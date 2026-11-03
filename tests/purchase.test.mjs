// purchase.mjs: trip order (online first, longest lead, first-needed step, name; Borrow last), items by first step,
// kit rows left out, "Any store" for rows with no known store, subtotals, and order-by dates from a start date.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildPurchase, orderBy, ANY_STORE, BORROW } from "../engine/lib/purchase.mjs";
import { compute } from "../engine/lib/model.mjs";

const shelf = () => JSON.parse(readFileSync(new URL("../examples/pine-bookshelf/project.json", import.meta.url), "utf8"));

const stores = {
  yard: { name: "Timber yard" },
  shop: { name: "Alpha shop" },
  web: { name: "Web order", online: true, lead: 2, note: "Order early.", url: "https://example.com" },
  far: { name: "Far away", online: true, lead: 7 },
  fast: { name: "Fast web", online: true },
};
const row = (key, store, first, amount, get = "buy") => ({ key, store, first, amount, get });
const rows = [
  row("pine", "yard", 0, 55.96), row("screws", "shop", 3, 8.98), row("glue", "shop", 1, 5.97), row("sand", "web", 2, 5.48),
  row("oil", "far", 8, 16.98), row("gloves", "fast", 8, 5.98), row("plugs", "fast", 4, null), row("kit", "shop", 2, 0, "kit"),
  row("tool/saw", null, 0, 0, "borrow"), row("tool/finder", "shop", 9, 0, "borrow"), row("tape", "nowhere", 5, 3), row("pens", null, 1, 2.5),
  row("nails", "shop", 1, 1.25),
];

test("trips: online first by lead, then by first step and name; Any store; Borrow last; kit rows left out", () => {
  const trips = buildPurchase(rows, stores, { currency: "USD" });
  // shop and Any store both start at step 1: the name decides ("Alpha shop" before "Any store").
  assert.deepEqual(trips.map((t) => t.store), ["far", "web", "fast", "yard", "shop", ANY_STORE, BORROW]);
  assert.deepEqual(trips.map((t) => t.name), ["Far away", "Web order", "Fast web", "Timber yard", "Alpha shop", "Any store", "Borrow"]);
  assert.deepEqual(Object.keys(trips[0]), ["store", "name", "online", "lead", "note", "url", "orderBy", "items", "subtotal"]);
  const by = Object.fromEntries(trips.map((t) => [t.store, t]));
  assert.deepEqual(by.shop.items, ["glue", "nails", "screws"], "items by first step, ties in BOQ order; kit left out");
  assert.deepEqual(by[ANY_STORE].items, ["pens", "tape"], "no store and unknown store");
  assert.deepEqual(by[BORROW].items, ["tool/saw", "tool/finder"]);
  assert.deepEqual([by.fast.subtotal, by.shop.subtotal, by[BORROW].subtotal], [5.98, 16.2, 0], "a null amount is left out");
  assert.deepEqual([by.web.note, by.web.url, by.web.online, by.web.lead, by.yard.url, by.yard.lead], ["Order early.", "https://example.com", true, 2, null, 0]);
  assert.ok(trips.every((t) => t.orderBy === null), "no start date, no order-by date");
  assert.ok(!trips.some((t) => t.items.includes("kit")));
});

test("trips: ties on online, lead and first step sort by name", () => {
  const s = { b: { name: "Beta" }, a: { name: "Alpha" }, c: { name: "Gamma", online: true } };
  const trips = buildPurchase([row("x", "b", 0, 1), row("y", "a", 0, 1), row("z", "c", 5, 1)], s);
  assert.deepEqual(trips.map((t) => t.name), ["Gamma", "Alpha", "Beta"]);
  assert.deepEqual(buildPurchase([], s), []);
});

test("orderBy: start minus lead days, across months, years and a leap day", () => {
  assert.equal(orderBy("2026-11-20", 3), "2026-11-17");
  assert.equal(orderBy("2026-03-02", 5), "2026-02-25");
  assert.equal(orderBy("2028-03-01", 1), "2028-02-29");
  assert.equal(orderBy("2027-01-02", 3), "2026-12-30");
  assert.equal(orderBy("2026-11-20", 1.5), "2026-11-18", "part of a day counts as a day");
  assert.equal(orderBy("2026-11-20", 0), "2026-11-20");
  assert.equal(orderBy("2026-11-20"), "2026-11-20");
  for (const bad of ["2026-02-30", "2026-13-01", "2026-2-3", "20261120", "", null, 20261120, "0099-01-01"]) assert.equal(orderBy(bad, 3), null, String(bad));
  const trips = buildPurchase(rows, stores, { start: "2026-11-20" });
  assert.deepEqual(trips.map((t) => t.orderBy), ["2026-11-13", "2026-11-18", "2026-11-20", "2026-11-20", "2026-11-20", "2026-11-20", "2026-11-20"]);
});

test("compute: the bookshelf trips and the start option", () => {
  const M = compute(shelf(), { start: "2026-11-20" });
  assert.deepEqual(M.purchase.map((t) => [t.name, t.orderBy]), [["Online order", "2026-11-17"], ["Hardware store", "2026-11-20"], ["Timber yard", "2026-11-20"], ["Borrow", "2026-11-20"]]);
  const keys = new Set(M.purchase.flatMap((t) => t.items));
  assert.deepEqual(M.boq.filter((r) => !keys.has(r.key)).map((r) => r.key), ["kit-screw"], "every row but the kit row is on a trip");
  const sum = M.purchase.reduce((a, t) => a + t.subtotal, 0);
  assert.equal(Math.round(sum * 100) / 100, M.totals.subtotal, "trip subtotals add up to the BOQ subtotal");
  assert.ok(compute(shelf()).purchase.every((t) => t.orderBy === null));
  const p = shelf();
  delete p.stores.online.lead;
  assert.equal(compute(p).purchase[0].name, "Online order", "an online store with no lead still comes first");
});
