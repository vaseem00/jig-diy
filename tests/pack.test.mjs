// pack.mjs: board plans against brute force and the v0.1 plan; sheet plans against geometry, grain and cost rules.
import { test } from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { packLinear, packSheets, expandPerLength } from "../engine/lib/pack.mjs";
import { toMM } from "../engine/lib/locale.mjs";

// Seeded PRNG (mulberry32): the same random cases on every run.
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const int = (R, lo, hi) => lo + Math.floor(R() * (hi - lo + 1));
const pick = (R, list) => list[Math.floor(R() * list.length)];
const shuffle = (R, list) => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const U = (v) => Math.round(v * 1000); // micrometres, as the module counts
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg ?? ""} ${a} vs ${b}`);

// The v0.1 bookshelf (examples/bookshelf/project.mjs): 1x10 pine stock, sides A 900 x 2, shelves B 762 x 4, kerf 3.
const PINE = [{ length: 2440, price: 27.98 }, { length: 1830, price: 21.5 }, { length: 1220, price: 14.9 }];
const SHELF_PARTS = [
  { id: "A1", label: "A", len: 900 }, { id: "A2", label: "A", len: 900 },
  ...[1, 2, 3, 4].map((i) => ({ id: `B${i}`, label: "B", len: 762 })),
];

// ---- boards

// Every set partition; each board at the cheapest stock that holds it (shortest on a tie).
// Key: cost in cents, then boards, then total stock length. q turns a length into exact integers (default: µm of mm).
function bruteLinear(pieces, stock, kerf, trim, q = U) {
  const holder = (blk) => {
    const used = q(trim) + blk.reduce((a, p) => a + q(p.len), 0) + q(kerf) * (blk.length - 1);
    return stock.filter((s) => q(s.length) >= used).sort((a, b) => a.price - b.price || a.length - b.length)[0];
  };
  let best = null;
  const blocks = [];
  const rec = (i) => {
    if (blocks.length && !holder(blocks.at(-1))) return;
    if (i === pieces.length) {
      let cents = 0, size = 0;
      for (const b of blocks) { const s = holder(b); if (!s) return; cents += Math.round(s.price * 100); size += s.length; }
      const k = { cents, count: blocks.length, size };
      if (!best || k.cents < best.cents || (k.cents === best.cents && (k.count < best.count || (k.count === best.count && k.size < best.size)))) best = k;
      return;
    }
    for (const b of blocks) { b.push(pieces[i]); if (holder(b)) rec(i + 1); b.pop(); }
    blocks.push([pieces[i]]);
    rec(i + 1);
    blocks.pop();
  };
  rec(0);
  return best;
}

// The v0.1 plan: first fit decreasing into the longest stock, then the cheapest stock that holds each board.
function v01Linear(pieces, stock, kerf, trim = 0) {
  const longest = Math.max(...stock.map((s) => s.length)), boards = [];
  for (const p of [...pieces].sort((a, b) => b.len - a.len)) {
    if (trim + p.len > longest) continue;
    let b = boards.find((x) => x.used + kerf + p.len <= longest);
    if (!b) boards.push((b = { used: trim - kerf }));
    b.used += kerf + p.len;
  }
  return boards.reduce((a, b) => a + stock.filter((s) => s.length >= b.used).sort((x, y) => x.price - y.price || x.length - y.length)[0].price, 0);
}

// Every rule a board plan must keep.
function checkBoards(r, pieces, stock, { kerf = 3, trim = 0 } = {}) {
  const max = Math.max(0, ...stock.map((s) => s.length));
  const long = pieces.filter((p) => U(trim) + U(p.len) > U(max)).map((p) => p.id).sort();
  assert.deepEqual(r.problems.map((x) => x.id).sort(), long);
  for (const x of r.problems) { assert.equal(x.level, "error"); assert.equal(x.code, "E_TOO_LONG"); }
  const ids = r.boards.flatMap((b) => b.cuts.map((c) => c.id)).sort();
  assert.deepEqual(ids, pieces.filter((p) => !long.includes(p.id)).map((p) => p.id).sort());
  let cost = 0;
  r.boards.forEach((b, k) => {
    assert.ok(stock.some((s) => s.length === b.stock.length && s.price === b.stock.price), "stock is a real stock entry");
    near(b.cuts[0].at, trim, "first cut at trim");
    b.cuts.forEach((c, j) => {
      if (!j) return;
      const prev = b.cuts[j - 1];
      assert.ok(c.at - (prev.at + prev.len) >= kerf - 1e-6, "kerf between cuts");
      assert.ok(prev.len >= c.len, "longest cut first");
    });
    const last = b.cuts.at(-1);
    near(b.used, last.at + last.len, "used is the end of the last cut");
    assert.ok(b.used <= b.stock.length + 1e-9, "last cut ends on the board");
    near(b.waste, b.stock.length - b.used, "waste");
    assert.ok(!stock.some((s) => s.length >= b.used - 1e-9 && s.price < b.stock.price), "cheapest stock that holds the board");
    if (k) assert.ok(r.boards[k - 1].stock.length >= b.stock.length, "boards sorted by length");
    cost += b.stock.price;
  });
  near(r.cost, cost, "cost is the sum of the boards");
}

test("packLinear equals the brute-force optimum on 300 random cases", () => {
  const R = rng(1);
  for (let c = 0; c < 300; c++) {
    const stock = shuffle(R, [600, 900, 1220, 1830, 2440, 3050, 3660]).slice(0, int(R, 1, 3))
      .map((length) => ({ length, price: R() < 0.3 ? Math.round(length * 1.15) / 100 : int(R, 500, 4500) / 100 }));
    const kerf = pick(R, [0, 3, 3.2, 4]), trim = pick(R, [0, 0, 5, 20]);
    const set = [int(R, 100, 1500), int(R, 100, 1500), int(R, 100, 1500)];
    const pieces = Array.from({ length: int(R, 1, 7) }, (_, i) => ({ id: `P${i}`, label: "P", len: R() < 0.5 ? pick(R, set) : int(R, 50, 2600) + (R() < 0.2 ? 0.5 : 0) }));
    const r = packLinear(pieces, stock, { kerf, trim });
    checkBoards(r, pieces, stock, { kerf, trim });
    const b = bruteLinear(pieces.filter((p) => !r.problems.some((x) => x.id === p.id)), stock, kerf, trim);
    assert.equal(Math.round(r.cost * 100), b.cents, `case ${c}: cost`);
    assert.equal(r.boards.length, b.count, `case ${c}: boards`);
    assert.equal(r.boards.reduce((a, x) => a + x.stock.length, 0), b.size, `case ${c}: stock length`);
    assert.equal(r.optimal, true);
  }
});

test("the v0.1 bookshelf pine costs 55.96 or less", () => {
  const r = packLinear(SHELF_PARTS, PINE, { kerf: 3 });
  checkBoards(r, SHELF_PARTS, PINE);
  assert.ok(r.cost <= 55.96 + 1e-9, `cost ${r.cost}`);
  assert.equal(r.boards.length, 2);
  assert.deepEqual(r.boards[0].cuts.map((c) => [c.id, c.at]), [["A1", 0], ["B1", 903], ["B2", 1668]]);
  assert.equal(r.optimal, true);
});

test("packLinear never costs more than the v0.1 plan", () => {
  const R = rng(2);
  for (let c = 0; c < 200; c++) {
    const stock = c % 3 === 0 ? expandPerLength({ price: int(R, 500, 1500) / 100, per: 1000, max: int(R, 3, 6) * 1000, step: pick(R, [300, 500, 1000]) })
      : shuffle(R, [1220, 1830, 2440, 3050, 3660, 4880]).slice(0, int(R, 1, 4)).map((length) => ({ length, price: int(R, 800, 6000) / 100 }));
    const kerf = pick(R, [0, 3, 4]), trim = pick(R, [0, 10]);
    const pieces = Array.from({ length: int(R, 1, 40) }, (_, i) => ({ id: `P${i}`, len: int(R, 80, 2400) }));
    const r = packLinear(pieces, stock, { kerf, trim });
    checkBoards(r, pieces, stock, { kerf, trim });
    const fit = pieces.filter((p) => !r.problems.some((x) => x.id === p.id));
    if (fit.length) assert.ok(r.cost <= v01Linear(fit, stock, kerf, trim) + 1e-9, `case ${c}`);
  }
});

test("trim and kerf set the cut positions", () => {
  const pieces = [{ id: "a", len: 500 }, { id: "b", len: 1000 }, { id: "c", len: 500 }];
  const r = packLinear(pieces, [{ length: 2440, price: 20 }], { kerf: 4, trim: 20 });
  assert.equal(r.boards.length, 1);
  assert.deepEqual(r.boards[0].cuts.map((c) => [c.id, c.at]), [["b", 20], ["a", 1024], ["c", 1528]]);
  assert.equal(r.boards[0].used, 2028);
  assert.equal(r.boards[0].waste, 412);
  // 2420 of pieces fit a 2440 board with no trim and no kerf, and not with a 20 mm trim.
  const two = [{ id: "x", len: 1210 }, { id: "y", len: 1230 }];
  assert.equal(packLinear(two, [{ length: 2440, price: 20 }], { kerf: 0 }).boards.length, 1);
  assert.equal(packLinear(two, [{ length: 2440, price: 20 }], { kerf: 0, trim: 20 }).boards.length, 2);
});

// Inch lengths are not whole micrometres (1/16 in is 1587.5 µm). An exact fit must stay a fit.
const inch = (v) => toMM(v, "in");

test("inch exact fits: two 47 15/16 in pieces and a 1/8 in kerf fill one 96 in board", () => {
  const stock = [{ length: inch(96), price: 24.98 }, { length: inch(120), price: 31.98 }];
  const two = [{ id: "A", len: inch(47.9375) }, { id: "B", len: inch(47.9375) }];
  const r = packLinear(two, stock, { kerf: inch(0.125) });
  assert.deepEqual([r.boards.length, r.boards[0].stock.length, r.cost, r.problems], [1, 2438.4, 24.98, []]);
  assert.ok(r.boards[0].waste >= 0 && r.boards[0].waste < 0.01, `waste ${r.boards[0].waste}`);
  const three = [31.9375, 31.9375, 31.875].map((v, i) => ({ id: `C${i}`, len: inch(v) }));
  assert.equal(packLinear(three, stock, { kerf: inch(0.125) }).cost, 24.98);
  // One sixteenth too much still needs the 120 in board.
  const over = packLinear([{ id: "A", len: inch(47.9375) }, { id: "B", len: inch(48) }], stock, { kerf: inch(0.125) });
  assert.deepEqual([over.boards.length, over.boards[0].stock.length, over.cost], [1, inch(120), 31.98]);
  // The mm boundary does not move: 1200 + 3 + 1197 fits 2400, 1197.001 does not.
  const mmStock = [{ length: 2400, price: 10 }, { length: 3000, price: 12 }];
  assert.equal(packLinear([{ id: "A", len: 1200 }, { id: "B", len: 1197 }], mmStock, { kerf: 3 }).cost, 10);
  assert.equal(packLinear([{ id: "A", len: 1200 }, { id: "B", len: 1197.001 }], mmStock, { kerf: 3 }).cost, 12);
});

test("inch exact fits: a part as long as the usable board is no E_TOO_LONG; a sheet ripped in two halves is one sheet", () => {
  const r = packLinear([{ id: "P0", len: inch(95.8125) }], [{ length: inch(96), price: 24.98 }], { kerf: inch(0.125), trim: inch(0.1875) });
  assert.deepEqual([r.problems, r.boards.length], [[], 1]);
  const halves = [{ id: "H1", a: inch(23.9375), b: inch(96) }, { id: "H2", a: inch(23.9375), b: inch(96) }];
  const s = packSheets(halves, [{ w: inch(48), h: inch(96), price: 52.98 }], { kerf: inch(0.125) });
  assert.deepEqual([s.sheets.length, s.cost, s.problems], [1, 52.98, []]);
  const wide = [{ id: "H1", a: inch(24), b: inch(96) }, { id: "H2", a: inch(23.9375), b: inch(96) }];
  assert.equal(packSheets(wide, [{ w: inch(48), h: inch(96), price: 52.98 }], { kerf: inch(0.125) }).sheets.length, 2);
});

test("packLinear equals the brute-force optimum on 300 random inch cases (exact in sixteenths)", () => {
  const R = rng(9), mmOf = (s) => toMM(s / 16, "in"), q = (v) => v;
  for (let c = 0; c < 300; c++) {
    const stock = shuffle(R, [48, 72, 96, 120, 144]).slice(0, int(R, 1, 3)).map((ft) => ({ length: ft * 16, price: int(R, 500, 4500) / 100 }));
    const kerf = pick(R, [0, 1, 2, 3]), trim = pick(R, [0, 0, 1, 3, 4]); // sixteenths
    const pieces = [];
    if (R() < 0.5) { // pieces that fill a stock length exactly, with odd sixteenths
      const L = pick(R, stock).length, k = int(R, 2, 3);
      let left = L - trim - (k - 1) * kerf;
      for (let i = 0; i < k - 1; i++) { const v = int(R, 1, Math.floor(left / (k - i))) * 2 - 1; pieces.push(v); left -= v; }
      pieces.push(left);
    }
    while (pieces.length < int(R, 1, 7)) pieces.push(int(R, 16, 2400));
    const P = pieces.filter((v) => v > 0).map((v, i) => ({ id: `P${i}`, label: "P", len: v }));
    const r = packLinear(P.map((p) => ({ ...p, len: mmOf(p.len) })), stock.map((s) => ({ ...s, length: mmOf(s.length) })), { kerf: mmOf(kerf), trim: mmOf(trim) });
    const max = Math.max(...stock.map((s) => s.length)), long = P.filter((p) => trim + p.len > max).map((p) => p.id);
    assert.deepEqual(r.problems.map((x) => x.id).sort(), long.sort(), `case ${c}: E_TOO_LONG`);
    const b = bruteLinear(P.filter((p) => !long.includes(p.id)), stock, kerf, trim, q);
    if (!b) continue;
    assert.equal(Math.round(r.cost * 100), b.cents, `case ${c}: cost`);
    assert.equal(r.boards.length, b.count, `case ${c}: boards`);
    assert.equal(r.boards.reduce((a, x) => a + Math.round((x.stock.length / 25.4) * 16), 0), b.size, `case ${c}: stock length`);
    for (const x of r.boards) assert.ok(x.waste >= 0, `case ${c}: waste ${x.waste}`);
  }
});

test("a piece longer than the stock gives E_TOO_LONG and the others still pack", () => {
  const r = packLinear([{ id: "L1", label: "L", len: 2500 }, { id: "S1", label: "S", len: 1000 }], PINE, { kerf: 3 });
  assert.equal(r.problems.length, 1);
  const [p] = r.problems;
  assert.equal(p.level, "error");
  assert.equal(p.code, "E_TOO_LONG");
  assert.equal(p.id, "L1");
  assert.equal(p.len, 2500);
  assert.equal(p.max, 2440);
  assert.match(p.msg, /2500 mm/);
  assert.match(p.hint, /^Add a stock length of 2500 mm or more/);
  assert.deepEqual(r.boards.map((b) => b.stock.length), [1220]);
  const t = packLinear([{ id: "T1", len: 2430 }], PINE, { kerf: 3, trim: 20 });
  assert.equal(t.problems[0]?.code, "E_TOO_LONG");
  assert.match(t.problems[0].msg, /after the 20 mm trim/);
  const none = packLinear([{ id: "Z", len: 10 }], [], {}).problems;
  assert.deepEqual(none.map((x) => x.code), ["E_TOO_LONG"]);
  assert.match(none[0].msg, /The material has no stock length\.$/);
  assert.doesNotMatch(none[0].msg, /holds 0 mm/);
  assert.deepEqual(packLinear([], PINE), { boards: [], cost: 0, problems: [], optimal: true, search: "exact" });
});

test("E_TOO_LONG: stock lengths that the trim uses up are not 'no stock length'", () => {
  const stock = [{ length: 1200, price: 9.5 }, { length: 2400, price: 16 }];
  for (const trim of [2400, 2500]) {
    const [p] = packLinear([{ id: "A", label: "A", len: 500 }], stock, { trim }).problems;
    assert.equal(p.code, "E_TOO_LONG");
    assert.match(p.msg, new RegExp(`^Part A is 500 mm long\\. No stock length of the material is longer than the ${trim} mm trim\\.$`));
    assert.doesNotMatch(p.msg, /no stock length/);
    assert.match(p.hint, /^Make the trim shorter, or add a stock length of \d+ mm or more to the material\.$/);
  }
  assert.match(packLinear([{ id: "A", label: "A", len: 500 }], [], {}).problems[0].msg, /The material has no stock length\./);
});

test("packLinear says which search made the plan: exact up to 14 pieces, fast above", () => {
  const pieces = (k) => Array.from({ length: k }, (_, i) => ({ id: `P${i + 1}`, label: "P", len: 1190 }));
  const stock = [{ length: 2400, price: 10 }];
  const exact = packLinear(pieces(14), stock);
  assert.deepEqual([exact.search, exact.optimal, exact.boards.length], ["exact", true, 7]);
  const fast = packLinear(pieces(15), stock);
  assert.deepEqual([fast.search, fast.optimal, fast.boards.length], ["fast", false, 8]);
});

test("expandPerLength lists cut-to-size lengths priced pro rata", () => {
  assert.deepEqual(expandPerLength({ price: 12.5, per: 1000, max: 3000 }), [{ length: 1000, price: 12.5 }, { length: 2000, price: 25 }, { length: 3000, price: 37.5 }]);
  assert.deepEqual(expandPerLength({ price: 9.99, per: 1000, max: 1000, step: 333 }), [{ length: 333, price: 3.33 }, { length: 666, price: 6.65 }, { length: 999, price: 9.98 }]);
  assert.deepEqual(expandPerLength({ price: 2.01, per: 1000, max: 1500, step: 500 }).map((s) => s.price), [1.01, 2.01, 3.02]);
  assert.deepEqual(expandPerLength({ price: 10, per: 1000, max: 500 }), []);
  const r = packLinear(SHELF_PARTS, expandPerLength({ price: 10, per: 1000, max: 3000, step: 100 }), { kerf: 3 });
  checkBoards(r, SHELF_PARTS, expandPerLength({ price: 10, per: 1000, max: 3000, step: 100 }));
  assert.equal(r.cost, 49); // [A, A, B] needs 2,568 mm (buy 2,600) and [B, B, B] 2,292 mm (buy 2,300): the 4,900 mm floor
});

test("expandPerLength rounds prices to the minor unit of the currency", () => {
  assert.deepEqual(expandPerLength({ price: 1000, per: 3000, max: 3000, step: 1000 }, 0).map((s) => s.price), [333, 667, 1000]);
  assert.equal(expandPerLength({ price: 1.235, per: 1000, max: 3000, step: 500 }, 3).find((s) => s.length === 1500).price, 1.853);
  assert.deepEqual(expandPerLength({ price: 1000, per: 3000, max: 3000, step: 1000 }).map((s) => s.price), [333.33, 666.67, 1000]);
});

test("a fine perLength step (300,000 lengths) packs in under 2 s, at the cost of a 1 mm step", () => {
  const pieces = SHELF_PARTS.map((p) => ({ ...p }));
  const t = performance.now();
  const fine = packLinear(pieces, expandPerLength({ price: 10, per: 1000, max: 3000, step: 0.01 }), { kerf: 3 });
  const ms = performance.now() - t;
  assert.ok(ms < 2000, `${ms.toFixed(0)} ms`);
  assert.equal(fine.cost, packLinear(pieces, expandPerLength({ price: 10, per: 1000, max: 3000, step: 1 }), { kerf: 3 }).cost);
});

test("packLinear output is deterministic and does not depend on input order", () => {
  const R = rng(3);
  for (let c = 0; c < 30; c++) {
    const pieces = Array.from({ length: int(R, 2, 20) }, (_, i) => ({ id: `P${i}`, label: pick(R, ["A", "B", "C"]), len: pick(R, [400, 762, 900, int(R, 100, 2000)]) }));
    const a = packLinear(pieces, PINE, { kerf: 3 }), b = packLinear(pieces, PINE, { kerf: 3 }), s = packLinear(shuffle(R, pieces), PINE, { kerf: 3 });
    assert.deepEqual(a, b);
    assert.deepEqual(a, s);
  }
});

test("14 pieces pack in under 200 ms", () => {
  const R = rng(4);
  for (let c = 0; c < 20; c++) {
    const stock = c % 2 ? PINE : expandPerLength({ price: 10, per: 1000, max: 6000, step: 500 });
    const pieces = Array.from({ length: 14 }, (_, i) => ({ id: `P${i}`, len: int(R, 100, 2400) }));
    let ms = Infinity;
    for (let k = 0; k < 2; k++) { const t = performance.now(); packLinear(pieces, stock, { kerf: 3 }); ms = Math.min(ms, performance.now() - t); }
    assert.ok(ms < 200, `case ${c}: ${ms.toFixed(0)} ms`);
  }
});

// ---- sheets

const CHAIN = [[2440, 1220], [1220, 1220], [1220, 610], [610, 610]]; // each sheet holds the next one
const OTHER = [[1830, 915], [2440, 600], [1500, 1500]];

// v0.1 shelf packing on the largest sheet, with turns only where grain allows, then the cheapest sheet that holds
// each used box (turned only without grain).
function shelfBaseline(pieces, stock, kerf, grain) {
  const sheets = stock.map((s) => ({ W: Math.max(s.w, s.h), H: Math.min(s.w, s.h), price: s.price }));
  const big = [...sheets].sort((a, b) => b.W * b.H - a.W * a.H)[0];
  const turns = (p) => {
    const a = Math.max(p.a, p.b), b = Math.min(p.a, p.b), g = grain ? p.grain ?? "along" : "any";
    return a === b || g === "along" ? [[a, b]] : g === "across" ? [[b, a]] : [[a, b], [b, a]];
  };
  const out = [];
  for (const p of [...pieces].sort((x, y) => Math.min(y.a, y.b) - Math.min(x.a, x.b) || Math.max(y.a, y.b) - Math.max(x.a, x.b))) {
    const o = turns(p).find(([w, h]) => w <= big.W && h <= big.H);
    if (!o) continue;
    const [w, h] = o;
    let placed = false;
    for (const s of out) {
      const row = s.rows.find((r) => h <= r.h && r.x + w <= big.W);
      if (row) { s.cuts.push({ x: row.x, y: row.y, w, h }); row.x += w + kerf; placed = true; break; }
      const y = s.rows.reduce((a, r) => a + r.h + kerf, 0);
      if (y + h <= big.H) { s.rows.push({ y, h, x: w + kerf }); s.cuts.push({ x: 0, y, w, h }); placed = true; break; }
    }
    if (!placed) out.push({ rows: [{ y: 0, h, x: w + kerf }], cuts: [{ x: 0, y: 0, w, h }] });
  }
  return out.reduce((a, s) => {
    const uw = Math.max(...s.cuts.map((c) => c.x + c.w)), uh = Math.max(...s.cuts.map((c) => c.y + c.h));
    return a + Math.min(...sheets.filter((k) => (k.W >= uw && k.H >= uh) || (!grain && k.W >= uh && k.H >= uw)).map((k) => k.price));
  }, 0);
}

// Every rule a sheet plan must keep.
function checkSheets(r, pieces, stock, { kerf = 3, grain = false } = {}) {
  const sheets = stock.map((s) => ({ w: Math.max(s.w, s.h), h: Math.min(s.w, s.h), price: s.price }));
  const byId = Object.fromEntries(pieces.map((p) => [p.id, { ...p, a: Math.max(p.a, p.b), b: Math.min(p.a, p.b), g: grain ? p.grain ?? "along" : "any" }]));
  const turns = (p) => (p.g === "along" ? [[p.a, p.b]] : p.g === "across" ? [[p.b, p.a]] : [[p.a, p.b], [p.b, p.a]]);
  const misfit = Object.values(byId).filter((p) => !sheets.some((s) => turns(p).some(([w, h]) => w <= s.w && h <= s.h))).map((p) => p.id).sort();
  assert.deepEqual(r.problems.map((x) => x.id).sort(), misfit);
  for (const x of r.problems) { assert.equal(x.level, "error"); assert.equal(x.code, "E_SHEET_FIT"); }
  assert.deepEqual(r.sheets.flatMap((s) => s.cuts.map((c) => c.id)).sort(), pieces.map((p) => p.id).filter((id) => !misfit.includes(id)).sort());
  let cost = 0;
  for (const s of r.sheets) {
    const { w: W, h: H, price } = s.stock;
    assert.ok(sheets.some((k) => k.w === W && k.h === H && k.price === price), "stock is a real sheet");
    assert.ok(W >= H, "sheet normalised to w >= h");
    let used = 0;
    for (const c of s.cuts) {
      const p = byId[c.id];
      assert.ok(c.x >= 0 && c.y >= 0 && c.x + c.w <= W + 1e-9 && c.y + c.h <= H + 1e-9, `cut ${c.id} inside its sheet`);
      assert.ok((c.w === p.a && c.h === p.b) || (c.w === p.b && c.h === p.a), `cut ${c.id} has the piece size`);
      if (p.a !== p.b) assert.equal(c.rotated, c.w === p.b, `cut ${c.id} rotated flag`);
      else assert.equal(c.rotated, p.g === "across", `square cut ${c.id} rotated flag`);
      if (p.g === "along") assert.equal(c.rotated, false, `cut ${c.id} keeps the grain`);
      if (p.g === "across") assert.equal(c.rotated, true, `cut ${c.id} runs across the grain`);
      used += p.a * p.b;
    }
    s.cuts.forEach((c, i) => s.cuts.slice(i + 1).forEach((d) => {
      const apart = c.x + c.w + kerf <= d.x + 1e-6 || d.x + d.w + kerf <= c.x + 1e-6 || c.y + c.h + kerf <= d.y + 1e-6 || d.y + d.h + kerf <= c.y + 1e-6;
      assert.ok(apart, `cuts ${c.id} and ${d.id} keep a kerf apart`);
    }));
    near(s.usedArea, used, "usedArea");
    near(s.waste, W * H - used, "waste");
    const bx = Math.max(...s.cuts.map((c) => c.x + c.w)), by = Math.max(...s.cuts.map((c) => c.y + c.h));
    assert.ok(!sheets.some((k) => k.price < price && ((k.w >= bx && k.h >= by) || (!grain && k.w >= by && k.h >= bx))), "cheapest sheet that holds the used box");
    cost += price;
  }
  near(r.cost, cost, "cost is the sum of the sheets");
}

function sheetCase(R, sizes) {
  const stock = shuffle(R, sizes).slice(0, int(R, 1, 3)).map(([w, h]) => {
    const price = Math.round((w * h) / 1e6 * int(R, 900, 1600)) / 100;
    return R() < 0.5 ? { w, h, price } : { w: h, h: w, price };
  });
  const pieces = Array.from({ length: int(R, 1, 15) }, (_, i) => {
    const a = R() < 0.05 ? 2500 : int(R, 50, 1300), b = R() < 0.1 ? a : int(R, 30, a);
    const p = { id: `Q${i}`, label: "Q", a, b };
    const g = pick(R, ["along", "across", "any", undefined]);
    if (g) p.grain = g;
    return p;
  });
  return { stock, pieces, kerf: pick(R, [0, 3, 4]), grain: R() < 0.5 };
}

test("packSheets keeps the geometry, grain and cost rules on 300 random cases, at or below the shelf baseline", () => {
  const R = rng(5);
  for (let c = 0; c < 300; c++) {
    const { stock, pieces, kerf, grain } = sheetCase(R, CHAIN);
    const r = packSheets(pieces, stock, { kerf, grain });
    checkSheets(r, pieces, stock, { kerf, grain });
    assert.ok(r.cost <= shelfBaseline(pieces, stock, kerf, grain) + 1e-9, `case ${c}: cost above the shelf baseline`);
  }
});

test("packSheets keeps the rules with sheets of mixed shapes", () => {
  const R = rng(6);
  for (let c = 0; c < 150; c++) {
    const { stock, pieces, kerf, grain } = sheetCase(R, [...CHAIN, ...OTHER]);
    checkSheets(packSheets(pieces, stock, { kerf, grain }), pieces, stock, { kerf, grain });
  }
});

test("pieces turn to fit unless the grain stops them", () => {
  const sheet = [{ w: 2440, h: 1220, price: 38 }];
  const three = (grain) => [1, 2, 3].map((i) => ({ id: `P${i}`, label: "P", a: 1000, b: 700, ...(grain ? { grain } : {}) }));
  // Long sides along x fit only two on a sheet (2003 x 700 per row, one row); turned pieces fit three.
  const free = packSheets(three(), sheet, { kerf: 3 });
  assert.equal(free.sheets.length, 1);
  assert.ok(free.sheets[0].cuts.some((c) => c.rotated && c.w === 700));
  assert.equal(packSheets(three(), sheet, { kerf: 3, grain: true }).sheets.length, 2);
  assert.equal(packSheets(three("any"), sheet, { kerf: 3, grain: true }).sheets.length, 1);
  const across = packSheets(three("across"), sheet, { kerf: 3, grain: true });
  assert.equal(across.sheets.length, 1);
  assert.ok(across.sheets[0].cuts.every((c) => c.rotated && c.h === 1000));
});

test("the bookshelf back panel goes on the cheaper 1220 x 1220 sheet", () => {
  const r = packSheets([{ id: "C1", label: "C", a: 900, b: 800 }], [{ w: 2440, h: 1220, price: 38 }, { w: 1220, h: 1220, price: 24 }], { kerf: 3 });
  assert.equal(r.cost, 24);
  assert.deepEqual(r.sheets[0].stock, { w: 1220, h: 1220, price: 24 });
  assert.equal(r.sheets[0].usedArea, 720000);
  assert.equal(r.sheets[0].waste, 1220 * 1220 - 720000);
});

test("a kerf separates neighbours but not the sheet edges", () => {
  const half = [{ id: "H1", a: 1220, b: 610 }, { id: "H2", a: 1220, b: 610 }];
  const sheet = [{ w: 1220, h: 1220, price: 24 }];
  assert.equal(packSheets(half, sheet, { kerf: 0 }).sheets.length, 1);
  assert.equal(packSheets(half, sheet, { kerf: 3 }).sheets.length, 2);
  const four = [1, 2, 3, 4].map((i) => ({ id: `F${i}`, a: 1200, b: 600 }));
  const r = packSheets(four, [{ w: 2440, h: 1220, price: 38 }], { kerf: 3 });
  assert.equal(r.sheets.length, 1);
  checkSheets(r, four, [{ w: 2440, h: 1220, price: 38 }], { kerf: 3 });
});

test("a piece that fits no sheet gives E_SHEET_FIT", () => {
  const sheet = [{ w: 2440, h: 1220, price: 38 }];
  const big = packSheets([{ id: "X1", a: 2500, b: 100 }, { id: "Y1", a: 500, b: 400 }], sheet, { kerf: 3 });
  assert.deepEqual(big.problems.map((p) => [p.code, p.id, p.a, p.b]), [["E_SHEET_FIT", "X1", 2500, 100]]);
  assert.match(big.problems[0].hint, /^Add a sheet of 2500 mm × 100 mm or larger/);
  assert.equal(big.sheets.length, 1);
  const turned = packSheets([{ id: "G1", a: 1300, b: 1000, grain: "across" }], sheet, { kerf: 3, grain: true });
  assert.equal(turned.problems[0].code, "E_SHEET_FIT");
  assert.match(turned.problems[0].hint, /^If the grain direction is not important, set grain to "any"/);
  assert.equal(packSheets([{ id: "G1", a: 1300, b: 1000, grain: "across" }], sheet, { kerf: 3 }).problems.length, 0);
  assert.deepEqual(packSheets([], sheet), { sheets: [], cost: 0, problems: [] });
});

test("packSheets output is deterministic", () => {
  const R = rng(7);
  for (let c = 0; c < 30; c++) {
    const { stock, pieces, kerf, grain } = sheetCase(R, [...CHAIN, ...OTHER]);
    assert.deepEqual(packSheets(pieces, stock, { kerf, grain }), packSheets(pieces, stock, { kerf, grain }));
  }
});

test("40 sheet pieces pack in under 200 ms", () => {
  const R = rng(8);
  const stock = [{ w: 2440, h: 1220, price: 38 }, { w: 1220, h: 1220, price: 24 }, { w: 1220, h: 610, price: 14 }];
  for (let c = 0; c < 10; c++) {
    const pieces = Array.from({ length: 40 }, (_, i) => { const a = int(R, 100, 1200); return { id: `S${i}`, a, b: int(R, 50, a), grain: pick(R, ["along", "across", "any"]) }; });
    let ms = Infinity;
    for (let k = 0; k < 2; k++) { const t = performance.now(); packSheets(pieces, stock, { kerf: 3, grain: c % 2 === 0 }); ms = Math.min(ms, performance.now() - t); }
    assert.ok(ms < 200, `case ${c}: ${ms.toFixed(0)} ms`);
  }
});
