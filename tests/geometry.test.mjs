// geometry.mjs: rotated bounds (box and cylinder), union bounds, overlaps with joins, floating parts,
// fastener head and tip, tip-over size.
import { test } from "node:test";
import assert from "node:assert/strict";
import { boxOf, bounds, overlaps, supports, fastenerHits, tipCheck } from "../engine/lib/geometry.mjs";

const near = (a, b, eps = 1e-6) => a.every((v, i) => Math.abs(v - b[i]) <= eps);
const sizeOf = (b) => b.max.map((v, i) => +(v - b.min[i]).toFixed(6));

test("boxOf: plain box, missing or bad fields", () => {
  assert.deepEqual(boxOf({ at: [10, 20, 30], size: [1, 2, 3] }), { min: [10, 20, 30], max: [11, 22, 33] });
  assert.equal(boxOf({ size: [1, 2, 3] }), null);
  assert.equal(boxOf({ at: [0, 0, 0], size: [1, 2] }), null);
  assert.equal(boxOf({ at: [0, 0, "1"], size: [1, 2, 3] }), null);
  assert.equal(boxOf(null), null);
  assert.deepEqual(boxOf({ at: [0, 0, 0], size: [10, 20, 30], rotate: [0, 360, -720] }), { min: [0, 0, 0], max: [10, 20, 30] });
  assert.deepEqual(boxOf({ at: [0, 0, 0], size: [10, 20, 30], rotate: [0, 0, 0] }), { min: [0, 0, 0], max: [10, 20, 30] });
});

test("boxOf: rotation about the box centre", () => {
  assert.deepEqual(boxOf({ at: [0, 0, 0], size: [10, 20, 30], rotate: [0, 90, 0] }), { min: [-10, 0, 10], max: [20, 20, 20] });
  const b = boxOf({ at: [0, 0, 0], size: [10, 10, 10], rotate: [0, 0, 45] });
  const e = 5 * Math.SQRT2;
  assert.ok(near(b.min, [5 - e, 5 - e, 0]) && near(b.max, [5 + e, 5 + e, 10]), JSON.stringify(b));
  for (const rotate of [[30, 0, 0], [12, 34, 56], [-90, 45, 180]]) {
    const r = boxOf({ at: [100, 50, -20], size: [40, 10, 300], rotate });
    assert.ok(near(r.min.map((v, i) => (v + r.max[i]) / 2), [120, 55, 130]), `centre stays for ${rotate}`);
  }
});

test("boxOf: rotation order is x, then y, then z", () => {
  const b = boxOf({ at: [0, 0, 0], size: [10, 20, 30], rotate: [90, 0, 90] });
  assert.deepEqual(sizeOf(b), [30, 10, 20]); // x first: (10, 30, 20); then z: (30, 10, 20). z first would give (20, 30, 10).
  assert.deepEqual(sizeOf(boxOf({ at: [0, 0, 0], size: [10, 20, 30], rotate: [90, 90, 0] })), [20, 30, 10]);
});

test("boxOf: a rotated cylinder gets exact bounds", () => {
  const part = { at: [0, 0, 0], size: [20, 100, 20], shape: "cylinder", rotate: [30, 0, 45] };
  const b = boxOf(part), box = boxOf({ ...part, shape: "box" });
  // Sample the two end circles of the cylinder (axis y, radius 10, half-length 50) and rotate them.
  const [rx, ry, rz] = part.rotate.map((d) => (d * Math.PI) / 180);
  const rot = ([x, y, z]) => {
    [y, z] = [y * Math.cos(rx) - z * Math.sin(rx), y * Math.sin(rx) + z * Math.cos(rx)];
    [x, z] = [x * Math.cos(ry) + z * Math.sin(ry), -x * Math.sin(ry) + z * Math.cos(ry)];
    [x, y] = [x * Math.cos(rz) - y * Math.sin(rz), x * Math.sin(rz) + y * Math.cos(rz)];
    return [x + 10, y + 50, z + 10];
  };
  const pts = [];
  for (let a = 0; a < 360; a += 0.25) for (const y of [-50, 50]) pts.push(rot([10 * Math.cos((a * Math.PI) / 180), y, 10 * Math.sin((a * Math.PI) / 180)]));
  const min = [0, 1, 2].map((i) => Math.min(...pts.map((p) => p[i]))), max = [0, 1, 2].map((i) => Math.max(...pts.map((p) => p[i])));
  assert.ok(near(b.min, min, 1e-3) && near(b.max, max, 1e-3), `${JSON.stringify(b)} vs ${JSON.stringify({ min, max })}`);
  assert.ok([0, 1, 2].every((i) => b.min[i] >= box.min[i] - 1e-9 && b.max[i] <= box.max[i] + 1e-9), "cylinder bounds fit inside box bounds");
  assert.ok(sizeOf(b)[0] < sizeOf(box)[0] - 0.1, "and are tighter");
});

test("bounds: union of parts, props and boxes", () => {
  const u = bounds([{ at: [0, 0, 0], size: [10, 10, 10] }, { at: [20, -5, 0], size: [5, 5, 50] }, { min: [-3, 0, 0], max: [0, 1, 1] }, { size: [1, 1, 1] }]);
  assert.deepEqual(u, { min: [-3, -5, 0], max: [25, 10, 50], size: [28, 15, 50] });
  assert.deepEqual(bounds({ wall: { at: [0, 0, -60], size: [2000, 1500, 60] } }).size, [2000, 1500, 60]);
  assert.equal(bounds([]), null);
  assert.equal(bounds([{ size: [1, 1, 1] }]), null);
});

const side = (over = {}) => ({ id: "A", at: [0, 0, 0], size: [19, 600, 200], ...over });
const shelf = (x, over = {}) => ({ id: "B", at: [x, 100, 0], size: [362, 19, 200], ...over });

test("overlaps: more than tol on all axes, joins allow it", () => {
  assert.deepEqual(overlaps([side(), shelf(14)]), [{ a: "A", b: "B", overlap: [5, 19, 200] }]);
  assert.deepEqual(overlaps([side(), shelf(14, { joins: ["A"] })]), []);
  assert.deepEqual(overlaps([side({ joins: ["B"] }), shelf(14)]), []);
  assert.deepEqual(overlaps([side(), shelf(19)]), [], "faces that touch");
  assert.deepEqual(overlaps([side(), shelf(18.5)]), [], "0.5 mm is within tol");
  assert.equal(overlaps([side(), shelf(18.5)], 0.1).length, 1);
  assert.deepEqual(overlaps([side(), shelf(14, { at: undefined })]), [], "no at: left out");
  assert.deepEqual(overlaps([side(), { id: "C", at: [5, 500, 50], size: [5, 5, 5] }, shelf(14)]).map((p) => `${p.a}-${p.b}`), ["A-C", "A-B"]);
  // A brace 6 mm clear of the side reaches into it when it turns 45 degrees (rotated bounds).
  const brace = { id: "D", at: [25, 300, 50], size: [10, 100, 10] };
  assert.equal(overlaps([side(), brace]).length, 0);
  assert.equal(overlaps([side(), { ...brace, rotate: [0, 0, 45] }]).length, 1);
});

test("supports: floating parts", () => {
  const floor = { id: "F", at: [0, 0, 0], size: [100, 10, 100] };
  assert.deepEqual(supports([floor]), []);
  assert.deepEqual(supports([floor, { id: "S", at: [0, 10, 0], size: [10, 10, 10] }]), [], "on another part");
  assert.deepEqual(supports([{ id: "X", at: [0, 500, 0], size: [10, 10, 10] }]), ["X"]);
  assert.deepEqual(supports([floor, { id: "X", at: [0, 10.8, 0], size: [10, 10, 10] }]), [], "0.8 mm gap is within tol");
  assert.deepEqual(supports([floor, { id: "X", at: [0, 12, 0], size: [10, 10, 10] }]), ["X"], "2 mm gap");
  assert.deepEqual(supports([floor, { id: "X", at: [0, 12, 0], size: [10, 10, 10] }], {}, 3), []);
  const wall = { at: [-100, 0, -60], size: [1000, 2000, 60] };
  assert.deepEqual(supports([{ id: "W", at: [0, 1200, 0], size: [600, 19, 200] }], { wall }), [], "on a prop (map)");
  assert.deepEqual(supports([{ id: "W", at: [0, 1200, 0], size: [600, 19, 200] }], [wall]), [], "on a prop (list)");
  assert.deepEqual(supports([{ id: "P", at: [0, -600, 0], size: [90, 1800, 90] }]), [], "a post set in the ground");
  assert.deepEqual(supports([{ id: "N", size: [1, 1, 1] }]), [], "no at: left out");
});

test("fastenerHits: head on a surface, tip in wood or in air", () => {
  const parts = [{ id: "A", at: [0, 0, 0], size: [19, 300, 200] }, { id: "B", at: [19, 100, 0], size: [362, 19, 200] }];
  const screw = (at, dir, len) => fastenerHits({ at, dir, len }, parts);
  assert.deepEqual(screw([0, 109.5, 100], [1, 0, 0], 50), { head: true, tip: true });
  assert.deepEqual(screw([0, 109.5, 100], [2, 0, 0], 50), { head: true, tip: true }, "dir is normalized");
  assert.deepEqual(screw([0, 109.5, 100], [1, 0, 0], 500), { head: true, tip: false }, "too long: tip in air");
  assert.deepEqual(screw([0, 50, 100], [1, 0, 0], 50), { head: true, tip: false }, "below the shelf: tip in air");
  assert.deepEqual(screw([-20, 109.5, 100], [1, 0, 0], 50), { head: false, tip: true }, "head in air");
  assert.deepEqual(screw([0.5, 109.5, 100], [1, 0, 0], 50), { head: true, tip: true }, "head sunk 0.5 mm");
  assert.deepEqual(screw([10, 109.5, 100], [1, 0, 0], 50), { head: false, tip: true }, "head deep inside the side");
  assert.deepEqual(screw([0, 109.5, 100], [1, 0, 0], 19.5), { head: true, tip: true }, "tip within tol of a face");
  assert.deepEqual(screw([0, 109.5, 100], [1, 0, 0]), { head: true, tip: true }, "no len: tip at the head");
  assert.deepEqual(fastenerHits({ dir: [1, 0, 0], len: 30 }, parts), { head: false, tip: false });
  const gap = [{ at: [0, 0, 0], size: [19, 100, 100] }, { at: [29, 0, 0], size: [19, 100, 100] }];
  assert.deepEqual(fastenerHits({ at: [0, 50, 50], dir: [1, 0, 0], len: 24 }, gap), { head: true, tip: false }, "tip in the gap");
  assert.deepEqual(fastenerHits({ at: [0, 50, 50], dir: [1, 0, 0], len: 35 }, gap), { head: true, tip: true });
});

test("tipCheck: height, base depth and ratio", () => {
  const shelf = [
    { at: [0, 0, 0], size: [19, 900, 235] }, { at: [781, 0, 0], size: [19, 900, 235] },
    { at: [19, 60, 0], size: [762, 19, 235] }, { at: [0, 0, -6], size: [800, 900, 6] },
  ];
  assert.deepEqual(tipCheck(shelf, {}), { height: 900, depth: 241, ratio: 3.73, anchored: false });
  assert.deepEqual(tipCheck([...shelf, { at: [380, 920, -9], size: [40, 30, 3] }], {}).height, 950);
  assert.deepEqual(tipCheck([{ at: [0, 1000, 0], size: [600, 19, 200] }], {}), { height: 1019, depth: null, ratio: null, anchored: false }, "wall-hung: no base");
  // A cabinet on a counter prop: the base is the counter top.
  const counter = { counter: { at: [-100, 0, -50], size: [1000, 900, 600] } };
  assert.deepEqual(tipCheck([{ at: [0, 900, 0], size: [400, 600, 150] }], counter), { height: 600, depth: 150, ratio: 4, anchored: false });
  assert.deepEqual(tipCheck([], {}), { height: 0, depth: null, ratio: null, anchored: false });
  assert.deepEqual(tipCheck([{ size: [1, 1, 1] }]), { height: 0, depth: null, ratio: null, anchored: false });
});
