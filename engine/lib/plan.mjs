// Build plan: a phase is a run of consecutive steps with one phase name. Work time comes from an experienced
// person's minutes; timeFor scales it to the reader's level.

import { round } from "./util.mjs";

export const LEVELS = { new: 1.5, some: 1.2, pro: 1 }; // First time, Some experience, Experienced
export const DEFAULT_PHASE = "Build"; // a step with no phase name
const num = (v) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0);

// Work minutes at a reader level. An unknown level uses factor 1.
export function timeFor(minutes, level = "pro") {
  return round(num(minutes) * (Object.hasOwn(LEVELS, level) ? LEVELS[level] : 1), 2);
}

// buildPlan(steps) -> { phases: [{ name, steps: [index], minutes, wait }], active, wait, levels }.
export function buildPlan(steps = []) {
  const phases = [];
  (Array.isArray(steps) ? steps : []).forEach((s, i) => {
    const name = typeof s?.phase === "string" && s.phase.trim() ? s.phase : DEFAULT_PHASE, last = phases.at(-1);
    if (last?.name === name) {
      last.steps.push(i);
      last.minutes = round(last.minutes + num(s.minutes), 2);
      last.wait = round(last.wait + num(s.wait), 2);
    } else phases.push({ name, steps: [i], minutes: num(s?.minutes), wait: num(s?.wait) });
  });
  const sum = (k) => round(phases.reduce((a, p) => a + p[k], 0), 2);
  return { phases, active: sum("minutes"), wait: sum("wait"), levels: { ...LEVELS } };
}

// Phases that reuse the name of an earlier, separate phase (W_PHASE_SPLIT): [{ name, step, first }].
// step: the first step of the repeated run; first: the first step of the earlier run.
export function phaseSplits(phases = []) {
  const seen = new Map(), out = [];
  for (const p of phases ?? []) {
    if (seen.has(p.name)) out.push({ name: p.name, step: p.steps[0], first: seen.get(p.name) });
    else seen.set(p.name, p.steps[0]);
  }
  return out;
}
