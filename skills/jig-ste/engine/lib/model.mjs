// The project model: one source of every number the guide shows. compute() runs validate, cut sizes, packing, needs,
// BOQ, purchase, plan, safety, geometry (guide mode) and the STE lint. It never throws: bad input becomes problems.

import { ENGINE_VERSION, FORMAT } from "./version.mjs";
import { validate } from "./validate.mjs";
import { packLinear, packSheets, expandPerLength } from "./pack.mjs";
import { buildBoq, TOOL_KEY } from "./boq.mjs";
import { buildPurchase } from "./purchase.mjs";
import { buildPlan, phaseSplits } from "./plan.mjs";
import { safetyChecks } from "./safety.mjs";
import { overlaps, supports, fastenerHits } from "./geometry.mjs";
import { lint } from "./ste.mjs";
import { TECHNIQUES, fillTechnique } from "./techniques.mjs";
import { fmtLen, fmtMoney, minorUnits } from "./locale.mjs";
import { round, stableSort } from "./util.mjs";

const TOL = 1.5; // mm: a part side matches a linear section or a sheet thickness within this
const MODES = ["estimate", "plan", "guide"];
const RANK = { error: 0, warn: 1, ste: 2, info: 3 };
const BAD = Symbol("bad");
const PERMS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]; // [length, width, thick] sides
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const vec = (v) => Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === "number" && Number.isFinite(x));
const count = (v) => (Array.isArray(v) ? v.length : 0), keys = (v) => (isObj(v) ? Object.keys(v).length : 0);
const surface = ([x, y, z]) => { const a = 2 * (x * y + y * z + x * z); return Number.isFinite(a) ? a : 0; }; // mm², all six faces
const txt = (d) => (typeof d === "string" ? d : d?.t);
const pathOf = (seg) => seg.map((k, i) => (typeof k === "number" ? `[${k}]` : /^[\w-]+$/.test(k) ? `${i ? "." : ""}${k}` : `[${JSON.stringify(k)}]`)).join("");
const mk = (level, code, seg, where, msg, hint) => ({ level, code, path: typeof seg === "string" ? seg : pathOf(seg), where, msg, hint });
const EMPTY_SAFETY = { tip: null, ppe: [], handoffs: [], power: [], notes: [], cleared: [] };

// Raw index of each normalized item. validate keeps the raw order and only drops items, so a greedy match works.
function align(raw, list, same) {
  const arr = Array.isArray(raw) ? raw : [];
  let j = 0;
  return list.map((x, i) => {
    let k = j;
    while (k < arr.length && !same(arr[k], x)) k++;
    if (k >= arr.length) return i;
    j = k + 1;
    return k;
  });
}

// The raw entry of each expanded fastener: [{ j, k, n }] (raw index, copy, copies), or null when the counts disagree.
function fastenerSources(raw, fs, mats) {
  if (!Array.isArray(raw)) return null;
  const out = [], rep = (r) => isObj(r) && Number.isInteger(r.count) && r.count >= 1 && r.count <= 500 && vec(r.step);
  raw.forEach((f, j) => {
    if (!isObj(f) || typeof f.material !== "string" || !Object.hasOwn(mats, f.material) || mats[f.material].kind !== "each") return;
    const n = vec(f.at) && vec(f.dir) ? (f.dir.some((x) => x !== 0) ? (rep(f.repeat) ? f.repeat.count : 1) : 0) : Number.isInteger(f.count) && f.count >= 1 ? 1 : 0;
    for (let k = 0; k < n; k++) out.push({ j, k, n });
  });
  return out.length === fs.length && out.every((o, x) => raw[o.j].material === fs[x].material) ? out : null;
}

// The cut of a part: { length, width, thick } on a linear material (thickness and width match the section; with rip
// the width may be less), { a, b, thick } on a sheet (one side matches the thickness), null on each, BAD on no match.
function cutOf(p, m) {
  const s = p.size;
  if (m.kind === "linear") {
    const [w, t] = m.section;
    let best = null;
    for (const [L, W, T] of PERMS.map((q) => q.map((k) => s[k]))) {
      const dt = Math.abs(T - t), full = Math.abs(W - w) <= TOL;
      if (dt > TOL || !(full || (p.rip === true && W < w))) continue;
      // Prefer a full-width match, then the closest match, then the longest cut length.
      const score = [full ? 0 : 1, dt + (full ? Math.abs(W - w) : 0), -L], i = best ? score.findIndex((v, k) => v !== best.score[k]) : -1;
      if (!best || (i >= 0 && score[i] < best.score[i])) best = { score, cut: { length: L, width: W, thick: T } };
    }
    return best ? best.cut : BAD;
  }
  if (m.kind === "sheet") {
    let k = -1;
    s.forEach((v, i) => { if (Math.abs(v - m.thick) <= TOL && (k < 0 || Math.abs(v - m.thick) < Math.abs(s[k] - m.thick))) k = i; });
    if (k < 0) return BAD;
    const rest = s.filter((_, i) => i !== k);
    return { a: Math.max(...rest), b: Math.min(...rest), thick: s[k] };
  }
  return null;
}

// The solid volume of a part in mm³: a box, or a cylinder along the side that is not one of the two equal sides (as
// the viewer draws it; a cylinder with no two equal sides is a box there too).
function volumeOf({ size, shape }) {
  const [x, y, z] = size, eq = (a, b) => Math.abs(a - b) < 1e-6, axis = shape !== "cylinder" ? -1 : eq(x, z) ? 1 : eq(x, y) ? 2 : eq(y, z) ? 0 : -1;
  if (axis < 0) return x * y * z;
  const d = size[(axis + 1) % 3];
  return (Math.PI / 4) * d * d * size[axis];
}

// The print of a part of a printed material: the slicer numbers, else estimates from the size. grams = volume (cm³) x
// density x fill, to 1 g; hours = grams / rate, to 0.1 h. est says which value is an estimate. step: the prints step.
function printOf(p, m) {
  const g = p.print?.grams, h = p.print?.hours;
  const grams = Math.max(1, round(g ?? (volumeOf(p) / 1000) * m.density * m.fill, 0));
  const hours = Math.max(0.1, round(h ?? grams / m.rate, 1));
  return { grams, hours, settings: p.print?.settings ?? "", est: { grams: g === undefined, hours: h === undefined }, step: null };
}

// Nominal inch timber sizes and their actual sizes: a 2x4 is 1 1/2 x 3 1/2 in.
const ACTUAL = { 1: 0.75, 2: 1.5, 3: 2.5, 4: 3.5, 6: 5.5, 8: 7.25, 10: 9.25, 12: 11.25 };
const NOMINAL_THICK = new Set([1, 2, 4]);
const UNDER = [6, 19.1]; // mm: an actual size is 1/4 to 3/4 in under the nominal size

// The section of a linear material whose parts all miss it, when it looks like a nominal size: an inch size such as
// [4, 2] for a 2x4, or a section that every part is the same 6-19 mm under. -> { section: [w, t] in project units,
// example } or null.
function nominalFix(section, list, units) {
  const sw = Math.max(...section), st = Math.min(...section), inch = (v) => v / 25.4, whole = (v) => Math.abs(v - Math.round(v)) < 0.01;
  const iw = Math.round(inch(sw)), it = Math.round(inch(st));
  const sides = (p) => PERMS.map(([, a, b]) => [p.size[a], p.size[b]]);
  // The inch table names the actual size only when a part has it: then the section change fixes that part, and
  // the other parts get their own errors.
  const table = units === "in" && whole(inch(sw)) && whole(inch(st)) && Object.hasOwn(ACTUAL, iw) && NOMINAL_THICK.has(it) && it <= iw
    && list.some((p) => sides(p).some(([a, b]) => Math.abs(a - ACTUAL[iw] * 25.4) <= TOL && Math.abs(b - ACTUAL[it] * 25.4) <= TOL));
  const under = ([w, t]) => sw - w >= UNDER[0] && sw - w <= UNDER[1] && st - t >= UNDER[0] && st - t <= UNDER[1];
  const shared = sides(list[0]).filter(under)
    .find(([w, t]) => list.every((p) => sides(p).some(([a, b]) => Math.abs(a - w) <= TOL && Math.abs(b - t) <= TOL)));
  if (!table && !shared) return null;
  const actual = table ? [ACTUAL[iw] * 25.4, ACTUAL[it] * 25.4] : null, show = (v) => fmtLen(v, units).replace(/ (mm|in)$/, "");
  return {
    section: (shared ?? actual).map((v) => round(v / (units === "in" ? 25.4 : 1), 4)),
    example: table ? `A ${it}x${iw} is ${show(actual[0])} x ${show(actual[1])} ${units}.` : null,
  };
}

// compute(project, { mode, start }) -> model (ARCHITECTURE.md section 5.2). mode: estimate | plan | guide.
// start: YYYY-MM-DD for the order-by dates of the purchase plan.
export function compute(project, { mode = "guide", start = null } = {}) {
  if (!MODES.includes(mode)) mode = "guide";
  const out = [];
  const run = (stage, fn) => {
    try { fn(); } catch (e) { out.push(mk("error", "E_SCHEMA", "", "project", `Internal error in the ${stage} stage: ${e?.message ?? e}.`, "Contact the jig maintainers with this error and the project file.")); }
  };
  let P = null, vp = [];
  run("validate", () => ({ project: P, problems: vp } = validate(project, { mode, techniques: TECHNIQUES })));
  out.push(...vp);
  P ??= validate({}, { mode }).project;
  const R = isObj(project) ? project : {}, units = P.units, mats = P.materials, planned = mode !== "estimate";
  const fmt = (mm) => fmtLen(mm, units), dims = (s) => `${s.map((v) => fmt(v).replace(/ (mm|in)$/, "")).join(" x ")} ${units}`;

  // Stop early when there is nothing to compute: the project, its materials or its parts are not usable.
  const fatal = vp.some((p) => p.level === "error" && p.code === "E_SCHEMA" && ["", "materials", "parts"].includes(p.path));
  let parts = [], cuts = [], rows = [], totals = buildBoq({ units, currency: P.currency, contingency: P.contingency, tax: P.tax ?? null }).totals;
  let purchase = [], plan = buildPlan([]), safety = EMPTY_SAFETY, tools = [], techniques = {}, steps = [];

  if (!fatal) {
    // Paths point into the raw input. lost: validate dropped items, so checks that need the whole list stay quiet.
    const rawPart = align(R.parts, P.parts, (r, n) => isObj(r) && r.id === n.id && r.material === n.material);
    const rawStep = align(R.steps, P.steps, (r, n) => isObj(r) && r.id === n.id && r.title === n.title);
    const rawTool = align(R.tools, P.tools, (r, n) => isObj(r) && r.id === n.id && r.name === n.name);
    const clear = P.safety?.cleared ?? [];
    const rawClear = align(isObj(R.safety) ? R.safety.cleared : null, clear, (r, n) => isObj(r) && r.topic === n.topic && r.why === n.why);
    const partAt = new Map(P.parts.map((p, k) => [p.id, rawPart[k]])), byId = new Map(P.parts.map((p) => [p.id, p]));
    const sNo = (i) => rawStep[i] + 1, rawS = (i) => (Array.isArray(R.steps) && isObj(R.steps[rawStep[i]]) ? R.steps[rawStep[i]] : {});
    const lost = { steps: count(R.steps) > P.steps.length, parts: count(R.parts) > P.parts.length, materials: keys(R.materials) > keys(mats), props: keys(R.props) > keys(P.props) };
    const errAt = (re) => vp.some((p) => p.level === "error" && re.test(p.path));
    const remap = (q) => {
      let { path, where } = q;
      const m = /^(steps|parts|tools|safety\.cleared)\[(\d+)\]/.exec(path ?? "");
      if (m) {
        const k = Number(m[2]), r = ({ steps: rawStep, parts: rawPart, tools: rawTool, "safety.cleared": rawClear }[m[1]])[k] ?? k;
        path = `${m[1]}[${r}]${path.slice(m[0].length)}`;
        if (m[1] === "steps") where = String(where).replace(/^step \d+/, `step ${r + 1}`);
        if (m[1] === "safety.cleared") where = String(where).replace(/^cleared entry \d+/, `cleared entry ${r + 1}`);
      }
      return { level: q.level, code: q.code, path, where, msg: q.msg, hint: q.hint };
    };

    run("cut sizes", () => {
      const cutsOf = new Map(P.parts.map((p) => [p, cutOf(p, mats[p.material])]));
      // A linear material whose parts all miss its section, when the section looks like a nominal size: one error on
      // the section, not one on each part.
      const nominal = new Map();
      for (const [id, m] of Object.entries(mats)) {
        if (m.kind !== "linear" || m.profile === "round") continue;
        const mine = P.parts.filter((p) => p.material === id);
        if (!mine.length || mine.some((p) => cutsOf.get(p) !== BAD)) continue;
        const fix = nominalFix(m.section, mine, units);
        if (fix) nominal.set(id, { ...fix, first: mine[0] });
      }
      parts = P.parts.map((p) => {
        const m = mats[p.material], cut = cutsOf.get(p), nom = nominal.get(p.material);
        if (cut === BAD && nom) {
          if (nom.first === p) {
            const mine = P.parts.filter((x) => x.material === p.material).map((x) => x.id), ids = mine.length > 1 ? `${mine.slice(0, -1).join(", ")} and ${mine.at(-1)}` : mine[0];
            out.push(mk("error", "E_SECTION", ["materials", p.material, "section"], `material ${p.material}`,
              `No two sides of part${mine.length > 1 ? "s" : ""} ${ids} match the ${dims(m.section)} section of "${m.name}".`,
              `The section looks like the nominal size.${nom.example ? ` ${nom.example}` : ""} If the parts are right, set section to [${nom.section.join(", ")}].`));
          }
        } else if (cut === BAD && m.kind === "linear") {
          const [w, t] = m.section, rod = m.profile === "round";
          out.push(mk("error", "E_SECTION", ["parts", partAt.get(p.id), "size"], `part ${p.id}`,
            `Part ${p.id} is ${dims(p.size)}. No two sides match the ${rod ? `round ${fmt(w)}` : dims([w, t])} section of "${m.name}".`,
            rod ? `Make two sides of the part ${fmt(w)}: the diameter of the rod.`
              : `Make two sides of the part ${fmt(w)} and ${fmt(t)}, or correct the section if it is the nominal size. To cut a narrower piece, set "rip": true.`));
        } else if (cut === BAD) {
          out.push(mk("error", "E_SECTION", ["parts", partAt.get(p.id), "size"], `part ${p.id}`,
            `Part ${p.id} is ${dims(p.size)}. No side is ${fmt(m.thick)}, the thickness of "${m.name}".`,
            `Make one side ${fmt(m.thick)}, or use a sheet material of the part's thickness.`));
        }
        return {
          id: p.id, label: p.label, name: p.name, material: p.material, materialName: m.name, kind: m.kind, shape: p.shape ?? "box",
          size: p.size, at: p.at ?? null, rotate: p.rotate ?? null, color: p.color ?? m.color ?? null, role: p.role ?? m.role ?? null,
          cut: cut === BAD ? null : cut, ...(m.kind === "printed" ? { print: printOf(p, m) } : {}), step: null,
        };
      });
      // One info for the project when a printed part has no slicer grams or hours.
      const guessed = parts.filter((p) => p.print && (p.print.est.grams || p.print.est.hours));
      if (guessed.length) {
        const labels = [...new Set(guessed.map((p) => p.label))], list = labels.length > 1 ? `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}` : labels[0];
        out.push(mk("info", "I_PRINT_ESTIMATE", ["parts", partAt.get(guessed[0].id), "print"], `part ${guessed[0].id}`,
          `The filament or the printer time of printed part${labels.length > 1 ? "s" : ""} ${list} is an estimate from the part size.`,
          'Slice each part. Then put the slicer numbers in "print", for example "print": { "grams": 24, "hours": 1.5 }.'));
      }
    });

    run("cut plan", () => {
      for (const [id, m] of Object.entries(mats)) {
        if (m.kind !== "linear" && m.kind !== "sheet") continue;
        const mine = parts.filter((p) => p.material === id && p.cut);
        if (!mine.length) continue;
        const base = { material: id, name: m.name, kind: m.kind, color: m.color ?? null };
        let res;
        if (m.kind === "linear") {
          const stock = [...(m.stock ?? []), ...(m.perLength ? expandPerLength(m.perLength, minorUnits(P.currency)) : [])];
          const piece = (p) => ({ id: p.id, label: p.label, len: p.cut.length }), opts = { kerf: P.kerf, trim: P.trim, fmt };
          res = packLinear(mine.map(piece), stock, opts);
          // optimal: the plan is the proven lowest cost. search: "exact" (up to 14 pieces) or "fast" (more pieces).
          cuts.push({ ...base, optimal: res.optimal, search: res.search, boards: res.boards });
          // Rip strips are packed by length only, each from its own board length. When strips side by side across one
          // board (longest first, in groups of `across`, each group from one blank of its longest strip) give a
          // cheaper plan, an info says how much the hand-made plan saves.
          const rips = mine.filter((p) => byId.get(p.id).rip === true);
          const widest = Math.max(0, ...rips.map((p) => p.cut.width)), across = Math.min(rips.length, Math.floor((m.section[0] + P.kerf) / (widest + P.kerf)));
          if (rips.length >= 2 && across >= 2 && !res.problems.length) {
            const ripIds = new Set(rips.map((p) => p.id)), longest = [...rips].sort((a, b) => b.cut.length - a.cut.length), blanks = [];
            for (let k = 0; k < longest.length; k += across) blanks.push(piece(longest[k]));
            const shared = packLinear([...mine.filter((p) => !ripIds.has(p.id)).map(piece), ...blanks], stock, opts);
            const n = res.boards.length, n2 = shared.boards.length, fewer = n2 < n && shared.cost <= res.cost + 1e-9;
            if (!shared.problems.length && (fewer || shared.cost < res.cost - 1e-9)) {
              const ids = rips.map((p) => p.id), list = `${ids.slice(0, -1).join(", ")} and ${ids.at(-1)}`, money = (v) => fmtMoney(v, P.currency);
              out.push(mk("info", "I_RIP_SHARE", ["materials", id], `material ${id}`,
                `Parts ${list} are rip cuts. The plan cuts each strip from its own board length. Up to ${across} strips fit side by side across one board.`,
                fewer ? `To buy fewer boards, rip ${across} strips side by side from one board. The plan then needs ${n2} ${n2 === 1 ? "board" : "boards"}, not ${n}. Make that cut plan by hand.`
                  : `To pay less, rip ${across} strips side by side from one board. The boards then cost ${money(shared.cost)}, not ${money(res.cost)}. Make that cut plan by hand.`));
            }
          }
        } else {
          res = packSheets(mine.map((p) => ({ id: p.id, label: p.label, a: p.cut.a, b: p.cut.b, grain: byId.get(p.id).grain })), m.stock, { kerf: P.kerf, grain: m.grain === true, fmt });
          // pack gives areas in mm²; the model gives m².
          cuts.push({ ...base, sheets: res.sheets.map((s) => ({ ...s, usedArea: round(s.usedArea / 1e6, 6), waste: round(s.waste / 1e6, 6) })) });
        }
        for (const q of res.problems) out.push(mk(q.level, q.code, ["parts", partAt.get(q.id) ?? 0, "size"], q.where, q.msg, q.hint));
      }
    });

    // Each part is installed in exactly one step (plan and guide modes).
    run("installation", () => {
      const at = new Map();
      P.steps.forEach((s, i) => (s.parts ?? []).forEach((id) => {
        if (!at.has(id)) return void at.set(id, i);
        if (!planned) return;
        const j = Array.isArray(rawS(i).parts) ? rawS(i).parts.indexOf(id) : -1;
        out.push(mk("error", "E_INSTALLED_TWICE", ["steps", rawStep[i], "parts", ...(j >= 0 ? [j] : [])], `step ${sNo(i)}`,
          `Step ${sNo(at.get(id))} and step ${sNo(i)} both install part ${id}.`, `Install part ${id} in one step only. To light it in another step, use "focus".`));
      }));
      for (const p of parts) p.step = at.get(p.id) ?? null;
      if (planned && P.steps.length && !lost.steps) for (const p of parts) if (p.step === null)
        out.push(mk("error", "E_NOT_INSTALLED", ["parts", partAt.get(p.id)], `part ${p.id}`, `No step installs part ${p.id} (${p.name}).`, `Add "${p.id}" to the parts of the step that puts it in place.`));
    });

    // Needs per material: parts, fasteners, uses and finishes (area: all six faces of each finished part).
    const need = Object.create(null), finished = new Set(); // ids such as "constructor" are valid: no prototype
    // The parts a finish covers: its list, else every part not of an each or printed material, except finish: false.
    const finishedParts = (f) => (f.parts ? f.parts.map((id) => byId.get(id)).filter(Boolean) : P.parts.filter((p) => !["each", "printed"].includes(mats[p.material].kind) && p.finish !== false));
    // Printer minutes by step index: the hours of each printed part go to the first step that prints its material.
    const printMin = new Map(), printAt = (id) => P.steps.findIndex((s) => s.prints === true || (Array.isArray(s.prints) && s.prints.includes(id)));
    run("needs", () => {
      const touch = (id, i) => {
        const n = (need[id] ??= { first: i, count: 0, amount: 0, finish: [], part: false, fastener: false });
        n.first = Math.min(n.first, i);
        return n;
      };
      for (const p of parts) {
        if (p.kind === "each") { const n = touch(p.material, p.step ?? 0); n.count++; n.part = true; continue; }
        if (p.kind === "printed") {
          const at = printAt(p.material), first = Math.min(...[at, p.step].filter((x) => x !== null && x >= 0));
          const n = touch(p.material, Number.isFinite(first) ? first : 0);
          n.count++;
          n.amount += p.print.grams;
          n.hours = round((n.hours ?? 0) + p.print.hours, 2);
          p.print.step = at >= 0 ? at : null;
          if (at >= 0) printMin.set(at, round((printMin.get(at) ?? 0) + p.print.hours * 60, 2));
          continue;
        }
        const cutAt = P.steps.findIndex((s) => s.cuts === true || (Array.isArray(s.cuts) && s.cuts.includes(p.material)));
        const first = Math.min(...[cutAt, p.step].filter((x) => x !== null && x >= 0));
        touch(p.material, Number.isFinite(first) ? first : 0);
      }
      const uses = (u, i) => {
        for (const [id, q] of Object.entries(u ?? {})) { const n = touch(id, i); if (mats[id].kind === "each") n.count += q; else n.amount += q; }
      };
      const finish = (f, i) => {
        const list = finishedParts(f);
        list.forEach((p) => finished.add(p.id));
        touch(f.material, i).finish.push({ area: list.reduce((a, p) => a + surface(p.size), 0) / 1e6, coats: f.coats ?? mats[f.material].coats ?? 1 });
      };
      P.steps.forEach((s, i) => {
        for (const f of s.fasteners ?? []) { const n = touch(f.material, i); n.count += f.count ?? 1; n.fastener = true; }
        uses(s.uses, i);
        if (s.finish) finish(s.finish, i);
      });
      uses(P.uses, 0);
      P.finish.forEach((f) => finish(f, 0));
      // A printed material that no step prints: its printer time is in no step.
      if (planned && P.steps.length && !lost.steps) for (const [id, m] of Object.entries(mats)) {
        const mine = m.kind === "printed" && printAt(id) < 0 ? [...new Set(parts.filter((p) => p.material === id).map((p) => p.label))] : [];
        if (mine.length) out.push(mk("warn", "W_NO_PRINT_STEP", ["materials", id], `material ${id}`,
          `No step prints the parts of "${m.name}" (${mine.length > 1 ? `${mine.slice(0, -1).join(", ")} and ${mine.at(-1)}` : mine[0]}), so the plan has no printer time for them.`,
          `Add "prints": true to the step in which the printer makes the parts, or add "${id}" to its prints list. The printer time then counts as waiting time of that step.`));
      }
    });

    run("tools", () => {
      const firstUse = new Map();
      P.steps.forEach((s, i) => (s.tools ?? []).forEach((id) => firstUse.has(id) || firstUse.set(id, i)));
      tools = P.tools.map((t) => ({ ...t, first: firstUse.get(t.id) ?? null }));
    });

    run("BOQ", () => {
      const area = [...finished].reduce((a, id) => a + surface(byId.get(id).size), 0) / 1e6;
      ({ rows, totals } = buildBoq({ materials: mats, tools, needs: need, cuts, area, units, currency: P.currency, contingency: P.contingency, tax: P.tax ?? null }));
      for (const r of rows) {
        if (r.rate !== null) continue;
        const tool = r.key.startsWith(TOOL_KEY), k = tools.findIndex((t) => t.id === r.id);
        out.push(mk("warn", "W_PRICE_UNKNOWN", tool ? ["tools", rawTool[k] ?? k, "price"] : ["materials", r.id, "price"], `${tool ? "tool" : "material"} ${r.id}`,
          `"${r.name}" has no price, so the total leaves it out.`,
          tool ? 'Add an estimated "price". If you have the tool, set "have": true. To borrow it, set "get": "borrow".' : `Add an estimated "price" for one ${mats[r.id]?.kind === "printed" ? "spool" : "pack"}.`));
      }
    });

    run("purchase", () => { purchase = buildPurchase(rows, P.stores, { start, currency: P.currency }); });

    run("plan", () => {
      // Printer time is machine time: waiting time of the prints step, not work time (never scaled by the level).
      plan = buildPlan(P.steps.map((s, i) => (printMin.has(i) ? { ...s, wait: round((s.wait ?? 0) + printMin.get(i), 2) } : s)));
      if (planned) for (const sp of phaseSplits(plan.phases))
        out.push(mk("warn", "W_PHASE_SPLIT", ["steps", rawStep[sp.step], "phase"], `step ${sNo(sp.step)}`,
          `The phase "${sp.name}" starts again after another phase. Step ${sNo(sp.first)} started it first.`,
          `Move step ${sNo(sp.step)} next to the other "${sp.name}" steps, or give it its own phase name.`));
    });

    // Safety: power-tool WARNING, tip-over and hand-off. The estimate mode keeps only the summary. The cleared hand-off
    // hits of the summary point into the raw project, as the problems do.
    run("safety", () => {
      const r = safetyChecks(P, { mode, techniques: { ...TECHNIQUES, ...P.techniques } });
      safety = { ...r.summary, cleared: r.summary.cleared.map((c) => ({ ...c, entry: rawClear[c.entry] ?? c.entry, hits: c.hits.map((h) => {
        const { path, where } = remap(h);
        return { path, where, text: h.text, context: h.context };
      }) })) };
      if (planned) for (const q of r.problems) if ((q.code !== "E_TIP_OVER" && q.code !== "W_TIP_SMALL") || !(lost.parts || lost.materials || lost.steps)) out.push(remap(q));
    });

    if (mode === "guide") run("geometry", () => {
      const placed = P.parts.filter((p) => p.at), solids = [...placed, ...Object.values(P.props).filter((p) => p.at)];
      for (const o of overlaps(placed))
        out.push(mk("error", "E_GEOMETRY", ["parts", partAt.get(o.b), "at"], `part ${o.b}`, `Parts ${o.a} and ${o.b} overlap by ${dims(o.overlap)}.`,
          `Set the "at" of part ${o.b} from the face of part ${o.a}. If the overlap is a real joint (a dado, a tenon), add "${o.a}" to the joins of part ${o.b}.`));
      if (lost.parts || lost.props) return;
      for (const id of supports(placed, P.props))
        out.push(mk("warn", "W_FLOATING", ["parts", partAt.get(id), "at"], `part ${id}`, `Part ${id} touches no other part, no prop and not the floor.`,
          "Adjust its \"at\" so that it rests on the part that holds it. If it hangs on a wall or a bench, add that as a prop."));
      P.steps.forEach((s, i) => {
        const fs = s.fasteners ?? [], src = fastenerSources(rawS(i).fasteners, fs, mats), bad = new Map();
        fs.forEach((f, x) => {
          if (f.count !== undefined) return;
          const hit = fastenerHits({ at: f.at, dir: f.dir, len: f.len ?? mats[f.material].len }, solids);
          if (hit.head && hit.tip) return;
          const key = src ? src[x].j : -1, b = bad.get(key) ?? { n: src ? src[x].n : fs.length, copies: [], head: false, tip: false, x };
          b.copies.push(src ? src[x].k + 1 : x + 1);
          b.head ||= !hit.head;
          b.tip ||= !hit.tip;
          bad.set(key, b);
        });
        for (const [j, b] of bad) {
          // Copies of one repeat entry; or, when the raw entries do not match, fasteners of the step.
          const word = (j >= 0 ? ["Copy", "Copies"] : ["Fastener", "Fasteners"])[b.copies.length > 1 ? 1 : 0];
          const which = b.n > 1 ? `${word} ${b.copies.length > 1 ? `${b.copies.slice(0, -1).join(", ")} and ${b.copies.at(-1)}` : b.copies[0]} of ${b.n}: ` : "";
          const what = [b.head && "the head is not on a part surface", b.tip && "the tip ends in air, not inside a part"].filter(Boolean).join(", and ");
          out.push(mk("warn", "W_FASTENER", ["steps", rawStep[i], "fasteners", ...(j >= 0 ? [j] : [])], `step ${sNo(i)}, fastener ${j >= 0 ? j + 1 : b.x + 1}`,
            `${which}${which ? what : what[0].toUpperCase() + what.slice(1)}.`,
            'Put "at" on the face where the fastener goes in. Set "dir" so that it points into the part. Use a "len" that ends inside the part.'));
        }
      });
    });

    run("unused", () => {
      // A dropped part or step, or a dropped fastener, use or finish (bad item, wrong kind, no coverage) loses a user.
      const users = lost.steps || lost.parts || errAt(/^(uses|finish|steps\[\d+\]\.(fasteners|uses|finish))|\.coverage$/);
      if (!users) for (const id of Object.keys(mats)) if (!need[id])
        out.push(mk("warn", "W_UNUSED_MATERIAL", ["materials", id], `material ${id}`, `No part, fastener, use or finish uses the material "${id}".`, "Use it in a step, or remove it from materials."));
      if (P.steps.length && !lost.steps) tools.forEach((t, k) => {
        if (t.first === null) out.push(mk("warn", "W_UNUSED_TOOL", ["tools", rawTool[k]], `tool ${t.id}`, `No step uses the tool "${t.id}".`, "Add it to the tools of the step that needs it, or remove it."));
      });
    });

    const taught = [...new Set(P.steps.flatMap((s) => s.teach ?? []))];
    run("techniques", () => {
      techniques = Object.fromEntries(taught.map((id) => {
        const c = Object.hasOwn(P.techniques, id) ? P.techniques[id] : TECHNIQUES[id];
        return [id, fillTechnique({ name: c.name, why: c.why ?? "", warn: c.warn ?? [], do: c.do, tools: c.tools ?? [] }, { kerf: P.kerf, units })];
      }));
    });

    // STE lint of every text the reader sees. Built-in cards pass the linter (tests/techniques.test.mjs).
    if (planned) run("STE", () => {
      const opts = { names: [...P.terms, ...Object.values(mats).map((m) => m.name), ...P.parts.map((p) => p.name), ...P.tools.map((t) => t.name)], verbs: P.verbs };
      // One text at a time, so a linter failure on one text does not stop the others.
      const ste = (seg, where, text, kind) => {
        let found = [];
        try { found = lint(text, kind, opts); } catch (e) { out.push(mk("error", "E_SCHEMA", seg, where, `Internal error in the STE linter on this text: ${e?.message ?? e}.`, "Contact the jig maintainers with this error and the project file.")); }
        for (const f of found) out.push(mk("ste", f.code, seg, where, f.msg, f.hint));
      };
      ste(["summary"], "summary", P.summary, "description");
      const rawH = align(R.handoff, P.handoff, (r, n) => isObj(r) && r.topic === n.topic && r.text === n.text);
      P.handoff.forEach((h, k) => ste(["handoff", rawH[k], "text"], `hand-off ${rawH[k] + 1}`, h.text, "description"));
      clear.forEach((c, k) => ste(["safety", "cleared", rawClear[k], "why"], `cleared entry ${rawClear[k] + 1}`, c.why, "description"));
      // Print settings are reader text (the print list shows them), once for each label.
      const shownSettings = new Set();
      P.parts.forEach((p, k) => {
        const s = p.print?.settings;
        if (typeof s !== "string" || shownSettings.has(p.label)) return;
        shownSettings.add(p.label);
        ste(["parts", rawPart[k], "print", "settings"], `part ${p.id}, print settings`, s, "description");
      });
      P.steps.forEach((s, i) => {
        const r = rawStep[i], raw = rawS(i), w = `step ${r + 1}`;
        ste(["steps", r, "title"], `${w}, title`, s.title, "title");
        const d = align(raw.do, s.do ?? [], (a, b) => txt(a) === txt(b));
        (s.do ?? []).forEach((x, j) => ste(["steps", r, "do", d[j]], `${w}, line ${d[j] + 1}`, txt(x), "procedure"));
        const wa = align(raw.warn, s.warn ?? [], (a, b) => isObj(a) && a.text === b.text);
        (s.warn ?? []).forEach((x, j) => ste(["steps", r, "warn", wa[j], "text"], `${w}, warning ${wa[j] + 1}`, x.text, "warning"));
        ste(["steps", r, "check"], `${w}, check`, s.check, "procedure");
        ste(["steps", r, "why"], `${w}, why`, s.why, "description");
        ste(["steps", r, "tip"], `${w}, tip`, s.tip, "description");
        ste(["steps", r, "view", "note"], `${w}, view note`, s.view?.note, "description");
      });
      for (const id of taught) {
        if (!Object.hasOwn(P.techniques, id) || !techniques[id]) continue;
        const c = techniques[id], raw = isObj(R.techniques?.[id]) ? R.techniques[id] : {}, w = `technique ${id}`;
        ste(["techniques", id, "name"], `${w}, name`, c.name, "title");
        // {kerf} is filled, so a raw line matches any non-empty text (validate drops only empty or non-text lines).
        const d = align(raw.do, c.do, (a) => typeof a === "string" && a.length > 0);
        const wa = align(raw.warn, c.warn, (a) => isObj(a) && typeof a.text === "string" && a.text.length > 0 && ["warning", "caution"].includes(a.type));
        c.do.forEach((x, j) => ste(["techniques", id, "do", d[j]], `${w}, line ${d[j] + 1}`, x, "procedure"));
        c.warn.forEach((x, j) => ste(["techniques", id, "warn", wa[j], "text"], `${w}, warning ${wa[j] + 1}`, x.text, "warning"));
        ste(["techniques", id, "why"], `${w}, why`, c.why, "description");
      }
    });

    run("steps", () => {
      steps = P.steps.map((s, i) => ({
        ...s, index: i,
        fasteners: (s.fasteners ?? []).map((f) => {
          const m = mats[f.material], counted = f.count !== undefined;
          return { material: f.material, at: counted ? null : f.at, dir: counted ? null : f.dir, len: f.len ?? m.len ?? null, d: f.d ?? m.d ?? null, head: m.head ?? null, color: m.color ?? null, count: counted ? f.count : 1 };
        }),
        // finish: coats and the parts it covers filled in (the viewer lights them)
        ...(s.finish ? { finish: { ...s.finish, coats: s.finish.coats ?? mats[s.finish.material].coats ?? 1, parts: finishedParts(s.finish).map((p) => p.id) } } : {}),
        // printMinutes: the printer time inside wait, on a step with prints only
        minutes: s.minutes ?? 0, wait: printMin.has(i) ? round((s.wait ?? 0) + printMin.get(i), 2) : s.wait ?? 0,
        ...(s.prints === true || Array.isArray(s.prints) ? { printMinutes: printMin.get(i) ?? 0 } : {}),
      }));
    });
    if (rows.some((r) => r.est))
      out.push(mk("info", "I_ESTIMATE", ["estimate"], "project", "The prices are estimates.", 'Replace them with the prices at your store. Set "est": false on each price that you confirm.'));
  }

  const problems = stableSort(out, (a, b) => RANK[a.level] - RANK[b.level]);
  const counts = { error: 0, warn: 0, ste: 0, info: 0 };
  for (const p of problems) counts[p.level]++;
  return {
    engine: ENGINE_VERSION, format: FORMAT, mode,
    meta: {
      id: P.id, title: P.title, summary: P.summary, level: P.level, units, currency: P.currency, tax: P.tax ?? null, priceNote: P.priceNote,
      pricesAsOf: P.pricesAsOf ?? null, estimate: P.estimate, kerf: P.kerf, trim: P.trim,
    },
    parts,
    props: fatal ? {} : Object.fromEntries(Object.entries(P.props).map(([id, p]) => [id, {
      size: p.size, at: p.at ?? null, color: p.color ?? null, shape: p.shape ?? "box", rotate: p.rotate ?? null, hero: p.hero !== false, label: p.label ?? null,
    }])),
    materials: fatal ? {} : Object.fromEntries(Object.entries(mats).map(([id, m]) => [id, {
      name: m.name, kind: m.kind, spec: m.spec ?? "", unit: m.kind === "each" || m.kind === "amount" ? m.unit ?? "piece" : null, color: m.color ?? null,
    }])),
    steps, tools, techniques, cuts, boq: rows, purchase, plan, totals, safety, problems, counts,
  };
}
