// safety.mjs: every code fires with path and where, and stays quiet on a clean project; hand-off screen
// (topics, false friends such as "gasket"), tip-over with anchors, the summary and its PPE notes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { safetyChecks, HANDOFF_TOPICS, PPE_FOR } from "../engine/lib/safety.mjs";
import { TECHNIQUES } from "../engine/lib/techniques.mjs";
import { lint } from "../engine/lib/ste.mjs";
import { compute } from "../engine/lib/model.mjs";

const RAGS = "Put used rags flat outdoors to dry, or in a closed metal can of water. Oily rags can catch fire.";
const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

// A small normalized project (lengths in mm): a low shelf, 300 tall and 200 deep.
const clean = () => ({
  id: "low-shelf", title: "Pine shelf", summary: "A low shelf with two sides and one shelf.", units: "mm",
  materials: {
    pine: { kind: "linear", name: "Pine board", section: [200, 19], stock: [{ length: 2400, price: 10 }] },
    screw: { kind: "each", name: "Wood screw", len: 40, d: 4 },
    oil: { kind: "amount", name: "Danish oil", unit: "L", coverage: 10 },
  },
  tools: [
    { id: "saw", name: "Circular saw", power: true }, { id: "drill", name: "Cordless drill", power: true },
    { id: "glasses", name: "Safety glasses", ppe: true }, { id: "tape", name: "Tape measure" },
  ],
  parts: [
    { id: "A1", label: "A", name: "Side", material: "pine", size: [19, 300, 200], at: [0, 0, 0] },
    { id: "A2", label: "A", name: "Side", material: "pine", size: [19, 300, 200], at: [381, 0, 0] },
    { id: "B1", label: "B", name: "Shelf", material: "pine", size: [362, 19, 200], at: [19, 100, 0] },
  ],
  props: {}, techniques: {}, uses: {},
  steps: [
    { id: "cut", title: "Cut the parts", tools: ["saw", "tape"], teach: ["cut-straight"], do: ["Cut each part on the waste side of the line."], check: "Make sure that you have three parts." },
    { id: "join", title: "Attach the shelf", tools: ["drill", "glasses"], parts: ["A1", "A2", "B1"],
      fasteners: [{ material: "screw", at: [0, 109.5, 100], dir: [1, 0, 0] }],
      warn: [{ type: "warning", text: "Wear safety glasses." }], do: ["Install two screws through each side into the shelf."], why: "The screws hold the shelf." },
    { id: "oil", title: "Apply the oil", finish: { material: "oil" }, do: ["Apply a thin coat of oil."], tip: "Thin coats dry fast." },
  ],
  handoff: [], safety: { tipRatio: 2 },
});
const run = (p, ctx = {}) => safetyChecks(p, { mode: "guide", ...ctx });
const codes = (r) => r.problems.map((p) => `${p.code} ${p.path}`);
function fires(change, code, path, { where, msg, ctx } = {}) {
  const p = clean();
  change(p);
  const r = run(p, ctx), hit = r.problems.find((x) => x.code === code && (path === undefined || x.path === path));
  assert.ok(hit, `${code} ${path} not found in: ${codes(r).join("; ")}`);
  assert.equal(hit.level, "error");
  if (where) assert.equal(hit.where, where);
  if (msg) assert.match(hit.msg, msg);
  for (const k of ["msg", "hint", "where", "path"]) assert.ok(typeof hit[k] === "string" && hit[k].length > 0, k);
  return r;
}
const quiet = (change, code, ctx) => {
  const p = clean();
  change(p);
  const r = run(p, ctx);
  assert.deepEqual(r.problems.filter((x) => !code || x.code === code).map((x) => `${x.code} ${x.path}: ${x.msg}`), []);
  return r;
};

test("clean project: no problems in any mode, and the summary", () => {
  for (const mode of ["estimate", "plan", "guide"]) assert.deepEqual(codes(safetyChecks(clean(), { mode })), [], mode);
  const { summary } = run(clean());
  assert.deepEqual(summary.tip, { height: 300, depth: 200, ratio: 1.5, limit: 2, anchored: false });
  assert.deepEqual(summary.ppe, ["glasses"]);
  assert.deepEqual(summary.power, ["saw", "drill"]);
  assert.deepEqual(summary.handoffs, []);
  assert.deepEqual(summary.notes, [PPE_FOR.saw.note, PPE_FOR.drill.note, RAGS]);
});

test("E_POWER_NO_WARNING", () => {
  fires((p) => delete p.steps[1].warn, "E_POWER_NO_WARNING", "steps[1].warn", { where: "step 2", msg: /"Cordless drill"/ });
  fires((p) => (p.steps[1].warn = [{ type: "caution", text: "Do not overtighten the screws." }]), "E_POWER_NO_WARNING", "steps[1].warn");
  fires((p) => delete p.steps[0].teach, "E_POWER_NO_WARNING", "steps[0].warn", { where: "step 1", msg: /"Circular saw"/ });
  fires((p) => { delete p.steps[1].warn; p.steps[1].tools.push("saw"); }, "E_POWER_NO_WARNING", "steps[1].warn", { msg: /power tools "Cordless drill" and "Circular saw"/ });
  // A project card replaces the built-in card: its CAUTION does not count.
  fires((p) => (p.techniques["cut-straight"] = { name: "Cut on the line", warn: [{ type: "caution", text: "Do not cut the bench." }], do: ["Cut the board."] }), "E_POWER_NO_WARNING", "steps[0].warn");
  quiet((p) => { delete p.steps[1].warn; p.steps[1].teach = ["pilot-hole"]; }, "E_POWER_NO_WARNING");
  quiet((p) => { delete p.steps[1].warn; p.steps[1].tools = ["glasses"]; }, "E_POWER_NO_WARNING");
  // ctx.techniques and ctx.tools replace the defaults.
  fires((p) => p, "E_POWER_NO_WARNING", "steps[0].warn", { ctx: { techniques: {} } });
  quiet((p) => p, "E_POWER_NO_WARNING", { tools: { saw: { name: "Hand saw" }, drill: { name: "Hand drill" } } });
});

const tall = (p) => { for (const a of p.parts.slice(0, 2)) a.size = [19, 900, 200]; };

test("E_TIP_OVER and anchors", () => {
  const r = fires(tall, "E_TIP_OVER", "parts", { where: "project", msg: /900 mm tall and 200 mm deep: ratio 4\.5, limit 2/ });
  assert.deepEqual(r.summary.tip, { height: 900, depth: 200, ratio: 4.5, limit: 2, anchored: false });
  fires((p) => { tall(p); p.units = "in"; }, "E_TIP_OVER", "parts", { msg: /35 7\/16 in tall and 7 7\/8 in deep/ });
  fires(tall, "E_TIP_OVER", "parts", { ctx: { mode: "plan" } });
  quiet(tall, "E_TIP_OVER", { mode: "estimate" });
  quiet((p) => { tall(p); p.safety.tipRatio = 5; }, "E_TIP_OVER");
  quiet((p) => { tall(p); p.parts[2].role = "anchor"; }, "E_TIP_OVER");
  quiet((p) => { tall(p); p.materials.strap = { kind: "each", name: "Anti-tip strap", role: "anchor" }; p.parts.push({ id: "D1", name: "Strap", material: "strap", size: [40, 3, 30], at: [180, 900, 0] }); }, "E_TIP_OVER");
  quiet((p) => { tall(p); p.materials.screw.role = "anchor"; }, "E_TIP_OVER");
  quiet((p) => { tall(p); p.materials.kit = { kind: "each", name: "Anti-tip kit", role: "anchor" }; p.steps[1].uses = { kit: 1 }; }, "E_TIP_OVER");
  quiet((p) => { tall(p); p.materials.kit = { kind: "each", name: "Anti-tip kit", role: "anchor" }; p.uses = { kit: 1 }; }, "E_TIP_OVER");
  const anchored = quiet((p) => { tall(p); p.materials.screw.role = "anchor"; });
  assert.equal(anchored.summary.tip.anchored, true);
  // Not every part has a position: no tip check.
  const r2 = quiet((p) => { tall(p); delete p.parts[2].at; }, "E_TIP_OVER");
  assert.equal(r2.summary.tip, null);
  // Wall-hung: no part on the floor.
  quiet((p) => { tall(p); for (const a of p.parts) a.at[1] += 1000; }, "E_TIP_OVER");
});

test("W_TIP_SMALL: an object under 600 mm above the ratio gets a warning, not E_TIP_OVER", () => {
  // A lamp-like object: 320 mm tall on a 140 mm deep base, ratio 2.29.
  const small = (p) => { for (const a of p.parts.slice(0, 2)) a.size = [19, 320, 140]; p.parts[2].size = [362, 19, 140]; };
  const p = clean();
  small(p);
  const r = run(p);
  assert.deepEqual(r.problems.map((x) => [x.level, x.code, x.path, x.where]), [["warn", "W_TIP_SMALL", "parts", "project"]]);
  assert.match(r.problems[0].msg, /^The object is 320 mm tall and 140 mm deep: ratio 2\.29, limit 2\. It can tip over\.$/);
  assert.match(r.problems[0].hint, /A wall fixing is for furniture 600 mm tall or more\.$/);
  for (const text of [r.problems[0].msg, r.problems[0].hint]) assert.deepEqual(lint(text, "description"), [], text);
  quiet((q) => { small(q); q.parts[2].role = "anchor"; }, "W_TIP_SMALL");
  quiet((q) => { small(q); q.safety.tipRatio = 3; }, "W_TIP_SMALL");
  quiet(small, "W_TIP_SMALL", { mode: "estimate" });
  // 600 mm tall with ratio 3: furniture, so E_TIP_OVER.
  const r6 = fires((q) => { for (const a of q.parts.slice(0, 2)) a.size = [19, 600, 200]; }, "E_TIP_OVER", "parts", { msg: /600 mm tall and 200 mm deep: ratio 3, limit 2/ });
  assert.ok(!r6.problems.some((x) => x.code === "W_TIP_SMALL"));
  assert.ok(!run((() => { const q = clean(); tall(q); return q; })()).problems.some((x) => x.code === "W_TIP_SMALL"), "900 mm: E_TIP_OVER only");
  // 599 mm: under the limit, so W_TIP_SMALL.
  const r599 = run((() => { const q = clean(); for (const a of q.parts.slice(0, 2)) a.size = [19, 599, 200]; return q; })());
  assert.deepEqual(r599.problems.map((x) => x.code), ["W_TIP_SMALL"]);
});

test("W_TIP_SMALL and E_TIP_OVER in an inch project: the wall rule starts at 24 in, and the hint says 24 in", () => {
  // A lamp-like object: a foot 5 x 3/4 x 5 in and a post 3/4 x 23 x 5 in on it (23 3/4 in tall, ratio 4.75). safetyChecks
  // reads lengths in mm, as compute normalizes them.
  const inch = (post) => {
    const p = clean(), I = 25.4;
    p.units = "in";
    p.parts = [
      { id: "A1", label: "A", name: "Foot", material: "pine", size: [5 * I, 0.75 * I, 5 * I], at: [0, 0, 0] },
      { id: "B1", label: "B", name: "Post", material: "pine", size: [0.75 * I, post * I, 5 * I], at: [2.125 * I, 0.75 * I, 0] },
    ];
    p.steps[1].parts = ["A1", "B1"];
    return run(p).problems.filter((x) => /TIP/.test(x.code));
  };
  const small = inch(23);
  assert.deepEqual(small.map((x) => x.code), ["W_TIP_SMALL"]);
  assert.match(small[0].msg, /23 3\/4 in tall and 5 in deep: ratio 4\.75, limit 2/);
  assert.match(small[0].hint, /A wall fixing is for furniture 24 in tall or more\.$/);
  assert.doesNotMatch(small[0].hint, /mm/);
  // 24 in tall in all (609.6 mm, which reads back as 609.5999... mm): the wall rule.
  assert.deepEqual(inch(23.25).map((x) => x.code), ["E_TIP_OVER"]);
});

test("tip-over: the size leaves out the wall fixing, as the page and plan.md do", () => {
  // The bookshelf: 900 mm sides, the anti-tip bracket E1 (role anchor) at y 920 to 950 above the top.
  const M = compute(JSON.parse(read("examples/pine-bookshelf/project.json")));
  assert.deepEqual(M.safety.tip, { height: 900, depth: 241, ratio: 3.73, limit: 2, anchored: true });
  // A part with role anchor on the part itself is also left out.
  const p = clean();
  tall(p);
  p.parts.push({ id: "D1", label: "D", name: "Bracket", material: "pine", role: "anchor", size: [40, 50, 30], at: [180, 900, 0] });
  assert.deepEqual(run(p).summary.tip, { height: 900, depth: 200, ratio: 4.5, limit: 2, anchored: true });
  // A project whose only part is an anchor still gives a height.
  const only = clean();
  only.parts = [{ id: "D1", label: "D", name: "Bracket", material: "pine", role: "anchor", size: [40, 50, 30], at: [0, 0, 0] }];
  assert.equal(run(only).summary.tip.height, 50);
});

test("I_TIP_UNCHECKED: with no positions and no anchor, plan mode says that tip-over is not checked", () => {
  const noAt = (p) => { tall(p); for (const a of p.parts) delete a.at; };
  const p = clean();
  noAt(p);
  const r = safetyChecks(p, { mode: "plan" });
  assert.deepEqual(r.problems.map((x) => [x.level, x.code, x.path, x.where]), [["info", "I_TIP_UNCHECKED", "parts", "project"]]);
  assert.equal(r.summary.tip, null);
  // The same 600 mm boundary as E_TIP_OVER and W_TIP_SMALL: a lamp is not told to get a wall fixing.
  assert.match(r.problems[0].hint, /If the object is 600 mm tall or more and the ratio is more than 2, the object needs a wall fixing\. In a home with children, a storage unit taller than 700 mm also needs one\./);
  assert.match(r.problems[0].hint, /If a smaller object has a ratio more than 2, make the base wider or deeper, or put weight in the base\./);
  for (const text of [r.problems[0].msg, r.problems[0].hint]) assert.deepEqual(lint(text, "description", { names: ["WARNING"] }), [], text);
  // An inch project gives the limits in inches.
  const q = clean();
  noAt(q);
  q.units = "in";
  const hint = safetyChecks(q, { mode: "plan" }).problems[0].hint;
  assert.match(hint, /If the object is 24 in tall or more and the ratio is more than 2/);
  assert.match(hint, /a storage unit taller than 27 in also needs one/);
  assert.doesNotMatch(hint, /\bmm\b/);
  assert.deepEqual(lint(hint, "description", { names: ["WARNING"] }), [], hint);
  const none = (change, mode) => { const q = clean(); noAt(q); change(q); return safetyChecks(q, { mode }).problems.filter((x) => x.code === "I_TIP_UNCHECKED"); };
  assert.deepEqual(none((q) => { q.materials.screw.role = "anchor"; }, "plan"), [], "an anchor material in use");
  assert.deepEqual(none(() => {}, "estimate"), [], "estimate mode");
  assert.deepEqual(none((q) => { q.parts = []; }, "plan"), [], "no parts");
  fires(tall, "E_TIP_OVER", "parts", { ctx: { mode: "guide" } });
});

test("a step stool with safety.tipRatio 1 (safety.md section 6): W_TIP_SMALL under 600 mm, E_TIP_OVER from 600 mm", () => {
  // 450 mm tall on a 235 mm deep base: ratio 1.91, above the step-stool limit 1.
  const stool = (h) => { const p = clean(); p.safety.tipRatio = 1; for (const a of p.parts.slice(0, 2)) a.size = [19, h, 235]; p.parts[2].size = [362, 19, 235]; return run(p); };
  const low = stool(450);
  assert.deepEqual(low.problems.map((x) => [x.level, x.code]), [["warn", "W_TIP_SMALL"]]);
  assert.match(low.problems[0].msg, /450 mm tall and 235 mm deep: ratio 1\.91, limit 1\./);
  const high = stool(600);
  assert.deepEqual(high.problems.map((x) => [x.level, x.code]), [["error", "E_TIP_OVER"]]);
  assert.match(high.problems[0].msg, /600 mm tall and 235 mm deep: ratio 2\.55, limit 1\./);
  assert.deepEqual(stool(230).problems, [], "a ratio under 1 is quiet");
  // The fix for a stool is a larger base, not a wall fixing (a person moves a stool).
  assert.match(high.problems[0].hint, /^Make the base deeper and wider/);
  assert.match(high.problems[0].hint, /Do not attach a step stool to a wall\./);
  assert.deepEqual(lint(high.problems[0].hint, "description", { names: ["role", "anchor"] }), [], high.problems[0].hint);
  // The default limit keeps the wall-fixing hint, and a wall fixing still clears a lower limit.
  assert.match(fires(tall, "E_TIP_OVER", "parts").problems.find((x) => x.code === "E_TIP_OVER").hint, /^Add a step that attaches the object to the wall/);
  quiet((p) => { p.safety.tipRatio = 1; for (const a of p.parts.slice(0, 2)) a.size = [19, 650, 235]; p.parts[2].size = [362, 19, 235]; p.materials.screw.role = "anchor"; }, "E_TIP_OVER");
});

test("I_OLD_PAINT: a step that strips, sands, scrapes, heats or removes old paint, with no lead-paint hand-off", () => {
  for (const [field, text] of [["do", "Sand the old paint off the door."], ["check", "Make sure that you scrape all the old paint off."],
    ["stepTitle", "Strip the old paintwork"], ["why", "A heat gun softens the old paint."], ["technique", "Scrape the flakes."],
    // The verb after "old paint", a tool after it, "old" on the object, and "Remove" or "Take off".
    ...["Remove the old paint with a heat gun.", "Remove the old paint with a scraper.", "Take the old paint off the door with a scraper.", "Strip the paint off the old chair.",
      "Burn off the paint on the old window frame.", "Strip the old, flaking paint from the gate.", "Scrape the flaking paint off the old gate.", "Take off the old paint.",
      "Lift the old paint with a heat gun.", "Take off the old paint with a scraper.", "Get the old paint off with sandpaper.", "Stripped off the old paint.", "Burnt off the old paint.",
      "Use a heat gun to soften the old paint.",
      // Round 5: "Remove" or "Heat" with "old" after the paint, an old painted item, and a stripper on an old item.
      "Remove the paint from the old dresser.", "Heat the paint on the old door until it bubbles.", "Sand the old painted door.", "Strip the old painted chair.",
      "Use paint stripper on the old door."].map((t) => ["do", t])]) {
    const p = clean(), [path, where] = FIELDS[field](p, text), r = run(p);
    const at = field === "technique" ? ["techniques.strip.name", "technique strip"] : [path, where];
    assert.deepEqual(r.problems.map((x) => [x.level, x.code, x.path, x.where]), [["info", "I_OLD_PAINT", ...at]], text);
    assert.equal(r.problems[0].msg, "The text works on old paint.");
    for (const t of [r.problems[0].msg, r.problems[0].hint]) assert.deepEqual(lint(t, "description"), [], t);
    assert.match(r.problems[0].hint, /before 1978 \(US\) or 1992 \(UK\)/);
  }
  // A lead-paint hand-off (in handoff, or an E_HANDOFF that the text already gives) covers it.
  const q = clean();
  FIELDS.do(q, "Sand the old paint off the door.");
  q.handoff = [{ topic: "lead-paint", text: HANDOFF_TOPICS["lead-paint"].text }];
  assert.deepEqual(codes(run(q)), []);
  const e = clean();
  FIELDS.warn(e, "Do not sand the old paint. It may contain lead.");
  assert.deepEqual(run(e).problems.map((x) => x.code), ["E_HANDOFF"]);
  // New paint, new wood, an old paint can, tin or brush, an old paint colour and "Sandra" stay quiet.
  for (const text of ["Sand the new wood.", "Paint the shelf.", "Put the old paint can away.", "Sand the primer. Then apply the paint.",
    "Take the old paint can to the recycling centre.", "Remove the old paint tins from the shelf.", "Put the old paint brush in the bin.",
    "Sand the new board, then paint it to match the old one.", "Sand the top, then apply the oil with an old paint brush.", "Sand the new board to match the old paint colour.",
    "Sandra painted the old paint.", "Remove the old paint can from the shelf.", "Remove the lid of the old paint tin.", "Put the old paint tin in the bin.",
    "Remove the old board, paint the new one.", "Sand the old table top.",
    // "the old one" is not an old item, and a paint tin or brush is not paint.
    "Sand the new paint so it matches the old one.", "Remove the paint tins from the old cupboard.", "Remove the paint brush from the old jar."]) {
    const p = clean();
    FIELDS.do(p, text);
    assert.deepEqual(codes(run(p)), [], text);
  }
});

// Put text in one field of the clean project: [field, text] -> [path, where].
const FIELDS = {
  title: (p, t) => ((p.title = t), ["title", "project"]),
  summary: (p, t) => ((p.summary = t), ["summary", "project"]),
  do: (p, t) => (p.steps[0].do.push(t), ["steps[0].do[1]", "step 1, line 2"]),
  doObject: (p, t) => (p.steps[2].do.push({ t, new: true }), ["steps[2].do[1]", "step 3, line 2"]),
  warn: (p, t) => (p.steps[1].warn.push({ type: "warning", text: t }), ["steps[1].warn[1].text", "step 2, warning 2"]),
  stepTitle: (p, t) => ((p.steps[2].title = t), ["steps[2].title", "step 3"]),
  why: (p, t) => ((p.steps[1].why = t), ["steps[1].why", "step 2"]),
  tip: (p, t) => ((p.steps[2].tip = t), ["steps[2].tip", "step 3"]),
  check: (p, t) => ((p.steps[0].check = t), ["steps[0].check", "step 1"]),
  part: (p, t) => ((p.parts[2].name = t), ["parts[2].name", "part B1"]),
  material: (p, t) => ((p.materials.oil.name = t), ["materials.oil.name", "material oil"]),
  tool: (p, t) => ((p.tools[3].name = t), ["tools[3].name", "tool tape"]),
  technique: (p, t) => ((p.techniques.strip = { name: "Strip old paint", do: ["Scrape the loose paint.", t] }), ["techniques.strip.do[1]", "technique strip, line 2"]),
};

// Round 4 of the review: plain wording of real hand-off work (a "do" line each), and the builds that must stay quiet.
const R4_HITS = {
  mains: [
    // Fixed wiring: a socket that moves, a kitchen or bathroom appliance, a ceiling rose or box, US outlets, a room rewire,
    // a new circuit, a cable to an outbuilding.
    "Move the socket 300 mm to the left.", "Move the socket above the worktop.", "Relocate the socket behind the fridge.", "Fit the cooker hood and connect it to the spur.",
    "Connect the hob to the cooker circuit.", "Install recessed lights in the kitchen ceiling.", "Install a bathroom extractor fan.", "Replace the extractor fan in the bathroom ceiling.",
    "Fit an electric shower over the bath.", "Install an electric towel rail.", "Fit a shaver socket next to the mirror.", "Connect the illuminated mirror to the lighting circuit.",
    "Fit downlights in the bathroom ceiling.", "Swap the old switch for a dimmer.", "Fit a smart switch in place of the old switch.", "Replace the switch on the wall by the door.",
    "Connect the light fitting to the ceiling rose.", "Wire the new ceiling rose.", "Hang the new chandelier from the ceiling box.", "Mount the light fixture to the ceiling box.",
    "Install the new chandelier in the hall.", "Replace the two-prong outlet with a three-prong outlet.", "Install a 120-volt GFCI receptacle.", "Connect the bare copper wire to the ground screw.",
    "Rewire the bedroom.", "Rewire the garage.", "Rewire the shed.", "Install an EV charger on the garage wall.", "Run a dedicated circuit for the workshop.", "Add a circuit for the hot tub.",
    "Run an armoured cable from the house to the shed.", "Bury the armoured cable 600 mm deep and connect it at the shed.", "Fit a weatherproof socket on the fence.",
    "Wire the outdoor light to the switch inside.", "Connect the ribbed wire to the silver screw and the smooth wire to the brass screw.",
    "Install a new extractor fan in the shower room.", "Fit a new electric shower in the en-suite.", "Run an armoured cable to the garden office.", "Fit the pendant to the ceiling rose.",
    "Run a dedicated circuit for the hot tub.", "Add a 13 A socket next to the desk.", "Move the double socket to the other wall.", "Install four downlights in the hall ceiling.",
    // Bathroom mains work (safety.md section 10).
    "Fit the new shaver socket above the vanity.", "Install a shaver socket next to the mirror.", "Install the mirror light above the basin.", "Fit the extractor fan in the bathroom wall.",
    "Wire the extractor fan to the light circuit.", "Install the electric towel rail.", "Fit the LED mirror to the wall and connect it to the lighting circuit.", "Replace the old extractor fan.",
    // A lamp or an appliance cord, in plain words.
    "Wire the lamp.", "Thread the flex through the lamp base and wire it to the lamp holder.", "Connect the wires to the lamp holder.", "Screw the two wires into the lamp holder terminals.",
    "Fit the lamp holder and connect the flex.", "Fit an E27 lamp holder to the flex.", "Fit a foot switch to the lamp flex.", "Replace the frayed cord on the lamp.",
    "Replace the cord on the old lamp.", "Repair the lamp cord with electrical tape.", "Splice the two ends of the lamp cord together.", "Shorten the lamp flex and refit the plug.",
    "Cut the flex to length and fit the plug.", "Rewire the old floor lamp.", "Rewire the vintage table lamp.", "Connect the brown wire to the fuse terminal of the plug.",
    "Connect the blue wire to the left terminal and the brown wire to the right terminal.", "Tighten the cord grip of the plug over the outer sheath.", "Change the plug on the vacuum cleaner.",
    "Replace the damaged flex on the iron.", "Fit a new plug to the kettle.", "Fit a new plug to the toaster.", "Rewire the old standard lamp.", "Wire the new table lamp.",
    "Connect both wires to the bulb holder.", "Fit a B22 lamp holder to the flex.", "Fit a rocker switch to the lamp flex.", "Replace the worn cord on the floor lamp.",
    "Shorten the flex on the kettle.", "Fit a new plug to the hair dryer flex.",
    // Still mains work next to a low-voltage word: a charger plugs into the mains, LED downlights are fixed lights.
    "Install a dimmer switch for the LED downlights.", "Fit a new plug to the cable of the battery charger.", "Replace the light switch next to the USB charger.",
    "Connect the hot wire to the brass terminal of the outlet.", "Wire the brass terminal of the outlet to the black wire.", "Connect the hot wire to the lamp socket.",
  ],
  structural: [
    "Notch the joists under the bathroom floor for the pipe.", "Cut a notch in the joist for the cable.", "Cut through the floor joist to fit the waste pipe.",
    "Drill a 50 mm hole through the floor joists for the waste pipe.", "Open up the wall between the kitchen and the dining room.", "Remove part of the wall between the kitchen and the lounge.",
    "Make an opening in the wall between the kitchen and the lounge.", "Widen the doorway in the hall wall.", "Cut a serving hatch in the kitchen wall.", "Install a steel beam over the new opening.",
    "Fit a lintel above the new doorway.", "Take down the partition between the two bedrooms.", "Cut a recess into the chimney breast for the TV.", "Remove the bricks of the chimney breast.",
    "Knock out the old fireplace and the chimney breast.", "Install a loft hatch between the ceiling joists.", "Cut through the joist to fit the soil pipe.",
    "Open up the wall between the hall and the lounge.", "Remove part of the wall to make an arch.", "Fit a new lintel over the window opening.", "Notch the ceiling joists for the cable.",
    "Take down the partition wall in the loft.", "Attach the ledger board to the house with lag bolts.",
  ],
  height: [
    "Clean the moss off the roof.", "Fix the felt on the garage roof.", "Replace the gutter on the house.", "Clear the leaves from the house gutters.", "Fit the TV aerial on the chimney.",
    "Use a ladder to reach the upstairs windows.", "Fit the bird box under the eaves of the house.", "Paint the ceiling above the stairs from a ladder.", "Fit the security light 3 m up the wall.",
    "Clean the gutters on the house.", "Use a ladder to clean the upstairs windows.", "Fit the CCTV camera 4 m up the wall.", "Remove the moss from the roof.",
    "Work on the treehouse roof.", "Stand on the playhouse roof.", "Use an extension ladder to reach the gutter.", "Stand on the extension ladder.",
  ],
  gas: [
    "Hook up the new range to the gas.", "Move the boiler into the new cupboard.", "Fit a new boiler flue.", "Install a gas-fired water heater in the garage.", "Install a gas dryer.",
    "Fit a new regulator to the patio heater.", "Replace the old combi boiler.", "Connect the new hob to the gas.", "Move the gas cooker 300 mm to the left.",
    "Move the buried gas pipe.", "Dig up the gas pipe.", "Connect the butane cylinder to the heater.", "Fit the butane bottle to the camping stove.",
  ],
  permit: ["Check the local building code for the deck.", "Apply for a zoning permit.", "Check the building code for the deck railing.", "Ask the zoning office about the fence height."],
  asbestos: ["Scrape off the old Artex ceiling.", "Remove the old pipe lagging.", "Remove the Artex from the ceiling.", "Sand the textured ceiling flat."],
};
const R4_QUIET = [
  // Kids', pet and furniture builds with a wall, a doorway, a ledger or a structural word.
  "Take out the side wall of the drawer.", "Cut a doorway in the front wall of the playhouse.", "Cut an archway in the wall of the doll house.",
  "Cut a hatch in the wall between the two halves of the rabbit hutch.", "Cut a hole in the wall between the run and the sleeping area.", "Cut a doorway in the front wall of the dog kennel.",
  "Screw the ledger to the back wall of the dog house.", "Attach the ledger strip to the wall of the play house.", "Screw the shelf ledger to the back wall of the summer house.",
  "Use C24 structural timber for the frame.", "Build a workbench from C24 structural timber.", "Use 100 x 100 mm structural posts for the pergola.", "Use brackets with a load-bearing capacity of 50 kg.",
  "Remove the back wall of the cabinet.", "Remove the back wall of the dolls house.", "Cut a doorway in the side wall of the play house.", "Use a bracket with a load-bearing capacity of 40 kg.",
  "Use C16 structural timber for the frame.", "Fix the ledger to the wall of the summer house.", "Screw the ledger to the wall studs in the home office.",
  "Drill pilot holes through the joists for the screws.", "Open up the wall cabinet.", "Widen the doorway of the bird box.", "Fit a lintel above the door of the dog kennel.",
  // Low-voltage electronics and kids' science builds.
  "Fit a bulb holder and a battery to the toy lighthouse.", "Connect the bulb holder to the battery with crocodile clips.", "Wire the bulb holder to the 3 V battery box.",
  "Fit the socket in the back wall of the enclosure.", "Fit the USB socket in the side wall of the case.", "Fit the switch to the lead of the 12 V LED strip.",
  "Fit the inline switch on the cable of the 12 V strip.", "Screw the doorbell wires to the brass terminals of the chime.", "Solder the ground wire to the pad marked GND on the green board.",
  "Use a wire nut to join the two 12 V wires.", "Use a hot wire to cut the foam, then glue it to the lamp shade.", "Solder the new circuit board into the enclosure.",
  "Fit a waterproof junction box for the 12 V garden light cables.", "Mount the 12 V fuse box next to the leisure battery in the van.", "Rewire the dolls house lights to the battery pack.",
  "Rewire the play kitchen lights to the battery pack.", "Connect the bulb holder to the 9 V battery.", "Fit the switch on the cable of the 5 V USB light.", "Join the 12 V wires with a wire nut.",
  "Solder the ground wire to the pad on the green board.", "Wire the doorbell to the brass terminals of the chime.", "Fit the 12 V junction box under the shelf.",
  "Mount the 12 V fuse box in the camper van.", "Connect the bulb holder to the crocodile clips.", "Fit the switch to the cable from the battery box.",
  "Screw the red wire to the brass terminal of the 12 V fuse holder.", "Crimp a brass terminal on the red wire.", "Use the hot wire to cut the foam panel.", "Keep the hot wire away from the lamp.",
  "Fit the dimmer switch to the LED strip cable.", "Fit the USB socket to the front panel.", "Add a circuit board to the robot.", "Run the circuit from the battery to the motor.",
  "Use armoured cable for the 12 V garden lights.", "Connect the LED to the power circuit of the board.", "Connect the battery to the circuit board.",
  // Plumbing outlets, a fence spur, tool sockets, and bathroom items that are not wiring.
  "Fit the outlet tap to the water butt.", "Install the outlet hose on the rain barrel.", "Replace the outlet valve in the cistern.", "Fit the outlet and the waste pipe to the new sink.",
  "Fit the outlet hose of the dishwasher to the sink waste.", "Install a new outlet pipe for the washing machine.", "Fit a new spur next to the rotten fence post.", "Fit a new socket to the impact driver.",
  "Fit a new socket on the breaker bar.", "Fit the outlet hose to the washing machine.", "Fit the new outlet pipe to the bath.", "Replace the outlet valve of the toilet cistern.",
  "Fit a new socket to the impact wrench.", "Fit the spur of the fence post into the concrete.", "Fit the extractor fan cover.", "Fit the extractor fan grille to the cabinet.",
  "Install the mirror above the basin.", "Install the mirror light shelf.", "Fit the towel rail to the wall with two screws.", "Paint the plaster ceiling rose.",
  // Plugs, leads and cords that are not mains work, and the cable of a tool.
  "Fit the plug in the bath.", "Replace the plug of the sink.", "Replace the lead on the dog.", "Replace the cord on the window blind.", "Repair the cord of the USB lamp.",
  "Wire the LED lamp to the 12 V adapter.", "Wire the lamp base to the column with a dowel.", "Use a rocker switch on the 12 V cable.", "Keep the 230 V cable of the saw away from the blade.",
  "Check the 230 V cable of the drill for damage.", "Fit the guide, then route the 230 V lead behind the saw.", "Keep the 230 V cable of the mitre saw away from the blade.",
  // Scaffold boards, small roofs, reused roof tiles, a stored ladder.
  "Make a shelf from old scaffold boards.", "Sand the scaffold boards and oil them.", "Make a clothes rail from scaffold tube and key clamps.", "Build a raised bed from scaffold boards.",
  "Nail the felt onto the hedgehog house roof.", "Screw the bat house roof to the back board.", "Cut the cat house roof from 12 mm plywood.", "Fit the chicken house roof with hinges so it opens.",
  "Lay old roof tiles as an edge for the path.", "Make a bird bath from an old roof tile.", "Make a wall rack for the extension ladder.", "Hang the extension ladder on the rack.",
  "Make a wall rack for the 4 m extension ladder.", "Make two hooks for the 3 m ladder.", "The ladder shelf is over 2 m tall, so attach it to the wall.", "Work on the roof of the bird box at the bench.",
  "Make a bench from scaffold boards and scaffold tube.", "Cut the scaffold plank to 1200 mm.", "Make a storage rack for the extension ladder.", "Hang the 3 m ladder on two hooks.",
  "Store the extension ladder on the garage wall rack.", "Lay the old roof tiles as a border.", "Glue the shingles on the bird-house roof.", "Nail the felt to the dog-house roof.",
  "Paint the doll’s house roof.", "Work on the birdhouse roof last.", "The shingles go on the birdhouse roof.", "Lift the lid off the roof of the log store.", "Clean the roof of the bird table.",
  "Paint the stairs with a roller.", "Make a ladder shelf for the stairs.", "Fix the bird box under the eaves of the shed.", "Fix the roof to the walls of the shed kit.",
  // A propane torch or weed burner, butane for a tool, an office chair, a toy cooker, a clearance, the dig advice.
  "Char the cedar boards with a propane weed burner.", "Use a blow torch with a propane cartridge to char the boards.", "Replace the gas cylinder of the office chair.",
  "Keep the bench 1 m from the gas fire pit.", "Keep the wood store 1 m from the gas heater.", "Fit the open shelf 750 mm above the gas hob.", "Make a pretend gas cooker for the play kitchen.",
  "Char the cladding with a propane weed burner.", "Fit the cabinet 650 mm above the gas hob, as the engineer says.", "Make a toy gas cooker from plywood.", "Replace the gas strut on the kitchen cabinet.",
  "Fill the soldering iron with butane.", "Refill the iron with butane gas.", "Fill the lighter with butane.",
  "Find out where buried cables and gas pipes run before you dig. A spade can cut a cable or a pipe.",
  // The gerund "building".
  "Fix the ledger to the wall before building the window seat.", "Screw the ledger to the wall studs before building the bench seat.",
  "This guide shows the steps for building office shelves from birch plywood.", "Cut the rafters before building roof panels for the log store.",
  "Before building the bench, fix the ledger to the wall.", "The steps for building office desks are easy.",
];

// Round 5 of the review: real work that the round-4 rules missed, and builds that the round-4 rules handed off.
const R5_HITS = {
  mains: [
    // A fixed mains item stays mains work with a USB or battery word after it: the new device or the test tool.
    "Replace the outlet with a USB outlet.", "Replace the old outlet with a new outlet that has USB ports.", "Install a GFCI outlet with two USB ports in the kitchen.",
    "Replace the receptacle with a USB receptacle.", "Replace the light switch with a smart switch that has a battery.", "Replace the ceiling fan with a new one with a battery remote.",
    "Install the new GFCI outlet with a 9 V battery tester.", "Install a new outlet for the USB-C power bank.",
    // A room fan, a wall light, a mains lamp holder, a lighting circuit, a cord on a plug, a site supply.
    "Fit the extractor fan in the bathroom wall and box in the duct.", "Replace the wall light with an LED one.", "Install the wall light, a black lantern, by the door.",
    "Fit an E11 lamp holder to the flex.", "Install a new lighting circuit.", "Wire the new lights to the wall switch.", "Splice the cord to the new plug.",
    "Splice the two ends of the cord together and tape the joint.", "Connect the transformer to 230 V.",
    // Hard-wired appliances with no plug.
    "Connect the sauna heater to the supply cable.", "Install the sauna heater on the wall.", "Move the sauna heater 200 mm to the left.", "Wire the sauna heater to the control unit.",
    "Connect the hot tub to the supply cable.", "Connect the electric heater to the supply.", "Wire the underfloor heating mat to the thermostat.", "Connect the immersion heater to the isolator.",
  ],
  structural: [
    "Make a recess in the chimney breast for the TV.", "Chisel out the bricks of the chimney breast.", "Take the bricks out of the chimney breast.",
    "Remove some bricks from the chimney breast for the stove.", "Make an opening in the chimney breast for the log burner.",
    "Knock down the wall of the unit next door.", "Fit a new lintel over the opening for the oven.", "Remove the wall between the garage and the shed.",
    // A joist cut for a larger loft hatch.
    "Cut the joist at the edge of the hatch.", "Saw through the ceiling joist.", "Remove a 600 mm length of the ceiling joist.", "Make the hatch opening wider. Cut one ceiling joist.",
    "Cut 150 mm off the end of the joist at the hatch.", "Cut the loft hatch opening wider for the ladder.", "Widen the loft hatch.", "Enlarge the loft hatch opening to 700 mm.",
    "Cut a hole in the ceiling for the loft ladder.", "Cut the ceiling joists to make the opening larger.",
  ],
  height: ["Climb onto the roof of the shed.", "Stand on the roof of the treehouse to fit the felt.", "Hang the picture above the stairs from the ladder.",
    "Keep the ladder steady on the stairs.", "Make the 4 m ladder secure before you climb."],
  gas: ["Move the gas pipe next to the gas meter.", "Install a gas fire beside the gas boiler.", "Move the gas meter 1 m from the door.",
    "Remove the boiler cover and reset the pressure.", "Remove the boiler housing."],
  asbestos: ["Remove the pipe lagging in the loft.", "Replace the pipe lagging on the boiler pipes.", "Take off the old lagging."],
};
const R5_QUIET = [
  // A shelf or a cupboard in the recess (the alcove) next to a chimney breast, and a fixing in its bricks.
  "Fit the floating shelves in the recess next to the chimney breast.", "Drill into the bricks of the chimney breast for the shelf brackets.",
  "Build the alcove cupboard in the recess beside the chimney breast.", "Measure the width of the recess on each side of the chimney breast.",
  "Fix the TV bracket to the brick of the chimney breast.", "Remove the plaster from the chimney breast and fix the shelf.",
  // A low-voltage item that holds the switch or the light, and an inline 12 V dimmer.
  "Fit the light switch to the battery box of the doll's house.", "Fit the ceiling light in the doll's house to the 3 V battery box.", "Install a dimmer switch for the LED strip lights.",
  // New joists of a deck or a shed, joist hangers, a playhouse, a hutch, a ceiling light.
  "Cut the floor joists of the shed to 2400 mm.", "Cut the deck joists to length.", "Cut the joist to 1800 mm.", "Cut each joist at the mark.", "Cut the joist hanger strap to length.",
  "Remove the ceiling joist hangers from the box.", "Cut the existing joist hanger strap.", "Cut the ceiling joists of the playhouse to 1200 mm.", "Make the hatch of the hutch wider.",
  "Cut a hole in the ceiling for the light.",
  // Water supplies, hoses, 12 V and aquarium heaters, a sauna heater guard, a clearance.
  "Connect the pump to the supply hose.", "Connect the pond pump to the water supply.", "Connect the hot tub to the water supply.", "Connect the heater hose to the supply valve.",
  "Connect the 12 V heater to the supply.", "Connect the heater to the 12 V supply.", "Connect the aquarium heater to the thermostat.", "Fit the sauna heater guard to the wall.",
  "Fit the wooden heater guard around the sauna heater.", "Keep the bench 100 mm from the sauna heater.", "Connect the heat mat to the plug-in thermostat.", "Connect the heater to the battery.",
  // New or foam pipe lagging.
  "Fit new pipe lagging to the cold water pipes in the loft.", "Wrap the pipes in the loft with foam pipe lagging.", "Cut the foam pipe lagging to length.", "Buy 10 m of pipe lagging.",
  // The fan of a maker build.
  "Fit the extractor fan for the 3D printer enclosure.", "Install an exhaust fan in the 3D printer enclosure.", "Fit the extractor fan in the lid of the solder fume box.",
  "Install the extractor fan in the grow tent.", "Fit the exhaust fan to the spray booth.",
  // A clearance from a gas appliance, a meter or a pipe.
  "Keep the log store 1 m from the gas meter.", "Keep the post holes 1 m from the gas pipe.", "Keep the shelf clear of the gas hob.", "Do not fit the shelf over the gas hob.",
  "Leave a gap of 650 mm between the gas hob and the wall cabinet.", "Leave 50 mm of space on each side of the gas boiler.", "Build a cupboard around the gas boiler.",
  "Keep the wood pile away from the gas meter.",
  // The wall, the door and the gutter of a shed, a garden building or a piece of furniture.
  "Make an opening in the wall of the shed for the cat flap.", "Widen the doorway of the shed.", "Fit the lintel over the door of the shed.", "Fit a lintel above the door of the brick pizza oven.",
  "Fit the gutter on the garden building.", "Remove the back wall of the wardrobe.", "Take out the side wall of the bookcase.", "Remove the back wall of the dresser and fit a new panel.",
  "Remove the side wall of the shed and replace the rotten boards.", "Cut a doorway in the side wall of the shed.", "Remove the end wall of the greenhouse.", "Remove the end wall of the raised bed.",
  "Remove the front wall of the compost bin.", "Remove the front wall of the vivarium to fit the glass doors.", "Cut a doorway in the front wall of the treehouse.", "Remove the back wall of the summer house.",
  // A boiler cupboard.
  "Fit the boiler cupboard door.", "Install the boiler cupboard shelves.",
  // Kids' battery circuits, a rope cord, a site transformer.
  "Add a buzzer circuit to the quiz board.", "Connect the fairy lights to the switch on the box.", "Fit an E10 bulb holder to the lid of the box.", "Install the LED circuit in the paper lantern.",
  "Add a simple circuit to light the dolls house.", "Splice the hammock cord to the ring.", "Splice the end of the cord into a loop for the pulley.", "Connect the saw to the 110 V transformer.",
  // A ladder that is stored under the stairs.
  "Build a cupboard under the stairs to store the step ladder.", "Hang the ladder on the wall under the stairs.", "Make a rack for the ladder under the stairs.",
];

test("E_HANDOFF: each topic, in every screened field", () => {
  const cases = [
    ...[R4_HITS, R5_HITS].flatMap((hits) => Object.entries(hits).flatMap(([topic, list]) => list.map((t) => [topic, "do", t]))),
    ["gas", "title", "Gas fireplace surround"],
    ["gas", "do", "Turn off the gas supply at the meter."],
    ["gas", "summary", "The cabinet hides the natural gas meter."],
    ["mains", "warn", "Shut off the breaker panel before you start."],
    ["mains", "part", "Consumer unit cover"],
    ["mains", "do", "Connect the 230 V wiring to the terminal."],
    ["mains", "doObject", "Install a new outlet next to the shelf."],
    ["mains", "tip", "A hard-wired light needs an electrician."],
    ["mains", "why", "The light switch wiring is in this wall."],
    ["mains", "do", "Fit a new mains lead to the lamp."],
    ["mains", "do", "Wire a new mains lead to the lamp holder."],
    ["mains", "summary", "Fit a new 230 V cord to the lamp."],
    ["mains", "do", "Fit a new 120 V lamp cord."],
    ["mains", "do", "Wire the plug with a 3 A fuse."],
    ["mains", "do", "Connect the brown wire to the L terminal of the lamp holder."],
    ["mains", "do", "Connect the live wire to the lamp holder."],
    ["mains", "stepTitle", "Rewire the lamp"],
    ["mains", "do", "Rewire the lamp."],
    // US and UK outlet, switch and light work, with a word before the item.
    ...["Replace the wall outlet.", "Install a new GFCI outlet.", "Wire the new GFCI receptacle.", "Install a USB outlet.", "Install a new wall outlet.",
      "Replace the old outlet in the kitchen.", "Replace the existing light switch.", "Install a GFCI outlet in the bathroom.", "Install a dimmer switch for the lamp.",
      "Fit a fused spur for the heater.", "Add a socket to the garage wall.", "Fit a double socket in the kitchen.", "Install a ceiling fan in the bedroom.",
      "Install the wall light above the mirror.", "Fit a new socket in the kitchen.", "Install a USB socket in the wall.", "Swap the light switch for a dimmer.",
      "Install the under-cabinet light fixture.", "Connect the light to the fused spur.", "Connect the under-cabinet light to the switched fused spur.",
      // Conductors and terminals: hot, ground, brass and silver screws, a wire nut, the mains earth colour.
      "Connect the hot wire to the brass screw of the socket.", "Connect the hot wire to the brass terminal.", "Connect the hot wire to the brass screw.",
      "Connect the black wire to the brass screw of the outlet.", "Connect the ground wire to the green screw.", "Connect the black wire to the black wire with a wire nut.",
      "Connect the green-and-yellow wire to the base.",
      // Lamp wiring: a lamp holder, a lamp socket, a lamp cord, a plug or a switch on a cord, a cord to a lamp.
      "Wire the lamp socket.", "Wire the lamp holder.", "Replace the lamp cord.", "Replace the lamp holder.", "Fit a new lamp cord to the lamp.",
      "Wire the lamp holder to the flex.", "Fit an inline switch to the lamp flex.", "Fit a new plug to the lamp cord.", "Replace the plug on the lamp cord.",
      "Fit a new lamp holder to the flex.", "Connect the flex to the lamp holder.", "Fit a new flex to the lamp holder.", "Connect the brown wire to the brass pin of the lamp holder.",
      "Fit a new cord to the lamp.",
      // A mains voltage: a cord with a work verb or "new", 100 to 250 V, an item connected to a voltage.
      "Replace the damaged 230 V cord of the drill.", "Feed the 127 V cord through the hole.", "Feed the 100 V cord through the hole.", "Run the 125 V cable.",
      "Connect the lamp to 230 V.", "Connect the power supply to the mains.", "Plug the wires into the mains terminal block.", "Plug the light fitting into the mains.",
      "Plug the new socket into the mains.", "Plug the lamp into the mains socket, then run a 230 V cable to the shed.", "Do not use a damaged power cable. A damaged 230 V cable can kill.",
      // Still hand off after the low-voltage exceptions.
      "Rewire the kitchen.", "Rewire the old lamp.", "Rewire the ceiling light.", "Rewire the toggle switch so that up is on.", "Rewire the LED light.",
      "Wire the plug of the 230 V lamp.", "Connect the new mains lead to the lamp holder.",
    ].map((t) => ["mains", "do", t]),
    ["mains", "summary", "A plug-in oak table lamp. You fit a new cord, an inline switch and a plug, then connect the lamp to 230 V."],
    ["mains", "summary", "The lamp gets a new 230 V cord."],
    ["structural", "warn", "Do not cut into the load-bearing wall."],
    ["structural", "do", "Remove the wall between the kitchen and the hall."],
    ["structural", "check", "Make sure that the structural beam is dry."],
    ...["Take out this wall.", "Take out the wall between the kitchen and the hall.", "Cut a new opening in the wall between the rooms.",
      "Cut a doorway in the wall between the kitchen and the hall.", "Notch the floor joists for the pipe.", "Cut a notch in the floor joist for the pipe.",
      "Remove the chimney breast.", "Bolt the ledger board to the rim joist of the house.", "Attach the ledger to the house with 12 mm coach screws."].map((t) => ["structural", "do", t]),
    ["height", "why", "Work on the roof of the house needs a harness."],
    ["height", "do", "Use a ladder above 2 m to reach the top."],
    ["height", "do", "Use a 3 m ladder."],
    ["height", "do", "Use a 10 ft ladder."],
    ["height", "do", "Hang the shelf 2400 mm above the floor."],
    ["height", "tool", "Scaffold tower"],
    ["height", "stepTitle", "Climb onto the roof"],
    ["height", "tip", "Do not work at height alone."],
    ...["Stand on the shed roof to fix the felt.", "Climb onto the shed roof.", "Use a 3 m step ladder.", "Use a 10 ft step ladder.", "Climb onto the house roof.",
      "Repair the tree house roof.", "Use a 2 m tall ladder."].map((t) => ["height", "do", t]),
    ["permit", "tip", "Ask about a building permit before you start."],
    ["permit", "summary", "Planning permission is not necessary for this shed."],
    ["permit", "do", "Ask the building department for a permit."],
    ["gas", "do", "Install the gas fire."],
    ["gas", "do", "Install the gas fire pit burner in the table."],
    ["gas", "do", "Connect the propane tank to the fire pit burner."],
    ["gas", "do", "Connect the gas hose to the regulator."],
    ["gas", "do", "Put the LPG cylinder inside the cabinet."],
    ["gas", "do", "Connect the gas bottle to the burner."],
    ["asbestos", "material", "Asbestos cement sheet"],
    ["lead-paint", "check", "Make sure that the old lead-based paint is off."],
    ["lead-paint", "technique", "Test the paint for lead paint first."],
    ["lead-paint", "warn", "Do not sand the old paint. It may contain lead."],
    ["lead-paint", "do", "Sand the paint with lead in it."],
  ];
  for (const [topic, field, text] of cases) {
    const p = clean(), [path, where] = FIELDS[field](p, text), r = run(p);
    const hit = r.problems.find((x) => x.code === "E_HANDOFF");
    assert.ok(hit, `${topic}: no E_HANDOFF for ${field} ${JSON.stringify(text)}`);
    assert.deepEqual([hit.path, hit.where, hit.level], [path, where, "error"], text);
    assert.match(hit.msg, new RegExp(`no "${topic}" entry`), text);
    assert.match(hit.hint, new RegExp(`"topic": "${topic}"`), text);
    assert.equal(r.problems.filter((x) => x.code === "E_HANDOFF").length, 1, text);
    // A handoff entry for the topic (by id, or by a common name) silences it.
    const q = clean();
    FIELDS[field](q, text);
    q.handoff = [{ topic, text: HANDOFF_TOPICS[topic].text }];
    assert.deepEqual(codes(run(q)), [], `${text} with handoff`);
  }
  const q = clean();
  q.steps[0].do.push("Shut off the breaker panel.");
  q.handoff = [{ topic: "Mains wiring", text: "An electrician does the wiring." }];
  assert.deepEqual(codes(run(q)), []);
});

test("E_HANDOFF: one problem per topic, and false friends stay quiet", () => {
  const two = clean();
  two.steps[0].do.push("Turn off the gas supply.", "Do not touch the gas pipe.");
  two.steps[1].why = "The gas line is behind the wall.";
  assert.deepEqual(codes(run(two)), ["E_HANDOFF steps[0].do[1]"]);
  for (const text of [
    "Replace the gasket on the gas strut.",
    "Fit the gas spring to the lid.",
    "Do not drill near outlets and switches. Cables can be in the wall there.",
    "Remove the wall bracket.",
    "Remove the shelf from the wall.",
    "Attach the roof to the birdhouse.",
    "Nail the shingles on the roof.",
    "Use a 1.5 m ladder.",
    "Use a 5 ft step ladder.",
    "Mark the line with a lead pencil.",
    "Plug the 230 V saw into an outlet.",
    "Wire the switch to the battery.",
    "Install the outlet cover.",
    "Use a mains-powered drill.",
    "Hang the shelf 1500 mm above the floor.",
    "Load the shelf with books.",
    "Paint the shelf with lead-free paint.",
    "Make sure that the building is dry.",
    "Plug the lamp into a wall socket.",
    "Connect the 12 V adapter to the LED strip.",
    "Fit the inline switch of the 12 V strip.",
    "Cut the foam with a hot wire cutter.",
    "Connect the black wire to the GND terminal.",
    "Plug the mains lead of the saw into an RCD.",
    "Buy a 230 V cord set with a plug, a switch and a lamp holder.",
    "Buy a 12 V LED kit with a 230 V plug-in adapter.",
    // Brass screws, hot-wire foam cutters, battery and board terminals, sockets for a ratchet.
    "Attach the hinge with brass screws.", "Use a hot-wire foam cutter.", "Cut the foam with a hot wire foam cutter.", "Attach the hot wire to the spring.",
    "Connect the hot wire to the battery terminal.", "Connect the ground wire to the GND pin.", "Connect the black wire to the ground terminal of the board.",
    "Screw the green terminal block to the board.", "Connect the red wire to the brass terminal block.", "Ground the edge smooth.", "Drive the ground screws into the soil.",
    "Install the new socket wrench set.", "Use a 10 mm socket on the bolt.", "Use a socket set to tighten the bolts.", "Fit the socket on the ratchet.",
    "Fit the 10 mm socket on the ratchet.", "Fit the new socket head screws.", "Fit the wall outlet cover.", "Replace the outlet cover with an oak one.",
    "Add a power strip behind the desk.", "Install the plug-in light fixture.", "Turn off the breaker before you drill.",
    // A pre-wired cord set, and the parts of a lamp that are not wiring.
    "Buy a lamp cord set with a plug and a switch.", "Replace the lamp cord set.", "Fit the lamp holder to the column.", "Fit the lamp holder to the top of the column.",
    "Push the lamp cord through the column.", "Push the cord of the cord set through the column.", "Fit a cable clip to the cord.", "Attach the cord to the base with a cable tie.",
    "Push the lamp holder of the cord set through the hole in the top.", "Fit the lamp holder of the cord set into the top.", "Fit the bulb into the lamp holder.",
    "Do not touch the pins of the plug.", "Strip about 5 mm of insulation from the end of each wire.", "Solder the red wire to the + pad.",
    "Connect the 12 V adapter to the lamp holder of the kit.", "Connect the LED strip to the 230 V adapter.", "Connect the switch to the 12 V cable.",
    "Fit a wall plug in each hole.", "Attach the switch to the battery box.",
    // A tool's own cord, a pre-wired or moulded lead, a cord set, a low voltage.
    "Examine the 120 V cord of the drill for damage.", "Keep the 230 V cord of the saw away from the blade. The blade can cut the cord.",
    "Plug the 230 V lead of the sander into an RCD.", "Use an outdoor 120 V cord for the saw.", "Use a ready-made 230 V lead with a moulded plug.",
    "Buy a 230 V cord and plug set.", "Buy a 230 V cord with a switch, fitted at the factory.", "Buy a new pre-wired 230 V lamp cord.",
    "Feed the 12 V cord through the hole.", "Feed the 24 V cord through the hole.", "Feed the 230 V cord set through the hole.",
    // Low-voltage electronics.
    "Rewire the switch of the battery box.", "Rewire the battery lights.", "Rewire the USB light.", "Rewire a solar light.", "Rewire the bike light to the USB pack.",
    "Rewire the guitar switch.", "Rewire the fairy lights to the new battery box.", "Wire the plug of the 12 V adapter to the strip.", "Wire up the plug on the LED strip.",
    "Wire the plug of the USB lead.",
    // Plug-in use.
    "Plug the adapter into a mains socket near the shelf.", "Plug the USB adapter into the mains.", "Plug the 12 V adapter into a mains outlet.",
    "Plug the power supply into a mains socket.", "Plug the circular saw into a 230 V socket through an RCD.", "Plug the saw into the mains through an RCD.",
    "Unplug the saw from the mains before you change the blade.", "Plug the lamp into the mains.",
    // Walls, joists and chimneys that are not structural work.
    "Build a shelf in the alcove next to the chimney breast.", "Cut an opening in the front wall of the bird house.", "Cut a hole in the back wall of the cabinet for the cable.",
    "Take out the wall plugs.", "Notch the legs for the rails.", "Screw the ledger to the wall studs.", "Hang the joists from the ledger with joist hangers.",
    "Drill pilot holes through the deck boards into the joists.", "Cut the joists to length.",
    // Small roofs, ladder shelves, step ladders under 2.5 m, lead-free paint, a propane torch, a gas grill.
    "Put the roof panel on the trestles.", "Attach the bird house roof with 4 nails.", "Nail the dog house roof to the walls.", "A shelf in the house roof space.",
    "Make a 2 m tall ladder shelf.", "Make a 72 in ladder shelf.", "Use a 6 ft step ladder.", "Stand on a 2 m step ladder to reach the shelf.",
    "Paint with lead-free paint.", "Use paint with lead-free pigment.", "Use lead-free solder. Old solder can contain lead.",
    "Char the boards with a propane torch.", "Put the gas grill on the cart.", "Keep the finish away from a gas heater.",
    // The texts of the built-in cards.
    "Do not drill above, below or beside a socket or a switch. Cables run there.", "Use a cable and pipe detector before you drill. A drill can hit a cable or a pipe.",
    ...R4_QUIET, ...R5_QUIET,
  ]) quiet((p) => p.steps[0].do.push(text), "E_HANDOFF");
});

test("E_HANDOFF: the 'Dig safely' advice of safety.md section 9 is not gas work", () => {
  const sec = /\n## 9\.[^\n]*\n([\s\S]*?)\n## 10\./.exec(read("engine/docs/safety.md"))?.[1] ?? "";
  const bullet = /\*\*Dig safely\.\*\*([^\n]*)/.exec(sec)?.[1] ?? "";
  const said = bullet.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  assert.ok(said.some((s) => /gas pipes/.test(s)), `the Dig safely bullet: ${bullet}`);
  for (const text of said) {
    const p = clean();
    p.steps[1].warn.push({ type: "warning", text });
    assert.deepEqual(run(p).problems.filter((x) => x.code === "E_HANDOFF").map((x) => x.msg), [], text);
  }
  assert.deepEqual(lint("Find out where buried cables and gas pipes run before you dig. A spade can cut a cable or a pipe.", "warning"), []);
});

test("E_HANDOFF: the screen stays fast on long runs of white space, and a run reads as one space", () => {
  for (const t of ["Use a 2" + " ".repeat(10000) + "m" + " ".repeat(10000) + "x.", "Use a 2" + "\n\t".repeat(5000) + "m" + "\n\t".repeat(5000) + "x.",
    "Wire the lamp" + " ".repeat(20000) + "x", "Fit a new 230" + " ".repeat(20000) + "x", "Remove the old" + " ".repeat(20000) + "paint", "a".repeat(50000)]) {
    const t0 = performance.now();
    safetyChecks({ steps: [{ title: "x", do: [t] }], parts: [] });
    assert.ok(performance.now() - t0 < 500, `${JSON.stringify(t.slice(0, 14))}: ${Math.round(performance.now() - t0)} ms`);
  }
  const p = clean();
  p.steps[0].do.push("Use a 3   m\t\tladder.");
  const hit = run(p).problems.find((x) => x.code === "E_HANDOFF");
  assert.match(hit?.msg ?? "", /mentions "3 m ladder" \(work at height\)/);
});

test("E_HANDOFF: each hand-off WARNING of safety.md section 10 names its own topic, once", () => {
  const doc = read("engine/docs/safety.md"), sec = /\n## 10\.[^\n]*\n([\s\S]*?)\n## 11\./.exec(doc)?.[1] ?? "";
  const table = sec.slice(sec.indexOf("| Topic | WARNING |"));
  const rows = table.split("\n").slice(2).filter((l) => l.startsWith("|")).map((l) => l.split("|").map((c) => c.trim())).map(([, name, text]) => [name, text]);
  assert.ok(rows.length >= 7, "the WARNING table of section 10");
  const idOf = (name) => {
    const n = name.replace(/\s*\(.*\)$/, "").toLowerCase();
    return Object.entries(HANDOFF_TOPICS).find(([id, t]) => [id, t.name, ...t.aliases].some((a) => a.toLowerCase() === n))?.[0];
  };
  for (const [name, text] of rows) {
    const id = idOf(name);
    assert.ok(id, `section 10: no topic for the row "${name}"`);
    const p = clean();
    p.steps[1].warn.push({ type: "warning", text });
    const found = run(p).problems.filter((x) => x.code === "E_HANDOFF");
    assert.deepEqual(found.map((x) => /no "([^"]+)" entry/.exec(x.msg)[1]), [id], `${name}: ${text}`);
  }
});

test("summary hand-offs: a topic id gets the topic name for the reader; free text stays", () => {
  const p = clean();
  p.handoff = [{ topic: "mains", text: "A licensed electrician fits the cord." }, { topic: "lead-paint", text: "A contractor removes the paint." }, { topic: "Chimney sweep", text: "A sweep cleans the flue." }];
  assert.deepEqual(run(p).summary.handoffs.map((h) => [h.topic, h.name]), [["mains", "Mains electrical work"], ["lead-paint", "Lead paint"], ["Chimney sweep", "Chimney sweep"]]);
});

// safety.cleared: one text that the screen finds for each topic, and a reason in STE.
const CLEAR_HITS = {
  gas: ["Keep the propane tank of the weed burner 3 m from the bench.", "propane"],
  mains: ["Keep the cable clips 50 mm from the mains cable.", "mains"],
  structural: ["Do not cut the load-bearing wall.", "load-bearing"],
  height: ["Do not work at height.", "work at height"],
  permit: ["Ask the local building office whether the work needs a permit.", "the local building office"],
  asbestos: ["Do not drill the asbestos sheet.", "asbestos"],
  "lead-paint": ["Old paint can contain lead.", "paint can contain lead"],
};
const WHY = "The text names the hazard only. The guide does no work of this kind.";

test("safety.cleared: the E_HANDOFF of each topic becomes one I_HANDOFF_CLEARED, and the summary lists each text it clears", () => {
  for (const [id, [text, hit]] of Object.entries(CLEAR_HITS)) {
    const p = clean();
    FIELDS.do(p, text);
    FIELDS.check(p, text);
    assert.deepEqual(run(p).problems.map((x) => [x.code, x.path]), [["E_HANDOFF", "steps[0].do[1]"]], `${id}: the screen finds it`);
    p.safety.cleared = [{ topic: id, why: WHY }];
    const r = run(p), topic = HANDOFF_TOPICS[id];
    assert.deepEqual(r.problems.map((x) => [x.level, x.code, x.path, x.where]), [["info", "I_HANDOFF_CLEARED", "steps[0].do[1]", "step 1, line 2"]], id);
    const [info] = r.problems;
    assert.ok(info.msg.includes(`"${hit}" (${topic.name})`) && info.msg.includes(WHY), `${id}: ${info.msg}`);
    assert.match(info.msg, /The screen finds .* in 2 texts\. The safety review lists each text\./, id);
    assert.ok(info.hint.includes(`remove the safety.cleared entry, and add { "topic": "${id}", "text": "${topic.text}" } to handoff.`), `${id}: ${info.hint}`);
    const name = topic.name[0].toUpperCase() + topic.name.slice(1);
    assert.deepEqual(r.summary.cleared, [{ topic: id, name, why: WHY, entry: 0, hits: [
      { path: "steps[0].do[1]", where: "step 1, line 2", text: hit, context: text }, { path: "steps[0].check", where: "step 1", text: hit, context: text }] }], id);
    // A common name matches as in handoff, in any letter case.
    for (const alias of topic.aliases) {
      const q = clean();
      FIELDS.do(q, text);
      q.safety.cleared = [{ topic: alias.toUpperCase(), why: WHY }];
      assert.deepEqual(run(q).problems.map((x) => x.code), ["I_HANDOFF_CLEARED"], `${id}: ${alias}`);
    }
  }
  // One info for each topic: two cleared topics give two infos, and a topic that is not cleared still stops the build.
  const p = clean();
  FIELDS.do(p, CLEAR_HITS.gas[0]);
  FIELDS.why(p, CLEAR_HITS.structural[0]);
  FIELDS.tip(p, CLEAR_HITS.height[0]);
  p.safety.cleared = [{ topic: "gas", why: WHY }, { topic: "structural", why: WHY }];
  assert.deepEqual(run(p).problems.map((x) => [x.code, x.path]), [["I_HANDOFF_CLEARED", "steps[0].do[1]"], ["I_HANDOFF_CLEARED", "steps[1].why"], ["E_HANDOFF", "steps[2].tip"]]);
  assert.match(run(p).problems[2].msg, /\(work at height\), but handoff has no "height" entry/);
  // The lead-paint hint asks the age of the paint.
  const lead = clean();
  FIELDS.do(lead, CLEAR_HITS["lead-paint"][0]);
  lead.safety.cleared = [{ topic: "lead-paint", why: WHY }];
  assert.match(run(lead).problems[0].hint, /^Make sure that the paint is from 1978 \(US\) or 1992 \(UK\) or later, or that a lead test is clear\. If not, remove/);
});

test("safety.cleared: an entry that clears nothing is W_CLEARED_UNUSED (no hit, a topic in handoff, a second entry)", () => {
  const unused = (r) => r.problems.filter((x) => x.code === "W_CLEARED_UNUSED");
  // No hit: an agent cannot clear a topic in advance.
  const none = clean();
  none.safety.cleared = [{ topic: "gas", why: WHY }];
  assert.deepEqual(run(none).problems.map((x) => [x.level, x.code, x.path, x.where]), [["warn", "W_CLEARED_UNUSED", "safety.cleared[0]", "cleared entry 1"]]);
  assert.match(run(none).problems[0].msg, /^The hand-off screen finds no gas work in the text, so this entry clears nothing\./);
  assert.match(run(none).problems[0].hint, /^Remove the entry\./);
  assert.deepEqual(run(none).summary.cleared, []);
  // A topic that handoff names: the hand-off covers it.
  const both = clean();
  FIELDS.do(both, CLEAR_HITS.mains[0]);
  both.handoff = [{ topic: "mains wiring", text: HANDOFF_TOPICS.mains.text }];
  both.safety.cleared = [{ topic: "mains", why: WHY }];
  assert.deepEqual(both && run(both).problems.map((x) => [x.level, x.code, x.path]), [["warn", "W_CLEARED_UNUSED", "safety.cleared[0]"]]);
  assert.match(run(both).problems[0].msg, /^The handoff list names mains electrical work/);
  assert.deepEqual(run(both).summary.cleared, []);
  // A second entry for one topic: the first entry clears the hit.
  const twice = clean();
  FIELDS.do(twice, CLEAR_HITS.gas[0]);
  twice.safety.cleared = [{ topic: "gas", why: WHY }, { topic: "Gas work", why: WHY }];
  assert.deepEqual(run(twice).problems.map((x) => [x.code, x.path]), [["W_CLEARED_UNUSED", "safety.cleared[1]"], ["I_HANDOFF_CLEARED", "steps[0].do[1]"]]);
  assert.match(unused(run(twice))[0].msg, /^An earlier entry of safety\.cleared clears gas work too/);
  // A topic that the screen does not know clears nothing, and gives no warning here (validate reports it).
  const other = clean();
  FIELDS.do(other, CLEAR_HITS.gas[0]);
  other.safety.cleared = [{ topic: "chimney", why: WHY }];
  assert.deepEqual(run(other).problems.map((x) => x.code), ["E_HANDOFF"]);
  for (const r of [run(none), run(both), run(twice)]) for (const x of unused(r)) for (const t of [x.msg, x.hint]) assert.deepEqual(lint(t, "description", { names: ["safety.cleared"] }), [], t);
});

test("safety.cleared lead-paint records the age of the paint: it silences I_OLD_PAINT and lists the old-paint text", () => {
  const p = clean();
  FIELDS.do(p, "Sand the old paint off the door.");
  assert.deepEqual(run(p).problems.map((x) => x.code), ["I_OLD_PAINT"]);
  p.safety.cleared = [{ topic: "lead-paint", why: "The owner painted the door in 2015. Paint from 2015 has no lead." }];
  const r = run(p);
  assert.deepEqual(r.problems.map((x) => [x.level, x.code, x.path]), [["info", "I_HANDOFF_CLEARED", "steps[0].do[1]"]]);
  assert.deepEqual(r.summary.cleared[0].hits, [{ path: "steps[0].do[1]", where: "step 1, line 2", text: "Sand the old paint", context: "Sand the old paint off the door." }]);
  // With no old paint and no lead-paint words, the entry clears nothing.
  const q = clean();
  q.safety.cleared = [{ topic: "lead-paint", why: "The owner painted the door in 2015. Paint from 2015 has no lead." }];
  assert.deepEqual(run(q).problems.map((x) => x.code), ["W_CLEARED_UNUSED"]);
  assert.match(run(q).problems[0].hint, /\(E_HANDOFF or I_OLD_PAINT\)/);
});

test("safety.cleared: each cleared hit carries its text, so a real hit added later shows next to the false alarm", () => {
  const p = clean(), real = "Connect the propane tank to the burner of the fire pit with the new hose.";
  FIELDS.do(p, CLEAR_HITS.gas[0]);
  p.steps[2].do.push(real);
  p.safety.cleared = [{ topic: "gas", why: WHY }];
  const r = run(p);
  assert.deepEqual(r.problems.map((x) => x.code), ["I_HANDOFF_CLEARED"]);
  // The matched words are the same ("propane"); the texts differ, so the safety review shows the real gas work.
  assert.deepEqual(r.summary.cleared[0].hits.map((h) => [h.where, h.text, h.context]),
    [["step 1, line 2", "propane", CLEAR_HITS.gas[0]], ["step 3, line 2", "propane", real]]);
  // A long text: its first 159 characters and "…", with each run of white space as one space.
  const q = clean(), long = `Keep the propane tank\n\n  of the weed burner 3 m from the bench. ${"Sand the edges smooth and wipe off the dust. ".repeat(5)}`;
  FIELDS.do(q, long);
  q.safety.cleared = [{ topic: "gas", why: WHY }];
  const [h] = run(q).summary.cleared[0].hits;
  assert.equal(h.context.length, 160);
  assert.equal(h.context, `${long.replace(/\s+/g, " ").slice(0, 159)}…`);
  assert.match(h.context, /^Keep the propane tank of the weed burner 3 m from the bench\. Sand/);
});

test("safety.cleared in the model: --strict counts pass with only the info, paths point into the raw project, and the reason is STE-linted", () => {
  const shelf = JSON.parse(read("examples/pine-bookshelf/project.json"));
  shelf.steps[1].do.push(CLEAR_HITS.gas[0]);
  shelf.safety = { ...shelf.safety, cleared: [{ topic: "gas", why: "The weed burner runs on a small propane tank. The guide makes no gas connection." }] };
  const M = compute(shelf);
  assert.deepEqual([M.counts.error, M.counts.warn, M.counts.ste], [0, 0, 0], M.problems.map((x) => `${x.code} ${x.msg}`).join("\n"));
  assert.ok(M.problems.some((x) => x.level === "info" && x.code === "I_HANDOFF_CLEARED" && x.path === `steps[1].do[${shelf.steps[1].do.length - 1}]`));
  assert.equal(M.safety.cleared[0].why, shelf.safety.cleared[0].why);
  // A bad entry first: the error and the cleared entry keep their raw index.
  const bad = structuredClone(shelf);
  bad.safety.cleared.unshift({ topic: "gas", why: "Too short" }, { topic: "mains", why: "The guide uses a plug-in lamp only." });
  const B = compute(bad);
  assert.ok(B.problems.some((x) => x.code === "E_SCHEMA" && x.path === "safety.cleared[0].why" && x.where === "cleared entry 1"));
  assert.ok(B.problems.some((x) => x.code === "W_CLEARED_UNUSED" && x.path === "safety.cleared[1]" && x.where === "cleared entry 2"), B.problems.map((x) => `${x.code} ${x.path}`).join("; "));
  assert.equal(B.safety.cleared[0].entry, 2);
  // The reason is STE descriptive text.
  const ste = structuredClone(shelf);
  ste.safety.cleared[0].why = "Ensure that the burner is a bottled-gas tool. The guide makes no gas connection.";
  assert.ok(compute(ste).problems.some((x) => x.level === "ste" && x.path === "safety.cleared[0].why" && x.where === "cleared entry 1"));
});

test("summary notes: PPE advice by tool and finish type", () => {
  const notes = (change) => { const p = clean(); change(p); return run(p).summary.notes; };
  const all = notes((p) => {
    p.tools.push({ id: "router", name: "Router", power: true }, { id: "sander", name: "Random orbit sander", power: true });
    p.materials.poly = { kind: "amount", name: "Polyurethane", spec: "oil-based, gloss", unit: "L", coverage: 12 };
  });
  assert.deepEqual(all, [PPE_FOR.saw.note, PPE_FOR.drill.note, PPE_FOR.sanding.note, PPE_FOR.noise.note, PPE_FOR.gloves.note, PPE_FOR.solvent.note, PPE_FOR.flame.note, RAGS]);
  const water = notes((p) => (p.materials.oil = { kind: "amount", name: "Polyurethane", spec: "water-based", unit: "L", coverage: 12 }));
  assert.ok(!water.includes(PPE_FOR.gloves.note) && !water.includes(PPE_FOR.solvent.note) && !water.includes(PPE_FOR.flame.note), water.join(" | "));
  // Gloves on the skin (safety.md sections 3 and 5): a solvent finish or glue, and epoxy. Epoxy gets its allergy note,
  // and no solvent fume or fire note.
  const finish = (name, spec) => notes((p) => { p.materials.oil = { kind: "amount", name, ...(spec ? { spec } : {}), unit: "L", coverage: 10 }; });
  for (const name of ["Two-part epoxy resin", "Epoxy resin"]) {
    const e = finish(name);
    assert.ok(e.includes(PPE_FOR.epoxy.note), `${name}: ${e.join(" | ")}`);
    for (const k of ["gloves", "solvent", "flame"]) assert.ok(!e.includes(PPE_FOR[k].note), `${name}: no ${k} note`);
  }
  for (const [name, spec] of [["Polyurethane varnish", "oil-based"], ["Oil-based polyurethane varnish"], ["Contact adhesive"], ["Spray lacquer"], ["Shellac sanding sealer"]]) {
    const s = finish(name, spec);
    for (const k of ["gloves", "solvent", "flame"]) assert.ok(s.includes(PPE_FOR[k].note), `${name}: the ${k} note`);
    assert.ok(!s.includes(PPE_FOR.epoxy.note), name);
  }
  assert.equal(PPE_FOR.epoxy.note, "Wear nitrile gloves. Wet epoxy can cause a skin allergy.", "the Epoxy row of safety.md section 5");
  // MDF or treated timber with a power saw and no sanding: the dust-mask note. A power sander: ear protection; a sanding
  // block: none.
  const mdf = notes((p) => { p.materials.pine.name = "MDF sheet"; p.steps[2].finish = undefined; p.materials.oil.name = "Wax"; });
  assert.ok(mdf.includes(PPE_FOR.mdf.note) && !mdf.includes(PPE_FOR.sanding.note), mdf.join(" | "));
  assert.ok(notes((p) => (p.materials.pine.spec = "pressure-treated")).includes(PPE_FOR.mdf.note));
  assert.ok(!notes((p) => (p.materials.pine.spec = "untreated")).includes(PPE_FOR.mdf.note));
  assert.ok(notes((p) => p.tools.push({ id: "ros", name: "Random orbit sander", power: true })).includes(PPE_FOR.noise.note));
  assert.ok(!notes((p) => p.tools.push({ id: "block", name: "Sanding block" })).includes(PPE_FOR.noise.note));
  assert.ok(!notes((p) => (p.tools[0] = { id: "saw", name: "Hand saw" })).includes(PPE_FOR.saw.note), "a hand saw is not a power saw");
  assert.ok(!notes((p) => (p.tools[0] = { id: "horse", name: "Sawhorse", power: true })).includes(PPE_FOR.saw.note));
  assert.ok(notes((p) => (p.materials.paper = { kind: "each", name: "Sandpaper" })).includes(PPE_FOR.sanding.note));
  assert.ok(notes((p) => p.steps[1].teach = ["sand"]).includes(PPE_FOR.sanding.note));
  assert.ok(notes((p) => p.tools.push({ id: "iron", name: "Soldering iron" })).includes(PPE_FOR.solder.note));
  // A heat gun (tool) or a paint stripper (tool or material): gloves and glasses. A wire stripper is not a paint stripper.
  for (const change of [(p) => p.tools.push({ id: "hg", name: "Heat gun" }), (p) => p.tools.push({ id: "hg", name: "Heat-gun", spec: "2000 W" }),
    (p) => (p.materials.strip = { kind: "amount", name: "Paint stripper", unit: "L" }), (p) => p.tools.push({ id: "st", name: "Chemical stripper", spec: "gel" })])
    assert.ok(notes(change).includes(PPE_FOR.heat.note), String(change));
  for (const change of [(p) => p.tools.push({ id: "ws", name: "Wire stripper" }), (p) => p.tools.push({ id: "hs", name: "Heat shrink tube" })])
    assert.ok(!notes(change).includes(PPE_FOR.heat.note), String(change));
  assert.deepEqual(notes((p) => { p.tools = []; p.materials = {}; p.steps = []; }), []);
});

test("PPE notes and hand-off texts pass the STE linter", () => {
  for (const [id, r] of Object.entries(PPE_FOR)) assert.deepEqual(lint(r.note, "warning"), [], id);
  for (const [id, t] of Object.entries(HANDOFF_TOPICS)) assert.deepEqual(lint(t.text, "description"), [], id);
  // The rag note is the card's WARNING and the text of safety.md section 5: outdoors, or a closed metal can of water.
  assert.equal(PPE_FOR.oil.note, RAGS);
  assert.equal(PPE_FOR.oil.note, TECHNIQUES["finish-wipe"].warn[2].text);
  assert.match(RAGS, /outdoors/);
  assert.match(RAGS, /closed metal can/);
  assert.deepEqual(Object.keys(HANDOFF_TOPICS), ["gas", "mains", "structural", "height", "permit", "asbestos", "lead-paint"]);
});

test("garbage-tolerant: missing collections do not throw", () => {
  const r = safetyChecks({ title: "Box" }, { mode: "guide" });
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.summary, { tip: null, ppe: [], handoffs: [], power: [], notes: [], cleared: [] });
  for (const cleared of [null, "gas", [null, 3, { topic: 1 }, { topic: "gas" }]]) assert.doesNotThrow(() => safetyChecks({ title: "Box", safety: { cleared } }), String(cleared));
  assert.ok(TECHNIQUES["cut-straight"]);
});
