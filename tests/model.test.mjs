// model.mjs: the model shape, the bookshelf and the inch bench build clean (pine at the optimised 55.96), what each
// mode needs, cut sizes (section, rip, round, sheet, perLength), installation, geometry, fasteners, unused and unpriced
// items, STE paths, problem order, paths into the raw input when validate drops items, and no throw on bad input.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compute } from "../engine/lib/model.mjs";
import { ENGINE_VERSION, FORMAT } from "../engine/lib/version.mjs";
import { cutMd } from "../engine/lib/markdown.mjs";
import { lint } from "../engine/lib/ste.mjs";

const load = (rel) => JSON.parse(readFileSync(new URL(rel, import.meta.url), "utf8"));
const shelf = () => load("../examples/pine-bookshelf/project.json");
const bench = () => load("./fixtures/inch-bench.json");
const hook = () => load("./fixtures/printed-hook.json");
const KEYS = ["engine", "format", "mode", "meta", "parts", "props", "materials", "steps", "tools", "techniques", "cuts", "boq", "purchase", "plan", "totals", "safety", "problems", "counts"];
const RANK = { error: 0, warn: 1, ste: 2, info: 3 };
const codes = (M, level) => M.problems.filter((p) => !level || p.level === level).map((p) => `${p.code} ${p.path}`);
const find = (M, code) => M.problems.filter((p) => p.code === code);
const has = (M, code, path, where) => {
  const hit = M.problems.find((p) => p.code === code && p.path === path);
  assert.ok(hit, `${code} ${path} not in: ${codes(M).join("; ")}`);
  if (where) assert.equal(hit.where, where);
  return hit;
};

test("shape: the keys of ARCHITECTURE.md 5.2 (plus materials) in every mode", () => {
  for (const mode of ["estimate", "plan", "guide"]) {
    const M = compute(shelf(), { mode });
    assert.deepEqual(Object.keys(M), KEYS, mode);
    assert.deepEqual([M.engine, M.format, M.mode], [ENGINE_VERSION, FORMAT, mode]);
    assert.deepEqual(Object.keys(M.meta), ["id", "title", "summary", "level", "units", "currency", "tax", "priceNote", "pricesAsOf", "estimate", "kerf", "trim"]);
    assert.deepEqual(Object.keys(M.parts[0]), ["id", "label", "name", "material", "materialName", "kind", "shape", "size", "at", "rotate", "color", "role", "cut", "step"]);
    assert.deepEqual(Object.keys(M.props.wall), ["size", "at", "color", "shape", "rotate", "hero", "label"]);
    assert.deepEqual(Object.keys(M.materials.glue), ["name", "kind", "spec", "unit", "color"]);
    assert.deepEqual(Object.keys(M.steps[3].fasteners[0]), ["material", "at", "dir", "len", "d", "head", "color", "count"]);
    assert.ok(["index", "minutes", "wait", "title", "do"].every((k) => k in M.steps[3]));
    assert.ok(M.tools.every((t) => "first" in t));
    assert.deepEqual(Object.keys(M.techniques["measure-mark"]), ["name", "why", "warn", "do", "tools"]);
    assert.deepEqual(M.cuts.map((c) => Object.keys(c)), [["material", "name", "kind", "color", "optimal", "search", "boards"], ["material", "name", "kind", "color", "sheets"]]);
    assert.deepEqual([M.cuts[0].optimal, M.cuts[0].search], [true, "exact"], "9 pieces: the exact search finishes");
    assert.deepEqual(Object.keys(M.purchase[0]), ["store", "name", "online", "lead", "note", "url", "orderBy", "items", "subtotal"]);
    assert.deepEqual(Object.keys(M.plan), ["phases", "active", "wait", "levels"]);
    assert.deepEqual(Object.keys(M.totals), ["subtotal", "contingencyRate", "contingency", "taxRate", "taxLabel", "taxIncluded", "tax", "total", "currency", "area", "areaDisplay", "unknownPrices"]);
    assert.ok(["tip", "ppe", "handoffs", "power"].every((k) => k in M.safety));
    assert.deepEqual(Object.keys(M.counts), ["error", "warn", "ste", "info"]);
    for (const p of M.problems) assert.deepEqual(Object.keys(p), ["level", "code", "path", "where", "msg", "hint"]);
  }
  assert.equal(compute(shelf(), { mode: "nonsense" }).mode, "guide");
});

test("bookshelf: 0 errors, 0 warnings, 0 STE in guide mode; pine is two 2440 boards for 55.96", () => {
  const M = compute(shelf());
  assert.deepEqual(M.counts, { error: 0, warn: 0, ste: 0, info: 1 }, codes(M).join("; "));
  has(M, "I_ESTIMATE", "estimate", "project");
  const pine = M.cuts.find((c) => c.material === "pine-1x10");
  assert.deepEqual(pine.boards.map((b) => [b.stock.length, b.cuts.map((c) => c.len)]), [[2440, [900, 762, 762]], [2440, [900, 762, 762]]]);
  assert.equal(Math.round(pine.boards.reduce((a, b) => a + b.stock.price, 0) * 100) / 100, 55.96);
  const ply = M.cuts.find((c) => c.material === "ply-6").sheets[0];
  assert.deepEqual([ply.stock, ply.usedArea, ply.waste], [{ w: 1220, h: 1220, price: 24 }, 0.72, 0.7684], "sheet areas in m²");
  const part = Object.fromEntries(M.parts.map((p) => [p.id, p]));
  assert.deepEqual(part.A1.cut, { length: 900, width: 235, thick: 19 });
  assert.deepEqual(part.C1.cut, { a: 900, b: 800, thick: 6 });
  assert.equal(part.D1.cut, null);
  assert.deepEqual(M.parts.map((p) => p.step), [3, 5, 3, 6, 6, 4, 7, 9, 9]);
  assert.deepEqual([part.D1.role, part.A1.role, part.A1.color, part.A1.materialName], ["anchor", null, "#d9b88a", "Pine board"]);
  assert.deepEqual(M.steps[3].fasteners[0], { material: "screw-4x50", at: [0, 69.5, 40], dir: [1, 0, 0], len: 50, d: 4, head: "flat", color: "#8f959c", count: 1 });
  assert.deepEqual(M.steps[3].fasteners.map((f) => f.at[2]), [40, 117.5, 195], "repeat expanded");
  assert.equal(M.steps[9].fasteners[0].len, 16, "a fastener len wins over the material len");
  assert.equal(M.steps.reduce((a, s) => a + s.fasteners.length, 0), 46);
  assert.deepEqual(Object.keys(M.techniques), ["measure-mark", "cut-straight", "sand", "pilot-hole", "countersink", "glue-joint", "clamp", "square-diagonals", "finish-wipe", "find-stud"]);
  assert.match(M.techniques["measure-mark"].why, /removes 3 mm of wood/);
  assert.deepEqual([M.safety.tip.anchored, M.safety.tip.ratio > M.safety.tip.limit], [true, true]);
  assert.deepEqual([M.totals.area, M.totals.areaDisplay], [3.977, "3.98 m²"]);
  assert.deepEqual(M.meta, { id: "pine-bookshelf", title: "Pine bookshelf", summary: M.meta.summary, level: "new", units: "mm", currency: "USD", tax: null,
    priceNote: M.meta.priceNote, pricesAsOf: "2026-11-02", estimate: true, kerf: 3, trim: 0 });
});

test("inch bench: builds clean; the model keeps mm; the kerf in the cards shows in inches", () => {
  const M = compute(bench());
  assert.deepEqual([M.counts.error, M.counts.warn, M.counts.ste], [0, 0, 0], codes(M).join("; "));
  assert.deepEqual([M.meta.units, M.meta.kerf], ["in", 3.175]);
  assert.deepEqual(M.parts[0].size, [38.1, 406.4, 88.9]);
  assert.deepEqual(M.parts[0].cut, { length: 406.4, width: 88.9, thick: 38.1 });
  assert.match(M.techniques["measure-mark"].why, /removes 1\/8 in of wood/);
  assert.deepEqual([M.totals.taxRate, M.totals.tax, M.totals.total, M.totals.areaDisplay], [0.08, 13.25, 178.92, "15.41 ft²"]);
});

test("deterministic, and the input stays unchanged", () => {
  assert.equal(JSON.stringify(compute(shelf(), { start: "2026-11-20" })), JSON.stringify(compute(shelf(), { start: "2026-11-20" })));
  const p = shelf(), copy = structuredClone(p);
  compute(p);
  assert.deepEqual(p, copy);
});

test("estimate mode: materials and parts only, no positions or steps needed", () => {
  const p = shelf();
  delete p.steps;
  delete p.props;
  for (const x of p.parts) delete x.at;
  const M = compute(p, { mode: "estimate" });
  assert.deepEqual(codes(M, "error"), []);
  assert.deepEqual(find(M, "W_UNUSED_MATERIAL").map((x) => x.path).sort(), ["materials.glue", "materials.kit-screw", "materials.poly", "materials.rags",
    "materials.sand-120", "materials.sand-180", "materials.sand-240", "materials.screw-3x16", "materials.screw-4x50"]);
  assert.equal(find(M, "W_UNUSED_TOOL").length, 0, "with no steps, no tool is unused");
  assert.deepEqual(M.boq.filter((r) => r.group === "Timber and sheet").map((r) => [r.key, r.first]), [["pine-1x10:2440", 0], ["ply-6:1220x1220", 0]]);
  assert.ok(M.boq.some((r) => r.key === "tool/square"), "tools are still bought");
  assert.equal(M.counts.ste, 0, "no STE lint in estimate mode");
  // plan and guide modes need steps
  for (const mode of ["plan", "guide"]) {
    const X = compute(p, { mode });
    has(X, "E_SCHEMA", "steps");
    assert.equal(find(X, "E_NOT_INSTALLED").length, 0, "no cascade when there are no steps");
  }
});

test("plan mode: steps and installation, no positions; guide mode needs positions", () => {
  const p = shelf();
  for (const x of p.parts) delete x.at;
  delete p.props.wall.at;
  const plan = compute(p, { mode: "plan" });
  assert.deepEqual(codes(plan, "error"), []);
  assert.deepEqual([plan.counts.warn, plan.counts.ste, plan.safety.tip], [0, 0, null]);
  const guide = compute(p, { mode: "guide" });
  has(guide, "E_SCHEMA", "parts[0].at", "part A1");
  has(guide, "E_SCHEMA", "props.wall.at");
  assert.equal(find(guide, "E_GEOMETRY").length + find(guide, "W_FLOATING").length, 0);
});

test("installation: E_NOT_INSTALLED and E_INSTALLED_TWICE in plan and guide modes, not in estimate", () => {
  const p = shelf();
  p.steps[9].parts = ["D1"];
  p.steps[4].parts.push("B1");
  for (const mode of ["plan", "guide"]) {
    const M = compute(p, { mode });
    has(M, "E_NOT_INSTALLED", "parts[8]", "part E1");
    const twice = has(M, "E_INSTALLED_TWICE", "steps[4].parts[1]", "step 5");
    assert.equal(twice.msg, "Step 4 and step 5 both install part B1.");
  }
  const E = compute(p, { mode: "estimate" });
  assert.equal(find(E, "E_NOT_INSTALLED").length + find(E, "E_INSTALLED_TWICE").length, 0);
  assert.equal(E.parts.find((x) => x.id === "E1").step, null);
});

test("cut sizes: section within 1.5 mm, rip, round stock, sheet thickness; E_SECTION with a fix", () => {
  const p = shelf();
  p.parts[2].size = [762, 25, 235]; // a nominal 25 mm board: one side does not match
  p.parts[3].size = [761, 20, 234]; // within 1.5 mm
  p.materials.dowel = { kind: "linear", name: "Beech dowel", profile: "round", section: [25, 25], stock: [{ length: 1000, price: 3.5 }] };
  p.parts.push(
    { id: "F1", label: "F", name: "Strip", material: "pine-1x10", size: [762, 19, 100], rip: true },
    { id: "G1", label: "G", name: "Wide", material: "pine-1x10", size: [762, 25, 100], rip: true },
    { id: "H1", label: "H", name: "Rod", material: "dowel", shape: "cylinder", size: [25, 600, 25] },
    { id: "J1", label: "J", name: "Peg", material: "dowel", shape: "cylinder", size: [30, 600, 30] },
    { id: "K1", label: "K", name: "Panel", material: "ply-6", size: [400, 9, 300] },
    { id: "L1", label: "L", name: "Narrow", material: "pine-1x10", size: [762, 19, 100] },
  );
  const M = compute(p, { mode: "estimate" }), part = Object.fromEntries(M.parts.map((x) => [x.id, x]));
  const sec = has(M, "E_SECTION", "parts[2].size", "part B1");
  assert.match(sec.msg, /762 x 25 x 235 mm.*235 x 19 mm section of "Pine board"/);
  assert.match(sec.hint, /"rip": true/);
  assert.deepEqual(part.B2.cut, { length: 761, width: 234, thick: 20 });
  assert.deepEqual(part.F1.cut, { length: 762, width: 100, thick: 19 });
  has(M, "E_SECTION", "parts[10].size", "part G1");
  assert.deepEqual(part.H1.cut, { length: 600, width: 25, thick: 25 });
  assert.match(has(M, "E_SECTION", "parts[12].size").msg, /round 25 mm section/);
  assert.match(has(M, "E_SECTION", "parts[13].size").msg, /No side is 6 mm/);
  has(M, "E_SECTION", "parts[14].size", "part L1");
  assert.deepEqual(M.problems.filter((x) => x.code === "E_SECTION").length, 5);
  assert.deepEqual(M.cuts.find((c) => c.material === "dowel").boards.map((b) => b.cuts.map((c) => c.id)), [["H1"]]);
  assert.ok(!M.cuts.flatMap((c) => c.boards ?? []).some((b) => b.cuts.some((c) => c.id === "B1")), "a bad part is not packed");
});

// A small estimate project with one linear material and the given parts.
const board = (material, parts, extra = {}) => ({ id: "t", title: "T", ...extra, materials: { m: { kind: "linear", name: "Board", ...material } },
  parts: parts.map((size, i) => ({ id: `P${i + 1}`, name: "Part", material: "m", size, ...(Array.isArray(size) ? {} : size) })) });

test("E_SECTION on a nominal section: one error on the section with the actual size, not one per part", () => {
  const p = board({ section: [4, 2], stock: [{ length: 96, price: 5 }] }, [[3.5, 30, 1.5], [3.5, 40, 1.5], [1.5, 3.5, 20]], { units: "in" });
  const M = compute(p, { mode: "estimate" }), sec = M.problems.filter((x) => x.code === "E_SECTION");
  assert.deepEqual(sec.map((x) => [x.path, x.where]), [["materials.m.section", "material m"]]);
  assert.match(sec[0].msg, /parts P1, P2 and P3 match the 4 x 2 in section of "Board"/);
  assert.match(sec[0].hint, /nominal/);
  assert.match(sec[0].hint, /A 2x4 is 3 1\/2 x 1 1\/2 in\. If the parts are right, set section to \[3\.5, 1\.5\]\./);
  assert.ok(!M.problems.some((x) => /Use the actual board size: one side 4 in/.test(x.hint)));
  // mm: every part the same 11-12 mm under the section.
  const q = board({ section: [100, 50], stock: [{ length: 2400, price: 5 }] }, [[89, 600, 38], [38, 89, 700]]);
  assert.match(compute(q, { mode: "estimate" }).problems.find((x) => x.code === "E_SECTION" && x.path === "materials.m.section")?.hint ?? "", /set section to \[89, 38\]/);
  // Some parts match: the section is right, so each wrong part gets its own error with a neutral hint.
  const r = board({ section: [3.5, 1.5], stock: [{ length: 96, price: 5 }] }, [[3.5, 30, 1.5], [4, 30, 2]], { units: "in" });
  const one = compute(r, { mode: "estimate" }).problems.filter((x) => x.code === "E_SECTION");
  assert.deepEqual(one.map((x) => x.path), ["parts[1].size"]);
  assert.match(one[0].hint, /^Make two sides of the part 3 1\/2 in and 1 1\/2 in, or correct the section if it is the nominal size\./);
  // An inch table size that no part has: the actual size would not fix the parts, so each part gets its own error.
  const sec4 = (section, parts) => compute(board({ section, stock: [{ length: 96, price: 5 }] }, parts, { units: "in" }), { mode: "estimate" }).problems.filter((x) => x.code === "E_SECTION");
  const p41 = sec4([4, 1], [[4, 30, 0.75], [4, 20, 0.75]]);
  assert.deepEqual(p41.map((x) => x.path), ["parts[0].size", "parts[1].size"]);
  assert.ok(!p41.some((x) => /\[3\.5, 0\.75\]/.test(x.hint)), p41.map((x) => x.hint).join(" | "));
  assert.ok(!sec4([2, 1], [[1, 30, 0.5]]).some((x) => /\[1\.5, 0\.75\]/.test(x.hint)));
  // A table size that one part has: one error on the section; the other parts get their errors after the change.
  const p62 = sec4([6, 2], [[5.5, 30, 1.5], [3.5, 20, 1.5]]);
  assert.deepEqual(p62.map((x) => x.path), ["materials.m.section"]);
  assert.match(p62[0].hint, /set section to \[5\.5, 1\.5\]/);
  assert.ok(!p62.some((x) => /6 in and 2 in/.test(x.hint)));
});

test("I_RIP_SHARE: rip strips that fit side by side across one board give an info, one strip does not", () => {
  const strips = (n) => Array.from({ length: n }, () => ({ size: [2000, 20, 20], rip: true }));
  const six = board({ section: [140, 20], stock: [{ length: 2400, price: 43.2 }] }, strips(6));
  six.parts.forEach((x) => { x.size = [2000, 20, 20]; });
  const M = compute(six, { mode: "estimate" }), info = M.problems.filter((x) => x.code === "I_RIP_SHARE");
  assert.deepEqual(info.map((x) => [x.level, x.path, x.where]), [["info", "materials.m", "material m"]]);
  assert.match(info[0].msg, /^Parts P1, P2, P3, P4, P5 and P6 are rip cuts\. .* Up to 6 strips fit side by side across one board\.$/);
  assert.match(info[0].hint, /^To buy fewer boards, rip 6 strips side by side from one board\. The plan then needs 1 board, not 6\. Make that cut plan by hand\.$/);
  for (const text of [info[0].msg, info[0].hint]) assert.deepEqual(lint(text, "description"), [], text);
  assert.equal(M.cuts[0].boards.length, 6, "the plan still packs by length");
  const single = board({ section: [140, 20], stock: [{ length: 2400, price: 43.2 }] }, strips(1));
  single.parts[0].size = [2000, 20, 20];
  assert.equal(compute(single, { mode: "estimate" }).problems.filter((x) => x.code === "I_RIP_SHARE").length, 0);
  // Strips side by side that save no board: no info. Two 1800 mm sides need a board each; the shelf and both strips
  // already share the third board.
  const tall = board({ section: [140, 18], stock: [{ length: 2400, price: 12 }] }, [[18, 1800, 140], [18, 1800, 140], [600, 18, 140], { size: [600, 18, 40], rip: true }, { size: [600, 18, 40], rip: true }]);
  const T = compute(tall, { mode: "estimate" });
  assert.equal(T.cuts[0].boards.length, 3);
  assert.deepEqual(T.problems.filter((x) => x.code === "I_RIP_SHARE"), []);
  // Cheaper, same board count: shorter boards. The hint names the cost.
  const cheap = board({ section: [140, 20], stock: [{ length: 1200, price: 10 }, { length: 2400, price: 15 }] }, [{ size: [1100, 20, 30], rip: true }, { size: [1100, 20, 30], rip: true }]);
  const C = compute(cheap, { mode: "estimate" }), ci = C.problems.filter((x) => x.code === "I_RIP_SHARE");
  assert.deepEqual(C.cuts[0].boards.map((b) => b.stock.length), [2400], "two strips end to end on one 2400 mm board");
  assert.match(ci[0]?.hint ?? "", /^To pay less, rip 2 strips side by side from one board\. The boards then cost \$10\.00, not \$15\.00\. Make that cut plan by hand\.$/);
  assert.deepEqual(lint(ci[0].hint, "description"), [], ci[0].hint);
});

test("cuts: optimal says whether the board plan is proven lowest cost; cutMd states it", () => {
  const lens = [940, 535, 1365, 617, 1258, 368, 843, 765, 754, 495, 468, 756, 1029, 590]; // the search stops at its node cap
  const parts = lens.map((L) => [L, 89, 19]);
  const capped = compute(board({ section: [89, 19], perLength: { price: 2400, per: 1000, max: 3000, step: 10 } }, parts), { mode: "estimate" });
  assert.deepEqual([capped.cuts[0].optimal, capped.cuts[0].search], [false, "exact"]);
  assert.match(cutMd(capped), /Plan: the best plan found, not proven lowest cost\. The search stopped early\./);
  const fixed = compute(board({ section: [89, 19], stock: [1800, 2400, 3000].map((length) => ({ length, price: length / 100 })) }, parts), { mode: "estimate" });
  assert.equal(fixed.cuts[0].optimal, true);
  assert.match(cutMd(fixed), /Plan: proven lowest cost\./);
  // More than 14 pieces: a fast search, not a search that stopped.
  const many = compute(board({ section: [89, 19], stock: [{ length: 2400, price: 10 }] }, Array.from({ length: 15 }, () => [1190, 89, 19])), { mode: "estimate" });
  assert.deepEqual([many.cuts[0].optimal, many.cuts[0].search, many.cuts[0].boards.length], [false, "fast", 8]);
  assert.match(cutMd(many), /Plan: the best plan found, not proven lowest cost\. The material has more than 14 pieces, so a fast search made the plan\./);
  assert.doesNotMatch(cutMd(many), /stopped early/);
  const lines = ["Plan: proven lowest cost.", "Plan: the best plan found, not proven lowest cost. The search stopped early.",
    "Plan: the best plan found, not proven lowest cost. The material has more than 14 pieces, so a fast search made the plan."];
  for (const line of lines) assert.deepEqual(lint(line, "description"), [], line);
  for (const M of [capped, fixed, many]) assert.ok(lines.some((l) => cutMd(M).includes(l)), "cutMd prints one of the linted lines");
});

test("perLength stock, trim, E_TOO_LONG and E_SHEET_FIT with the part path", () => {
  const p = shelf();
  p.materials["pine-1x10"] = { kind: "linear", name: "Pine board", section: [235, 19], perLength: { price: 10, per: 1000, max: 2400, step: 100 }, store: "lumber" };
  p.trim = 10;
  const M = compute(p, { mode: "estimate" });
  assert.deepEqual(codes(M, "error"), []);
  const boards = M.cuts[0].boards;
  for (const b of boards) {
    assert.equal(b.stock.length % 100, 0);
    assert.equal(b.stock.price, Math.round(b.stock.length / 100) / 1);
    assert.equal(b.cuts[0].at, 10, "the first cut starts at the trim");
  }
  const q = shelf();
  q.parts.push({ id: "P1", label: "P", name: "Post", material: "pine-1x10", size: [19, 3000, 235] }, { id: "Q1", label: "Q", name: "Wall", material: "ply-6", size: [3000, 6, 1500] });
  const N = compute(q, { mode: "estimate" });
  assert.match(has(N, "E_TOO_LONG", "parts[9].size", "part P1").msg, /3000 mm/);
  has(N, "E_SHEET_FIT", "parts[10].size", "part Q1");
});

test("guide geometry: E_GEOMETRY (joins allows it), W_FLOATING, W_FASTENER with paths", () => {
  const p = shelf();
  p.parts[2].at = [10, 60, 0]; // B1 into side A1
  const M = compute(p);
  const g = has(M, "E_GEOMETRY", "parts[2].at", "part B1");
  assert.match(g.msg, /A1 and B1 overlap by 9 x 19 x 235 mm/);
  p.parts[2].joins = ["A1"];
  assert.equal(find(compute(p), "E_GEOMETRY").length, 0);

  const q = shelf();
  q.parts[7].at = [380, 1000, 0]; // D1 in the air
  const N = compute(q);
  has(N, "W_FLOATING", "parts[7].at", "part D1");
  const f = has(N, "W_FASTENER", "steps[9].fasteners[0]", "step 10, fastener 1");
  assert.match(f.msg, /^Copies 1 and 2 of 2: the head is not on a part surface/);

  const r = shelf();
  r.steps[3].fasteners[0].dir = [-1, 0, 0]; // the screws point out of the side
  const R = compute(r);
  assert.match(has(R, "W_FASTENER", "steps[3].fasteners[0]", "step 4, fastener 1").msg, /^Copies 1, 2 and 3 of 3: the tip ends in air/);
  assert.equal(find(compute(r, { mode: "plan" }), "W_FASTENER").length, 0, "geometry is for guide mode only");

  const s = shelf();
  s.steps[9].fasteners[1].dir = [0, 0, 1]; // into the bracket, and out of its other face into air
  s.steps[9].fasteners[1].len = 100;
  has(compute(s), "W_FASTENER", "steps[9].fasteners[1]", "step 10, fastener 2");
  assert.equal(find(compute(shelf()), "W_FASTENER").length, 0, "a screw into the wall prop is fine");
});

test("counted fasteners: in the BOQ, not drawn, W_COUNTED_FASTENER in guide mode", () => {
  const p = shelf();
  p.steps[3].fasteners = [{ material: "screw-4x50", count: 3 }];
  const M = compute(p);
  has(M, "W_COUNTED_FASTENER", "steps[3].fasteners[0]");
  assert.deepEqual(M.steps[3].fasteners, [{ material: "screw-4x50", at: null, dir: null, len: 50, d: 4, head: "flat", color: "#8f959c", count: 3 }]);
  assert.equal(M.boq.find((r) => r.key === "screw-4x50").needQty, 26, "24 shelf screws and the 2 wall screws");
  assert.equal(find(compute(p, { mode: "plan" }), "W_COUNTED_FASTENER").length, 0);
});

test("unused and unpriced items: W_UNUSED_MATERIAL, W_UNUSED_TOOL, W_PRICE_UNKNOWN", () => {
  const p = shelf();
  p.materials.hinge = { kind: "each", name: "Hinge", price: 2 };
  p.tools.push({ id: "router", name: "Router", price: 99 });
  delete p.tools[2].price;
  delete p.materials.glue.price;
  const M = compute(p);
  has(M, "W_UNUSED_MATERIAL", "materials.hinge", "material hinge");
  has(M, "W_UNUSED_TOOL", "tools[15]", "tool router");
  has(M, "W_PRICE_UNKNOWN", "tools[2].price", "tool square");
  has(M, "W_PRICE_UNKNOWN", "materials.glue.price", "material glue");
  assert.equal(M.totals.unknownPrices, 2);
  assert.equal(M.boq.find((r) => r.key === "tool/router").first, 0, "an unused tool is still bought");
  assert.equal(M.totals.subtotal, 231.06 - 9.98 - 5.97 + 99);
});

test("I_ESTIMATE only when a rate is an estimate", () => {
  const p = shelf();
  p.estimate = false;
  const M = compute(p);
  assert.equal(find(M, "I_ESTIMATE").length, 0);
  assert.ok(M.boq.every((r) => !r.est));
  p.materials.poly.est = true;
  assert.equal(find(compute(p), "I_ESTIMATE").length, 1);
});

test("finish: explicit parts, finish false, project-wide finish and uses", () => {
  const area = (p) => compute(p, { mode: "estimate" }).totals.area;
  const a = shelf();
  a.parts[6].finish = false; // the back panel
  assert.equal(area(a), 2.516);
  const b = shelf();
  b.steps[8].finish.parts = ["A1", "A2"];
  assert.equal(area(b), 0.932);
  const c = shelf();
  c.uses = { rags: 1 };
  c.finish = [{ material: "poly", parts: ["D1"] }];
  const M = compute(c, { mode: "estimate" });
  assert.equal(M.boq.find((r) => r.key === "rags").needQty, 3);
  assert.equal(M.totals.area, 3.98, "an each part counts when a finish names it (D1 adds 0.0028 m²)");
  assert.match(M.boq.find((r) => r.key === "poly").note, /× 2 coats \+ 0\.00 m² × 2 coats/);
});

test("safety: E_TIP_OVER without an anchor, power-tool WARNING; none in estimate mode", () => {
  const p = shelf();
  delete p.materials["anti-tip"].role;
  has(compute(p), "E_TIP_OVER", "parts");
  has(compute(p, { mode: "plan" }), "E_TIP_OVER", "parts");
  const q = shelf();
  q.steps[0].warn = [];
  q.steps[0].teach = ["measure-mark"];
  has(compute(q), "E_POWER_NO_WARNING", "steps[0].warn", "step 1");
  assert.deepEqual(codes(compute(q, { mode: "estimate" }), "error"), []);
  assert.deepEqual(compute(q, { mode: "estimate" }).safety.power, ["saw", "drill"], "the estimate keeps the summary");
});

test("STE: findings point at the raw text; titles use the title kind; none in estimate mode", () => {
  const p = shelf();
  p.summary = "This shelf is assembled quickly.";
  p.steps[0].do[1] = "Mark each cut and cut each part.";
  p.steps[1].do[0] = { t: "Utilize 120 grit on the faces.", new: true };
  p.steps[2].title = "Drilling the sides";
  p.steps[3].warn[0].text = "Safety glasses should be worn.";
  p.steps[3].check = "The shelf is flush.";
  p.steps[0].why = "Letters are used by the reader.";
  p.handoff = [{ topic: "mains", text: "An electrician is needed for this." }];
  const M = compute(p);
  has(M, "STE_PASSIVE", "summary", "summary");
  has(M, "STE_TWO_ACTIONS", "steps[0].do[1]", "step 1, line 2");
  has(M, "STE_WORD", "steps[1].do[0]", "step 2, line 1");
  has(M, "STE_ING", "steps[2].title", "step 3, title");
  has(M, "STE_VERB_FIRST", "steps[3].warn[0].text", "step 4, warning 1");
  has(M, "STE_VERB_FIRST", "steps[3].check", "step 4, check");
  has(M, "STE_PASSIVE", "steps[0].why", "step 1, why");
  has(M, "STE_PASSIVE", "handoff[0].text", "hand-off 1");
  assert.ok(M.problems.filter((x) => x.level === "ste").every((x) => x.hint && x.msg));
  assert.equal(compute(p, { mode: "estimate" }).counts.ste, 0);
  const long = shelf();
  long.steps[0].title = "Cut all of the parts for the shelf from the boards today";
  has(compute(long), "STE_LENGTH", "steps[0].title");
});

test("STE: project technique cards are linted when taught, with their paths", () => {
  const p = shelf();
  p.techniques = { "measure-mark": { name: "Measuring", do: ["Hook the tape on the end.", "Marking the board."], warn: [{ type: "warning", text: "Gloves should be worn." }], why: "The blade removes {kerf}." } };
  const M = compute(p);
  has(M, "STE_ING", "techniques.measure-mark.name", "technique measure-mark, name");
  has(M, "STE_VERB_FIRST", "techniques.measure-mark.do[1]", "technique measure-mark, line 2");
  has(M, "STE_VERB_FIRST", "techniques.measure-mark.warn[0].text", "technique measure-mark, warning 1");
  assert.equal(M.techniques["measure-mark"].why, "The blade removes 3 mm.");
  p.techniques.unused = { name: "Doing nothing", do: ["Nothing."] };
  assert.equal(compute(p).problems.filter((x) => x.path.startsWith("techniques.unused")).length, 0, "a card no step teaches is not linted");
});

test("problems: sorted error, warn, ste, info; counts match", () => {
  const p = shelf();
  p.parts[2].size = [762, 25, 235]; // E_SECTION, and E_LABEL_MISMATCH from validate
  p.materials.hinge = { kind: "each", name: "Hinge", price: 2 };
  p.steps[0].do[0] = "Boards are put on the trestles.";
  const M = compute(p);
  has(M, "W_UNUSED_MATERIAL", "materials.hinge");
  assert.ok(M.counts.error && M.counts.warn && M.counts.ste && M.counts.info);
  assert.deepEqual(M.problems.map((x) => RANK[x.level]), M.problems.map((x) => RANK[x.level]).sort((a, b) => a - b));
  for (const level of Object.keys(RANK)) assert.equal(M.counts[level], M.problems.filter((x) => x.level === level).length);
});

test("raw paths: when validate drops a step or a part, paths still point into the input", () => {
  const p = shelf();
  p.steps.unshift({ id: "broken" }); // no title: validate drops it
  p.steps[4].do[0] = "Utilize the drill.";
  p.steps[1].warn = [];
  p.steps[1].teach = [];
  const M = compute(p);
  has(M, "E_SCHEMA", "steps[0].title");
  has(M, "STE_WORD", "steps[4].do[0]", "step 5, line 1");
  has(M, "E_POWER_NO_WARNING", "steps[1].warn", "step 2");
  const q = shelf();
  q.parts.unshift({ id: "Z9", name: "Broken" }); // no material or size: dropped
  q.parts[3].size = [762, 25, 235];
  q.steps[3].title = 42; // dropped with its parts A1 and B1
  const N = compute(q);
  has(N, "E_SECTION", "parts[3].size", "part B1");
  assert.equal(find(N, "E_NOT_INSTALLED").length, 0, "no cascade from a dropped step");
  assert.equal(find(N, "W_UNUSED_MATERIAL").length + find(N, "W_UNUSED_TOOL").length, 0);
});

test("fatal input: no throw, every key, the problems", () => {
  for (const bad of [null, undefined, 42, "x", [], {}, { id: "x", title: "X" }, { id: "x", title: "X", materials: 5, parts: "no" }]) {
    const M = compute(bad);
    assert.deepEqual(Object.keys(M), KEYS);
    assert.ok(M.counts.error > 0, JSON.stringify(bad));
    assert.deepEqual([M.parts, M.boq, M.steps, M.cuts, M.purchase, M.totals.total], [[], [], [], [], [], 0]);
  }
});

// A seeded PRNG (mulberry32) and a mutator: deletes, junk values, duplicated items.
function prng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const JUNK = [null, 0, -1, 1e308, -0.5, 3.5, "", "x", "3", "linar", true, false, [], {}, [1, 2], [0, 0, 0], [-5, 10, 2], [1e308, 1, 1],
  { a: 1 }, "#zzz", "__proto__", "constructor", "toString", "A1", "screw-4x50", "drill", "measure-mark", { count: 2 }, [{ t: "" }]];
const pathsOf = (v, pre = [], out = []) => {
  if (pre.length) out.push(pre);
  if (v && typeof v === "object") for (const k of Object.keys(v)) pathsOf(v[k], [...pre, Array.isArray(v) ? Number(k) : k], out);
  return out;
};
function mutate(base, rnd) {
  const p = structuredClone(base), pick = (list) => list[Math.floor(rnd() * list.length)];
  for (let n = 1 + Math.floor(rnd() * 6); n > 0; n--) {
    const path = pick(pathsOf(p));
    if (!path) break;
    const parent = path.slice(0, -1).reduce((o, k) => o[k], p), key = path.at(-1), r = rnd();
    if (r < 0.3) Array.isArray(parent) ? parent.splice(key, 1) : delete parent[key];
    else if (r < 0.85) parent[key] = structuredClone(pick(JUNK));
    else if (Array.isArray(parent)) parent.push(structuredClone(parent[key]));
    else parent[`${key}x`] = structuredClone(parent[key]);
  }
  return p;
}

test("prototype-like ids and names work: constructor, toString, __proto__", () => {
  const p = shelf();
  p.materials.toString = { kind: "each", name: "Hook", price: 1.5, group: "constructor", store: "constructor" };
  p.stores.constructor = { name: "Corner shop" };
  p.parts.push({ id: "K1", label: "K", name: "Hook", material: "toString", size: [10, 10, 10], at: [100, 200, 235] });
  p.steps[6].parts.push("K1");
  const M = compute(p);
  assert.deepEqual(codes(M, "error"), []);
  const r = M.boq.find((x) => x.key === "toString");
  assert.deepEqual([r.code, r.group, r.qty, r.amount], ["O01", "constructor", 1, 1.5]);
  assert.deepEqual(M.purchase.find((t) => t.store === "constructor").items, ["toString"]);
  assert.equal(Object.getPrototypeOf({}).first, undefined, "nothing is written to Object.prototype");
});

test("compute never throws on 200 malformed projects", () => {
  const rnd = prng(20261102), bases = [shelf(), bench(), hook()];
  for (let i = 0; i < 200; i++) {
    const mode = ["guide", "plan", "estimate"][i % 3];
    const p = i % 25 === 0 ? structuredClone(JUNK[i % JUNK.length]) : mutate(bases[i % 3], rnd);
    let M;
    assert.doesNotThrow(() => { M = compute(p, { mode, start: "2026-11-20" }); }, `case ${i}`);
    assert.deepEqual(Object.keys(M), KEYS, `case ${i}`);
    assert.deepEqual(M.problems.filter((x) => /Internal error/.test(x.msg)), [], `case ${i}`);
    for (const x of M.problems) for (const k of ["level", "code", "path", "where", "msg", "hint"]) assert.equal(typeof x[k], "string", `case ${i}: ${k} of ${x.code}`);
    for (const level of Object.keys(RANK)) assert.equal(M.counts[level], M.problems.filter((x) => x.level === level).length);
    for (const k of ["subtotal", "contingency", "tax", "total", "area"]) assert.ok(Number.isFinite(M.totals[k]), `case ${i}: totals.${k}`);
    for (const r of M.boq) assert.ok(r.amount === null || Number.isFinite(r.amount), `case ${i}: ${r.code}`);
    assert.doesNotThrow(() => JSON.parse(JSON.stringify(M)), `case ${i}`);
  }
});

// ---- 3D-printed parts

test("printed: grams = volume (cm³) x density x fill to 1 g, hours = grams / rate to 0.1 h; box and cylinder", () => {
  const p = hook();
  delete p.parts[3].print; // the peg: a cylinder along y, 20 mm across and 50 mm long
  const M = compute(p), part = Object.fromEntries(M.parts.map((x) => [x.id, x]));
  // hook: 40 x 60 x 20 mm = 48 cm³ x 1.24 x 0.3 = 17.856 g -> 18 g; 18 / 12 = 1.5 h
  assert.deepEqual(part.B1.print, { grams: 18, hours: 1.5, settings: "0.2 mm layers, 20% infill, no supports", est: { grams: true, hours: true }, step: 0 });
  // peg: pi / 4 x 20² x 50 = 15.708 cm³ x 1.24 x 0.3 = 5.84 g -> 6 g; 6 / 12 = 0.5 h
  assert.deepEqual([part.C1.print.grams, part.C1.print.hours], [6, 0.5]);
  assert.equal(part.C1.kind, "printed");
  assert.equal(part.C1.cut, null);
  assert.ok(!("print" in part.A1), "a cut part has no print");
  // the material density, fill and rate change the estimate
  p.materials.pla = { ...p.materials.pla, density: 1.04, fill: 0.5, rate: 20 };
  const N = compute(p).parts.find((x) => x.id === "B1").print;
  assert.deepEqual([N.grams, N.hours], [25, 1.3], "48 x 1.04 x 0.5 = 24.96 g; 25 / 20 = 1.25 h");
  // a tiny part still weighs 1 g and takes 0.1 h
  p.parts[3].size = [1, 1, 1];
  assert.deepEqual([compute(p).parts[3].print.grams, compute(p).parts[3].print.hours], [1, 0.1]);
});

test("printed: slicer numbers override the estimate; I_PRINT_ESTIMATE once for the project, only while a value is estimated", () => {
  const M = compute(hook());
  const peg = M.parts.find((x) => x.id === "C1").print;
  assert.deepEqual([peg.grams, peg.hours, peg.est], [7, 0.8, { grams: false, hours: false }]);
  assert.equal(find(M, "I_PRINT_ESTIMATE").length, 1);
  has(M, "I_PRINT_ESTIMATE", "parts[1].print", "part B1");
  assert.match(find(M, "I_PRINT_ESTIMATE")[0].msg, /printed part B is an estimate/);
  // only grams from the slicer: hours = slicer grams / rate, and still an estimate
  const p = hook();
  p.parts[1].print.grams = 30;
  p.parts[2].print.grams = 30;
  const B = compute(p).parts.find((x) => x.id === "B1").print;
  assert.deepEqual([B.grams, B.hours, B.est], [30, 2.5, { grams: false, hours: true }]);
  for (const x of [p.parts[1], p.parts[2]]) x.print.hours = 2;
  const S = compute(p);
  assert.deepEqual(find(S, "I_PRINT_ESTIMATE"), [], "every value from the slicer");
  assert.deepEqual(S.counts, { error: 0, warn: 0, ste: 0, info: 1 }, codes(S).join("; "));
});

test("printed: the BOQ row (grams, parts, spools with spare), group Printing P after T, needed by the prints step", () => {
  const M = compute(hook());
  assert.deepEqual(M.boq.map((r) => `${r.code} ${r.group} ${r.key}`), ["T01 Timber and sheet board:1000", "P01 Printing pla", "C01 Consumables glue"]);
  const r = M.boq.find((x) => x.key === "pla");
  // 18 + 18 + 7 = 43 g, + 10% spare = 47.3 g -> 1 spool of 1000 g
  assert.deepEqual([r.need, r.needQty, r.qty, r.unit, r.rate, r.amount, r.get, r.first, r.store], ["3 parts, 43 g + 10% spare", 43, 1, "1 kg spool", 21.99, 21.99, "buy", 0, "online"]);
  assert.equal(r.note, "3.8 h of printer time.");
  assert.deepEqual(M.materials.pla, { name: "PLA filament", kind: "printed", spec: "1.75 mm, black", unit: null, color: "#333333" });
  assert.deepEqual(M.purchase.find((t) => t.store === "online").items, ["pla"]);
});

test("printed: spools round up with the spare share; spool, packName and spare change the row", () => {
  const p = hook();
  Object.assign(p.materials.pla, { spool: 250, spare: 0.2, packName: "250 g reel" });
  for (const x of [p.parts[1], p.parts[2]]) x.print.grams = 100;
  // 100 + 100 + 7 = 207 g x 1.2 = 248.4 g -> 1 reel; 210 g x 1.2 = 252 g -> 2 reels
  let r = compute(p).boq.find((x) => x.key === "pla");
  assert.deepEqual([r.need, r.qty, r.unit, r.amount], ["3 parts, 207 g + 20% spare", 1, "250 g reel", 21.99]);
  p.parts[3].print.grams = 10;
  r = compute(p).boq.find((x) => x.key === "pla");
  assert.deepEqual([r.qty, r.amount], [2, 43.98]);
  delete p.materials.pla.packName;
  assert.equal(compute(p).boq.find((x) => x.key === "pla").unit, "250 g spool");
  delete p.materials.pla.price;
  const U = compute(p);
  assert.equal(U.boq.find((x) => x.key === "pla").amount, null);
  assert.match(has(U, "W_PRICE_UNKNOWN", "materials.pla.price").hint, /one spool/);
});

test("printed: printer time is waiting time of the prints step, not work time, and not scaled by the level", () => {
  const M = compute(hook());
  // 1.5 + 1.5 + 0.8 = 3.8 h = 228 min, in step 1; step 2 keeps its own 30 min wait
  assert.deepEqual(M.steps.map((s) => [s.minutes, s.wait, s.printMinutes]), [[10, 228, 228], [15, 30, undefined]]);
  assert.deepEqual([M.plan.active, M.plan.wait], [25, 258]);
  assert.deepEqual(M.plan.phases.map((ph) => ph.wait), [258]);
  assert.ok(!("printMinutes" in M.steps[1]), "only a prints step carries printMinutes");
  // prints with a material list; a list without the material gives no printer time, and a warning
  const p = hook();
  p.steps[0].prints = ["pla"];
  assert.equal(compute(p).steps[0].printMinutes, 228);
  p.steps[0].wait = 15;
  assert.equal(compute(p).steps[0].wait, 243, "the step wait plus the printer time");
  p.steps[0].prints = [];
  const E = compute(p);
  assert.deepEqual(E.steps.map((s) => s.printMinutes), [0, undefined]);
  assert.equal(E.parts.find((x) => x.id === "B1").print.step, null);
});

test("printed: W_NO_PRINT_STEP when no step prints a printed material (plan and guide modes, with steps)", () => {
  const p = hook();
  delete p.steps[0].prints;
  const M = compute(p);
  const w = has(M, "W_NO_PRINT_STEP", "materials.pla", "material pla");
  assert.match(w.msg, /No step prints the parts of "PLA filament" \(B and C\)/);
  assert.match(w.hint, /"prints": true/);
  assert.equal(M.steps[0].wait, 0, "no printer time in any step");
  assert.equal(M.boq.find((x) => x.key === "pla").first, 1, "needed by the step that installs the parts");
  assert.deepEqual(find(compute(p, { mode: "estimate" }), "W_NO_PRINT_STEP"), [], "estimate mode");
  assert.equal(find(compute(p, { mode: "plan" }), "W_NO_PRINT_STEP").length, 1);
});

test("printed: print settings are reader text for the STE lint (once a label) and the hand-off screen; default finish skips printed parts", () => {
  const p = hook();
  for (const x of [p.parts[1], p.parts[2]]) x.print.settings = "Using supports is needed for the arm.";
  const M = compute(p);
  assert.deepEqual(codes(M, "ste"), ["STE_ING parts[1].print.settings", "STE_PASSIVE parts[1].print.settings"]);
  assert.equal(M.problems.find((x) => x.code === "STE_ING").where, "part B1, print settings");
  p.parts[1].print.settings = p.parts[2].print.settings = "Wire it into the mains supply.";
  has(compute(p), "E_HANDOFF", "parts[1].print.settings", "part B1");
  const f = hook();
  f.materials.oil = { kind: "amount", name: "Oil", unit: "L", price: 9, coverage: 10 };
  f.steps[1].finish = { material: "oil" };
  assert.deepEqual(compute(f).steps[1].finish.parts, ["A1"]);
});
