// Motions: the parts of the finished object that slide or turn. validate checks ids, parts, pivot and travel;
// geometry gives the moved bounds; the model warns W_MOTION_HIT when a motion drives a part into another one, lints
// the motion text and screens it for hand-off work.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compute } from "../engine/lib/model.mjs";
import { movedBox, motionClash } from "../engine/lib/geometry.mjs";

const cube = () => JSON.parse(readFileSync(new URL("../examples/plywood-storage-cube/project.json", import.meta.url), "utf8"));
const codes = (M) => M.problems.map((p) => `${p.code} ${p.path}`);
const find = (M, code) => M.problems.filter((p) => p.code === code);

// The cube with a door on its front face, hinged at the front edge of side A.
function withDoor(motion) {
  const P = cube();
  const mat = P.parts.find((p) => p.id === "C1").material;
  P.parts.push({ id: "F1", label: "F", name: "Door", material: mat, size: [400, 400, 18], at: [0, 5, 400] });
  P.steps.at(-1).parts = [...(P.steps.at(-1).parts ?? []), "F1"];
  P.motions = [{ id: "door", name: "Door", kind: "turn", parts: ["F1"], axis: "y", pivot: [0, 5, 418], travel: -100, text: "The door turns open on its hinges.", ...motion }];
  return P;
}

test("movedBox: a slide moves the box; a turn about a corner gives the turned bounds", () => {
  const part = { at: [0, 0, 0], size: [100, 10, 20] };
  assert.deepEqual(movedBox(part, { kind: "slide", axis: "z", travel: 50 }, 0.5), { min: [0, 0, 25], max: [100, 10, 45] });
  const b = movedBox(part, { kind: "turn", axis: "y", travel: 90, pivot: [0, 0, 0] }, 1);
  assert.deepEqual(b, { min: [0, 0, -100], max: [20, 10, 0] });
  // a cylinder turned about its own axis keeps its bounds
  const wheel = { at: [0, 0, 0], size: [20, 70, 70], shape: "cylinder" };
  assert.deepEqual(movedBox(wheel, { kind: "turn", axis: "x", travel: 45, pivot: [10, 35, 35] }, 1), { min: [0, 0, 0], max: [20, 70, 70] });
});

test("motionClash: a slide into a fixed part; joins and a rest overlap do not count", () => {
  const parts = [{ id: "a", at: [0, 0, 0], size: [10, 10, 10] }, { id: "b", at: [20, 0, 0], size: [10, 10, 10] }];
  const hit = motionClash(parts, {}, { kind: "slide", axis: "x", travel: 15, parts: ["a"] });
  assert.equal(hit.a, "a");
  assert.equal(hit.b, "b");
  assert.equal(hit.k, 0.75, "at 75% the box goes 1.25 mm into b, more than the 1 mm tolerance");
  assert.equal(motionClash(parts, {}, { kind: "slide", axis: "x", travel: -15, parts: ["a"] }), null);
  parts[0].joins = ["b"];
  assert.equal(motionClash(parts, {}, { kind: "slide", axis: "x", travel: 15, parts: ["a"] }), null);
});

test("a door that opens outward builds clean and the model carries the motion in mm", () => {
  const M = compute(withDoor());
  assert.equal(M.counts.error, 0, codes(M).join("; "));
  assert.equal(find(M, "W_MOTION_HIT").length, 0, codes(M).join("; "));
  assert.equal(M.counts.ste, 0, codes(M).join("; "));
  assert.deepEqual(M.motions, [{ id: "door", name: "Door", kind: "turn", parts: ["F1"], axis: "y", travel: -100, pivot: [0, 5, 418], text: "The door turns open on its hinges." }]);
});

test("W_MOTION_HIT: a door that opens into the cube", () => {
  const M = compute(withDoor({ travel: 100 }));
  const [w] = find(M, "W_MOTION_HIT");
  assert.ok(w, codes(M).join("; "));
  assert.equal(w.path, "motions[0]");
  assert.equal(w.where, "motion door");
  assert.match(w.msg, /^At 25% of its travel \(25 degrees\), part F1 of the motion "Door" goes .* into part /);
  assert.match(w.hint, /pivot/);
});

test("validation: unknown part, a turn with no pivot, a slide with a pivot, no travel, two motions on one part, a duplicate id", () => {
  const P = withDoor({});
  P.motions.push(
    { id: "door", name: "Again", kind: "slide", parts: ["Z9"], axis: "x", travel: 10 },
    { id: "lid", name: "Lid", kind: "turn", parts: ["C1"], axis: "x", travel: 30 },
    { id: "pad", name: "Pad", kind: "slide", parts: ["F1"], axis: "x", travel: 0, pivot: [0, 0, 0] },
    { id: "big", name: "Big", kind: "turn", parts: ["B1"], axis: "x", travel: 400, pivot: [0, 0, 0] },
  );
  const M = compute(P);
  const c = codes(M);
  for (const want of ["E_DUP_ID motions[1].id", "E_REF motions[1].parts[0]", "E_SCHEMA motions[2].pivot", "E_SCHEMA motions[3].pivot",
    "E_SCHEMA motions[3].travel", "E_SCHEMA motions[3].parts[0]", "E_SCHEMA motions[4].travel"]) assert.ok(c.includes(want), `${want} not in ${c.join("; ")}`);
  assert.deepEqual(M.motions.map((m) => m.id), ["door"], "bad motions are left out");
});

test("inch units: a slide travel and a pivot come out in mm", () => {
  const P = { id: "box", title: "Box", units: "in", materials: { b: { name: "Board", kind: "each", price: 1 } },
    parts: [{ id: "A", name: "Base", material: "b", size: [10, 1, 10], at: [0, 0, 0] }, { id: "B", name: "Drawer", material: "b", size: [8, 2, 8], at: [1, 1, 1] }],
    steps: [{ id: "s", title: "Put the parts together", parts: ["A", "B"], minutes: 5, check: "Make sure that the drawer moves." }],
    motions: [{ id: "d", name: "Drawer", kind: "slide", parts: ["B"], axis: "z", travel: 6, text: "The drawer slides out." },
      { id: "t", name: "Base", kind: "turn", parts: ["A"], axis: "y", travel: 90, pivot: [5, 0, 5] }] };
  const M = compute(P);
  assert.deepEqual(M.motions.map((m) => [m.travel, m.pivot]), [[152.4, null], [90, [127, 0, 127]]]);
});

test("the motion text is linted and screened for hand-off work", () => {
  const M = compute(withDoor({ text: "Wire the mains plug to the door switch." }));
  assert.ok(find(M, "E_HANDOFF").some((p) => p.path === "motions[0].text"), codes(M).join("; "));
  const S = compute(withDoor({ text: "The door is opened by the hinges." }));
  assert.ok(S.problems.some((p) => p.level === "ste" && p.path === "motions[0].text"), codes(S).join("; "));
});
