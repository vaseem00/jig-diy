// Geometry checks on axis-aligned boxes in mm: rotated bounds, overlaps, floating parts, fastener head and tip,
// and the height and base depth for the tip-over check. Items without `at` are left out. The floor is y = 0.

import { round } from "./util.mjs";

const RAD = Math.PI / 180;
const r6 = (v) => round(v, 6);
const vec = (v) => Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === "number" && Number.isFinite(x));
const listOf = (items) => (Array.isArray(items) ? items : items && typeof items === "object" ? Object.values(items) : []);

// Rotation matrix for degrees [rx, ry, rz] applied x, then y, then z: R = Rz * Ry * Rx.
function matrix(rotate) {
  const [cx, sx, cy, sy, cz, sz] = [0, 0, 1, 1, 2, 2].map((a, i) => (i % 2 ? Math.sin : Math.cos)(rotate[a] * RAD));
  return [
    [cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx],
    [sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx],
    [-sy, cy * sx, cy * cx],
  ];
}

// The axis of a cylinder: the side that is not one of the two equal sides (the diameter). -1: no two sides are equal.
function cylinderAxis([x, y, z]) {
  const eq = (a, b) => Math.abs(a - b) < 1e-6;
  return eq(x, z) ? 1 : eq(x, y) ? 2 : eq(y, z) ? 0 : -1;
}

// { min, max } of a part or prop: its box, or the axis-aligned bounds of the box rotated about its centre.
// A rotated cylinder gets its exact bounds (axis extent + radius across it). null when at or size is missing.
export function boxOf(item) {
  if (!item || !vec(item.at) || !vec(item.size)) return null;
  const h = item.size.map((s) => s / 2), c = item.at.map((a, i) => a + h[i]);
  let e = h;
  if (vec(item.rotate) && item.rotate.some((d) => d % 360 !== 0)) {
    const R = matrix(item.rotate), axis = item.shape === "cylinder" ? cylinderAxis(item.size) : -1;
    e = R.map((row) => axis < 0
      ? row.reduce((sum, r, j) => sum + Math.abs(r) * h[j], 0)
      : Math.abs(row[axis]) * h[axis] + h[(axis + 1) % 3] * Math.sqrt(Math.max(0, 1 - row[axis] ** 2)));
  }
  return { min: c.map((v, i) => r6(v - e[i])), max: c.map((v, i) => r6(v + e[i])) };
}

// Matrix of a turn of deg degrees about axis a (0 x, 1 y, 2 z), counterclockwise seen from the + end of the axis.
function axisTurn(a, deg) {
  const c = Math.cos(deg * RAD), s = Math.sin(deg * RAD);
  return a === 0 ? [[1, 0, 0], [0, c, -s], [0, s, c]] : a === 1 ? [[c, 0, s], [0, 1, 0], [-s, 0, c]] : [[c, -s, 0], [s, c, 0], [0, 0, 1]];
}
const mul = (A, B) => A.map((row) => [0, 1, 2].map((j) => row.reduce((sum, v, k) => sum + v * B[k][j], 0)));
export const AXES = { x: 0, y: 1, z: 2 };

// { min, max } of a part moved by a motion { kind, axis, travel, pivot } to share k (0 rest, 1 the full travel). A
// turn gives the exact bounds of the turned box, or of the turned cylinder. null when at or size is missing.
export function movedBox(item, motion, k) {
  const b = boxOf(item);
  if (!b) return null;
  const a = AXES[motion.axis], amount = motion.travel * k;
  if (motion.kind === "slide") {
    const d = [0, 0, 0];
    d[a] = amount;
    return { min: b.min.map((v, i) => r6(v + d[i])), max: b.max.map((v, i) => r6(v + d[i])) };
  }
  const h = item.size.map((s) => s / 2), c = item.at.map((v, i) => v + h[i]), p = motion.pivot;
  const T = axisTurn(a, amount), M = mul(T, vec(item.rotate) ? matrix(item.rotate) : [[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
  const nc = T.map((row, i) => p[i] + row.reduce((sum, v, j) => sum + v * (c[j] - p[j]), 0));
  const cyl = item.shape === "cylinder" ? cylinderAxis(item.size) : -1;
  const e = M.map((row) => cyl < 0
    ? row.reduce((sum, r, j) => sum + Math.abs(r) * h[j], 0)
    : Math.abs(row[cyl]) * h[cyl] + h[(cyl + 1) % 3] * Math.sqrt(Math.max(0, 1 - row[cyl] ** 2)));
  return { min: nc.map((v, i) => r6(v - e[i])), max: nc.map((v, i) => r6(v + e[i])) };
}

// The first clash of a motion: { k, a, b, overlap } at the first share k of SHARES where a moved part a overlaps a part
// or prop b that does not move with it by more than tol on all three axes, or null. A pair that overlaps at rest is not
// a clash of the motion (E_GEOMETRY or joins covers it), and neither is a pair in joins.
export const SHARES = [0.25, 0.5, 0.75, 1];
export function motionClash(parts, props, motion, tol = 1) {
  const all = listOf(parts), mine = new Set(motion.parts);
  const moving = all.filter((p) => mine.has(p.id) && boxOf(p));
  const fixed = [...all.filter((p) => !mine.has(p.id)).map((p) => ({ id: p.id, joins: p.joins, b: boxOf(p) })),
    ...Object.entries(props && typeof props === "object" ? props : {}).map(([id, p]) => ({ id, prop: true, b: boxOf(p) }))].filter((x) => x.b);
  const deep = (A, B) => [0, 1, 2].map((i) => overlap(A, B, i));
  for (const k of SHARES) for (const m of moving) {
    const B = movedBox(m, motion, k), rest = boxOf(m);
    for (const f of fixed) {
      if (m.joins?.includes(f.id) || f.joins?.includes(m.id)) continue;
      const o = deep(B, f.b);
      if (o.every((v) => v > tol) && !deep(rest, f.b).every((v) => v > tol)) return { k, a: m.id, b: f.id, prop: Boolean(f.prop), overlap: o };
    }
  }
  return null;
}

// Union bounds { min, max, size } of parts, props or boxes; null when none has a position.
export function bounds(items) {
  const boxes = listOf(items).map((b) => (b && vec(b.min) && vec(b.max) ? b : boxOf(b))).filter(Boolean);
  if (!boxes.length) return null;
  const min = [0, 1, 2].map((i) => Math.min(...boxes.map((b) => b.min[i]))), max = [0, 1, 2].map((i) => Math.max(...boxes.map((b) => b.max[i])));
  return { min, max, size: max.map((v, i) => r6(v - min[i])) };
}

const overlap = (A, B, i) => r6(Math.min(A.max[i], B.max[i]) - Math.max(A.min[i], B.min[i]));
const touches = (A, B, tol) => [0, 1, 2].every((i) => overlap(A, B, i) >= -tol);
const onFloor = (b, tol) => b.min[1] <= tol && b.max[1] >= -tol;

// [{ a, b, overlap: [x, y, z] }]: pairs of parts whose boxes overlap by more than tol on all three axes.
// A pair is allowed when either part lists the other in joins.
export function overlaps(parts, tol = 1) {
  const list = listOf(parts).map((p) => ({ p, b: boxOf(p) })).filter((x) => x.b);
  const out = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const A = list[i], B = list[j];
      if (A.p.joins?.includes(B.p.id) || B.p.joins?.includes(A.p.id)) continue;
      const o = [0, 1, 2].map((k) => overlap(A.b, B.b, k));
      if (o.every((v) => v > tol)) out.push({ a: A.p.id, b: B.p.id, overlap: o });
    }
  }
  return out;
}

// Ids of parts that touch nothing within tol: no other part, no prop and not the floor.
export function supports(parts, props = {}, tol = 1) {
  const list = listOf(parts).map((p) => ({ id: p.id, b: boxOf(p) })).filter((x) => x.b);
  const fixed = listOf(props).map(boxOf).filter(Boolean);
  return list.filter(({ b }, i) => !onFloor(b, tol) && !fixed.some((f) => touches(b, f, tol)) && !list.some((o, j) => j !== i && touches(b, o.b, tol)))
    .map((x) => x.id);
}

// Distance from a point to the surface of a box (outside or inside).
function surfaceDistance(p, b) {
  const out = Math.hypot(...[0, 1, 2].map((i) => Math.max(b.min[i] - p[i], 0, p[i] - b.max[i])));
  return out > 0 ? out : Math.min(...[0, 1, 2].map((i) => Math.min(p[i] - b.min[i], b.max[i] - p[i])));
}

// { head, tip } for a positional fastener { at, dir, len }: head is within tol of a part surface;
// tip (at + unit dir * len) is inside a part box (tol allowed). No len: the tip is the head point.
export function fastenerHits(f, parts, tol = 1) {
  const boxes = listOf(parts).map(boxOf).filter(Boolean);
  if (!vec(f?.at)) return { head: false, tip: false };
  const n = vec(f.dir) ? Math.hypot(...f.dir) : 0, len = typeof f.len === "number" && Number.isFinite(f.len) ? f.len : 0;
  const tip = f.at.map((v, i) => r6(n ? v + (f.dir[i] / n) * len : v));
  return {
    head: boxes.some((b) => surfaceDistance(f.at, b) <= tol),
    tip: boxes.some((b) => [0, 1, 2].every((i) => tip[i] >= b.min[i] - tol && tip[i] <= b.max[i] + tol)),
  };
}

// Size for the tip-over check: height (top of the parts above the base) and depth (the smaller horizontal side of the
// footprint of the parts on the floor, or on a prop top when no part is on the floor). depth and ratio are null for
// an object with no base (a wall-hung shelf). anchored is false here; safety.mjs fills it.
export function tipCheck(parts, props = {}, tol = 1) {
  const boxes = listOf(parts).map(boxOf).filter(Boolean);
  if (!boxes.length) return { height: 0, depth: null, ratio: null, anchored: false };
  const top = Math.max(...boxes.map((b) => b.max[1]));
  let base = boxes.filter((b) => onFloor(b, tol)), floor = 0;
  if (!base.length) {
    const low = Math.min(...boxes.map((b) => b.min[1]));
    const tops = listOf(props).map(boxOf).filter((t) => t && Math.abs(t.max[1] - low) <= tol);
    base = boxes.filter((b) => Math.abs(b.min[1] - low) <= tol && tops.some((t) => overlap(b, t, 0) > tol && overlap(b, t, 2) > tol));
    floor = low;
  }
  const height = round(top - (base.length ? floor : 0), 1);
  if (!base.length) return { height, depth: null, ratio: null, anchored: false };
  const fp = bounds(base), depth = round(Math.min(fp.size[0], fp.size[2]), 1);
  return { height, depth, ratio: depth > 0 ? round(height / depth, 2) : null, anchored: false };
}
