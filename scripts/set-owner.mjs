#!/usr/bin/env node
// set-owner.mjs --github <user> [--name "Display Name"] [--url https://...] [--dry-run]: replace the YOUR-GITHUB-USER
// and YOUR-NAME placeholders before the first push. It edits every text file except scripts/, tests/ and .git/, and the
// same edit lands on a file and its synced copies. A placeholder written alone in backticks is a mention and stays.
import { readdirSync, readFileSync, writeFileSync, realpathSync } from "node:fs";
import { basename, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

export const ROOT = fileURLToPath(new URL("..", import.meta.url));
export const USER_SLOT = "YOUR-GITHUB-USER";
export const NAME_SLOT = "YOUR-NAME";
export const GITHUB_USER = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;
export const DISPLAY_NAME = /^[\p{L}\p{N}](?:[\p{L}\p{N} .'-]{0,78}[\p{L}\p{N}.])?$/u;
const SKIP_DIRS = new Set([".git", "node_modules", "scripts", "tests"]);
const TEXT_EXT = new Set([".md", ".json", ".yaml", ".yml", ".txt", ".mjs", ".js", ".css", ".html", ".svg", ".toml"]);
const TEXT_NAMES = new Set(["LICENSE", "CODEOWNERS", "NOTICE"]);
const USAGE = `Usage: node scripts/set-owner.mjs --github <user> [--name "Display Name"] [--url https://...] [--dry-run]

Replaces the placeholders in manifests, README.md, docs, SKILL.md files, CHANGELOG.md, SECURITY.md,
CONTRIBUTING.md, LICENSE, .github/ and every other text file outside scripts/ and tests/:
  https://github.com/${USER_SLOT}/...  ->  https://github.com/<user>/...
  https://github.com/${USER_SLOT}      ->  --url (default https://github.com/<user>)
  ${USER_SLOT}                         ->  <user>
  ${NAME_SLOT}                                ->  --name (default <user>)
A placeholder alone in backticks, such as \`${NAME_SLOT}\`, names the placeholder and stays.

  --github <user>   GitHub user or organization that owns the repo (required)
  --name <text>     Display name for author fields and the license (letters, digits, spaces, . ' -)
  --url <https>     Profile URL for author.url and owner.url
  --dry-run         List the files that change and write nothing

Exit codes: 0 done, 2 usage error.`;

const posix = (p) => p.split(sep).join("/");
const free = (slot) => `(?<!\`)${slot}|${slot}(?!\`)`;

// Text files the owner may appear in, sorted, as repo-relative forward-slash paths.
export function ownerFiles(root = ROOT, dir = root, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory()) { if (!(dir === root && SKIP_DIRS.has(e.name)) && e.name !== ".git" && e.name !== "node_modules") ownerFiles(root, p, out); }
    else if (TEXT_EXT.has(extname(e.name).toLowerCase()) || TEXT_NAMES.has(basename(e.name))) out.push(posix(relative(root, p)));
  }
  return out.sort();
}

// Check the options; returns the normalized { github, name, url } or throws with a reason.
export function ownerOptions({ github, name, url } = {}) {
  if (!github) throw new Error("--github <user> is required");
  if (!GITHUB_USER.test(github)) throw new Error(`"${github}" is not a GitHub user name: use 1-39 letters, digits or single hyphens, with no hyphen at the start or end`);
  name ??= github;
  if (!DISPLAY_NAME.test(name)) throw new Error(`"${name}" cannot be a display name here: use letters, digits, spaces, . ' - (max 80), starting with a letter or digit`);
  if (/^[\d.+-]+$/.test(name) || /^(true|false|yes|no|on|off|null|y|n)$/i.test(name)) throw new Error(`"${name}" reads as a number or a boolean in YAML: add a word`);
  url ??= `https://github.com/${github}`;
  let u;
  try { u = new URL(url); } catch { throw new Error(`"${url}" is not a URL`); }
  if (u.protocol !== "https:" || /[\s"'<>`\\]/.test(url)) throw new Error(`"${url}" must be an https:// URL with no spaces or quotes`);
  return { github, name, url };
}

// Replace the placeholders in one text. Returns { text, count, mentions }.
export function replaceOwner(text, { github, name, url }) {
  let count = 0;
  const sub = (re, to) => { text = text.replace(re, () => { count++; return to; }); };
  sub(new RegExp(`https://github\\.com/${USER_SLOT}/`, "g"), `https://github.com/${github}/`);
  sub(new RegExp(`https://github\\.com/${USER_SLOT}(?![\\w/-])`, "g"), url);
  sub(new RegExp(free(USER_SLOT), "g"), github);
  sub(new RegExp(free(NAME_SLOT), "g"), name);
  const mentions = (text.match(new RegExp(`\`(?:${USER_SLOT}|${NAME_SLOT})\``, "g")) ?? []).length;
  return { text, count, mentions };
}

// Apply to the repo. Returns { changes: [{ file, count }], mentions }; writes nothing on dryRun.
export function setOwner({ root = ROOT, dryRun = false, ...opts } = {}) {
  const o = ownerOptions(opts);
  const out = { changes: [], mentions: 0 };
  for (const rel of ownerFiles(root)) {
    const file = join(root, rel);
    const before = readFileSync(file, "utf8");
    if (!before.includes(USER_SLOT) && !before.includes(NAME_SLOT)) continue;
    const r = replaceOwner(before, o);
    out.mentions += r.mentions;
    if (!r.count) continue;
    out.changes.push({ file: rel, count: r.count });
    if (!dryRun) writeFileSync(file, r.text);
  }
  return out;
}

function main() {
  let opts;
  try {
    opts = parseArgs({ options: { github: { type: "string" }, name: { type: "string" }, url: { type: "string" },
      "dry-run": { type: "boolean" }, help: { type: "boolean", short: "h" } }, strict: true }).values;
  } catch (e) { console.error(`${e.message}\n\n${USAGE}`); process.exit(2); }
  if (opts.help) { console.log(USAGE); return; }
  let r;
  try { r = setOwner({ github: opts.github, name: opts.name, url: opts.url, dryRun: opts["dry-run"] }); }
  catch (e) { console.error(`set-owner: ${e.message}\n\n${USAGE}`); process.exit(2); }
  const o = ownerOptions(opts);
  console.log(`owner: ${o.github}, name: ${o.name}, url: ${o.url}${opts["dry-run"] ? " (dry run: nothing written)" : ""}`);
  if (!r.changes.length) console.log("no placeholders found: nothing to change");
  for (const c of r.changes) console.log(`  ${c.file}  (${c.count})`);
  if (r.mentions) console.log(`kept ${r.mentions} placeholder mention(s) in backticks`);
  if (r.changes.length && !opts["dry-run"]) console.log("Next: node scripts/sync-engine.mjs --check");
}

// Run when called as a script, also through a symbolic link or a junction: Node gives import.meta.url the real path,
// so both sides are compared as real paths (case-insensitive only where the file system is).
const invoked = (() => {
  if (!process.argv[1]) return false;
  let a = resolve(process.argv[1]), b = fileURLToPath(import.meta.url);
  try { a = realpathSync(a); b = realpathSync(b); } catch { /* compare as given */ }
  return process.platform === "win32" || process.platform === "darwin" ? a.toLowerCase() === b.toLowerCase() : a === b;
})();
if (invoked) main();
