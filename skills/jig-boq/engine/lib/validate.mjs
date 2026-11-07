// Input layer: checks a project against SCHEMA (E_SCHEMA, E_UNKNOWN_KEY), then ids, references, labels and mode
// needs. Returns a normalized copy (defaults, lengths in mm, fastener repeats expanded) whose references all resolve.
// Bad input never throws: it becomes problems, and the bad values are left out of the normalized copy.

import { SCHEMA } from "./schema.mjs";
import { didYouMean, round } from "./util.mjs";
import { toMM, fmtLen } from "./locale.mjs";
import { HANDOFF_TOPICS, topicOf } from "./safety.mjs";

const BAD = Symbol("bad");
const KINDS = SCHEMA.$defs.material.anyOf.map((r) => deref(r).properties.kind.const); // linear, sheet, each, amount, printed
const KERF = { mm: 3, in: 0.125 }; // default saw kerf in project units
const MAX_KERF = SCHEMA.properties.kerf.maximum; // mm, also checked after an inch conversion
const MAX_LENGTHS = 100000; // board lengths that one perLength may give (max / step)
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const has = (o, k) => isObj(o) && Object.hasOwn(o, k) && o[k] !== undefined;
const items = (v) => (Array.isArray(v) ? [...v.entries()] : []);
const keysOf = (v) => (isObj(v) ? Object.keys(v) : []);
const uniq = (list) => [...new Set(list)];
const put = (o, k, v) => Object.defineProperty(o, k, { value: v, enumerable: true, writable: true, configurable: true });
const copy = (d) => (Array.isArray(d) ? [...d] : d);

const TYPE = { number: "a number", integer: "a whole number", string: "text", boolean: "true or false", array: "a list", object: "an object" };
const PATTERN = new Map([
  [SCHEMA.properties.id.pattern, 'Use lower-case letters, digits and single hyphens, for example "pine-bookshelf".'],
  [SCHEMA.$defs.id.pattern, "Use letters, digits, '.', '_' and '-' only. Start with a letter or a digit."],
  [SCHEMA.$defs.color.pattern, 'Use a hex color such as "#d9b88a".'],
  [SCHEMA.properties.currency.pattern, 'Use a 3-letter ISO 4217 code in capitals, such as "USD".'],
  [SCHEMA.properties.pricesAsOf.pattern, 'Use the form YYYY-MM-DD, for example "2026-11-02".'],
  [SCHEMA.$defs.store.properties.url.pattern, "Use a full address that starts with https:// or http://."],
]);
const regex = new Map();

// ---- problems

const report = (ctx, level, code, seg, msg, hint) => { ctx.list.push({ level, code, seg, msg, hint }); if (level === "error") ctx.errors++; };
const err = (ctx, seg, msg, hint) => report(ctx, "error", "E_SCHEMA", seg, msg, hint);

const pathOf = (seg) => seg.map((k, i) => (typeof k === "number" ? `[${k}]` : /^[\w-]+$/.test(k) ? `${i ? "." : ""}${k}` : `[${JSON.stringify(k)}]`)).join("");

// "step 4, line 2", "part A1", "material pine-1x10".
function whereOf(seg, P) {
  const [a, b, c, d] = seg, n = typeof b === "number";
  const named = (list, word) => {
    const id = Array.isArray(list) && isObj(list[b]) && typeof list[b].id === "string" && list[b].id ? list[b].id : null;
    return `${word} ${id ?? b + 1}`;
  };
  const sub = { do: "line", warn: "warning", fasteners: "fastener" }[c];
  const tail = sub && typeof d === "number" ? `, ${sub} ${d + 1}` : "";
  if (b !== undefined && !n) {
    const word = { materials: "material", stores: "store", props: "prop", techniques: "technique" }[a];
    if (word) return `${word} ${b}${a === "techniques" ? tail : ""}`;
  }
  if (n && a === "parts") return named(P?.parts, "part");
  if (n && a === "tools") return named(P?.tools, "tool");
  if (n && a === "motions") return named(P?.motions, "motion");
  if (n && a === "steps") return `step ${b + 1}${tail}`;
  if (n && a === "finish") return `finish ${b + 1}`;
  if (n && a === "handoff") return `hand-off ${b + 1}`;
  if (a === "safety" && b === "cleared" && typeof c === "number") return `cleared entry ${c + 1}`;
  return "project";
}

// A short quote of a found value.
function show(v) {
  const cut = (s) => (s.length > 40 ? `${s.slice(0, 39)}…` : s);
  if (v === undefined) return "nothing";
  if (typeof v === "string") return JSON.stringify(cut(v));
  if (Array.isArray(v) || isObj(v)) {
    let j;
    try { j = JSON.stringify(v); } catch {}
    return typeof j === "string" ? cut(j) : Array.isArray(v) ? "a list" : "an object";
  }
  return typeof v === "symbol" || typeof v === "function" ? `a ${typeof v}` : String(v);
}
const found = (v) => (typeof v === "string" ? `the text ${show(v)}` : typeof v === "number" ? `the number ${show(v)}` : Array.isArray(v) ? `the list ${show(v)}` : isObj(v) ? "an object" : show(v));

// ---- the schema interpreter (the keywords SCHEMA uses; tests/schema.test.mjs keeps the two in step)

function deref(s) {
  if (!s?.$ref) return s;
  const { $ref, ...rest } = s;
  return { ...deref(SCHEMA.$defs[$ref.slice("#/$defs/".length)]), ...rest };
}

function typeOk(t, v) {
  if (t === "number") return typeof v === "number" && Number.isFinite(v);
  if (t === "integer") return Number.isInteger(v);
  if (t === "array") return Array.isArray(v);
  if (t === "object") return isObj(v);
  return typeof v === t;
}

function typeHint(s, v) {
  const t = [].concat(s.type), num = t.includes("number") || t.includes("integer");
  let fix = `Use ${t.map((x) => TYPE[x]).join(" or ")}.`;
  if (num && typeof v === "string" && v.trim() && Number.isFinite(Number(v))) fix = `Write ${Number(v)} without quotes.`;
  else if (t.includes("boolean") && (v === "true" || v === "false")) fix = `Write ${v} without quotes.`;
  else if (t.includes("integer") && typeof v === "number" && Number.isFinite(v)) fix = `Use a whole number, for example ${Math.round(v)}.`;
  return s.description ? `${fix} ${s.description}` : fix;
}

// Returns the cleaned value (defaults filled, unknown keys dropped) or BAD.
function walk(s, v, seg, ctx) {
  s = deref(s);
  if (s.anyOf && !s.type) return union(s, v, seg, ctx);
  const c = base(s, v, seg, ctx);
  if (c === BAD || !s.anyOf) return c;
  // Branches that only name alternative required fields (linear: stock or perLength).
  const alt = s.anyOf.map((b) => b.required ?? []);
  if (alt.some((r) => r.every((k) => has(c, k)))) return c;
  if (!alt.some((r) => r.every((k) => has(v, k)))) {
    const names = alt.flat().map((k) => `"${k}"`);
    err(ctx, seg, `None of these fields is given: ${names.join(", ")}.`, `Add ${names.join(" or ")}. ${s.description ?? ""}`.trim());
  }
  return BAD;
}

function base(s, v, seg, ctx) {
  if (s.type && ![].concat(s.type).some((t) => typeOk(t, v))) {
    err(ctx, seg, `Expected ${[].concat(s.type).map((t) => TYPE[t]).join(" or ")}, found ${found(v)}.`, typeHint(s, v));
    return BAD;
  }
  if ("const" in s && v !== s.const) return err(ctx, seg, `The value ${show(v)} is not allowed.`, `Use ${show(s.const)}.`), BAD;
  if (s.enum && !s.enum.includes(v)) {
    const m = typeof v === "string" ? didYouMean(v, s.enum) : null;
    return err(ctx, seg, `The value ${show(v)} is not allowed.`, `${m ? `Did you mean "${m}"? ` : ""}Use one of: ${s.enum.join(", ")}.`), BAD;
  }
  if (typeof v === "number") {
    const why = s.description ? ` ${s.description}` : ""; // the description names the scale ("A share: 7% is 0.07.")
    if (s.minimum !== undefined && v < s.minimum) return err(ctx, seg, `The value ${v} is less than ${s.minimum}.`, `Use ${s.minimum} or more.${why}`), BAD;
    if (s.exclusiveMinimum !== undefined && v <= s.exclusiveMinimum) return err(ctx, seg, `The value ${v} is not more than ${s.exclusiveMinimum}.`, `Use a value more than ${s.exclusiveMinimum}.${why}`), BAD;
    if (s.maximum !== undefined && v > s.maximum) return err(ctx, seg, `The value ${v} is more than ${s.maximum}.`, `Use ${s.maximum} or less.${why}`), BAD;
  }
  if (typeof v === "string") {
    if (s.minLength !== undefined && v.length < s.minLength)
      return (s.minLength > 1 ? err(ctx, seg, `The text has ${v.length} characters. It needs ${s.minLength} or more.`, `Write a longer text.${s.description ? ` ${s.description}` : ""}`)
        : err(ctx, seg, "The text is empty.", "Write a value, or remove the field.")), BAD;
    if (s.maxLength !== undefined && v.length > s.maxLength) return err(ctx, seg, `The text has ${v.length} characters. The limit is ${s.maxLength}.`, "Use a shorter value."), BAD;
    if (s.pattern) {
      if (!regex.has(s.pattern)) regex.set(s.pattern, new RegExp(s.pattern, "u"));
      if (!regex.get(s.pattern).test(v)) return err(ctx, seg, `The value ${show(v)} has the wrong format.`, PATTERN.get(s.pattern) ?? `Match the pattern ${s.pattern}.`), BAD;
    }
  }
  if (Array.isArray(v)) return arr(s, v, seg, ctx);
  if (isObj(v)) return obj(s, v, seg, ctx);
  return v;
}

function arr(s, v, seg, ctx) {
  const min = s.minItems, max = s.maxItems, tuple = min !== undefined && min === max;
  if ((min !== undefined && v.length < min) || (max !== undefined && v.length > max)) {
    const want = tuple ? `exactly ${min}` : v.length < min ? `at least ${min}` : `at most ${max}`;
    return err(ctx, seg, `The list has ${v.length} item${v.length === 1 ? "" : "s"}. It needs ${want}.`, `Give ${want} items.${s.description ? ` ${s.description}` : ""}`), BAD;
  }
  const out = [];
  let bad = false;
  for (let i = 0; i < v.length; i++) {
    const c = s.items ? walk(s.items, v[i], [...seg, i], ctx) : v[i];
    if (c === BAD) bad = true;
    else { if (isObj(c)) ctx.src.set(c, i); out.push(c); }
  }
  return (bad && tuple) || (min !== undefined && out.length < min) ? BAD : out;
}

// keep: return the cleaned object even when a required field is bad (the project root).
function obj(s, v, seg, ctx, keep = false) {
  const out = {}, props = s.properties ?? {}, req = s.required ?? [];
  let bad = false;
  for (const k of req) {
    if (has(v, k)) continue;
    const d = props[k] && deref(props[k]).description;
    err(ctx, [...seg, k], `The required field "${k}" is missing.`, `Add "${k}".${d ? ` ${d}` : ""}`);
    bad = true;
  }
  for (const [k, ps] of Object.entries(props)) {
    const c = has(v, k) ? walk(ps, v[k], [...seg, k], ctx) : undefined;
    if (c !== BAD && c !== undefined) out[k] = c;
    else if (c === BAD && req.includes(k)) bad = true;
    else if (ps.default !== undefined) out[k] = copy(ps.default); // absent or bad: the default
  }
  for (const k of Object.keys(v)) {
    if (Object.hasOwn(props, k) || v[k] === undefined) continue;
    if (s.additionalProperties === false) {
      // An error: a misspelt field ("packs" for "pack") silently takes its default, and the numbers go wrong.
      const m = didYouMean(k, Object.keys(props));
      report(ctx, "error", "E_UNKNOWN_KEY", [...seg, k], `Unknown field "${k}".`,
        m ? `Did you mean "${m}"? Fix the name, or remove the field.`
          : k === "price" && props.stock ? "Remove the field. Put the price on each stock entry, or in perLength."
          : `Remove the field. Fields here: ${Object.keys(props).join(", ")}.`);
    } else if (isObj(s.additionalProperties)) {
      if (s.propertyNames && walk(s.propertyNames, k, [...seg, k], { list: [], errors: 0, src: ctx.src }) === BAD) {
        err(ctx, [...seg, k], `The id ${show(k)} has the wrong format.`, PATTERN.get(deref(s.propertyNames).pattern) ?? "Use a shorter, plain id.");
        continue;
      }
      const c = walk(s.additionalProperties, v[k], [...seg, k], ctx);
      if (c !== BAD) put(out, k, c);
    }
  }
  return bad && !keep ? BAD : out;
}

// anyOf. Branches with a shared const field (material kind) pick one branch; others take the branch with the fewest problems.
function union(s, v, seg, ctx) {
  const branches = s.anyOf.map(deref);
  const key = Object.keys(branches[0].properties ?? {}).find((k) => branches.every((b) => b.properties?.[k]?.const !== undefined));
  if (key && isObj(v)) {
    const consts = branches.map((b) => b.properties[key].const);
    if (!has(v, key)) return err(ctx, [...seg, key], `The required field "${key}" is missing.`, `Add "${key}": one of ${consts.join(", ")}.`), BAD;
    const i = consts.indexOf(v[key]);
    if (i >= 0) return walk(branches[i], v, seg, ctx);
    const m = typeof v[key] === "string" ? didYouMean(v[key], consts) : null;
    return err(ctx, [...seg, key], `The ${key} ${show(v[key])} is not known.`, `${m ? `Did you mean "${m}"? ` : ""}Use one of: ${consts.join(", ")}.`), BAD;
  }
  if (branches.every((b) => b.type === "object") && !isObj(v))
    return err(ctx, seg, `Expected an object, found ${found(v)}.`, `Use an object.${s.description ? ` ${s.description}` : ""}`), BAD;
  let best = null;
  for (const b of branches) {
    const sub = { list: [], errors: 0, src: ctx.src }, c = walk(b, v, seg, sub), score = sub.errors * 1000 + sub.list.length;
    if (!best || score < best.score) best = { c, sub, score };
    if (!score) break;
  }
  const first = best.sub.list.find((p) => p.level === "error");
  if (first && s.description) first.hint += ` ${s.description}`;
  ctx.list.push(...best.sub.list);
  ctx.errors += best.sub.errors;
  return best.c;
}

// ---- semantic checks on the raw project (type-guarded; schema errors are already reported)

function checks(R, units, mode, techniques, ctx) {
  const mats = isObj(R.materials) ? R.materials : {}, stores = isObj(R.stores) ? R.stores : {};
  const rawParts = Array.isArray(R.parts) ? R.parts : [], rawSteps = Array.isArray(R.steps) ? R.steps : [], rawTools = Array.isArray(R.tools) ? R.tools : [];
  const idsOf = (list) => new Set(list.filter((x) => isObj(x) && typeof x.id === "string").map((x) => x.id));
  // Known ids; null when the collection is missing (required) or has the wrong type (already an E_SCHEMA): no E_REF then.
  const okType = (v, array) => v === undefined || (array ? Array.isArray(v) : isObj(v));
  const known = {
    material: isObj(R.materials) ? new Set(Object.keys(mats)) : null, part: Array.isArray(R.parts) ? idsOf(rawParts) : null,
    tool: okType(R.tools, true) ? idsOf(rawTools) : null, prop: okType(R.props) ? new Set(keysOf(R.props)) : null,
    technique: okType(R.techniques) ? new Set([...techniques, ...keysOf(R.techniques)]) : null,
  };
  const owner = { material: "materials", part: "parts", tool: "tools", prop: "props", technique: "techniques or the built-in cards" };
  const kindOf = (id) => (has(mats, id) && isObj(mats[id]) && KINDS.includes(mats[id].kind) ? mats[id].kind : null);

  // E_DUP_ID: part, step and tool ids
  for (const [list, word, key] of [[rawParts, "part", "parts"], [rawSteps, "step", "steps"], [rawTools, "tool", "tools"]]) {
    const first = new Map();
    list.forEach((x, i) => {
      const id = isObj(x) && typeof x.id === "string" ? x.id : null;
      if (id === null) return;
      if (!first.has(id)) return first.set(id, i);
      report(ctx, "error", "E_DUP_ID", [key, i, "id"], `The ${word} id "${id}" is used again. ${word[0].toUpperCase() + word.slice(1)} ${first.get(id) + 1} in the list has it too.`,
        `Give each ${word} its own id.${word === "part" ? " Use label to give identical parts one letter." : ""}`);
    });
  }

  // E_REF: one reference; returns true when it resolves.
  const ref = (seg, id, word) => {
    if (typeof id !== "string" || !known[word]) return false;
    if (known[word].has(id)) return true;
    const m = didYouMean(id, known[word]);
    report(ctx, "error", "E_REF", seg, `The ${word} "${id}" does not exist.`, `${m ? `Did you mean "${m}"? ` : ""}Use an id from ${owner[word]}, or add the ${word}.`);
    return false;
  };
  const kind = (seg, id, kinds, what) => {
    const k = kindOf(id);
    if (k && !kinds.includes(k)) report(ctx, "error", "E_REF", seg, `The material "${id}" has kind ${k}. ${what} needs kind ${kinds.join(" or ")}.`, `Use a material of kind ${kinds.join(" or ")}, or change the kind of "${id}".`);
  };
  const mat = (seg, id, kinds, what) => ref(seg, id, "material") && kind(seg, id, kinds, what);
  const refs = (list, seg, word, dup) => {
    const seen = new Set();
    for (const [j, id] of items(list)) {
      if (typeof id !== "string") continue;
      if (dup && seen.has(id)) report(ctx, "error", "E_DUP_ID", [...seg, j], `The ${word} "${id}" is listed two times in this step.`, "Remove the second one.");
      else ref([...seg, j], id, word);
      seen.add(id);
    }
  };
  const uses = (u, seg) => keysOf(u).forEach((id) => mat([...seg, id], id, ["each", "amount"], "A uses entry"));
  const noCoverage = new Set();
  const finish = (f, seg) => {
    if (!isObj(f)) return;
    if (ref([...seg, "material"], f.material, "material")) {
      kind([...seg, "material"], f.material, ["amount"], "A finish");
      const m = mats[f.material];
      if (kindOf(f.material) === "amount" && !has(m, "coverage") && !noCoverage.has(f.material)) {
        noCoverage.add(f.material);
        err(ctx, ["materials", f.material, "coverage"], `The material "${f.material}" is a finish but has no coverage.`,
          `Add "coverage": the area one ${typeof m.unit === "string" ? m.unit : "unit"} covers, in ${units === "in" ? "ft²" : "m²"}.`);
      }
    }
    refs(f.parts, [...seg, "parts"], "part");
  };

  rawParts.forEach((p, i) => {
    if (!isObj(p)) return;
    mat(["parts", i, "material"], p.material, ["linear", "sheet", "each", "printed"], "A part");
    refs(p.joins, ["parts", i, "joins"], "part");
    // print: the slicer numbers of a 3D-printed part. On a part of another kind it would count nothing.
    const k = kindOf(p.material);
    if (p.print !== undefined && k && k !== "printed")
      err(ctx, ["parts", i, "print"], `The part has "print", but its material "${p.material}" has kind ${k}.`, 'Remove "print", or use a material of kind printed for the part.');
    if (mode === "guide" && p.at === undefined) err(ctx, ["parts", i, "at"], "The part has no position.", 'Add "at": [x, y, z], the minimum corner of the part box. The 3D guide needs it.');
  });

  rawSteps.forEach((s, i) => {
    if (!isObj(s)) return;
    const at = (...k) => ["steps", i, ...k];
    refs(s.parts, at("parts"), "part", true);
    refs(s.focus, at("focus"), "part");
    refs(s.props, at("props"), "prop");
    refs(s.tools, at("tools"), "tool");
    refs(s.teach, at("teach"), "technique", true);
    for (const [j, f] of items(s.fasteners)) {
      if (!isObj(f)) continue;
      mat(at("fasteners", j, "material"), f.material, ["each"], "A fastener");
      if (Array.isArray(f.dir) && f.dir.length === 3 && f.dir.every((x) => x === 0))
        err(ctx, at("fasteners", j, "dir"), "The direction [0, 0, 0] has no length.", "Give the direction the fastener travels, for example [1, 0, 0].");
      if (mode === "guide" && f.count !== undefined && f.at === undefined)
        report(ctx, "warn", "W_COUNTED_FASTENER", at("fasteners", j), `The fastener has a count (${show(f.count)}) but no position, so the 3D view does not show it.`, 'Give "at" and "dir". Use "repeat" for a row of fasteners.');
    }
    uses(s.uses, at("uses"));
    finish(s.finish, at("finish"));
    if (Array.isArray(s.cuts)) s.cuts.forEach((id, j) => mat(at("cuts", j), id, ["linear", "sheet"], "A cut"));
    if (Array.isArray(s.prints)) s.prints.forEach((id, j) => mat(at("prints", j), id, ["printed"], "A print"));
    if (mode !== "estimate" && s.check === undefined) report(ctx, "warn", "W_NO_CHECK", at("check"), "The step has no check.", 'Add "check": the inspection that ends the step, for example "Make sure that the shelf is level."');
    if (mode !== "estimate" && s.minutes === undefined) report(ctx, "warn", "W_NO_MINUTES", at("minutes"), "The step has no work time.", 'Add "minutes": the work time for an experienced person.');
  });
  uses(R.uses, ["uses"]);
  items(R.finish).forEach(([i, f]) => finish(f, ["finish", i]));

  // motions: unique ids, known parts, a part in one motion only, a pivot on a turn and only there, a travel that moves
  const mIds = new Map(), moved = new Map();
  items(R.motions).forEach(([i, m]) => {
    if (!isObj(m)) return;
    const at = (...k) => ["motions", i, ...k];
    if (typeof m.id === "string") {
      if (mIds.has(m.id)) report(ctx, "error", "E_DUP_ID", at("id"), `The motion id "${m.id}" is used again. Motion ${mIds.get(m.id) + 1} in the list has it too.`, "Give each motion its own id.");
      else mIds.set(m.id, i);
    }
    refs(m.parts, at("parts"), "part", true);
    for (const [j, id] of items(m.parts)) {
      if (typeof id !== "string" || !known.part?.has(id)) continue;
      if (moved.has(id) && moved.get(id) !== i) err(ctx, at("parts", j), `Part "${id}" is in motion ${moved.get(id) + 1} too.`, "Put each part in one motion only. Make one motion for the parts that move together.");
      else moved.set(id, i);
    }
    if (m.kind === "turn" && m.pivot === undefined) err(ctx, at("pivot"), "The turn has no pivot.", 'Add "pivot": [x, y, z], a point on the turn axis, for example the centre of the hinge pin.');
    if (m.kind === "slide" && m.pivot !== undefined) err(ctx, at("pivot"), "A slide has no pivot.", 'Remove "pivot", or set "kind": "turn".');
    if (m.travel === 0) err(ctx, at("travel"), "The travel 0 does not move the parts.", "Give the distance of the slide, or the angle of the turn in degrees.");
    if (m.kind === "turn" && typeof m.travel === "number" && Math.abs(m.travel) > 360) err(ctx, at("travel"), `The turn of ${m.travel} degrees is more than one full turn.`, "Give an angle from -360 to 360 degrees.");
  });

  // safety.cleared: a hand-off topic as in handoff (an id or an alias), and a reason that is more than spaces. A
  // handoff entry may name other work ("Chimney sweep"); a cleared entry must name a topic of the screen.
  const topics = Object.entries(HANDOFF_TOPICS).flatMap(([id, t]) => [id, ...t.aliases]);
  items(isObj(R.safety) ? R.safety.cleared : undefined).forEach(([i, c]) => {
    if (!isObj(c)) return;
    // A topic of only spaces is empty: it clears nothing, so it is an error too (the schema finds only "").
    if (typeof c.topic === "string" && c.topic !== "" && !topicOf(c.topic)) {
      const blank = !c.topic.trim(), m = blank ? null : didYouMean(c.topic.trim(), topics);
      err(ctx, ["safety", "cleared", i, "topic"], blank ? "The hand-off topic is empty." : `The hand-off topic ${show(c.topic)} is not known.`,
        `${m ? `Did you mean "${topicOf(m)}"? ` : ""}Use a topic id: ${Object.keys(HANDOFF_TOPICS).join(", ")}.`);
    }
    if (typeof c.why === "string" && c.why.length >= 10 && c.why.trim().length < 10)
      err(ctx, ["safety", "cleared", i, "why"], "The text has fewer than 10 characters that are not spaces.", "Say why the hit is not hand-off work, in STE descriptive sentences.");
  });

  if (mode !== "estimate" && (R.steps === undefined || (Array.isArray(R.steps) && !R.steps.length)))
    err(ctx, ["steps"], "The project has no steps.", `Add steps. The ${mode} mode needs at least one step.`);
  if (mode === "guide") for (const [id, p] of Object.entries(isObj(R.props) ? R.props : {}))
    if (isObj(p) && p.at === undefined) err(ctx, ["props", id, "at"], "The prop has no position.", 'Add "at": [x, y, z], the minimum corner of the prop box. The 3D guide needs it.');

  // W_UNKNOWN_STORE, W_COVERAGE_UNIT
  const store = (seg, id) => {
    if (typeof id !== "string" || has(stores, id)) return;
    const m = didYouMean(id, Object.keys(stores));
    report(ctx, "warn", "W_UNKNOWN_STORE", seg, `The store "${id}" is not in stores.`, `${m ? `Did you mean "${m}"? ` : ""}Add the store to stores, or fix the id. Until then the item goes on the "Any store" trip.`);
  };
  for (const [id, m] of Object.entries(mats)) {
    if (!isObj(m)) continue;
    store(["materials", id, "store"], m.store);
    if (m.kind === "amount" && typeof m.unit === "string" && /^(ml|g)$/i.test(m.unit.trim()) && typeof m.coverage === "number" && m.coverage > 1) {
      const big = /^ml$/i.test(m.unit.trim()) ? "L" : "kg";
      report(ctx, "warn", "W_COVERAGE_UNIT", ["materials", id, "coverage"], `The coverage ${m.coverage} for one ${m.unit} looks like a value for one ${big}.`,
        `Give the area that one ${m.unit} covers: the area for one ${big} divided by 1000.`);
    }
  }
  rawTools.forEach((t, i) => isObj(t) && store(["tools", i, "store"], t.store));
}

// ---- normalization of the cleaned project (types are safe here)

function normalize(c, ctx, techniques, problems) {
  const units = c.units, est = c.estimate, L = (v) => toMM(v, units), V = (a) => a.map(L);
  const sel = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));
  const stores = c.stores ?? {};

  // Which each/amount materials are fasteners and finishes (spare defaults).
  const fastened = new Set(), finished = new Set();
  for (const s of c.steps ?? []) {
    for (const f of s.fasteners ?? []) fastened.add(f.material);
    if (s.finish) finished.add(s.finish.material);
  }
  for (const f of c.finish ?? []) finished.add(f.material);

  const materials = {};
  for (const [id, m] of Object.entries(c.materials ?? {})) {
    const n = { ...m, est: m.est ?? est };
    if (n.store !== undefined && !has(stores, n.store)) delete n.store;
    if (m.kind === "linear") {
      n.section = V(m.section);
      if (m.stock) n.stock = m.stock.map((s) => ({ ...s, length: L(s.length) }));
      if (m.perLength) {
        n.perLength = { ...m.perLength, per: L(m.perLength.per), max: L(m.perLength.max), step: L(m.perLength.step ?? m.perLength.per) };
        // The board lengths are step, 2 x step ... up to max: none when step > max, too many for a tiny step.
        // The material is left out, as for any other bad material, so its parts give no E_TOO_LONG.
        const { step, max } = n.perLength, given = m.perLength.step !== undefined, u = (v) => `${v} ${units}`;
        if (step > max + 1e-9) {
          err(problems, ["materials", id, "perLength", given ? "step" : "max"],
            `No board length fits: the step ${u(m.perLength.step ?? m.perLength.per)}${given ? "" : " (the per length)"} is more than max ${u(m.perLength.max)}.`,
            `Set step to the length increment the store cuts, at most max.${given ? "" : " Without step, the step is per."}`);
          continue;
        }
        if (max / step > MAX_LENGTHS) {
          err(problems, ["materials", id, "perLength", "step"], `The step ${u(m.perLength.step ?? m.perLength.per)} gives more than 100,000 board lengths.`,
            "Use the cut increment of the store, for example 1 mm or 1/16 in.");
          continue;
        }
      }
    } else if (m.kind === "sheet") {
      n.thick = L(m.thick);
      n.stock = m.stock.map((s) => ({ ...s, w: L(s.w), h: L(s.h) }));
    } else if (m.kind === "each") {
      if (m.len !== undefined) n.len = L(m.len);
      if (m.d !== undefined) n.d = L(m.d);
      n.spare = m.spare ?? (fastened.has(id) || m.len !== undefined || m.d !== undefined || m.head !== undefined ? 0.1 : 0);
    } else if (m.kind === "amount") n.spare = m.spare ?? (finished.has(id) ? 0.1 : 0);
    // printed: spool, density, fill, rate and spare come with their schema defaults
    put(materials, id, n);
  }
  const kindIs = (id, kinds) => has(materials, id) && kinds.includes(materials[id].kind);

  // Parts: first of each id, material must resolve; label defaults to the id.
  const parts = [], partIds = new Set(), byLabel = new Map();
  for (const p of c.parts ?? []) {
    if (partIds.has(p.id) || !kindIs(p.material, ["linear", "sheet", "each", "printed"])) continue;
    const n = { ...p, label: p.label ?? p.id, size: V(p.size) };
    if (p.at) n.at = V(p.at);
    if (materials[p.material].kind !== "printed") delete n.print; // an E_SCHEMA in checks
    partIds.add(p.id);
    parts.push(n);
    const first = byLabel.get(n.label);
    if (!first) { byLabel.set(n.label, n); continue; }
    const sorted = (s) => [...s].sort((a, b) => a - b);
    const diff = [n.name !== first.name && "name", n.material !== first.material && "material",
      sorted(n.size).some((v, k) => Math.abs(v - sorted(first.size)[k]) > 0.1) && "size",
      JSON.stringify(n.print ?? null) !== JSON.stringify(first.print ?? null) && "print"].filter(Boolean);
    if (!diff.length) continue;
    const dims = (s) => `${s.map((v) => fmtLen(v, units).replace(/ (mm|in)$/, "")).join(" x ")} ${units}`;
    const detail = diff.includes("size") ? ` Sizes: ${dims(n.size)} and ${dims(first.size)}.` : "";
    const what = diff.length > 1 ? `${diff.slice(0, -1).join(", ")} and ${diff.at(-1)}` : diff[0];
    report(problems, "error", "E_LABEL_MISMATCH", ["parts", ctx.src.get(p) ?? 0, "label"], `Part "${p.id}" has the label "${n.label}" like part "${first.id}", but a different ${what}.${detail}`,
      `Give part "${p.id}" its own label, or make its ${what} the same as part "${first.id}".`);
  }
  for (const p of parts) if (p.joins) p.joins = uniq(p.joins.filter((id) => partIds.has(id) && id !== p.id));

  const props = {};
  for (const [id, p] of Object.entries(c.props ?? {})) put(props, id, { ...p, size: V(p.size), ...(p.at ? { at: V(p.at) } : {}) });

  const tools = [], toolIds = new Set();
  for (const t of c.tools ?? []) {
    if (toolIds.has(t.id)) continue;
    toolIds.add(t.id);
    const n = { ...t, est: t.est ?? est };
    if (n.store !== undefined && !has(stores, n.store)) delete n.store;
    tools.push(n);
  }

  const techs = c.techniques ?? {}, teachable = (id) => techniques.has(id) || has(techs, id);
  const usesOf = (u) => Object.fromEntries(Object.entries(u).filter(([id]) => kindIs(id, ["each", "amount"])));
  const finishOf = (f) => {
    if (!kindIs(f.material, ["amount"]) || materials[f.material].coverage === undefined) return null;
    return f.parts ? { ...f, parts: uniq(f.parts.filter((id) => partIds.has(id))) } : { ...f };
  };
  // A positional fastener with repeat becomes count fasteners, each moved by k * step.
  const expand = (f) => {
    if (f.count !== undefined) return [sel(f, ["material", "count"])];
    if (f.dir.every((x) => x === 0)) return [];
    const at = V(f.at), step = f.repeat ? V(f.repeat.step) : [0, 0, 0], extra = sel({ len: f.len === undefined ? undefined : L(f.len), d: f.d === undefined ? undefined : L(f.d) }, ["len", "d"]);
    return Array.from({ length: f.repeat?.count ?? 1 }, (_, k) => ({ material: f.material, at: at.map((v, i) => round(v + k * step[i], 6)), dir: [...f.dir], ...extra }));
  };

  const steps = (c.steps ?? []).map((s) => {
    const n = { ...s };
    if (s.parts) n.parts = uniq(s.parts.filter((id) => partIds.has(id)));
    if (s.focus) n.focus = uniq(s.focus.filter((id) => partIds.has(id)));
    if (s.props) n.props = uniq(s.props.filter((id) => has(props, id)));
    if (s.tools) n.tools = uniq(s.tools.filter((id) => toolIds.has(id)));
    if (s.teach) n.teach = uniq(s.teach.filter(teachable));
    if (s.fasteners) n.fasteners = s.fasteners.filter((f) => kindIs(f.material, ["each"])).flatMap(expand);
    if (s.uses) n.uses = usesOf(s.uses);
    if (s.finish) { const f = finishOf(s.finish); if (f) n.finish = f; else delete n.finish; }
    if (Array.isArray(s.cuts)) n.cuts = uniq(s.cuts.filter((id) => kindIs(id, ["linear", "sheet"])));
    if (Array.isArray(s.prints)) n.prints = uniq(s.prints.filter((id) => kindIs(id, ["printed"])));
    if (s.from) n.from = V(s.from);
    return n;
  });

  // motions: lengths in mm (the travel of a slide, the pivot); raw: the index in the project file. A motion with no
  // known part, a turn with no pivot or no travel is left out (checks reported it).
  const motions = [], seenM = new Set(), movedP = new Set();
  (c.motions ?? []).forEach((m, raw) => {
    if (seenM.has(m.id)) return;
    seenM.add(m.id);
    const list = uniq(m.parts.filter((id) => partIds.has(id) && !movedP.has(id)));
    if (!list.length || m.travel === 0 || (m.kind === "turn" && (!m.pivot || Math.abs(m.travel) > 360))) return;
    list.forEach((id) => movedP.add(id));
    motions.push({ ...m, parts: list, travel: m.kind === "slide" ? L(m.travel) : m.travel, ...(m.kind === "turn" ? { pivot: V(m.pivot) } : {}), raw });
  });

  let kerf = c.kerf === undefined ? L(KERF[units]) : L(c.kerf);
  if (kerf > MAX_KERF) {
    err(problems, ["kerf"], `The kerf ${fmtLen(kerf, units, { den: 64 })} is more than ${MAX_KERF} mm.`, "Use the width of the saw cut, for example 3 mm (1/8 in).");
    kerf = L(KERF[units]);
  }

  return {
    jig: c.jig, id: c.id ?? "", title: c.title ?? "", summary: c.summary, level: c.level, units, currency: c.currency,
    ...(c.tax ? { tax: c.tax } : {}), priceNote: c.priceNote, ...(c.pricesAsOf ? { pricesAsOf: c.pricesAsOf } : {}),
    estimate: est, kerf, trim: L(c.trim), contingency: c.contingency, terms: c.terms, verbs: c.verbs,
    stores, materials, tools, parts, props, techniques: techs, steps, motions,
    uses: usesOf(c.uses ?? {}), finish: (c.finish ?? []).map(finishOf).filter(Boolean), handoff: c.handoff ?? [],
    safety: c.safety ?? { tipRatio: SCHEMA.properties.safety.properties.tipRatio.default },
  };
}

// validate(project, { mode, techniques }) -> { project: normalized, problems }.
// mode: "estimate" | "plan" | "guide". techniques: ids of the built-in cards (Set, array or object).
export function validate(project, { mode = "guide", techniques = new Set() } = {}) {
  if (!["estimate", "plan", "guide"].includes(mode)) mode = "guide";
  const techSet = new Set(techniques instanceof Set || Array.isArray(techniques) ? techniques : keysOf(techniques));
  const ctx = { list: [], errors: 0, src: new WeakMap() };
  let normalized;
  try {
    const ok = isObj(project);
    if (!ok) err(ctx, [], `Expected the project to be an object, found ${found(project)}.`, "Give a project object with id, title, materials and parts.");
    const cleaned = obj(SCHEMA, ok ? project : {}, [], ok ? ctx : { list: [], errors: 0, src: ctx.src }, true);
    if (ok) checks(project, cleaned.units, mode, techSet, ctx);
    normalized = normalize(cleaned, ctx, techSet, ctx);
  } catch (e) {
    err(ctx, [], `Internal error while the project was checked: ${e?.message ?? e}.`, "Contact the jig maintainers with this error and the project file.");
    normalized = normalize(obj(SCHEMA, {}, [], { list: [], errors: 0, src: new WeakMap() }, true), ctx, techSet, { list: [], errors: 0 });
  }
  const problems = ctx.list.map((p) => {
    let where = "project";
    try { where = whereOf(p.seg, project); } catch {}
    return { level: p.level, code: p.code, path: pathOf(p.seg), where, msg: p.msg, hint: p.hint };
  });
  return { project: normalized, problems };
}
