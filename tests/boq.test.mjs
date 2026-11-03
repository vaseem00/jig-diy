// boq.mjs: row arithmetic (amount = qty x rate), packs with spare, finish need from area and coverage, kit, borrow,
// rent and unknown-price rows, group order with per-group codes (custom groups O, last), and the totals with
// contingency and tax (added or included). Also the arithmetic and code stability on computed projects.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildBoq, GROUPS, OTHER, TOOL_KEY } from "../engine/lib/boq.mjs";
import { compute } from "../engine/lib/model.mjs";
import { roundMoney } from "../engine/lib/locale.mjs";

const load = (rel) => JSON.parse(readFileSync(new URL(rel, import.meta.url), "utf8"));
const shelf = () => load("../examples/pine-bookshelf/project.json");
const bench = () => load("./fixtures/inch-bench.json");

// The arithmetic every BOQ must keep.
function arithmetic(M) {
  const T = M.totals, c = T.currency;
  for (const r of M.boq) {
    if (r.amount !== null) assert.equal(r.amount, roundMoney(r.qty * r.rate, c), `${r.code} amount = qty x rate`);
    assert.match(r.code, /^[THCFSXO]\d{2,}$/);
  }
  assert.equal(T.subtotal, roundMoney(M.boq.reduce((a, r) => a + (r.amount ?? 0), 0), c), "subtotal");
  assert.equal(T.contingency, roundMoney(T.subtotal * T.contingencyRate, c), "contingency");
  assert.equal(T.total, roundMoney(T.subtotal + T.contingency + (T.taxIncluded ? 0 : T.tax), c), "subtotal + contingency + tax = total");
  if (T.taxIncluded) assert.equal(T.tax, roundMoney(T.total - T.total / (1 + T.taxRate), c), "included tax");
  assert.equal(T.unknownPrices, M.boq.filter((r) => r.amount === null).length);
}

// A synthetic context: boards from a cut plan, packs with spare, a finish, kit and unknown-price items, tools.
const ctx = (over = {}) => ({
  units: "mm", currency: "USD", contingency: 0.1, tax: null, area: 4,
  materials: {
    board: { kind: "linear", name: "Pine board", spec: "19 x 235 mm", section: [235, 19], est: true, store: "yard" },
    screw: { kind: "each", name: "Wood screw", pack: 50, price: 8, spare: 0.1, unit: "piece", len: 50, est: true, store: "hw" },
    glue: { kind: "amount", name: "Wood glue", unit: "ml", pack: 250, packName: "250 ml bottle", price: 6.99, spare: 0, est: true },
    oil: { kind: "amount", name: "Oil", unit: "L", pack: 0.5, price: 12.5, coverage: 10, coats: 2, spare: 0.1, est: false },
    plug: { kind: "each", name: "Wall plug", group: "Electrical", pack: 1, price: 0.25, unit: "piece", spare: 0, est: true },
    alarm: { kind: "each", name: "Alarm", group: "Alarm", pack: 1, price: 20, unit: "piece", spare: 0, est: true },
    kit: { kind: "each", name: "Kit screw", included: true, unit: "piece", spare: 0.1, est: true },
    tape: { kind: "each", name: "Tape", unit: "roll", pack: 1, spare: 0, est: true },
    unused: { kind: "each", name: "Hinge", unit: "piece", pack: 1, price: 3, spare: 0 },
  },
  needs: {
    board: { first: 0, count: 0, amount: 0, finish: [] },
    screw: { first: 2, count: 46, amount: 0, finish: [], fastener: true },
    glue: { first: 3, count: 0, amount: 40, finish: [] },
    oil: { first: 5, count: 0, amount: 0, finish: [{ area: 4, coats: 2 }] },
    plug: { first: 1, count: 3, amount: 0, finish: [], part: true },
    alarm: { first: 0, count: 1, amount: 0, finish: [], part: true },
    kit: { first: 4, count: 4, amount: 0, finish: [], fastener: true },
    tape: { first: 1, count: 2, amount: 0, finish: [] },
  },
  cuts: [{ material: "board", name: "Pine board", kind: "linear", color: null, boards: [
    { stock: { length: 2440, price: 27.98 }, cuts: [{ id: "A1", label: "A", len: 900, at: 0 }, { id: "B1", label: "B", len: 762, at: 903 }], used: 1665, waste: 775 },
    { stock: { length: 2440, price: 27.98 }, cuts: [{ id: "A2", label: "A", len: 900, at: 0 }], used: 900, waste: 1540 },
    { stock: { length: 1220, price: 14.9 }, cuts: [{ id: "B2", label: "B", len: 762, at: 0 }], used: 762, waste: 458 },
  ] }],
  tools: [
    { id: "square", name: "Square", price: 9.98, qty: 1, get: "buy", est: true, first: 0, store: "hw" },
    { id: "sander", name: "Sander", price: 15, qty: 2, days: 3, get: "rent", est: true, first: 1 },
    { id: "saw", name: "Saw", get: "borrow", qty: 1, first: 0, price: 99 },
    { id: "tape-m", name: "Tape measure", have: true, first: 0 },
    { id: "glasses", name: "Safety glasses", ppe: true, price: 6.97, get: "buy", qty: 1, first: 0, est: true },
    { id: "level", name: "Level", get: "buy", qty: 1, first: 2 },
  ],
  ...over,
});
const byKey = (rows) => Object.fromEntries(rows.map((r) => [r.key, r]));

test("rows: boards per stock length, packs with spare, finish need, kit, rent, borrow and unknown prices", () => {
  const { rows } = buildBoq(ctx()), r = byKey(rows);
  assert.deepEqual(Object.keys(rows[0]), ["code", "group", "key", "id", "name", "spec", "need", "needQty", "qty", "unit", "rate", "amount", "est", "store", "first", "note", "get"]);
  assert.deepEqual([r["board:2440"].qty, r["board:2440"].amount, r["board:2440"].need, r["board:2440"].needQty], [2, 55.96, "3 pieces, 2562 mm", 2562]);
  assert.equal(r["board:2440"].spec, "19 x 235 mm, 2440 mm long");
  assert.deepEqual([r["board:1220"].qty, r["board:1220"].amount], [1, 14.9]);
  // 46 x 1.1 = 50.6 screws -> 2 packs of 50
  assert.deepEqual([r.screw.qty, r.screw.unit, r.screw.amount, r.screw.need, r.screw.group], [2, "pack of 50", 16, "46 pieces + 10% spare", "Hardware"]);
  assert.deepEqual([r.glue.qty, r.glue.unit, r.glue.need, r.glue.group], [1, "250 ml bottle", "40 ml", "Consumables"]);
  // 4 m² x 2 coats / 10 m² per L = 0.8 L, + 10% = 0.88 L -> 2 packs of 0.5 L; a finish note says it is an upper bound
  assert.deepEqual([r.oil.qty, r.oil.needQty, r.oil.amount, r.oil.group, r.oil.est], [2, 0.8, 25, "Finish", false]);
  assert.match(r.oil.note, /upper bound/);
  assert.match(r.oil.note, /4\.00 m² × 2 coats ÷ 10 m² per L/);
  assert.deepEqual([r.kit.get, r.kit.need, r.kit.rate, r.kit.amount, r.kit.est], ["kit", "4 pieces, in the kit", 0, 0, false]);
  assert.deepEqual([r.tape.rate, r.tape.amount, r.tape.need], [null, null, "2 rolls"]);
  assert.equal(r.unused, undefined, "no need, no row");
  // rent: qty x days x price; borrow: 0; have: not in the BOQ; no price: amount null
  const t = (id) => r[`${TOOL_KEY}${id}`];
  assert.deepEqual([t("sander").qty, t("sander").unit, t("sander").rate, t("sander").amount, t("sander").need], [6, "day", 15, 90, "rent 2 for 3 days"]);
  assert.deepEqual([t("saw").get, t("saw").rate, t("saw").amount, t("saw").est, t("saw").store], ["borrow", 0, 0, false, null]);
  assert.equal(t("tape-m"), undefined);
  assert.deepEqual([t("level").rate, t("level").amount, t("level").est], [null, null, false]);
  assert.deepEqual([t("glasses").group, t("square").group], ["Safety", "Tools"]);
});

test("groups: fixed order and letters, codes numbered inside each group, other groups O and last", () => {
  const { rows } = buildBoq(ctx());
  assert.deepEqual(rows.map((r) => r.code), ["T01", "T02", "H01", "H02", "C01", "C02", "F01", "S01", "X01", "X02", "X03", "X04", "O01", "O02"]);
  assert.deepEqual(rows.map((r) => r.group), ["Timber and sheet", "Timber and sheet", "Hardware", "Hardware", "Consumables", "Consumables",
    "Finish", "Safety", "Tools", "Tools", "Tools", "Tools", "Alarm", "Electrical"]);
  // inside a group: by first step, then the project order
  assert.deepEqual(rows.filter((r) => r.group === "Hardware").map((r) => r.key), ["screw", "kit"]);
  assert.deepEqual(rows.filter((r) => r.group === "Consumables").map((r) => r.key), ["tape", "glue"]);
  assert.deepEqual(rows.filter((r) => r.group === "Tools").map((r) => r.id), ["square", "saw", "sander", "level"]);
  for (const [g, L] of Object.entries(GROUPS)) for (const r of rows.filter((x) => x.group === g)) assert.equal(r.code[0], L);
  assert.equal(OTHER, "O");
  // a known group name in another case is the known group
  const m = ctx();
  m.materials.plug.group = "hardware";
  assert.deepEqual(buildBoq(m).rows.filter((r) => r.group === "Hardware").map((r) => `${r.code} ${r.key}`), ["H01 plug", "H02 screw", "H03 kit"]);
});

test("totals: contingency, tax added or included, unknown prices, currency minor units, area", () => {
  const plain = buildBoq(ctx()).totals;
  assert.deepEqual(plain, {
    subtotal: 246.55, contingencyRate: 0.1, contingency: 24.66, taxRate: 0, taxLabel: null, taxIncluded: false, tax: 0, total: 271.21,
    currency: "USD", area: 4, areaDisplay: "4.00 m²", unknownPrices: 2,
  });
  const added = buildBoq(ctx({ tax: { rate: 0.2, label: "VAT", included: false } })).totals;
  assert.deepEqual([added.tax, added.total, added.taxLabel, added.taxIncluded], [54.24, 325.45, "VAT", false]);
  const incl = buildBoq(ctx({ tax: { rate: 0.2, label: "VAT", included: true } })).totals;
  assert.deepEqual([incl.total, incl.tax, incl.taxIncluded], [271.21, 45.2, true]);
  const yen = buildBoq(ctx({ currency: "JPY" }));
  assert.ok(yen.rows.every((r) => r.amount === null || Number.isInteger(r.amount)), "JPY has no minor unit");
  assert.ok(Number.isInteger(yen.totals.total));
  assert.equal(buildBoq(ctx({ units: "in", area: 0.09290304 })).totals.areaDisplay, "1.00 ft²");
  const none = buildBoq({});
  assert.deepEqual([none.rows, none.totals.total, none.totals.subtotal], [[], 0, 0]);
});

test("amount = qty x the price as given: a price below the minor unit does not round first", () => {
  const each = (price, count, currency = "USD") => buildBoq({ currency, materials: { n: { kind: "each", name: "Nail", pack: 1, price, spare: 0 } }, needs: { n: { first: 0, count, amount: 0, finish: [] } } });
  const usd = each(0.045, 200);
  assert.deepEqual([usd.rows[0].rate, usd.rows[0].amount, usd.totals.subtotal], [0.045, 9, 9]);
  assert.equal(each(0.125, 1000).rows[0].amount, 125);
  assert.equal(each(12.5, 1000, "JPY").rows[0].amount, 12500);
  assert.equal(each(0.034, 500, "EUR").rows[0].amount, 17);
  const tool = buildBoq({ tools: [{ id: "c", name: "Clamp", get: "buy", qty: 3, price: 7.333, first: 0 }] });
  assert.deepEqual([tool.rows[0].rate, tool.rows[0].amount], [7.333, 22]);
  const { rows, totals } = buildBoq(ctx());
  assert.equal(totals.subtotal, roundMoney(rows.reduce((a, r) => a + (r.amount ?? 0), 0), "USD"), "subtotal = the sum of the row amounts");
});

test("need text: a tiny finish keeps 2 significant digits; a huge need does not buy one pack too many", () => {
  const m = ctx();
  m.needs.oil.finish = [{ area: 0.0021 * 10 / 2, coats: 2 }]; // 0.0021 L of oil at 10 m² per L
  const oil = byKey(buildBoq(m).rows).oil;
  assert.deepEqual([oil.need, oil.qty], ["0.0021 L + 10% spare", 1]);
  const big = buildBoq({ materials: { s: { kind: "each", name: "Screw", pack: 1, price: 1e3, spare: 1 } }, needs: { s: { first: 0, count: 1e6, amount: 0, finish: [] } } });
  assert.deepEqual([big.rows[0].qty, big.rows[0].amount], [2e6, 2e9]);
  const exact = buildBoq({ materials: { s: { kind: "each", name: "Screw", pack: 50, price: 1, spare: 0.1 } }, needs: { s: { first: 0, count: 500, amount: 0, finish: [] } } });
  assert.equal(exact.rows[0].qty, 11, "550 / 50 = 11 packs, not 12");
});

test("inch projects: finish coverage is per ft²", () => {
  const m = ctx({ units: "in" });
  m.needs.oil.finish = [{ area: 0.9290304, coats: 1 }]; // 10 ft² / 10 ft² per L = 1 L, + 10% -> 3 packs of 0.5 L
  const r = byKey(buildBoq(m).rows);
  assert.deepEqual([r.oil.needQty, r.oil.qty], [1, 3]);
  assert.match(r.oil.note, /10\.00 ft² × 1 coat ÷ 10 ft² per L/);
});

test("computed projects keep the arithmetic: bookshelf, inch bench, tax included, JPY", () => {
  arithmetic(compute(shelf()));
  arithmetic(compute(bench()));
  const vat = shelf();
  vat.tax = { rate: 0.19, label: "VAT", included: true };
  vat.currency = "EUR";
  const M = compute(vat);
  arithmetic(M);
  assert.equal(M.totals.total, 254.17);
  assert.equal(M.totals.tax, 40.58);
  const yen = shelf();
  yen.currency = "JPY";
  arithmetic(compute(yen));
});

test("bookshelf BOQ: optimised pine, groups and the totals", () => {
  const M = compute(shelf()), r = byKey(M.boq);
  assert.deepEqual([r["pine-1x10:2440"].qty, r["pine-1x10:2440"].amount], [2, 55.96]);
  assert.equal(M.boq.filter((x) => x.id === "pine-1x10").length, 1, "one stock length");
  assert.deepEqual([M.totals.subtotal, M.totals.contingency, M.totals.total], [231.06, 23.11, 254.17]);
  assert.deepEqual(M.boq.map((x) => x.code).join(" "), "T01 T02 H01 H02 H03 H04 C01 C02 C03 C04 F01 F02 S01 S02 S03 S04 X01 X02 X03 X04 X05 X06 X07");
  assert.deepEqual([r["kit-screw"].get, r["kit-screw"].amount], ["kit", 0]);
  assert.equal(r.poly.needQty, 0.723);
});

test("code stability: a new timber row does not renumber the hardware", () => {
  const codes = (M, g) => Object.fromEntries(M.boq.filter((x) => x.group === g).map((x) => [x.key, x.code]));
  const before = compute(shelf(), { mode: "estimate" });
  const p = shelf();
  p.materials.oak = { kind: "linear", name: "Oak strip", section: [40, 10], stock: [{ length: 1000, price: 4 }], store: "lumber" };
  p.parts.push({ id: "F1", label: "F", name: "Strip", material: "oak", size: [600, 10, 40] });
  const after = compute(p, { mode: "estimate" });
  assert.equal(after.counts.error, 0);
  for (const g of ["Hardware", "Consumables", "Finish", "Safety", "Tools"]) assert.deepEqual(codes(after, g), codes(before, g), g);
  assert.deepEqual(Object.values(codes(after, "Timber and sheet")), ["T01", "T02", "T03"]);
});
