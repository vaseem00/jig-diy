#!/usr/bin/env node
// check-repo.mjs: the repo layout rules of contract section 2 and the directory portal's file rules. It reports every
// problem as "rule  path  message" and exits 1 when there is one. Paths that .gitignore ignores are not checked.
import { existsSync, lstatSync, openSync, readFileSync, readSync, closeSync, readdirSync, realpathSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

export const ROOT = fileURLToPath(new URL("..", import.meta.url));
export const MAX_FILES = 512;
export const MAX_BYTES = 256 * 1024;
const MEDIA = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".svg", ".bmp", ".woff", ".woff2", ".ttf", ".otf"]);
const JUNK = new Set([".ds_store", "thumbs.db", "desktop.ini"]);
const LOCKS = new Set(["package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "pnpm-lock.yaml", "bun.lock", "bun.lockb", "deno.lock"]);
const WIN_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;
const USAGE = `Usage: node scripts/check-repo.mjs [--json]

Checks the repo layout: SKILL.md only at skills/<name>/SKILL.md, no top-level bin/, no symlinks, no
metadata.json in skills/, every non-image file under 256 KiB, at most 512 files, no .DS_Store,
Thumbs.db or lockfile, safe file names, and forward-slash relative paths in Markdown links.

  --json   Print the problems as JSON

Exit codes: 0 no problems, 1 problems, 2 usage error.`;

// .gitignore patterns as tests (rel, isDir) -> bool. Supports *, ?, **, a leading or inner "/" and a trailing "/".
export function ignoreRules(root) {
  const file = join(root, ".gitignore");
  if (!existsSync(file)) return () => false;
  const rules = readFileSync(file, "utf8").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && !l.startsWith("!")).map((g) => {
    const dirOnly = g.endsWith("/");
    g = g.replace(/\/+$/, "").replace(/^\*\*\//, "");
    const anchored = g.includes("/");
    const body = g.replace(/^\//, "").split("**").map((p) => p.split("*").map((q) => q.split("?").map((s) => s.replace(/[.+^${}()|[\]\\]/g, "\\$&")).join("[^/]")).join("[^/]*")).join(".*");
    return { re: new RegExp(anchored ? `^${body}$` : `(^|/)${body}$`), dirOnly };
  });
  return (rel, isDir) => rules.some((r) => (!r.dirOnly || isDir) && r.re.test(rel));
}

// Every entry under root except .git and ignored paths: [{ rel, name, dir, link, size }].
export function walk(root, ignored = ignoreRules(root), dir = "", out = []) {
  for (const e of readdirSync(join(root, dir), { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (rel === ".git" || ignored(rel, e.isDirectory())) continue;
    const link = e.isSymbolicLink();
    const entry = { rel, name: e.name, dir: e.isDirectory(), link, size: link || e.isDirectory() ? 0 : lstatSync(join(root, rel)).size };
    out.push(entry);
    if (entry.dir && !link) walk(root, ignored, rel, out);
  }
  return out;
}

// Link targets in Markdown outside code: inline links, images, reference definitions, and href/src attributes.
export function mdLinks(text) {
  const out = [];
  let fence = null;
  text.split(/\r?\n/).forEach((raw, i) => {
    const f = /^\s{0,3}(`{3,}|~{3,})/.exec(raw);
    if (f) { if (!fence) fence = f[1][0]; else if (f[1][0] === fence) fence = null; return; }
    if (fence) return;
    const line = raw.replace(/(`+)[\s\S]*?\1/g, "");
    for (const m of line.matchAll(/!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+["'(][^)]*)?\)/g)) out.push({ target: m[1], line: i + 1 });
    for (const m of line.matchAll(/^\s{0,3}\[[^\]]+\]:\s*<?(\S+?)>?(?:\s|$)/g)) out.push({ target: m[1], line: i + 1 });
    for (const m of line.matchAll(/\b(?:href|src)\s*=\s*["']([^"']+)["']/g)) out.push({ target: m[1], line: i + 1 });
  });
  return out;
}

// True for a link that leaves the repo: a URL scheme, a protocol-relative URL or an in-page anchor.
export const isExternal = (t) => /^(?:[a-z][a-z0-9+.-]*:(?!\\)|\/\/|#)/i.test(t) && !/^[a-z]:[\\/]/i.test(t) && !/^file:/i.test(t);

// Read the first bytes of a file, to spot a Git LFS pointer.
function head(file, n = 64) {
  const fd = openSync(file, "r");
  try { const b = Buffer.alloc(n); return b.subarray(0, readSync(fd, b, 0, n, 0)).toString("latin1"); } finally { closeSync(fd); }
}

// All problems: [{ rule, path, msg }], in walk order.
export function checkRepo(root = ROOT) {
  const entries = walk(root);
  const files = entries.filter((e) => !e.dir);
  const problems = [];
  const add = (rule, path, msg) => problems.push({ rule, path, msg });
  const byDir = new Map();
  for (const e of entries) {
    const lower = e.name.toLowerCase();
    const parent = e.rel.includes("/") ? e.rel.slice(0, e.rel.lastIndexOf("/")) : "";
    const seen = byDir.get(parent) ?? new Map();
    byDir.set(parent, seen);
    if (seen.has(lower)) add("name-case", e.rel, `differs from ${seen.get(lower)} only by case`);
    else seen.set(lower, e.rel);
    if (e.link) add("symlink", e.rel, "symlinks are not allowed; commit a real file");
    if (/[<>:"|?*\x00-\x1f\\]/.test(e.name) || /[. ]$/.test(e.name) || WIN_RESERVED.test(e.name)) add("file-name", e.rel, "this name is not safe on Windows");
    if (JUNK.has(lower) || lower.startsWith("._") || (e.dir && e.name === "__MACOSX")) add("junk", e.rel, "operating system junk file; delete it");
    if (e.dir && e.rel === "bin") add("bin", e.rel, "no top-level bin/: claude.ai and Cowork refuse the plugin; use scripts/");
  }
  for (const f of files) {
    const lower = f.name.toLowerCase();
    if (lower === "skill.md" && !/^skills\/[^/]+\/SKILL\.md$/.test(f.rel)) add("skill-md", f.rel, "a SKILL.md may exist only at skills/<name>/SKILL.md");
    if (f.rel.startsWith("skills/") && lower === "metadata.json") add("metadata-json", f.rel, "skill installers drop files named metadata.json; rename it");
    if (LOCKS.has(lower)) add("lockfile", f.rel, "no lockfile: the pack has no npm dependencies");
    if (f.name === ".gitmodules") add("submodule", f.rel, "no git submodules: installers do not fetch them");
    if (f.link) continue;
    if (f.size > MAX_BYTES && !MEDIA.has(extname(lower))) add("size", f.rel, `${Math.ceil(f.size / 1024)} KiB; every non-image file must be under 256 KiB`);
    if (f.size < 1024 && head(join(root, f.rel)).startsWith("version https://git-lfs")) add("lfs", f.rel, "a Git LFS pointer; commit the real file");
    if (f.name === ".gitattributes" && /\b(export-ignore|filter=)/.test(readFileSync(join(root, f.rel), "utf8"))) add("gitattributes", f.rel, "no export-ignore or filter attributes: the directory scan refuses them");
    if (extname(lower) === ".md") {
      for (const { target, line } of mdLinks(readFileSync(join(root, f.rel), "utf8"))) {
        if (isExternal(target)) continue;
        if (target.includes("\\")) add("md-link", `${f.rel}:${line}`, `use forward slashes: ${target}`);
        else if (/^(?:\/|[a-z]:|file:)/i.test(target)) add("md-link", `${f.rel}:${line}`, `use a relative path: ${target}`);
      }
    }
  }
  if (files.length > MAX_FILES) add("count", ".", `${files.length} files; the plugin may hold at most ${MAX_FILES}`);
  return problems;
}

function main() {
  let opts;
  try { opts = parseArgs({ options: { json: { type: "boolean" }, help: { type: "boolean", short: "h" } }, strict: true }).values; }
  catch (e) { console.error(`${e.message}\n\n${USAGE}`); process.exit(2); }
  if (opts.help) { console.log(USAGE); return; }
  const problems = checkRepo();
  const count = walk(ROOT).filter((e) => !e.dir).length;
  if (opts.json) console.log(JSON.stringify({ ok: !problems.length, files: count, problems }, null, 2));
  else {
    const w = Math.max(0, ...problems.map((p) => p.rule.length));
    for (const p of problems) console.log(`${p.rule.padEnd(w)}  ${p.path}  ${p.msg}`);
    console.log(`check-repo: ${count} files, ${problems.length} problem(s)`);
  }
  if (problems.length) process.exit(1);
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
