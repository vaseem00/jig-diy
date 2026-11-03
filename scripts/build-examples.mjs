#!/usr/bin/env node
// build-examples.mjs: rebuild every examples/<id>/project.json into its guide page and its Artifact page with
// engine/jig.mjs (a child node process, --strict), then report counts, outputs and sizes. Exit 1 if a build fails.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync, realpathSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

export const ROOT = fileURLToPath(new URL("..", import.meta.url));
export const VARIANTS = [{ name: "page", args: [] }, { name: "artifact", args: ["--artifact"] }];
const USAGE = `Usage: node scripts/build-examples.mjs [id ...]

Builds examples/<id>/project.json twice with engine/jig.mjs: the guide page (<id>.html) and the
Artifact page (<id>-artifact.html), both next to the project and both with --strict.
With ids, only those examples are built. Run node scripts/sync-engine.mjs afterwards.

Exit codes: 0 all built, 1 a build failed, 2 usage error (unknown id, no engine).`;

const posix = (p) => p.split(sep).join("/");

// Example ids: folders under examples/ that hold a project.json, sorted.
export function exampleIds(root = ROOT) {
  const dir = join(root, "examples");
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(dir, e.name, "project.json"))).map((e) => e.name).sort();
}

// Build one example in every variant: [{ id, variant, ok, status, report, stderr }].
export function buildExample(id, { root = ROOT } = {}) {
  const jig = join(root, "engine", "jig.mjs");
  return VARIANTS.map((v) => {
    const r = spawnSync(process.execPath, [jig, "build", `examples/${id}/project.json`, ...v.args, "--strict", "--report", "json"],
      { cwd: root, encoding: "utf8", timeout: 120000 });
    let report = null;
    try { report = JSON.parse(r.stdout); } catch { /* not JSON: the raw output is shown */ }
    return { id, variant: v.name, ok: r.status === 0 && report?.ok !== false, status: r.status, report, stdout: r.stdout, stderr: r.stderr };
  });
}

// One report line: "page      ok    0 errors, 0 warnings, 0 STE  examples/x/x.html (74 KiB)".
function line(root, b) {
  const c = b.report?.counts;
  const counts = c ? `${c.error ?? 0} errors, ${c.warn ?? 0} warnings, ${c.ste ?? 0} STE` : `exit ${b.status ?? "timeout"}`;
  const outs = (b.report?.outputs ?? []).map((o) => {
    const abs = isAbsolute(o) ? o : resolve(root, o);
    return `${posix(relative(root, abs))}${existsSync(abs) ? ` (${Math.ceil(statSync(abs).size / 1024)} KiB)` : " (missing)"}`;
  });
  return `  ${b.variant.padEnd(9)} ${(b.ok ? "ok" : "FAIL").padEnd(5)} ${counts}${outs.length ? `  ${outs.join(", ")}` : ""}`;
}

function main() {
  let parsed;
  try { parsed = parseArgs({ options: { help: { type: "boolean", short: "h" } }, allowPositionals: true, strict: true }); }
  catch (e) { console.error(`${e.message}\n\n${USAGE}`); process.exit(2); }
  if (parsed.values.help) { console.log(USAGE); return; }
  if (!existsSync(join(ROOT, "engine", "jig.mjs"))) { console.error("build-examples: engine/jig.mjs not found"); process.exit(2); }
  const all = exampleIds();
  const ids = parsed.positionals.length ? parsed.positionals : all;
  const unknown = ids.filter((id) => !all.includes(id));
  if (unknown.length) { console.error(`build-examples: unknown example(s): ${unknown.join(", ")}. Known: ${all.join(", ") || "none"}`); process.exit(2); }
  if (!ids.length) { console.log("build-examples: no examples/<id>/project.json found"); return; }
  let failed = 0;
  for (const id of ids) {
    console.log(id);
    for (const b of buildExample(id)) {
      console.log(line(ROOT, b));
      if (b.ok) continue;
      failed++;
      for (const p of b.report?.problems ?? []) if (p.level === "error" || p.level === "ste") console.log(`      ${p.code} ${p.where}: ${p.msg}`);
      const raw = (b.report ? "" : b.stdout) + (b.stderr ?? "");
      if (raw.trim()) console.log(raw.trim().split("\n").slice(0, 20).map((l) => `      ${l}`).join("\n"));
    }
  }
  console.log(failed ? `\n${failed} build(s) failed.` : `\nbuilt ${ids.length} example(s). Next: node scripts/sync-engine.mjs`);
  if (failed) process.exit(1);
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
