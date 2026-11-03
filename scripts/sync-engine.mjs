#!/usr/bin/env node
// sync-engine.mjs: copy the canonical engine/ into every skills/<name>/engine/ (exact mirror), LICENSE to
// skills/<name>/LICENSE.txt, assets/icon.svg to skills/<name>/assets/icon.svg, and examples/<id>/project.json to
// skills/{jig,jig-3d}/examples/<id>.json. --check lists every drifted file, writes nothing and exits 1 on drift.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, realpathSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

export const ROOT = fileURLToPath(new URL("..", import.meta.url));
export const EXAMPLE_SKILLS = ["jig", "jig-3d"];
const JUNK = new Set([".DS_Store", "Thumbs.db", "desktop.ini"]);
const USAGE = `Usage: node scripts/sync-engine.mjs [--check] [--quiet]

Copies engine/ into skills/<name>/engine/ (stale files are deleted), LICENSE to skills/<name>/LICENSE.txt,
assets/icon.svg to skills/<name>/assets/icon.svg, and examples/<id>/project.json to
skills/jig/examples/<id>.json and skills/jig-3d/examples/<id>.json. No other skill file is touched.

  --check   List every drifted file and write nothing. Exit 1 on drift (for CI).
  --quiet   Print only drift and problems.

Exit codes: 0 in sync or synced, 1 drift (--check), 2 usage error.`;

const posix = (p) => p.split(sep).join("/");
const dirs = (dir) => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort() : []);

// Every file under dir, as sorted forward-slash paths relative to dir. A symlink is an error: copies must be real files.
export function listFiles(dir, base = dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isSymbolicLink()) throw new Error(`symlink not allowed: ${posix(relative(base, p))}`);
    if (e.isDirectory()) listFiles(p, base, out);
    else if (!JUNK.has(e.name)) out.push(posix(relative(base, p)));
  }
  return out.sort();
}

// What the skill folders must hold: want (target -> source, repo-relative) and the folders that must hold nothing else.
export function planSync(root = ROOT) {
  const want = new Map(), mirrors = [], notes = [];
  const skills = dirs(join(root, "skills"));
  const engine = listFiles(join(root, "engine"));
  const has = (rel) => existsSync(join(root, rel));
  const examples = dirs(join(root, "examples")).filter((id) => has(`examples/${id}/project.json`));
  if (!skills.length) notes.push("skills/ has no skill folders");
  if (!engine.length) notes.push("engine/ has no files: engine copies left as they are");
  if (!has("LICENSE")) notes.push("LICENSE not found: LICENSE.txt copies left as they are");
  if (!has("assets/icon.svg")) notes.push("assets/icon.svg not found: icon copies left as they are");
  if (!examples.length) notes.push("examples/ has no <id>/project.json: example copies left as they are");
  for (const s of skills) {
    if (engine.length) {
      mirrors.push(`skills/${s}/engine`);
      for (const f of engine) want.set(`skills/${s}/engine/${f}`, `engine/${f}`);
    }
    if (has("LICENSE")) want.set(`skills/${s}/LICENSE.txt`, "LICENSE");
    if (has("assets/icon.svg")) want.set(`skills/${s}/assets/icon.svg`, "assets/icon.svg");
    if (examples.length && EXAMPLE_SKILLS.includes(s)) {
      mirrors.push(`skills/${s}/examples`);
      for (const id of examples) want.set(`skills/${s}/examples/${id}.json`, `examples/${id}/project.json`);
    }
  }
  return { want, mirrors, notes, skills };
}

// Compare the plan with the disk: [{ path, kind: "missing" | "differs" | "stale", source? }], sorted by path.
export function findDrift(root, { want, mirrors }) {
  const drift = [];
  for (const [dst, src] of want) {
    const file = join(root, dst);
    if (!existsSync(file)) drift.push({ path: dst, kind: "missing", source: src });
    else if (!readFileSync(file).equals(readFileSync(join(root, src)))) drift.push({ path: dst, kind: "differs", source: src });
  }
  for (const m of mirrors) for (const f of listFiles(join(root, m))) if (!want.has(`${m}/${f}`)) drift.push({ path: `${m}/${f}`, kind: "stale" });
  return drift.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

// Delete empty folders under dir, deepest first; dir itself stays.
function pruneEmpty(dir) {
  if (!existsSync(dir)) return;
  for (const d of dirs(dir)) {
    pruneEmpty(join(dir, d));
    if (!readdirSync(join(dir, d)).length) rmSync(join(dir, d), { recursive: true });
  }
}

// Run the sync. With check: true nothing is written. Returns { drift, notes, total }.
export function syncEngine({ root = ROOT, check = false } = {}) {
  const plan = planSync(root);
  const drift = findDrift(root, plan);
  if (!check) {
    for (const d of drift) {
      const file = join(root, d.path);
      if (d.kind === "stale") rmSync(file);
      else { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, readFileSync(join(root, d.source))); }
    }
    for (const m of plan.mirrors) pruneEmpty(join(root, m));
  }
  return { drift, notes: plan.notes, total: plan.want.size, skills: plan.skills };
}

function main() {
  let opts;
  try { opts = parseArgs({ options: { check: { type: "boolean" }, quiet: { type: "boolean", short: "q" }, help: { type: "boolean", short: "h" } }, strict: true }).values; }
  catch (e) { console.error(`${e.message}\n\n${USAGE}`); process.exit(2); }
  if (opts.help) { console.log(USAGE); return; }
  let r;
  try { r = syncEngine({ check: opts.check }); }
  catch (e) { console.error(`sync-engine: ${e.message}`); process.exit(1); }
  for (const n of r.notes) console.error(`note: ${n}`);
  if (opts.check) {
    for (const d of r.drift) console.log(`drift: ${d.path} (${d.kind})`);
    if (r.drift.length) {
      console.log(`\n${r.drift.length} file(s) drifted. Run: node scripts/sync-engine.mjs`);
      process.exit(1);
    }
    if (!opts.quiet) console.log(`in sync: ${r.total} file(s) in ${r.skills.length} skill(s)`);
    return;
  }
  if (!opts.quiet) for (const d of r.drift) console.log(`${d.kind === "stale" ? "deleted" : "wrote  "} ${d.path}`);
  if (!opts.quiet) console.log(`synced: ${r.drift.filter((d) => d.kind !== "stale").length} written, ${r.drift.filter((d) => d.kind === "stale").length} deleted, ${r.total} file(s) in ${r.skills.length} skill(s)`);
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
