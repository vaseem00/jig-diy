// locale.mjs: unit conversion, length/area/money/time formats.
import { test } from "node:test";
import assert from "node:assert/strict";
import { toMM, fromMM, fmtLen, fmtArea, fmtMoney, fmtRate, minorUnits, roundMoney, fmtDuration } from "../engine/lib/locale.mjs";

test("toMM / fromMM", () => {
  assert.equal(toMM(762, "mm"), 762);
  assert.equal(toMM(0.75, "in"), 19.05);
  assert.equal(toMM(0.125, "in"), 3.175);
  assert.equal(toMM(96, "in"), 2438.4);
  assert.equal(toMM(0.1, "in"), 2.54);
  assert.equal(fromMM(19.05, "in"), 0.75);
  assert.equal(fromMM(762, "mm"), 762);
  for (const v of [0.0625, 1.5, 30.0625, 47.25]) assert.equal(fromMM(toMM(v, "in"), "in"), v);
  assert.equal(toMM(undefined, "in"), undefined);
});

test("fmtLen in mm: integers, one decimal only when needed", () => {
  assert.equal(fmtLen(762, "mm"), "762 mm");
  assert.equal(fmtLen(2440), "2440 mm");
  assert.equal(fmtLen(19.05, "mm"), "19.1 mm");
  assert.equal(fmtLen(3.175, "mm"), "3.2 mm");
  assert.equal(fmtLen(762.04, "mm"), "762 mm");
  assert.equal(fmtLen(0, "mm"), "0 mm");
  assert.equal(fmtLen(NaN, "mm"), "?");
});

test("fmtLen in inches: whole inches and a reduced fraction to 1/16", () => {
  assert.equal(fmtLen(toMM(30.0625, "in"), "in"), "30 1/16 in");
  assert.equal(fmtLen(2438.4, "in"), "96 in");
  assert.equal(fmtLen(19.05, "in"), "3/4 in");
  assert.equal(fmtLen(3.175, "in"), "1/8 in");
  assert.equal(fmtLen(toMM(9.25, "in"), "in"), "9 1/4 in");
  assert.equal(fmtLen(toMM(1.5, "in"), "in"), "1 1/2 in");
  assert.equal(fmtLen(762, "in"), "30 in");
  assert.equal(fmtLen(0, "in"), "0 in");
  assert.equal(fmtLen(1, "in"), "1/16 in");
  assert.equal(fmtLen(0.7, "in"), "0 in");
  assert.equal(fmtLen(25.39, "in"), "1 in");
  assert.equal(fmtLen(-19.05, "in"), "-3/4 in");
});

test("fmtArea", () => {
  assert.equal(fmtArea(3.98, "mm"), "3.98 m²");
  assert.equal(fmtArea(4, "mm"), "4.00 m²");
  assert.equal(fmtArea(0.09290304, "in"), "1.00 ft²");
  assert.equal(fmtArea(3.98, "in"), "42.84 ft²");
});

test("money: minor units, rounding, format", () => {
  assert.equal(minorUnits("USD"), 2);
  assert.equal(minorUnits("JPY"), 0);
  assert.equal(minorUnits("KWD"), 3);
  assert.equal(minorUnits("not a code"), 2);
  assert.equal(roundMoney(12.345, "USD"), 12.35);
  assert.equal(roundMoney(1250.5, "JPY"), 1251);
  assert.equal(fmtMoney(1234.5, "USD"), "$1,234.50");
  assert.equal(fmtMoney(12, "EUR"), "€12.00");
  assert.equal(fmtMoney(1250.4, "JPY"), "¥1,250");
  assert.equal(fmtMoney(-0.001, "USD"), "$0.00");
  assert.equal(fmtMoney(null, "USD"), "price?");
  assert.equal(fmtMoney(NaN, "USD"), "price?");
  assert.equal(fmtMoney(12.5, "not a code"), "not a code 12.50");
});

test("money: the same text on every Node build (plain spaces, a fixed table of minor units)", () => {
  assert.equal(fmtMoney(1234.5, "USD"), "$1,234.50");
  assert.equal(fmtMoney(1234.5, "EUR"), "€1,234.50");
  assert.equal(fmtMoney(1234.5, "GBP"), "£1,234.50");
  assert.equal(fmtMoney(1234.5, "JPY"), "¥1,235");
  assert.equal(fmtMoney(1234.5, "BHD"), "BHD 1,234.500");
  assert.equal(fmtMoney(1234.5, "CHF"), "CHF 1,234.50");
  for (const c of ["BHD", "CHF", "SEK", "PLN"]) assert.doesNotMatch(fmtMoney(1, c), /[   ]/, c);
  assert.deepEqual(["USD", "JPY", "HUF", "BHD", "KWD", "EUR", "XYZ"].map(minorUnits), [2, 0, 0, 3, 3, 2, 2]);
  assert.equal(fmtRate(0.045, "USD"), "$0.045");
  assert.equal(fmtRate(12.5, "USD"), "$12.50");
  assert.equal(fmtRate(12.5, "JPY"), "¥12.5");
  assert.equal(fmtRate(7.33333, "USD"), "$7.3333");
  assert.equal(fmtRate(1.2345, "BHD"), "BHD 1.2345");
  assert.equal(fmtRate(null, "USD"), "price?");
  assert.equal(fmtRate(0.5, "not a code"), "not a code 0.50");
});

test("fmtLen with a fine fraction: kerf and trim to 1/64 in, or decimal inches", () => {
  assert.equal(fmtLen(toMM(0.09375, "in"), "in", { den: 64 }), "3/32 in");
  assert.equal(fmtLen(toMM(0.125, "in"), "in", { den: 64 }), "1/8 in");
  assert.equal(fmtLen(toMM(0.02, "in"), "in", { den: 64 }), "0.02 in");
  assert.equal(fmtLen(toMM(0.059, "in"), "in", { den: 64 }), "0.059 in");
  assert.equal(fmtLen(toMM(1.25, "in"), "in", { den: 64 }), "1 1/4 in");
  assert.equal(fmtLen(0, "in", { den: 64 }), "0 in");
  assert.equal(fmtLen(toMM(0.09375, "in"), "in"), "1/8 in", "lengths stay at 1/16");
  assert.equal(fmtLen(2.4, "mm", { den: 64 }), "2.4 mm");
});

test("fmtDuration", () => {
  assert.equal(fmtDuration(0), "0 min");
  assert.equal(fmtDuration(0.4), "1 min");
  assert.equal(fmtDuration(2), "2 min");
  assert.equal(fmtDuration(7.4), "7 min");
  assert.equal(fmtDuration(9.6), "10 min");
  assert.equal(fmtDuration(12), "10 min");
  assert.equal(fmtDuration(13), "15 min");
  assert.equal(fmtDuration(60), "1 h");
  assert.equal(fmtDuration(85), "1 h 25 min");
  assert.equal(fmtDuration(118), "2 h");
  assert.equal(fmtDuration(-5), "0 min");
  assert.equal(fmtDuration(undefined), "0 min");
});
