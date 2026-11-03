#!/usr/bin/env node
// bump-version.mjs <x.y.z> [--date YYYY-MM-DD] [--dry-run]: set the one pack version everywhere (contract section 10):
// every skills/*/SKILL.md metadata.version, .claude-plugin/plugin.json, plugin.json, gemini-extension.json,
// engine/lib/version.mjs ENGINE_VERSION, and a "## [x.y.z] - date" heading under "## [Unreleased]" in CHANGELOG.md.
import { existsSync, readdirSync, readFileSync, writeFileSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import { isDeepStrictEqual, parseArgs } from "node:util";
import { fileURLToPath } from "node:url";

export const ROOT = fileURLToPath(new URL("..", import.meta.url));
export const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
export const MANIFESTS = [".claude-plugin/plugin.json", "plugin.json", "gemini-extension.json"];
const USAGE = `Usage: node scripts/bump-version.mjs <x.y.z> [--date YYYY-MM-DD] [--dry-run]

Sets the version in every skills/*/SKILL.md (metadata.version), .claude-plugin/plugin.json, plugin.json,
gemini-extension.json and engine/lib/version.mjs, and adds "## [x.y.z] - <date>" under "## [Unreleased]"
in CHANGELOG.md. The version is semver without a "v" (1.2.0, 1.2.0-rc.1).

  --date YYYY-MM-DD   Release date for CHANGELOG.md (default: today)
  --dry-run           List the changes and write nothing

Exit codes: 0 done, 1 a file could not be updated, 2 usage error.`;

const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const eolOf = (text) => (text.includes("\r\n") ? "\r\n" : "\n");

// A real calendar date in YYYY-MM-DD form.
export function isDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? "");
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// -1, 0 or 1 by major.minor.patch, then a release above its pre-releases (pre-release order compared as text).
export function compareVersions(a, b) {
  const pa = SEMVER.exec(a), pb = SEMVER.exec(b);
  for (let i = 1; i <= 3; i++) if (+pa[i] !== +pb[i]) return +pa[i] < +pb[i] ? -1 : 1;
  if (!pa[4] !== !pb[4]) return pa[4] ? -1 : 1;
  return pa[4] === pb[4] ? 0 : pa[4] < pb[4] ? -1 : 1;
}

// SKILL.md: the "version:" line inside the frontmatter "metadata:" block. Returns { text, from } or { error }.
export function setSkillVersion(text, version) {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!fm) return { error: "no frontmatter" };
  const lines = fm[1].split("\n");
  const start = lines.findIndex((l) => /^metadata:\s*$/.test(l));
  if (start < 0) return { error: "no metadata block in the frontmatter" };
  for (let i = start + 1; i < lines.length && /^(\s|$)/.test(lines[i]); i++) {
    const m = /^(\s+)version:\s*(.*?)(\r?)$/.exec(lines[i]);
    if (!m) continue;
    lines[i] = `${m[1]}version: "${version}"${m[3]}`;
    const from = m[2].replace(/\s+#.*$/, "").replace(/^(["'])(.*)\1$/, "$2");
    const offset = fm.index + fm[0].indexOf(fm[1]);
    return { text: text.slice(0, offset) + lines.join("\n") + text.slice(offset + fm[1].length), from };
  }
  return { error: "no metadata.version line" };
}

// A JSON manifest: change only the top-level "version" value and keep the formatting. Returns { text, from } or { error }.
export function setJsonVersion(text, version) {
  let obj;
  try { obj = JSON.parse(text); } catch (e) { return { error: `bad JSON: ${e.message}` }; }
  if (typeof obj?.version !== "string") return { error: "no top-level version string" };
  const want = { ...obj, version };
  const re = new RegExp(`("version"\\s*:\\s*)"${reEsc(JSON.stringify(obj.version).slice(1, -1))}"`, "g");
  for (const m of text.matchAll(re)) {
    const next = text.slice(0, m.index) + `${m[1]}${JSON.stringify(version)}` + text.slice(m.index + m[0].length);
    try { if (isDeepStrictEqual(JSON.parse(next), want)) return { text: next, from: obj.version }; } catch { /* try the next match */ }
  }
  return { text: JSON.stringify(want, null, 2) + "\n", from: obj.version };
}

// engine/lib/version.mjs: export const ENGINE_VERSION = "x.y.z".
export function setEngineVersion(text, version) {
  const re = /(export const ENGINE_VERSION\s*=\s*)(["'])([^"']*)\2/;
  const m = re.exec(text);
  if (!m) return { error: "no ENGINE_VERSION export" };
  return { text: text.replace(re, `$1"${version}"`), from: m[3] };
}

// CHANGELOG.md: insert "## [x.y.z] - date" under "## [Unreleased]" (once) and move the compare links if they exist.
export function addChangelogEntry(text, version, date) {
  const eol = eolOf(text);
  const top = (t) => /^## \[(?!unreleased\])([^\]]+)\]/im.exec(t)?.[1] ?? null;
  if (new RegExp(`^## \\[${reEsc(version)}\\]`, "m").test(text)) return { text, from: top(text) };
  const head = /^## \[Unreleased\][^\r\n]*\r?\n/im.exec(text);
  if (!head) return { error: 'no "## [Unreleased]" heading' };
  const prev = top(text);
  const at = head.index + head[0].length;
  let out = `${text.slice(0, at)}${eol}## [${version}] - ${date}${eol}${text.slice(at)}`;
  const link = /^\[Unreleased\]:[ \t]*(\S+?)\/compare\/(v?)(\S+?)\.\.\.HEAD[ \t]*$/im.exec(out);
  if (link && !new RegExp(`^\\[${reEsc(version)}\\]:`, "m").test(out)) {
    const [all, base, v, from] = link;
    const lines = `[Unreleased]: ${base}/compare/${v}${version}...HEAD${eol}[${version}]: ${base}/compare/${v}${from}...${v}${version}`;
    out = out.slice(0, link.index) + lines + out.slice(link.index + all.length);
  }
  return { text: out, from: prev };
}

// Every version location, as [repo-relative path, updater].
export function locations(root = ROOT) {
  const skills = existsSync(join(root, "skills"))
    ? readdirSync(join(root, "skills"), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort() : [];
  return [
    ...skills.map((s) => [`skills/${s}/SKILL.md`, setSkillVersion]),
    ...MANIFESTS.map((f) => [f, setJsonVersion]),
    ["engine/lib/version.mjs", setEngineVersion],
    ["CHANGELOG.md", "changelog"],
  ];
}

// Apply the bump. Returns { changes: [{ file, from, to }], unchanged, missing, problems }; writes nothing on dryRun.
export function bumpVersion({ root = ROOT, version, date = today(), dryRun = false } = {}) {
  if (!SEMVER.test(version ?? "")) throw new Error(`"${version}" is not a semver version such as 1.2.0`);
  if (!isDate(date)) throw new Error(`"${date}" is not a date in YYYY-MM-DD form`);
  const out = { changes: [], unchanged: [], missing: [], problems: [] };
  for (const [rel, fn] of locations(root)) {
    const file = join(root, rel);
    if (!existsSync(file)) { out.missing.push(rel); continue; }
    const before = readFileSync(file, "utf8");
    const r = fn === "changelog" ? addChangelogEntry(before, version, date) : fn(before, version);
    if (r.error) { out.problems.push(`${rel}: ${r.error}`); continue; }
    if (r.text === before) { out.unchanged.push(rel); continue; }
    out.changes.push({ file: rel, from: r.from, to: fn === "changelog" ? `## [${version}] - ${date}` : version });
    if (!dryRun) writeFileSync(file, r.text);
  }
  const mkt = join(root, ".claude-plugin", "marketplace.json");
  if (existsSync(mkt)) {
    try { if (JSON.parse(readFileSync(mkt, "utf8")).plugins?.some((p) => "version" in p)) out.problems.push(".claude-plugin/marketplace.json: remove \"version\" from the plugin entry (plugin.json sets it)"); }
    catch (e) { out.problems.push(`.claude-plugin/marketplace.json: bad JSON: ${e.message}`); }
  }
  return out;
}

function main() {
  let parsed;
  try { parsed = parseArgs({ options: { date: { type: "string" }, "dry-run": { type: "boolean" }, help: { type: "boolean", short: "h" } }, allowPositionals: true, strict: true }); }
  catch (e) { console.error(`${e.message}\n\n${USAGE}`); process.exit(2); }
  const { values: o, positionals: pos } = parsed;
  if (o.help) { console.log(USAGE); return; }
  if (pos.length !== 1) { console.error(`bump-version: give exactly one version\n\n${USAGE}`); process.exit(2); }
  const version = pos[0];
  if (/^v\d/.test(version)) { console.error(`bump-version: write the version without "v": ${version.slice(1)}`); process.exit(2); }
  let r;
  try { r = bumpVersion({ version, date: o.date ?? today(), dryRun: o["dry-run"] }); }
  catch (e) { console.error(`bump-version: ${e.message}`); process.exit(2); }
  const current = r.changes.find((c) => c.file !== "CHANGELOG.md" && SEMVER.test(c.from ?? ""))?.from;
  console.log(`bump to ${version}${o["dry-run"] ? " (dry run: nothing written)" : ""}`);
  if (current && compareVersions(version, current) <= 0) console.log(`note: ${version} is not above the current ${current}`);
  const w = Math.max(0, ...r.changes.map((c) => c.file.length), ...r.unchanged.map((f) => f.length));
  for (const c of r.changes) console.log(`  ${c.file.padEnd(w)}  ${c.file === "CHANGELOG.md" ? `add ${c.to}` : `${c.from} -> ${c.to}`}`);
  for (const f of r.unchanged) console.log(`  ${f.padEnd(w)}  already ${version}`);
  for (const f of r.missing) console.error(`note: ${f} not found, skipped`);
  for (const p of r.problems) console.error(`problem: ${p}`);
  if (r.problems.length) process.exit(1);
  if (r.changes.length && !o["dry-run"]) console.log(NEXT_STEPS);
}

// After a bump: the example pages carry the version (meta generator, model JSON), then the skill engine copies and
// examples carry version.mjs and the pages. In this order, or the golden and sync tests fail.
export const NEXT_STEPS = "Next: node scripts/build-examples.mjs, then node scripts/sync-engine.mjs (the example pages and the skill engine copies carry the version)";

// Run when called as a script, also through a symbolic link or a junction: Node gives import.meta.url the real path,
// so both sides are compared as real paths (case-insensitive only where the file system is).
const invoked = (() => {
  if (!process.argv[1]) return false;
  let a = resolve(process.argv[1]), b = fileURLToPath(import.meta.url);
  try { a = realpathSync(a); b = realpathSync(b); } catch { /* compare as given */ }
  return process.platform === "win32" || process.platform === "darwin" ? a.toLowerCase() === b.toLowerCase() : a === b;
})();
if (invoked) main();
