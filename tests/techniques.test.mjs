// techniques.mjs: the built-in card set, card shape, every line lint-clean (raw and filled), {kerf} filling.
import { test } from "node:test";
import assert from "node:assert/strict";
import { TECHNIQUES, fillTechnique } from "../engine/lib/techniques.mjs";
import { lint, sentences } from "../engine/lib/ste.mjs";

const IDS = ["measure-mark", "cut-straight", "pilot-hole", "countersink", "glue-joint", "clamp", "square-diagonals", "sand", "finish-wipe", "find-stud", "drill-straight", "level-check"];

// [kind, text, where] for every reader line of a card.
const lines = (id, c) => [
  ["title", c.name, `${id} name`],
  ...c.do.map((t, i) => ["procedure", t, `${id} do[${i}]`]),
  ...(c.warn ?? []).map((w, i) => ["warning", w.text, `${id} warn[${i}]`]),
  ...(c.why ? [["description", c.why, `${id} why`]] : []),
];

test("the built-in cards of the contract, in order", () => {
  assert.deepEqual(Object.keys(TECHNIQUES), IDS);
});

test("card shape: name, do lines, warn types, tools", () => {
  for (const [id, c] of Object.entries(TECHNIQUES)) {
    assert.deepEqual(Object.keys(c).filter((k) => !["name", "why", "warn", "do", "tools"].includes(k)), [], id);
    assert.ok(typeof c.name === "string" && c.name, id);
    assert.ok(Array.isArray(c.do) && c.do.length && c.do.every((t) => typeof t === "string" && t.trim()), id);
    for (const w of c.warn ?? []) assert.ok(["warning", "caution"].includes(w.type) && typeof w.text === "string", id);
    assert.ok(Array.isArray(c.tools) && c.tools.every((t) => typeof t === "string"), id);
  }
});

test("cards for power-tool work carry a WARNING", () => {
  for (const id of ["cut-straight", "pilot-hole", "countersink", "drill-straight", "sand", "find-stud", "finish-wipe"])
    assert.ok(TECHNIQUES[id].warn?.some((w) => w.type === "warning"), id);
});

test("every built-in WARNING and CAUTION states the risk after its command: two sentences or more", () => {
  for (const [id, c] of Object.entries(TECHNIQUES)) for (const w of fillTechnique(c, { units: "mm" }).warn ?? [])
    assert.ok(sentences(w.text).length >= 2, `${id}: "${w.text}"`);
});

test("every line passes the STE linter, raw and filled (mm and in)", () => {
  const cards = [["raw", TECHNIQUES], ["mm", null], ["in", null]];
  for (const [mode] of cards) {
    for (const [id, card] of Object.entries(TECHNIQUES)) {
      const c = mode === "raw" ? card : fillTechnique(card, { kerf: mode === "in" ? 3.175 : 3, units: mode });
      for (const [kind, text, where] of lines(id, c)) assert.deepEqual(lint(text, kind), [], `${mode} ${where}: ${JSON.stringify(text)}`);
    }
  }
});

test("cut-straight and measure-mark use {kerf}, not a fixed 3 mm", () => {
  assert.match(TECHNIQUES["cut-straight"].why, /\{kerf\}/);
  assert.match(TECHNIQUES["measure-mark"].why, /\{kerf\}/);
  assert.ok(!/\b3 mm\b/.test(JSON.stringify(TECHNIQUES["cut-straight"])));
});

test("fillTechnique fills {kerf} in the project units", () => {
  const card = TECHNIQUES["cut-straight"];
  assert.equal(fillTechnique(card, { kerf: 3, units: "mm" }).why, "The blade removes 3 mm of wood. A cut on the waste side keeps the part at its full length.");
  assert.match(fillTechnique(card, { kerf: 3.175, units: "in" }).why, /removes 1\/8 in of wood/);
  assert.match(fillTechnique(card, { kerf: 2.4, units: "mm" }).why, /removes 2\.4 mm of wood/);
  assert.match(fillTechnique(card, { units: "in" }).why, /1\/8 in/);
  assert.match(fillTechnique(card).why, /3 mm/);
  const custom = { name: "Rip a board", why: "Allow {kerf} per cut.", warn: [{ type: "warning", text: "Keep {kerf} clear." }], do: ["Mark {kerf} past the line.", "Cut."], tools: ["Saw {kerf}"] };
  const out = fillTechnique(custom, { kerf: 4, units: "mm" });
  assert.equal(out.why, "Allow 4 mm per cut.");
  assert.equal(out.warn[0].text, "Keep 4 mm clear.");
  assert.deepEqual(out.do, ["Mark 4 mm past the line.", "Cut."]);
  assert.deepEqual(out.tools, ["Saw 4 mm"]);
  assert.ok(!JSON.stringify(fillTechnique(card, { kerf: 3 })).includes("{kerf}"));
});

test("fillTechnique puts in the value of the project unit: {150 mm|6 in}, and a fine kerf", () => {
  const card = TECHNIQUES["cut-straight"];
  assert.equal(fillTechnique(card, { units: "mm" }).warn[2].text, "Keep your hands 150 mm from the blade. The blade can cut your fingers.");
  assert.equal(fillTechnique(card, { units: "in" }).warn[2].text, "Keep your hands 6 in from the blade. The blade can cut your fingers.");
  assert.equal(fillTechnique(TECHNIQUES["square-diagonals"], { units: "in" }).do[3], "Measure again until the two lengths are equal within 1/16 in.");
  assert.equal(fillTechnique(TECHNIQUES["find-stud"], { units: "mm" }).do[5], "Drill a 2 mm test hole between the marks.");
  assert.equal(fillTechnique(TECHNIQUES["find-stud"], { units: "in" }).do[2], "Do not drill within 6 in of a ceiling or a corner.");
  const text = (c) => [c.name, c.why ?? "", ...c.do, ...(c.warn ?? []).map((w) => w.text), ...c.tools].join("\n");
  for (const c of Object.values(TECHNIQUES)) {
    const inch = text(fillTechnique(c, { kerf: 3.175, units: "in" })), mm = text(fillTechnique(c, { kerf: 3, units: "mm" }));
    assert.doesNotMatch(inch, /\d\s*mm\b|[{}]/, `${c.name}: no mm value in an inch project`);
    assert.doesNotMatch(mm, /\d(\/\d+)? in\b|[{}]/, `${c.name}: no inch value in a mm project`);
  }
  assert.match(fillTechnique(card, { kerf: 0.09375 * 25.4, units: "in" }).why, /removes 3\/32 in of wood/);
  assert.match(fillTechnique(card, { kerf: 0.02 * 25.4, units: "in" }).why, /removes 0\.02 in of wood/);
});

test("the cards name nothing a project may not buy, and the drill cards share one WARNING text", () => {
  const all = JSON.stringify(TECHNIQUES);
  assert.doesNotMatch(all, /\b\d+ grit\b/, "no grit number");
  assert.doesNotMatch(all, /\bawl\b/i, "no awl");
  assert.doesNotMatch(all, /\bthe bench\b/, "a bench or a sawhorse");
  assert.doesNotMatch(all, /\bshims?\b/i, "no shims");
  const drill = ["pilot-hole", "countersink", "drill-straight"].map((id) => TECHNIQUES[id].warn.find((w) => w.type === "warning").text);
  assert.equal(new Set(drill).size, 1, drill.join(" | "));
});

test("cut-straight (a circular saw): kickback, support near the line, the lower guard, and no hand on the offcut", () => {
  const c = TECHNIQUES["cut-straight"];
  assert.equal(c.warn.filter((w) => w.type === "warning").length, 6);
  assert.equal(c.warn[3].text, "Stand to the side of the saw line. A saw that jumps back can hit you.");
  // The kickback and guard rows of safety.md section 4: a long offcut that sags pinches the blade.
  assert.equal(c.warn[4].text, "Support the board so that the cut stays open. A cut that closes on the blade makes the saw jump back toward you.");
  assert.equal(c.warn[5].text, "Do not lock or remove the lower blade guard. The guard covers the blade after the cut.");
  assert.equal(c.do[0], "Clamp the board to a bench or a sawhorse, with the line near the support.");
  assert.equal(c.do[1], "Put a second support under a long waste piece, near the line.");
  assert.ok(c.do.some((t) => /between two supports/.test(t)), c.do.join(" | "));
  assert.doesNotMatch(c.do.join(" "), /waste side free/);
  assert.equal(c.do.at(-2), "Let a short waste piece fall. Do not hold it.");
  assert.equal(c.do.at(-1), "Before you lift the saw, let the blade stop.");
  assert.deepEqual(c.do.filter((t) => /hold the waste/i.test(t)), []);
  // The new texts have no {mm|in} value: mm and inch projects show the same words.
  assert.deepEqual(fillTechnique(c, { units: "in" }).warn.slice(4), fillTechnique(c, { units: "mm" }).warn.slice(4));
});

test("find-stud: a cable and pipe detector first, and the cable WARNING of safety.md section 6", () => {
  const c = TECHNIQUES["find-stud"];
  assert.deepEqual(c.warn.map((w) => w.text), [
    "Do not drill above, below or beside a socket or a switch. Cables run there.",
    "Use a cable and pipe detector before you drill. A drill can hit a cable or a pipe.",
  ]);
  assert.ok(c.do.findIndex((t) => /cable and pipe detector/.test(t)) < c.do.findIndex((t) => /^Drill /.test(t)), "the detector before the test hole");
  assert.deepEqual(c.tools, ["Cable and pipe detector", "Stud finder", "Drill"]);
});

test("finish-wipe: one hazard in each WARNING, and the rag text of safety.md section 5", () => {
  const c = TECHNIQUES["finish-wipe"];
  assert.deepEqual(c.warn.map((w) => w.text), [
    "Wear nitrile gloves. The finish can hurt your skin.",
    "Open a window. Finish fumes can make you ill.",
    "Put used rags flat outdoors to dry, or in a closed metal can of water. Oily rags can catch fire.",
  ]);
});

test("fillTechnique copies: the library card does not change", () => {
  const before = JSON.stringify(TECHNIQUES);
  const out = fillTechnique(TECHNIQUES["cut-straight"], { kerf: 3 });
  out.do.push("Extra line.");
  out.warn[0].text = "Changed.";
  assert.equal(JSON.stringify(TECHNIQUES), before);
});
