// util.mjs: rounding, plurals, grouping, escaping, words, did-you-mean, stable sort.
import { test } from "node:test";
import assert from "node:assert/strict";
import { round, amount, plural, groupBy, esc, term, words, didYouMean, stableSort } from "../engine/lib/util.mjs";

test("round: half away from zero, binary noise absorbed, no -0", () => {
  assert.equal(round(1.005, 2), 1.01);
  assert.equal(round(2.675, 2), 2.68);
  assert.equal(round(2.5), 3);
  assert.equal(round(-2.5), -3);
  assert.equal(round(0.1 + 0.2, 6), 0.3);
  assert.equal(round(19.05, 1), 19.1);
  assert.equal(round(1234.5678, 0), 1235);
  assert.ok(Object.is(round(-0.0001, 2), 0));
  assert.ok(Number.isNaN(round(NaN, 2)));
  assert.equal(round("x", 2), "x");
  // A whole scaled value, or one from 2^49 up, gets no bump that adds one.
  assert.equal(round(2e6, 9), 2e6);
  assert.equal(round(2000001, 9), 2000001);
  assert.equal(Math.ceil(round(2e6, 9)), 2e6);
  for (const [n, d] of [[1e6, 9], [1100000, 9], [999999, 9], [1e9, 6], [999999999999999, 0], [1e13, 2], [1000000.5, 9], [-1e6, 9]]) assert.equal(round(n, d), n, `round(${n}, ${d})`);
  // The first whole numbers that the old 2^50 guard moved: about 9.85e14 after scaling.
  for (let a = 985162418487296; a < 985162418487296 + 64; a++) assert.equal(round(a, 0), a, `round(${a}, 0)`);
});

test("amount: 2 decimals, but a small positive amount keeps 2 significant digits", () => {
  assert.equal(amount(0.004), 0.004);
  assert.equal(amount(0.00213), 0.0021);
  assert.equal(amount(1.234), 1.23);
  assert.equal(amount(0), 0);
  assert.equal(amount(0.01), 0.01);
  assert.equal(amount(-0.004), 0);
});

test("term: control characters become U+FFFD; tab and line feed stay", () => {
  assert.equal(term("a\u001b[31mb\rc\u0007d\u009be\tf\ng"), "a�[31mb�c�d�e\tf\ng");
  assert.equal(term(null), "");
});

test("plural", () => {
  assert.equal(plural(1, "board"), "1 board");
  assert.equal(plural(3, "board"), "3 boards");
  assert.equal(plural(0, "cut"), "0 cuts");
  assert.equal(plural(1, "sheets"), "1 sheet");
  assert.equal(plural(5, "sheets"), "5 sheets");
  assert.equal(plural(2, "box"), "2 boxes");
  assert.equal(plural(1, "boxes"), "1 box");
  assert.equal(plural(2, "battery"), "2 batteries");
  assert.equal(plural(1, "batteries"), "1 battery");
  assert.equal(plural(2, "glass"), "2 glasses");
  assert.equal(plural(1, "glass"), "1 glass");
  assert.equal(plural(2, "piece"), "2 pieces");
  assert.equal(plural(2, "ml"), "2 ml");
  assert.equal(plural(2, "L"), "2 L");
  // Abbreviations and units of more than one word take no s, unless the last word is a count noun.
  assert.equal(plural(5.5, "cu ft"), "5.5 cu ft");
  assert.equal(plural(2, "gal"), "2 gal");
  assert.equal(plural(3, "qt"), "3 qt");
  assert.equal(plural(4, "pcs."), "4 pcs.");
  assert.equal(plural(2, "lbs"), "2 lbs");
  assert.equal(plural(2, "fl oz"), "2 fl oz");
  assert.equal(plural(2, "sanding sheet"), "2 sanding sheets");
  assert.equal(plural(1, "sanding sheets"), "1 sanding sheet");
  assert.equal(plural(2, "pair of gloves"), "2 pairs of gloves");
  assert.equal(plural(2, "box of 50"), "2 boxes of 50");
  assert.equal(plural(3, "bag"), "3 bags");
  assert.equal(plural(2, "day"), "2 days");
  // A unit of more words changes its last word, unless that word is an abbreviation or a short unit.
  assert.equal(plural(2, "console error"), "2 console errors");
  assert.equal(plural(16, "shelf pin"), "16 shelf pins");
  assert.equal(plural(4, "cabinet hinge"), "4 cabinet hinges");
  assert.equal(plural(4, "shelf bracket"), "4 shelf brackets");
  assert.equal(plural(1, "shelf pins"), "1 shelf pin");
  assert.equal(plural(1, "shelf brackets"), "1 shelf bracket");
  assert.equal(plural(3, "kg bag"), "3 kg bags");
  assert.equal(plural(4, "cu ft"), "4 cu ft");
  assert.equal(plural(2, "sq ft"), "2 sq ft");
  assert.equal(plural(2, "linear m"), "2 linear m");
  assert.equal(plural(2, "cu. ft."), "2 cu. ft.");
  // foot and feet.
  assert.equal(plural(3, "board foot"), "3 board feet");
  assert.equal(plural(3, "board feet"), "3 board feet");
  assert.equal(plural(1, "board feet"), "1 board foot");
  assert.equal(plural(2, "cubic feet"), "2 cubic feet");
  assert.equal(plural(1, "Cubic Feet"), "1 Cubic Foot");
  assert.equal(plural(2, "foot"), "2 feet");
  // A note in brackets at the end stays as it is; the word before it changes.
  assert.equal(plural(3, "tin (small)"), "3 tins (small)");
  assert.equal(plural(1, "tin (small)"), "1 tin (small)");
  assert.equal(plural(2, "bag (dry mix)"), "2 bags (dry mix)");
  assert.equal(plural(2, "bag (25 kg)"), "2 bags (25 kg)");
  assert.equal(plural(3, "piece (offcut)"), "3 pieces (offcut)");
  assert.equal(plural(2, "pair of gloves (L)"), "2 pairs of gloves (L)");
  assert.equal(plural(1, "tins (small)"), "1 tin (small)");
});

test("groupBy keeps first-seen order and takes a function or a key", () => {
  const list = [{ s: "b", n: 1 }, { s: "a", n: 2 }, { s: "b", n: 3 }];
  assert.deepEqual(groupBy(list, "s"), [["b", [list[0], list[2]]], ["a", [list[1]]]]);
  assert.deepEqual(groupBy(list, (x) => x.n % 2), [[1, [list[0], list[2]]], [0, [list[1]]]]);
  assert.deepEqual(groupBy(undefined, "s"), []);
});

test("esc escapes the five HTML characters", () => {
  assert.equal(esc(`<a href="x">Tom & 'Jerry'</a>`), "&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;");
  assert.equal(esc(null), "");
  assert.equal(esc(12), "12");
});

test("words", () => {
  assert.deepEqual(words("Drill a 4.5 mm hole, 1/16 deep. Don't stop!"), ["drill", "a", "4.5", "mm", "hole", "1/16", "deep", "don't", "stop"]);
  assert.deepEqual(words("Pine board (1x10)"), ["pine", "board", "1x10"]);
  assert.deepEqual(words(""), []);
  assert.deepEqual(words(undefined), []);
});

test("didYouMean", () => {
  assert.equal(didYouMean("linar", ["linear", "sheet", "each", "amount"]), "linear");
  assert.equal(didYouMean("meterials", ["materials", "parts", "steps"]), "materials");
  assert.equal(didYouMean("Warning", ["warning", "caution"]), "warning");
  assert.equal(didYouMean("lenght", ["length", "price"]), "length");
  assert.equal(didYouMean("dri", ["material", "at", "dir"]), "dir");
  assert.equal(didYouMean("mat", ["material", "materials"]), "material");
  assert.equal(didYouMean("materialsList", new Set(["materials", "parts"])), "materials");
  assert.equal(didYouMean("xyz", ["linear", "sheet"]), null);
  assert.equal(didYouMean("ab", ["at", "id"]), "at");
  assert.equal(didYouMean("x", ["id", "at"]), null);
  assert.equal(didYouMean("", ["a"]), null);
  assert.equal(didYouMean(5, ["a"]), null);
});

test("stableSort keeps equal items in order and copies", () => {
  const list = [{ k: 2, i: 0 }, { k: 1, i: 1 }, { k: 2, i: 2 }, { k: 1, i: 3 }];
  const sorted = stableSort(list, (a, b) => a.k - b.k);
  assert.deepEqual(sorted.map((x) => x.i), [1, 3, 0, 2]);
  assert.deepEqual(list.map((x) => x.i), [0, 1, 2, 3]);
});
