// validate.mjs: each problem code fires with the right path and stays quiet on a clean project; normalization
// (mm, defaults, repeat expansion, consistent references); garbage input never throws.
import { test } from "node:test";
import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { validate } from "../engine/lib/validate.mjs";

const TECH = new Set(["cut-straight", "pilot-hole", "glue-joint"]);

// A small clean project: a box with two sides, a bottom, screws, glue and oil.
const clean = () => ({
  id: "test-box", title: "Test box", summary: "A small box with two sides and a bottom.",
  stores: { yard: { name: "Timber yard" }, shop: { name: "Hardware store", online: true, lead: 2 } },
  materials: {
    "pine-1x4": { kind: "linear", name: "Pine board", section: [89, 19], stock: [{ length: 2440, price: 10 }], store: "yard", color: "#d9b88a" },
    ply: { kind: "sheet", name: "Plywood", thick: 6, stock: [{ w: 1220, h: 610, price: 20 }], store: "yard" },
    screw: { kind: "each", name: "Wood screw", pack: 50, price: 5, len: 30, d: 4, store: "shop" },
    glue: { kind: "amount", name: "Wood glue", unit: "ml", pack: 237, price: 6, store: "shop" },
    oil: { kind: "amount", name: "Finish oil", unit: "L", pack: 0.5, price: 12, coverage: 10, coats: 2 },
  },
  tools: [{ id: "saw", name: "Hand saw", have: true }, { id: "drill", name: "Cordless drill", have: true, power: true }],
  parts: [
    { id: "A1", label: "A", name: "Side", material: "pine-1x4", size: [19, 200, 89], at: [0, 6, 0] },
    { id: "A2", label: "A", name: "Side", material: "pine-1x4", size: [19, 200, 89], at: [281, 6, 0] },
    { id: "B1", label: "B", name: "Bottom", material: "ply", size: [300, 6, 89], at: [0, 0, 0] },
  ],
  props: { bench: { size: [1000, 20, 500], at: [-300, -20, -200] } },
  steps: [
    { id: "cut", phase: "Prepare", title: "Cut the parts", minutes: 20, cuts: true, pose: "kit", focus: ["A1"], tools: ["saw"], teach: ["cut-straight"],
      do: ["Cut each part."], check: "Make sure that you have three parts." },
    { id: "join", phase: "Build", title: "Attach the sides", minutes: 15, parts: ["A1", "A2", "B1"], tools: ["drill"], teach: ["pilot-hole"], uses: { glue: 5 },
      warn: [{ type: "warning", text: "Wear safety glasses." }], props: ["bench"], from: [0, 100, 0], view: { az: 30, el: 20, zoom: 1.2 },
      fasteners: [{ material: "screw", at: [0, 3, 20], dir: [1, 0, 0], repeat: { count: 3, step: [0, 0, 25] } }],
      do: ["Apply glue to the edges.", { t: "Drill a pilot hole at each mark.", new: true }], check: "Make sure that the box is square." },
    { id: "finish", phase: "Finish", title: "Apply the oil", minutes: 30, wait: 60, finish: { material: "oil" }, do: ["Apply the oil."], check: "Make sure that the oil is dry." },
  ],
});

const run = (p, mode = "guide") => validate(p, { mode, techniques: TECH });
const codes = (r) => r.problems.map((p) => `${p.code} ${p.path}`);
const find = (r, code, path) => r.problems.find((p) => p.code === code && p.path === path);
// Change a clean project, then expect exactly this problem (code + path), with level, where and text.
function fires(change, code, path, { mode = "guide", level, where, msg, hint } = {}) {
  const p = clean();
  change(p);
  const r = run(p, mode), hit = find(r, code, path);
  assert.ok(hit, `${code} ${path} not found in: ${codes(r).join("; ")}`);
  if (level) assert.equal(hit.level, level);
  if (where) assert.equal(hit.where, where);
  if (msg) assert.match(hit.msg, msg);
  if (hint) assert.match(hit.hint, hint);
  for (const k of ["msg", "hint", "where"]) assert.ok(typeof hit[k] === "string" && hit[k].length > 0, k);
  return r;
}

test("clean project: no problems in any mode", () => {
  for (const mode of ["estimate", "plan", "guide"]) assert.deepEqual(codes(run(clean(), mode)), [], mode);
});

// ARCHITECTURE.md 4.2: the 1e6 limit applies to the value as written, in the project unit (an inch project allows
// 2.54e7 mm), and the converted value stays finite.
test("the 1e6 length limit is in the project unit: an inch stock length of 1e6 passes, 1e6 + 1 is E_SCHEMA", () => {
  const inch = (len) => { const p = clean(); p.units = "in"; p.materials["pine-1x4"].stock = [{ length: len, price: 10 }]; return run(p, "estimate"); };
  const ok = inch(1e6);
  assert.equal(find(ok, "E_SCHEMA", "materials.pine-1x4.stock[0].length"), undefined, codes(ok).join("; "));
  assert.equal(ok.project.materials["pine-1x4"].stock[0].length, 2.54e7);
  assert.ok(find(inch(1e6 + 1), "E_SCHEMA", "materials.pine-1x4.stock[0].length"), "1e6 + 1 in is out of range");
});

test("step view.note: a short text; more than 120 characters or not a text is E_SCHEMA", () => {
  const p = clean();
  p.steps[1].view.note = "The picture shows the box upright.";
  assert.deepEqual(codes(run(p)), []);
  fires((q) => (q.steps[1].view.note = "x".repeat(121)), "E_SCHEMA", "steps[1].view.note", { msg: /121 characters/ });
  fires((q) => (q.steps[1].view.note = 3), "E_SCHEMA", "steps[1].view.note");
  fires((q) => (q.steps[1].view.nots = "x"), "E_UNKNOWN_KEY", "steps[1].view.nots", { hint: /"note"/ });
});

test("safety.cleared: a known topic (id or common name) and a reason of 10 to 240 characters", () => {
  const why = "The text names the gas hob only. The guide does no gas work.";
  const ok = clean();
  ok.safety = { cleared: [{ topic: "gas", why }, { topic: "Mains wiring", why: "x".repeat(240) }, { topic: "LEAD_PAINT", why: "x".repeat(10) }] };
  assert.deepEqual(codes(run(ok)), []);
  assert.deepEqual(run(ok).project.safety, { tipRatio: 2, cleared: ok.safety.cleared });
  // The reason: 10 to 240 characters, and more than spaces.
  fires((p) => (p.safety = { cleared: [{ topic: "gas", why: "x".repeat(9) }] }), "E_SCHEMA", "safety.cleared[0].why", { where: "cleared entry 1", msg: /The text has 9 characters\. It needs 10 or more\./, hint: /10 to 240 characters/ });
  fires((p) => (p.safety = { cleared: [{ topic: "gas", why: "x".repeat(241) }] }), "E_SCHEMA", "safety.cleared[0].why", { msg: /241 characters\. The limit is 240\./ });
  fires((p) => (p.safety = { cleared: [{ topic: "gas", why: `${" ".repeat(12)}gas` }] }), "E_SCHEMA", "safety.cleared[0].why", { msg: /fewer than 10 characters that are not spaces/ });
  fires((p) => (p.safety = { cleared: [{ topic: "gas" }] }), "E_SCHEMA", "safety.cleared[0].why", { msg: /required field "why"/ });
  fires((p) => (p.safety = { cleared: [{ topic: "gas", why, note: "x" }] }), "E_UNKNOWN_KEY", "safety.cleared[0].note");
  // The topic: an unknown name is an error, with the nearest topic id.
  fires((p) => (p.safety = { cleared: [{ topic: "gass", why }] }), "E_SCHEMA", "safety.cleared[0].topic", { level: "error", where: "cleared entry 1", msg: /The hand-off topic "gass" is not known\./, hint: /^Did you mean "gas"\? Use a topic id: gas, mains, structural, height, permit, asbestos, lead-paint\./ });
  fires((p) => (p.safety = { cleared: [{ topic: "electrcal", why }] }), "E_SCHEMA", "safety.cleared[0].topic", { hint: /^Did you mean "mains"\?/ });
  fires((p) => (p.safety = { cleared: [{ topic: "leadpaint", why }] }), "E_SCHEMA", "safety.cleared[0].topic", { hint: /^Did you mean "lead-paint"\?/ });
  fires((p) => (p.safety = { cleared: [{ topic: "Chimney sweep", why }] }), "E_SCHEMA", "safety.cleared[0].topic", { hint: /^Use a topic id:/ });
  fires((p) => (p.safety = { cleared: [{ topic: "", why }] }), "E_SCHEMA", "safety.cleared[0].topic", { msg: /empty/ });
  // A topic of only spaces clears nothing: one E_SCHEMA, as for "" (which gets only the schema finding).
  const topicErrors = (topic) => { const p = clean(); p.safety = { cleared: [{ topic, why }] }; return run(p).problems.filter((x) => x.path === "safety.cleared[0].topic"); };
  assert.deepEqual(topicErrors("   ").map((x) => [x.level, x.code, x.where, x.msg]), [["error", "E_SCHEMA", "cleared entry 1", "The hand-off topic is empty."]]);
  assert.match(topicErrors("   ")[0].hint, /^Use a topic id: gas, mains/);
  assert.equal(topicErrors("").length, 1);
  fires((p) => (p.safety = { cleared: { topic: "gas", why } }), "E_SCHEMA", "safety.cleared", { msg: /Expected a list/ });
  // A handoff entry may still name other work.
  const h = clean();
  h.handoff = [{ topic: "Chimney sweep", text: "A sweep cleans the flue." }];
  assert.deepEqual(codes(run(h)), []);
});

test("E_SCHEMA: wrong type, range, enum with did-you-mean, required, pattern, list length", () => {
  fires((p) => (p.kerf = "3"), "E_SCHEMA", "kerf", { level: "error", where: "project", msg: /found the text "3"/, hint: /Write 3 without quotes/ });
  fires((p) => (p.contingency = 10), "E_SCHEMA", "contingency", { msg: /10 is more than 0\.5/ });
  fires((p) => (p.materials["pine-1x4"].kind = "linar"), "E_SCHEMA", "materials.pine-1x4.kind", { where: "material pine-1x4", msg: /"linar"/, hint: /Did you mean "linear"\?/ });
  fires((p) => (p.steps[1].warn[0].type = "Warning"), "E_SCHEMA", "steps[1].warn[0].type", { where: "step 2, warning 1", hint: /Did you mean "warning"\?/ });
  fires((p) => delete p.parts[2].size, "E_SCHEMA", "parts[2].size", { where: "part B1", msg: /required field "size" is missing/, hint: /Add "size"/ });
  fires((p) => (p.parts[0].size = [-19, 200, 89]), "E_SCHEMA", "parts[0].size[0]", { where: "part A1", msg: /-19/ });
  fires((p) => (p.parts[0].at = [0, 0]), "E_SCHEMA", "parts[0].at", { msg: /2 items/, hint: /exactly 3/ });
  fires((p) => (p.steps[1].do[1] = 5), "E_SCHEMA", "steps[1].do[1]", { where: "step 2, line 2", msg: /found the number 5/ });
  fires((p) => (p.id = "Test Box"), "E_SCHEMA", "id", { msg: /"Test Box"/, hint: /lower-case/ });
  fires((p) => (p.materials.ply.color = "red"), "E_SCHEMA", "materials.ply.color", { hint: /hex color/ });
  fires((p) => (p.materials.screw.pack = 0), "E_SCHEMA", "materials.screw.pack", { msg: /not more than 0/ });
  fires((p) => (p.tools[0].qty = 1.5), "E_SCHEMA", "tools[0].qty", { where: "tool saw", hint: /whole number/ });
  fires((p) => (p.jig = 2), "E_SCHEMA", "jig", { hint: /Use one of: 1/ });
  fires((p) => delete p.materials["pine-1x4"].stock, "E_SCHEMA", "materials.pine-1x4", { msg: /"stock", "perLength"/, hint: /Add "stock" or "perLength"/ });
  fires((p) => delete p.materials.ply.kind, "E_SCHEMA", "materials.ply.kind", { msg: /required field "kind"/ });
  fires((p) => (p.steps[1].fasteners[0] = { material: "screw" }), "E_SCHEMA", "steps[1].fasteners[0].count", { hint: /positional/ });
  fires((p) => (p.steps[1].fasteners[0].dir = [0, 0, 0]), "E_SCHEMA", "steps[1].fasteners[0].dir", { where: "step 2, fastener 1", msg: /no length/ });
  fires((p) => (p.materials.ply.stock = []), "E_SCHEMA", "materials.ply.stock", { hint: /at least 1/ });
  fires((p) => (p.materials.glue2 = p.materials.glue) && (p.materials["bad id"] = p.materials.glue), "E_SCHEMA", 'materials["bad id"]', { msg: /"bad id"/ });
  fires((p) => (p.units = "in") && (p.kerf = 0.5), "E_SCHEMA", "kerf", { msg: /1\/2 in is more than 10 mm/ });
  fires((p) => (p.pricesAsOf = "2026-13-01"), "E_SCHEMA", "pricesAsOf", { hint: /YYYY-MM-DD/ });
});

test("E_SCHEMA: mode needs (steps for plan and guide, at for guide)", () => {
  fires((p) => delete p.steps, "E_SCHEMA", "steps", { mode: "plan", msg: /no steps/ });
  fires((p) => (p.steps = []), "E_SCHEMA", "steps", { mode: "guide" });
  fires((p) => delete p.parts[1].at, "E_SCHEMA", "parts[1].at", { where: "part A2", hint: /minimum corner/ });
  fires((p) => delete p.props.bench.at, "E_SCHEMA", "props.bench.at", { where: "prop bench" });
  const est = clean();
  delete est.steps;
  delete est.parts[0].at;
  delete est.props.bench.at;
  assert.deepEqual(codes(run(est, "estimate")), []);
  const plan = clean();
  delete plan.parts[0].at;
  assert.deepEqual(codes(run(plan, "plan")), []);
});

test("E_UNKNOWN_KEY: an error with did-you-mean (a misspelt field takes its default and the numbers go wrong)", () => {
  const r = fires((p) => (p.meterials = {}), "E_UNKNOWN_KEY", "meterials", { level: "error", where: "project", hint: /Did you mean "materials"\?/ });
  assert.deepEqual(r.problems.filter((x) => x.level === "error").map((x) => x.code), ["E_UNKNOWN_KEY"]);
  fires((p) => (p.materials.screw.packs = 50), "E_UNKNOWN_KEY", "materials.screw.packs", { level: "error", hint: /Did you mean "pack"\?/ });
  // A union branch still wins on its own fields: a counted fastener with a typo gives one unknown key, not a schema error.
  const typo = clean();
  typo.steps[1].fasteners[0] = { material: "screw", count: 4, cuont: 1 };
  assert.deepEqual(codes(run(typo, "plan")), ["E_UNKNOWN_KEY steps[1].fasteners[0].cuont"]);
  const pos = clean();
  pos.steps[1].fasteners[0].dri = [1, 0, 0];
  assert.deepEqual(codes(run(pos)), ["E_UNKNOWN_KEY steps[1].fasteners[0].dri"]);
  fires((p) => (p.parts[0].sise = 1), "E_UNKNOWN_KEY", "parts[0].sise", { where: "part A1", hint: /"size"/ });
  fires((p) => (p.steps[1].fasteners[0].dri = [1, 0, 0]), "E_UNKNOWN_KEY", "steps[1].fasteners[0].dri", { hint: /"dir"/ });
  fires((p) => (p.materials["pine-1x4"].thick = 19), "E_UNKNOWN_KEY", "materials.pine-1x4.thick", { hint: /Fields here: .*section/ });
  fires((p) => (p.materials["pine-1x4"].price = 5), "E_UNKNOWN_KEY", "materials.pine-1x4.price", { hint: /each stock entry/ });
  fires((p) => (p.materials.ply = 5), "E_SCHEMA", "materials.ply", { msg: /Expected an object, found the number 5/, hint: /kind sets the other fields/ });
});

test("perLength: no board length (step or per above max) and too many lengths are E_SCHEMA on the material, not E_TOO_LONG", async () => {
  const { compute } = await import("../engine/lib/model.mjs");
  const per = (perLength) => { const p = clean(); delete p.materials["pine-1x4"].stock; p.materials["pine-1x4"].perLength = perLength; return p; };
  const a = run(per({ price: 5, per: 1000, max: 600 }));
  const hit = find(a, "E_SCHEMA", "materials.pine-1x4.perLength.max");
  assert.ok(hit, codes(a).join("; "));
  assert.match(hit.msg, /No board length fits: the step 1000 mm \(the per length\) is more than max 600 mm\./);
  assert.match(hit.hint, /at most max/);
  const b = run(per({ price: 5, per: 1000, max: 2400, step: 3000 }));
  assert.ok(find(b, "E_SCHEMA", "materials.pine-1x4.perLength.step"), codes(b).join("; "));
  const c = run(per({ price: 5, per: 1000, max: 3000, step: 0.001 }));
  assert.match(find(c, "E_SCHEMA", "materials.pine-1x4.perLength.step")?.msg ?? "", /more than 100,000 board lengths/);
  for (const p of [per({ price: 5, per: 1000, max: 600 }), per({ price: 5, per: 1000, max: 2400, step: 3000 })]) {
    const M = compute(p, { mode: "estimate" });
    assert.equal(M.problems.filter((x) => x.code === "E_TOO_LONG").length, 0, M.problems.map((x) => x.code).join(" "));
  }
  assert.deepEqual(codes(run(per({ price: 5, per: 1000, max: 3000, step: 1 }))), []);
});

test("a range hint names the scale of a share: tax.rate 7 is 0.07", () => {
  fires((p) => (p.tax = { rate: 7, label: "Sales tax" }), "E_SCHEMA", "tax.rate", { msg: /7 is more than 1/, hint: /0\.07/ });
  fires((p) => (p.contingency = 10), "E_SCHEMA", "contingency", { hint: /0\.1/ });
});

test("E_DUP_ID: parts, steps, tools, and twice in one step", () => {
  fires((p) => (p.parts[1].id = "A1"), "E_DUP_ID", "parts[1].id", { level: "error", msg: /"A1" is used again/ });
  fires((p) => (p.steps[2].id = "cut"), "E_DUP_ID", "steps[2].id", { where: "step 3" });
  fires((p) => (p.tools[1].id = "saw"), "E_DUP_ID", "tools[1].id");
  fires((p) => p.steps[1].parts.push("A1"), "E_DUP_ID", "steps[1].parts[3]", { msg: /two times/ });
  fires((p) => p.steps[0].teach.push("cut-straight"), "E_DUP_ID", "steps[0].teach[1]");
});

test("E_LABEL_MISMATCH: shared label, different name, material or size", () => {
  fires((p) => (p.parts[1].size = [19, 210, 89]), "E_LABEL_MISMATCH", "parts[1].label", { where: "part A2", msg: /different size.*19 x 210 x 89 mm/ });
  fires((p) => (p.parts[1].name = "End"), "E_LABEL_MISMATCH", "parts[1].label", { msg: /different name/ });
  fires((p) => (p.parts[2].label = "A"), "E_LABEL_MISMATCH", "parts[2].label", { msg: /different name, material and size/ });
  const turned = clean();
  turned.parts[1].size = [89, 200, 19]; // the same piece, turned: not a mismatch
  assert.deepEqual(codes(run(turned)), []);
});

test("E_REF: every kind of reference", () => {
  const ref = (change, path, msg) => fires(change, "E_REF", path, { level: "error", msg });
  ref((p) => (p.parts[0].material = "pine-1x8"), "parts[0].material", /"pine-1x8" does not exist/);
  ref((p) => (p.parts[0].material = "glue"), "parts[0].material", /kind amount/);
  ref((p) => (p.parts[0].joins = ["Z9"]), "parts[0].joins[0]");
  ref((p) => (p.steps[1].parts[2] = "B2"), "steps[1].parts[2]", /"B2"/);
  ref((p) => (p.steps[0].focus = ["A3"]), "steps[0].focus[0]");
  ref((p) => (p.steps[1].props = ["wall"]), "steps[1].props[0]");
  ref((p) => (p.steps[0].tools = ["saww"]), "steps[0].tools[0]");
  ref((p) => (p.steps[0].teach = ["sand"]), "steps[0].teach[0]");
  ref((p) => (p.steps[1].fasteners[0].material = "nail"), "steps[1].fasteners[0].material");
  ref((p) => (p.steps[1].fasteners[0].material = "pine-1x4"), "steps[1].fasteners[0].material", /kind linear/);
  ref((p) => (p.steps[1].uses = { glu: 5 }), "steps[1].uses.glu");
  ref((p) => (p.steps[1].uses = { ply: 1 }), "steps[1].uses.ply", /kind sheet/);
  ref((p) => (p.steps[2].finish.material = "paint"), "steps[2].finish.material");
  ref((p) => (p.steps[2].finish.material = "screw"), "steps[2].finish.material", /kind each.*needs kind amount/);
  ref((p) => (p.steps[2].finish.parts = ["A1", "X1"]), "steps[2].finish.parts[1]");
  ref((p) => (p.steps[0].cuts = ["screw"]), "steps[0].cuts[0]", /kind each/);
  ref((p) => (p.uses = { tape: 1 }), "uses.tape");
  ref((p) => (p.finish = [{ material: "oil", parts: ["Q"] }]), "finish[0].parts[0]");
  ref((p) => (p.finish = [{ material: "wax" }]), "finish[0].material");
  const r = fires((p) => (p.steps[1].tools = ["dril"]), "E_REF", "steps[1].tools[0]", { hint: /Did you mean "drill"\?/ });
  assert.equal(find(r, "E_REF", "steps[1].tools[0]").where, "step 2");
  // Built-in cards come from options.techniques; project cards count too.
  const own = clean();
  own.techniques = { "my-card": { name: "My card", do: ["Hold the board."] } };
  own.steps[0].teach = ["my-card"];
  assert.deepEqual(codes(run(own)), []);
  assert.ok(find(validate(clean(), { techniques: new Set() }), "E_REF", "steps[0].teach[0]"));
});

test("finish material without coverage", () => {
  fires((p) => delete p.materials.oil.coverage, "E_SCHEMA", "materials.oil.coverage", { msg: /no coverage/, hint: /m²/ });
});

test("warnings: W_UNKNOWN_STORE, W_COVERAGE_UNIT, W_NO_CHECK, W_NO_MINUTES, W_COUNTED_FASTENER", () => {
  fires((p) => (p.materials.screw.store = "shopp"), "W_UNKNOWN_STORE", "materials.screw.store", { level: "warn", where: "material screw", hint: /Did you mean "shop"\?/ });
  fires((p) => (p.tools[0].store = "mall"), "W_UNKNOWN_STORE", "tools[0].store");
  fires((p) => (p.materials.glue.coverage = 8), "W_COVERAGE_UNIT", "materials.glue.coverage", { level: "warn", msg: /for one L/ });
  fires((p) => delete p.steps[1].check, "W_NO_CHECK", "steps[1].check", { level: "warn", where: "step 2", mode: "plan" });
  fires((p) => delete p.steps[2].minutes, "W_NO_MINUTES", "steps[2].minutes", { level: "warn" });
  fires((p) => (p.steps[1].fasteners[1] = { material: "screw", count: 4 }), "W_COUNTED_FASTENER", "steps[1].fasteners[1]", { level: "warn", where: "step 2, fastener 2" });
  // Quiet where the mode does not need them.
  const p = clean();
  delete p.steps[1].check;
  delete p.steps[1].minutes;
  p.steps[1].fasteners.push({ material: "screw", count: 4 });
  assert.deepEqual(codes(run(p, "estimate")), []);
  assert.deepEqual(codes(run(p, "plan")), ["W_NO_CHECK steps[1].check", "W_NO_MINUTES steps[1].minutes"]);
  const ok = clean();
  ok.materials.glue.coverage = 0.01;
  assert.deepEqual(codes(run(ok)), []);
});

test("normalize: defaults", () => {
  const { project: n } = run(clean());
  assert.equal(n.jig, 1);
  assert.equal(n.level, "some");
  assert.equal(n.units, "mm");
  assert.equal(n.currency, "USD");
  assert.equal(n.estimate, true);
  assert.equal(n.kerf, 3);
  assert.equal(n.trim, 0);
  assert.equal(n.contingency, 0.1);
  assert.deepEqual(n.safety, { tipRatio: 2 });
  assert.deepEqual([n.terms, n.verbs, n.handoff, n.finish], [[], [], [], []]);
  assert.deepEqual(n.uses, {});
  assert.equal(n.parts[2].label, "B");
  const solo = clean();
  delete solo.parts[2].label;
  assert.equal(run(solo).project.parts[2].label, "B1");
  assert.equal(n.parts[0].shape, "box");
  assert.equal(n.props.bench.hero, true);
  const m = n.materials;
  assert.equal(m.screw.spare, 0.1); // a fastener
  assert.equal(m.screw.unit, "piece");
  assert.equal(m.screw.included, false);
  assert.equal(m.glue.spare, 0); // not a finish
  assert.equal(m.oil.spare, 0.1); // a finish
  assert.equal(m.oil.coats, 2);
  assert.equal(m.glue.coats, 1);
  assert.equal(m.ply.grain, false);
  assert.equal(m["pine-1x4"].profile, "rect");
  assert.equal(m["pine-1x4"].est, true);
  assert.equal(n.tools[0].qty, 1);
  assert.equal(n.tools[0].days, 1);
  assert.equal(n.tools[0].get, "buy");
  const priced = clean();
  priced.estimate = false;
  priced.materials.ply.est = true;
  priced.tax = { rate: 0.2 };
  assert.equal(run(priced).project.materials.screw.est, false);
  assert.equal(run(priced).project.materials.ply.est, true);
  assert.deepEqual(run(priced).project.tax, { rate: 0.2, label: "Tax", included: false });
  const bad = clean();
  bad.level = "expert";
  assert.equal(run(bad).project.level, "some");
});

test("normalize: inch project converts every length to mm, and nothing else", () => {
  const p = clean();
  Object.assign(p, { units: "in", trim: 0.5, currency: "USD" });
  p.materials["pine-1x4"] = { kind: "linear", name: "Pine board", section: [3.5, 0.75], stock: [{ length: 96, price: 10 }], perLength: { price: 2, per: 12, max: 120 } };
  p.materials.ply = { kind: "sheet", name: "Plywood", thick: 0.25, stock: [{ w: 48, h: 24, price: 20 }] };
  p.materials.screw.len = 1.25;
  p.materials.screw.d = 0.125;
  p.materials.oil.coverage = 400;
  p.parts = [
    { id: "A1", label: "A", name: "Side", material: "pine-1x4", size: [0.75, 8, 3.5], at: [0, 0.25, 0], rotate: [0, 90, 0] },
    { id: "A2", label: "A", name: "Side", material: "pine-1x4", size: [0.75, 8, 3.5], at: [11.25, 0.25, 0] },
    { id: "B1", label: "B", name: "Bottom", material: "ply", size: [12, 0.25, 3.5], at: [0, 0, 0] },
  ];
  p.props.bench = { size: [40, 1, 20], at: [-10, -1, -8] };
  p.steps[1].fasteners = [{ material: "screw", at: [0, 0.125, 1], dir: [1, 0, 0], len: 1.5, d: 0.25, repeat: { count: 2, step: [0, 0, 1.5] } }];
  p.steps[1].from = [0, 4, 0];
  const { project: n, problems } = run(p);
  assert.deepEqual(problems, []);
  assert.equal(n.units, "in");
  assert.equal(n.kerf, 3.175);
  assert.equal(n.trim, 12.7);
  const pine = n.materials["pine-1x4"];
  assert.deepEqual(pine.section, [88.9, 19.05]);
  assert.deepEqual(pine.stock, [{ length: 2438.4, price: 10 }]);
  assert.deepEqual(pine.perLength, { price: 2, per: 304.8, max: 3048, step: 304.8 });
  assert.equal(n.materials.ply.thick, 6.35);
  assert.deepEqual(n.materials.ply.stock, [{ w: 1219.2, h: 609.6, price: 20 }]);
  assert.equal(n.materials.screw.len, 31.75);
  assert.equal(n.materials.screw.d, 3.175);
  assert.equal(n.materials.oil.coverage, 400);
  assert.deepEqual(n.parts[0].size, [19.05, 203.2, 88.9]);
  assert.deepEqual(n.parts[0].at, [0, 6.35, 0]);
  assert.deepEqual(n.parts[0].rotate, [0, 90, 0]);
  assert.deepEqual(n.props.bench.size, [1016, 25.4, 508]);
  assert.deepEqual(n.steps[1].from, [0, 101.6, 0]);
  assert.deepEqual(n.steps[1].view, { az: 30, el: 20, zoom: 1.2 });
  assert.equal(n.steps[1].minutes, 15);
  assert.deepEqual(n.steps[1].fasteners, [
    { material: "screw", at: [0, 3.175, 25.4], dir: [1, 0, 0], len: 38.1, d: 6.35 },
    { material: "screw", at: [0, 3.175, 63.5], dir: [1, 0, 0], len: 38.1, d: 6.35 },
  ]);
});

test("normalize: repeat expands into positional fasteners; counted fasteners stay counted", () => {
  const p = clean();
  p.steps[1].fasteners.push({ material: "screw", count: 4 });
  const { project: n } = run(p, "plan");
  assert.deepEqual(n.steps[1].fasteners, [
    { material: "screw", at: [0, 3, 20], dir: [1, 0, 0] },
    { material: "screw", at: [0, 3, 45], dir: [1, 0, 0] },
    { material: "screw", at: [0, 3, 70], dir: [1, 0, 0] },
    { material: "screw", count: 4 },
  ]);
  assert.ok(!("repeat" in n.steps[1].fasteners[0]));
});

test("normalize: never mutates the input; drops unknown keys and $schema", () => {
  const p = clean();
  p.$schema = "../engine/schema/project.schema.json";
  p.parts[0].sise = 3;
  const before = structuredClone(p);
  const { project: n } = run(p);
  assert.ok(isDeepStrictEqual(p, before));
  assert.ok(!("$schema" in n));
  assert.ok(!("sise" in n.parts[0]));
  n.parts[0].size[0] = 999;
  assert.equal(p.parts[0].size[0], 19);
});

test("normalize: bad items are left out and every reference resolves", () => {
  const p = clean();
  p.parts[2].size = "big"; // B1 is dropped: no E_REF cascade from the step that installs it
  p.materials.screw.kind = "nail"; // screw is dropped: its fasteners go too
  p.materials.glue.store = "nowhere";
  p.materials.glue.pack = -1; // a bad optional value falls back to its default
  p.steps[1].tools.push("hammer");
  const r = run(p);
  assert.deepEqual(codes(r).sort(), ["E_REF steps[1].tools[1]", "E_SCHEMA materials.glue.pack", "E_SCHEMA materials.screw.kind", "E_SCHEMA parts[2].size", "W_UNKNOWN_STORE materials.glue.store"]);
  const n = r.project;
  assert.equal(n.materials.glue.pack, 1);
  assert.deepEqual(n.parts.map((x) => x.id), ["A1", "A2"]);
  assert.deepEqual(n.steps[1].parts, ["A1", "A2"]);
  assert.deepEqual(n.steps[1].tools, ["drill"]);
  assert.deepEqual(n.steps[1].fasteners, []);
  assert.ok(!("screw" in n.materials));
  assert.ok(!("store" in n.materials.glue));
  assert.deepEqual(n.steps[0].cuts, true);
});

test("a missing or wrong-type collection gives one E_SCHEMA, not an E_REF for each reference", () => {
  const p = clean();
  p.parts = "x";
  p.tools = {};
  assert.deepEqual(codes(run(p)), ["E_SCHEMA tools", "E_SCHEMA parts"]);
  const q = clean();
  delete q.materials;
  assert.deepEqual(codes(run(q)), ["E_SCHEMA materials"]);
});

test("problems keep a stable order and shape", () => {
  const p = clean();
  p.kerf = "3";
  p.meterials = 1;
  const a = run(p), b = run(structuredClone(p));
  assert.deepEqual(a, b);
  for (const x of a.problems) assert.deepEqual(Object.keys(x), ["level", "code", "path", "where", "msg", "hint"]);
});

// ---- fuzz: 200 malformed projects from a seeded PRNG never throw and give a consistent normalized project

function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const GARBAGE = [null, undefined, NaN, Infinity, -1, 0, 1e9, "", "x", "3", true, [], [1], [1, 2, 3], ["a", null], {}, { x: 1 }, "constructor", "__proto__", "toString"];

function mutate(rand) {
  const p = clean(), pick = (list) => list[Math.floor(rand() * list.length)];
  for (let n = 1 + Math.floor(rand() * 6); n > 0; n--) {
    // Walk to a random node, then replace, delete or add a key.
    let node = p, depth = 0;
    while (depth++ < 6 && node && typeof node === "object" && rand() < 0.75) {
      const keys = Object.keys(node);
      if (!keys.length) break;
      const next = node[pick(keys)];
      if (!next || typeof next !== "object") break;
      node = next;
    }
    if (!node || typeof node !== "object") continue;
    const keys = Object.keys(node), r = rand();
    if (r < 0.5 && keys.length) node[pick(keys)] = pick(GARBAGE);
    else if (r < 0.75 && keys.length) delete node[pick(keys)];
    else Object.defineProperty(node, pick(["meterials", "sise", "dri", "kind", "at", "count", "repeat", "units", "__proto__"]), { value: pick(GARBAGE), enumerable: true, writable: true, configurable: true });
  }
  return rand() < 0.05 ? pick(GARBAGE) : p;
}

function finite(v, path = "") {
  if (typeof v === "number") assert.ok(Number.isFinite(v), `non-finite number at ${path}`);
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) finite(x, `${path}.${k}`);
}

test("huge numbers are E_SCHEMA, and every normalized value stays finite in inches", () => {
  const p = clean();
  p.units = "in";
  p.parts[0].size = [1e308, 200, 89];
  p.parts[1].at = [1e308, 0, 0];
  p.materials.ply.stock[0].w = 1e300;
  p.materials.screw.price = 1e12;
  p.steps[1].fasteners[0].at = [-1e308, 3, 20];
  p.steps[1].uses.glue = 1e20;
  p.steps[1].minutes = 1e300;
  const r = run(p);
  for (const path of ["parts[0].size[0]", "parts[1].at[0]", "materials[\"ply\"].stock[0].w", "materials[\"screw\"].price", "steps[1].fasteners[0]", "steps[1].uses[\"glue\"]", "steps[1].minutes"].map((x) => x.replace(/\["([\w-]+)"\]/g, ".$1")))
    assert.ok(r.problems.some((x) => x.code === "E_SCHEMA" && x.path.startsWith(path)), `${path}: ${JSON.stringify(codes(r))}`);
  finite(r.project);
});

test("fuzz: 200 malformed projects never throw", () => {
  const rand = mulberry32(20261102);
  for (let i = 0; i < 200; i++) {
    const p = mutate(rand), before = structuredClone(p);
    for (const mode of ["estimate", "plan", "guide"]) {
      let r;
      assert.doesNotThrow(() => (r = validate(p, { mode, techniques: TECH })), `case ${i}`);
      assert.ok(isDeepStrictEqual(p, before), `case ${i} mutated the input`);
      assert.ok(Array.isArray(r.problems));
      for (const x of r.problems) {
        for (const k of ["level", "code", "path", "where", "msg", "hint"]) assert.equal(typeof x[k], "string", `case ${i}: ${k}`);
        assert.ok(!/Internal error/.test(x.msg), `case ${i}: ${x.msg}`);
      }
      const n = r.project;
      finite(n);
      assert.ok(n && Array.isArray(n.parts) && Array.isArray(n.steps) && Array.isArray(n.tools));
      const partIds = new Set(n.parts.map((x) => x.id)), toolIds = new Set(n.tools.map((x) => x.id));
      for (const part of n.parts) {
        assert.ok(Object.hasOwn(n.materials, part.material), `case ${i}: part material`);
        assert.equal(part.size.length, 3);
      }
      for (const s of n.steps) {
        for (const id of s.parts ?? []) assert.ok(partIds.has(id), `case ${i}: step part`);
        for (const id of s.tools ?? []) assert.ok(toolIds.has(id), `case ${i}: step tool`);
        for (const f of s.fasteners ?? []) assert.equal(n.materials[f.material]?.kind, "each", `case ${i}: fastener material`);
        for (const id of Object.keys(s.uses ?? {})) assert.ok(Object.hasOwn(n.materials, id), `case ${i}: uses`);
      }
    }
  }
});

test("printed: kind printed with schema defaults; print only on a printed part; prints names printed materials; print in the label check", () => {
  const p = clean();
  p.materials.pla = { kind: "printed", name: "PLA filament", price: 20 };
  p.parts.push({ id: "C1", label: "C", name: "Knob", material: "pla", size: [20, 20, 20], at: [100, 206, 30], print: { grams: 4, settings: "0.2 mm layers" } });
  p.steps[1].parts.push("C1");
  p.steps[0].prints = ["pla"];
  let r = run(p);
  assert.deepEqual(codes(r), []);
  assert.deepEqual(r.project.materials.pla, { kind: "printed", name: "PLA filament", price: 20, spool: 1000, density: 1.24, fill: 0.3, rate: 12, spare: 0.1, est: true });
  assert.deepEqual(r.project.parts[3].print, { grams: 4, settings: "0.2 mm layers" });
  assert.deepEqual(r.project.steps[0].prints, ["pla"]);
  // print on a cut part: an error, and the normalized part has no print
  p.parts[0].print = { grams: 3 };
  r = run(p);
  assert.deepEqual(codes(r), ["E_SCHEMA parts[0].print"]);
  assert.match(r.problems[0].msg, /material "pine-1x4" has kind linear/);
  assert.ok(!("print" in r.project.parts[0]));
  delete p.parts[0].print;
  // prints names a material of another kind; an unknown field in print; a fill of 0
  p.steps[0].prints = ["pla", "ply"];
  p.parts[3].print = { gram: 4 };
  p.materials.pla.fill = 0;
  r = run(p);
  assert.deepEqual(codes(r).sort(), ["E_REF steps[0].prints[1]", "E_SCHEMA materials.pla.fill", "E_UNKNOWN_KEY parts[3].print.gram"].sort());
  assert.match(r.problems.find((x) => x.code === "E_UNKNOWN_KEY").hint, /Did you mean "grams"/);
  assert.deepEqual(r.project.steps[0].prints, ["pla"]);
  // a printed material in cuts is the wrong kind
  p.materials.pla.fill = 0.3;
  p.parts[3].print = { grams: 4 };
  p.steps[0].prints = true;
  p.steps[0].cuts = ["pla"];
  assert.deepEqual(codes(run(p)), ["E_REF steps[0].cuts[0]"]);
  delete p.steps[0].cuts;
  // two parts with one label and other print numbers
  p.parts.push({ ...p.parts[3], id: "C2", at: [200, 206, 30], print: { grams: 5 } });
  p.steps[1].parts.push("C2");
  r = run(p);
  assert.deepEqual(codes(r), ["E_LABEL_MISMATCH parts[4].label"]);
  assert.match(r.problems[0].msg, /a different print/);
});
