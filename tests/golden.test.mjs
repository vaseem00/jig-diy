// Golden tests: every examples/<id>/project.json builds with 0 errors, 0 warnings and 0 STE findings (--strict), and
// the guide page and the Artifact page match the committed <id>.html and <id>-artifact.html byte for byte.
// The builds run engine/jig.mjs in a temp folder. After an intended change: node scripts/build-examples.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const JIG = join(ROOT, "engine", "jig.mjs");
const EXAMPLES = join(ROOT, "examples");
const ids = existsSync(EXAMPLES) ? readdirSync(EXAMPLES).filter((d) => existsSync(join(EXAMPLES, d, "project.json"))).sort() : [];
const VARIANTS = [{ suffix: "", args: [] }, { suffix: "-artifact", args: ["--artifact"] }];
const FIX = "Rebuild the golden pages with: node scripts/build-examples.mjs";

// Build one variant into dir; returns the parsed JSON report and the page bytes.
function build(id, v, dir) {
  const out = join(dir, `${id}${v.suffix}.html`);
  const r = spawnSync(process.execPath, [JIG, "build", join(EXAMPLES, id, "project.json"), ...v.args, "--strict", "--out", out, "--report", "json"], { cwd: dir, encoding: "utf8", timeout: 120000 });
  let report = null;
  try { report = JSON.parse(r.stdout); } catch { /* reported below */ }
  assert.ok(report, `${id}${v.suffix}: no JSON report (exit ${r.status}): ${r.stderr}`);
  return { status: r.status, report, page: existsSync(out) ? readFileSync(out) : null };
}

// The first line where two texts differ, for a readable failure.
function firstDiff(a, b) {
  const x = a.split("\n"), y = b.split("\n"), i = x.findIndex((l, k) => l !== y[k]);
  const k = i < 0 ? Math.min(x.length, y.length) : i, cut = (s) => (s === undefined ? "(end)" : s.length > 160 ? `${s.slice(0, 160)}…` : s);
  return `line ${k + 1}:\n  built:     ${cut(x[k])}\n  committed: ${cut(y[k])}`;
}

test("there is at least one example", () => assert.ok(ids.length > 0, "no examples/<id>/project.json"));

for (const id of ids) {
  test(`${id}: 0 errors, 0 warnings, 0 STE, and the pages match the committed files byte for byte`, (t) => {
    const dir = mkdtempSync(join(tmpdir(), "jig-golden-"));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    for (const v of VARIANTS) {
      const name = `${id}${v.suffix}.html`, { status, report, page } = build(id, v, dir);
      const c = report.counts, found = report.problems.filter((p) => p.level !== "info").map((p) => `${p.code} ${p.where}: ${p.msg}`);
      assert.deepEqual([c.error, c.warn, c.ste], [0, 0, 0], `${name}: ${found.join("; ")}`);
      assert.equal(status, 0, `${name}: exit ${status}`);
      assert.equal(report.ok, true);
      assert.ok(page, `${name} was not written`);
      const golden = join(EXAMPLES, id, name);
      assert.ok(existsSync(golden), `examples/${id}/${name} is missing. ${FIX}`);
      const want = readFileSync(golden);
      if (!page.equals(want)) assert.fail(`examples/${id}/${name} differs from a fresh build at ${firstDiff(page.toString("utf8"), want.toString("utf8"))}\n${FIX}`);
      assert.ok(want.length < 256 * 1024, `examples/${id}/${name} is ${want.length} bytes, over 256 KiB`);
    }
  });

  test(`${id}: the pages are self-contained and hold no machine path`, () => {
    for (const v of VARIANTS) {
      const name = `${id}${v.suffix}.html`, file = join(EXAMPLES, id, name);
      if (!existsSync(file)) continue; // the test above reports it
      const html = readFileSync(file, "utf8");
      assert.ok(!html.startsWith("﻿"), `${name}: BOM`);
      assert.ok(!/\r/.test(html), `${name}: CR line ends`);
      assert.ok(!/[A-Za-z]:\\|file:\/\/|\/(?:home|Users|tmp)\//.test(html), `${name}: a machine path`);
      assert.ok(html.includes('<script type="application/json" id="jig-data">'), `${name}: model data`);
      assert.ok(/"integrity":\{"https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.160\.0\//.test(html), `${name}: import map integrity`);
      assert.ok(!/data:text\/javascript;base64/.test(html), `${name}: an offline page is committed; build it with --offline only outside the repo`);
    }
    const extra = readdirSync(join(EXAMPLES, id)).filter((f) => /\.html?$/i.test(f) && !VARIANTS.some((v) => f === `${id}${v.suffix}.html`));
    assert.deepEqual(extra, [], `examples/${id} holds other pages (offline or 3D builds stay out of the repo)`);
    for (const f of readdirSync(join(EXAMPLES, id))) assert.ok(statSync(join(EXAMPLES, id, f)).size < 256 * 1024, `examples/${id}/${f} is over 256 KiB`);
  });
}

test("two builds of an example give the same bytes", (t) => {
  if (!ids.length) return;
  const id = ids[0], a = mkdtempSync(join(tmpdir(), "jig-det-a-")), b = mkdtempSync(join(tmpdir(), "jig-det-b-"));
  t.after(() => { rmSync(a, { recursive: true, force: true }); rmSync(b, { recursive: true, force: true }); });
  const x = build(id, VARIANTS[0], a).page, y = build(id, VARIANTS[0], b).page;
  assert.ok(x && y && x.equals(y), "the build depends on the folder, the clock or chance");
});
