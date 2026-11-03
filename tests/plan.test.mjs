// plan.mjs: phases are runs of consecutive steps, a repeated phase name is a split (W_PHASE_SPLIT), minutes and wait
// add up, and timeFor scales the work time by the reader level.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildPlan, phaseSplits, timeFor, LEVELS, DEFAULT_PHASE } from "../engine/lib/plan.mjs";
import { compute } from "../engine/lib/model.mjs";

const shelf = () => JSON.parse(readFileSync(new URL("../examples/pine-bookshelf/project.json", import.meta.url), "utf8"));

test("buildPlan: consecutive phases, sums and the levels", () => {
  const plan = buildPlan([
    { phase: "Prepare", minutes: 30 }, { phase: "Prepare", minutes: 15, wait: 5 }, { phase: "Build", minutes: 20 },
    { phase: "Finish", minutes: 10, wait: 120 }, { phase: "Build", minutes: 5 }, { minutes: 7.5 },
  ]);
  assert.deepEqual(plan.phases, [
    { name: "Prepare", steps: [0, 1], minutes: 45, wait: 5 }, { name: "Build", steps: [2], minutes: 20, wait: 0 },
    { name: "Finish", steps: [3], minutes: 10, wait: 120 }, { name: "Build", steps: [4, 5], minutes: 12.5, wait: 0 },
  ]);
  assert.deepEqual([plan.active, plan.wait], [87.5, 125]);
  assert.deepEqual(plan.levels, { new: 1.5, some: 1.2, pro: 1 });
  assert.notEqual(plan.levels, LEVELS, "a copy");
  assert.equal(DEFAULT_PHASE, "Build");
  assert.deepEqual(buildPlan([]), { phases: [], active: 0, wait: 0, levels: LEVELS });
  assert.deepEqual(buildPlan(null).phases, []);
  assert.deepEqual(buildPlan([{ minutes: -5, wait: NaN }, { phase: "  ", minutes: "9" }]).phases, [{ name: "Build", steps: [0, 1], minutes: 0, wait: 0 }]);
});

test("phaseSplits: each later run of an earlier phase name", () => {
  const plan = buildPlan([{ phase: "A" }, { phase: "B" }, { phase: "A" }, { phase: "A" }, { phase: "C" }, { phase: "B" }]);
  assert.deepEqual(phaseSplits(plan.phases), [{ name: "A", step: 2, first: 0 }, { name: "B", step: 5, first: 1 }]);
  assert.deepEqual(phaseSplits(buildPlan([{ phase: "A" }, { phase: "A" }]).phases), []);
  assert.deepEqual(phaseSplits(), []);
});

test("timeFor: level factors, unknown level and bad minutes", () => {
  assert.equal(timeFor(40, "new"), 60);
  assert.equal(timeFor(45, "some"), 54);
  assert.equal(timeFor(45, "pro"), 45);
  assert.equal(timeFor(45), 45);
  assert.equal(timeFor(45, "expert"), 45);
  assert.equal(timeFor(7, "some"), 8.4);
  for (const bad of [undefined, null, -3, NaN, "20"]) assert.equal(timeFor(bad, "new"), 0);
});

test("compute: the bookshelf plan and W_PHASE_SPLIT with its path", () => {
  const M = compute(shelf());
  assert.deepEqual(M.plan.phases.map((p) => [p.name, p.steps, p.minutes, p.wait]), [
    ["Prepare", [0, 1, 2], 120, 0], ["Build", [3, 4, 5, 6, 7], 110, 0], ["Finish", [8, 9], 80, 240],
  ]);
  assert.deepEqual([M.plan.active, M.plan.wait], [310, 240]);
  assert.deepEqual(M.steps.map((s) => s.index), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const p = shelf();
  p.steps[9].phase = "Build";
  const split = compute(p).problems.filter((x) => x.code === "W_PHASE_SPLIT");
  assert.deepEqual(split.map((x) => [x.level, x.path, x.where]), [["warn", "steps[9].phase", "step 10"]]);
  assert.match(split[0].msg, /"Build".*Step 4/);
  assert.equal(compute(p, { mode: "estimate" }).problems.filter((x) => x.code === "W_PHASE_SPLIT").length, 0, "the estimate mode has no plan checks");
});
