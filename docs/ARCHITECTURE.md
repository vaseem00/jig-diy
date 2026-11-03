# jig-diy architecture

This is the contract for every part of the pack: the repo layout, the project format, the computed model, the engine modules, the CLI and the page. Code, skills, tests and docs must agree with it. If you change it, change this file in the same pull request.

## Contents

1. Principles
2. Repo layout
3. Skills in the pack
4. Project format (input)
5. Computed model (output)
6. Problems and codes
7. Engine modules
8. CLI
9. Guide page
10. Distribution and versioning
11. Tests

## 1. Principles

- **One model, every number.** Quantities, boards, cut positions, cost, time, the plan text and the 3D come from `compute(project)`. No number is typed twice.
- **Build to zero.** A guide page is written only when `errors: 0`. Bad input is an error with a field path and a fix, never NaN or a silent drop.
- **Self-contained skills.** Each skill folder carries its own copy of the engine (`skills/<name>/engine/`). Installers copy one skill folder at a time, so no skill reads a sibling or a repo-root file at run time.
- **No dependencies.** Plain Node.js ESM (`.mjs`), Node 22 or later, zero npm packages. The page uses three.js 0.160.0 from jsDelivr with Subresource Integrity, or inlined with `--offline`.
- **Deterministic.** The same project gives byte-identical output. No clock, no randomness, no machine paths in output.
- **Safe by default.** Every power-tool step carries a WARNING. Tall furniture needs an anchor step. Gas, mains wiring, structural or load-bearing changes, roofs or work above 2 m, permit work, asbestos and lead paint go to a professional (hand-off). The hand-off screen is a safety net of common words; a false alarm is cleared on purpose (`safety.cleared`), and the safety review shows each one.
- **STE-style, not certified.** Reader text follows ASD-STE100 writing rules (command verb first, one instruction per sentence, 20/25-word limits, active voice, condition first). The full dictionary is not reproduced.

## 2. Repo layout

```
jig-diy/                         repo root = Claude Code plugin root
  .claude-plugin/plugin.json     Claude Code plugin manifest (name "jig")
  .claude-plugin/marketplace.json  marketplace "jig-diy", one entry {name:"jig", source:"./", skills:["./skills/<name>", ...]}
  plugin.json                    Agent Plugins 1.0 manifest (Codex, Cursor, Copilot, VS Code)
  gemini-extension.json          Gemini CLI extension manifest
  skills.sh.json                 skills.sh repo-page groupings
  assets/                        the plugin icon (SVG, and a 512 x 512 PNG render of it) and the listing logo (SVG)
  engine/                        canonical engine source (copied into each skill by scripts/sync-engine.mjs)
    jig.mjs                      CLI entry
    lib/*.mjs                    pure modules (section 7)
    web/app.js, web/viewer.js, web/page.css   page runtime
    schema/project.schema.json   JSON Schema 2020-12 of the project format
    templates/starter.json       smallest valid project
    docs/                        shared references every skill may link: format.md (project format),
                                 cli.md (commands), method.md (how to explain a build), ste.md (writing rules),
                                 safety.md (hazards, PPE, hand-off), verify.md (checking a page)
  skills/<name>/                 one folder per skill (section 3)
    SKILL.md                     six spec frontmatter keys only
    LICENSE.txt                  MIT text
    references/*.md              read on demand
    engine/                      GENERATED copy of /engine (never edit by hand)
    examples/                    GENERATED copy of example projects (jig, jig-3d only)
    agents/openai.yaml           Codex metadata
    assets/                      Codex icon (a copy of the plugin icon)
    evals/evals.json             skill-creator eval cases
    evals/triggers.json          should-trigger / near-miss queries
  examples/<id>/project.json     example projects + built pages (golden files)
  evals/<case>/                  `claude plugin eval` suite (prompt.md + graders/)
  tests/*.test.mjs               node:test suite
  scripts/                       repo tools: sync-engine, build-examples, bump-version, set-owner, check-repo
  docs/                          ARCHITECTURE.md, design-notes.md, PUBLISHING.md
  .github/                       CI, issue forms, PR template, README screenshots
  README.md LICENSE CHANGELOG.md CONTRIBUTING.md SECURITY.md CODE_OF_CONDUCT.md THIRD_PARTY_NOTICES.md
```

Rules that keep every installer happy:

- No `SKILL.md` at the repo root or in any top-level folder other than `skills/<name>/`. Test fixtures never contain a file named `SKILL.md`.
- No top-level `bin/`, no `package.json` with a lockfile, no symlinks, no Git LFS, no file named `metadata.json` inside a skill.
- Every non-image file under 256 KiB. The whole plugin under 512 files.
- Forward slashes and relative paths in every document. Scripts find their own files with `import.meta.url`.

## 3. Skills in the pack

Names are prefixed `jig-` so they stay unique in flat skill folders (`~/.claude/skills`, `.agents/skills`). In the Claude Code plugin they also answer as `/jig:<name>`.

| Skill | Does | CLI commands it runs | Output |
|---|---|---|---|
| `jig` | The full interactive guide: plan, shopping (BOQ + trips), cut list, 3D build steps, level switch | `new`, `check`, `build`, `capture` | `<id>.html` (+ Artifact page) |
| `jig-plan` | A printable step-by-step plan: size, hand-offs, parts, tools, steps in STE, time | `new`, `check`, `plan` | `plan.md` + `project.json` |
| `jig-boq` | Bill of quantities and cost estimate | `boq` | Markdown / CSV / JSON table |
| `jig-buy` | Purchase plan: online orders first, one trip per store, borrow/rent, order-by dates | `buy` | Markdown checklist / JSON |
| `jig-cut` | Cut list optimiser for boards and sheets with kerf, trim, grain, to-scale drawings | `cut` | Markdown + SVG / JSON |
| `jig-3d` | The 3D assembly viewer only (Build tab), part by part | `check`, `build --tabs build` | `<id>-3d.html` |
| `jig-ste` | Write, rewrite and lint any procedure in ASD-STE100 style | `lint` | Findings + rewritten text |
| `jig-safety` | Safety review: WARNING/CAUTION, PPE, tip-over, hand-off topics | `safety` | Findings + fixes |
| `jig-verify` | Check a built guide like a critic: captures, console, scroll, contrast, checklist | `capture`, `check` | PNG/WebP captures + verdict |

Boundaries (each SKILL.md states its own): `jig` owns the whole guide; the others own one output each and point to `jig` for the full page.

SKILL.md frontmatter (portable to claude.ai, the Skills API, skills-ref and quick_validate):

```yaml
---
name: jig-boq
description: >-
  What it does first, then "Use when ..." triggers, then the boundary. 1024 characters or fewer, no angle brackets.
license: MIT
compatibility: Requires Node.js 22 or later. The guide page loads three.js 0.160.0 from cdn.jsdelivr.net and fonts from fonts.googleapis.com when it opens.
metadata:
  version: "x.y.z"
  pack: jig-diy
  author: vaseem00
---
```

Scripts are called as `node "${CLAUDE_SKILL_DIR}/engine/jig.mjs" <command> ...`. Every SKILL.md says once: if your agent does not fill in `${CLAUDE_SKILL_DIR}`, use the folder that holds this SKILL.md. Never write a dollar sign followed by a digit (Claude Code substitutes `$1`); write prices as `USD 12.50`.

## 4. Project format (input)

A project is a JSON file (`project.json`, preferred: it runs no code) or an ES module (`project.mjs`) whose default export is the same object. The schema is `engine/schema/project.schema.json`.

### 4.1 World and units

- `units`: `"mm"` (default) or `"in"`. Every length in the file uses this unit: sizes, positions, stock, kerf, trim, fastener length and diameter. The engine converts to millimetres inside and shows lengths back in the project's unit (`mm` as integers or one decimal; `in` as fractions to 1/16). The kerf and the trim show to 1/64 in ("3/32 in"), or as decimal inches ("0.02 in") when the value is not on a 1/64 in step.
- Axes: x to the right, y up, z toward the viewer. A part's `at` is the minimum corner of its box before rotation. The floor is y = 0.

### 4.2 Top level

| Field | Type | Default | Meaning |
|---|---|---|---|
| `jig` | 1 | 1 | Format version |
| `id` | string, kebab-case | required | Output file name and browser storage key. `^[a-z0-9]+(-[a-z0-9]+)*$`, 1-64 chars |
| `title` | string | required | The object: "Pine bookshelf" |
| `summary` | string | "" | 1-2 STE descriptive sentences |
| `level` | `new` \| `some` \| `pro` | `some` | Level the page opens at |
| `units` | `mm` \| `in` | `mm` | See 4.1 |
| `currency` | ISO 4217 code | `USD` | Money format via `Intl.NumberFormat` |
| `tax` | `{ rate: 0-1, label?: string, included?: bool }` | none | Sales tax / VAT. `included: true` shows it inside prices; otherwise it is added to the total |
| `priceNote` | string | "" | Where prices come from |
| `pricesAsOf` | `YYYY-MM-DD` | none | Shown next to prices |
| `estimate` | bool | true | Rates carry an `est` badge unless a material/tool sets `est: false` |
| `kerf` | length 0-10 mm | 3 mm (1/8 in) | Saw cut width |
| `trim` | length >= 0 | 0 | Waste cut from the start of each board to square the factory end; the first piece starts at `trim` |
| `contingency` | 0-0.5 | 0.1 | Spare budget share |
| `terms` | string[] | [] | Technical names the STE linter accepts |
| `verbs` | string[] | [] | Extra command verbs the STE linter accepts (trade verbs) |
| `stores` | `{ id: Store }` | {} | Where to buy |
| `materials` | `{ id: Material }` | required | What is bought and consumed |
| `tools` | Tool[] | [] | Tools used by steps |
| `parts` | Part[] | required | What is cut, made or installed |
| `props` | `{ id: Prop }` | {} | Context boxes (wall, bench, floor), never bought |
| `techniques` | `{ id: Technique }` | {} | Extra or replacement technique cards |
| `steps` | Step[] | [] | The build sequence (required for `plan`, `check`, `build`) |
| `uses` | `{ materialId: amount }` | {} | Project-wide consumables not tied to a step |
| `finish` | Finish[] | [] | Project-wide finishes not tied to a step |
| `handoff` | `[{ topic, text }]` | [] | Work this guide leaves to a professional. Required when the hand-off screen finds a topic, unless `safety.cleared` clears it |
| `safety` | `{ tipRatio?: number, cleared?: [{ topic, why }] }` | `{ tipRatio: 2 }` | `tipRatio`: height-to-depth ratio above which an object 600 mm (24 in) tall or more needs an anchor step. `cleared`: hits of the hand-off screen that are not hand-off work (below) |

`safety.cleared` records a false alarm of the hand-off screen. The screen is a safety net (common words only): it misses work and it gives false alarms, and the agent's reading of the request decides. Each entry is `{ topic, why }`: `topic` is a topic id or alias, matched as `handoff[].topic` is (any case, a space or `_` for a hyphen); a name that is not a topic is `E_SCHEMA` with "did you mean" (a `handoff` topic may still be free text). `why` is STE descriptive text of 10 to 240 characters (and 10 or more that are not spaces), linted as `description`. For a topic in `cleared` and not in `handoff`, the screen gives one `I_HANDOFF_CLEARED` for the topic in place of `E_HANDOFF`, and the safety summary lists every text it clears. A `lead-paint` entry records the age of the paint: it also stops `I_OLD_PAINT`, and each text that works on old paint counts as its hit. An entry that clears nothing (no hit, a topic that `handoff` names, a second entry for one topic) is `W_CLEARED_UNUSED`. It is never for real hand-off work; `engine/docs/safety.md` section 11 has the rule.

Store: `{ name, online?: bool, lead?: days, note?, url? }`.

Limits that keep every value finite and safe as a key: ids of parts, steps and tools, and the keys of `materials`, `stores`, `props` and `techniques`, match `^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$`. Lengths, amounts, counts and minutes are at most 1e6 in the project unit, and positions are -1e6 to 1e6. An inch project allows up to 2.54e7 mm, and every value stays finite after conversion. Prices are at most 1e9, `view.az` is -360 to 360, and `repeat.count` is 1 to 500.

### 4.3 Materials

Common fields: `name` (required), `kind` (required: `linear` \| `sheet` \| `each` \| `amount`), `spec`, `store`, `price` (`each` and `amount` only; on `linear` and `sheet` it is the error `E_UNKNOWN_KEY`, because their prices go on `stock` or `perLength`), `color` (`#rrggbb`), `group` (BOQ group name), `est`, `note`, `role` (`anchor` marks wall fixings).

| kind | Extra fields | Quantity comes from |
|---|---|---|
| `linear` | `section: [width, thick]` (required), `profile: "rect" \| "round"`, `stock: [{ length, price }]` (required unless `perLength`), `perLength: { price, per, max, step? }` (cut-to-size pricing: `price` per `per` length, boards up to `max`, sold in `step` increments, default step = per; the step at most `max`, and at most 100,000 lengths (`max / step`), else `E_SCHEMA`) | Parts. Two sides of `size` match the section within 1.5 mm; the third is the cut length. A part with `rip: true` may be narrower than the section width (thickness must still match). Packed at lowest total cost (section 7, pack). Rip strips are packed by length only, each from its own board length; when 2 or more fit side by side across one board, the info `I_RIP_SHARE` says so. |
| `sheet` | `thick` (required), `stock: [{ w, h, price }]` (required), `grain: bool` (default false) | Parts. One side matches `thick`; the other two are the piece. Guillotine-packed at lowest cost. With `grain: true`, a piece keeps its long side along the sheet's long side unless the part says `grain: "across"` or `"any"`. |
| `each` | `pack` (default 1), `unit` (default "piece"), `packName`, `spare` (default 0.1 for fasteners, else 0), `len`, `d` (fastener length and diameter), `head: "flat" \| "pan" \| "hex"`, `included` | Parts made of it + step fasteners + `uses`. `included: true` lists it as "in the kit" with no purchase. |
| `amount` | `unit` (required: "L", "ml", "kg", "g", "sheet", "m", "roll"...), `pack` (amount per pack, default 1), `packName`, `coverage` (area per ONE `unit`: m² for mm projects, ft² for in projects; required when used as a finish), `coats` (default 1), `spare` (default 0.1 for finishes, else 0) | `uses` amounts + finishes (finished surface area x coats / coverage). |

Packs to buy = ceil(need x (1 + spare) / pack). A coverage above 1 with unit `ml` or `g` is a warning (probably meant per L or kg).

### 4.4 Tools

`{ id, name, spec?, have?: bool, get?: "buy" | "rent" | "borrow", price?, days?: number (rent, default 1), qty?: number (default 1), store?, power?: bool, ppe?: bool, est?: bool }`

- `have: true`: listed in the plan only.
- `buy`: amount = qty x price. `rent`: amount = qty x days x price. `borrow`: 0, listed on a "Borrow" trip.
- No price on a `buy`/`rent` tool: warning `W_PRICE_UNKNOWN`; the row shows "price?" and is left out of the total, and the totals carry `unknownPrices`.
- `power: true`: every step that uses it needs a WARNING (in the step or one of its technique cards).
- `ppe: true`: BOQ group "Safety" and the safety summary.

### 4.5 Parts

`{ id, label?, name, material, size: [x, y, z], at?: [x, y, z], shape?: "box" | "cylinder", rotate?: [rx, ry, rz], color?, rip?: bool, grain?: "along" | "across" | "any", role?: "anchor", finish?: bool, joins?: [partIds] }`

- `id` unique. `label` (default `id`) is the letter the reader sees, shared by identical parts. Parts that share a label must share name, material and size.
- `name`: one word used for it everywhere ("Side", "Shelf").
- `size` > 0 in every axis. `cylinder`: two equal sides are the diameter, the third is the length (axis).
- `at` is required for the `guide` mode (section 5.1).
- `rotate`: degrees about the box centre, applied x then y then z. Cut sizes come from `size`, not from the rotated box.
- `finish: false` leaves the part out of the finished area.
- `joins` lists parts this part may overlap on purpose (a shelf in a dado, a tenon in a mortise). Other overlaps over 1 mm are `E_GEOMETRY`.
- A part of an `each` material (bracket, hinge, ready-made leg) is counted, not cut.

### 4.6 Props

`{ size, at, color?, shape?, rotate?, hero?: bool (default true: shown in the Plan view), label? }`. `at` is required for the `guide` mode only. Never in the BOQ.

### 4.7 Techniques

`{ name, why?, warn?: Warn[], do: string[], tools?: string[] }`. Text may use `{kerf}` (the project kerf, formatted) and `{mm value|inch value}`, such as `{150 mm|6 in}`: the card shows the value for the project unit. A step WARNING or CAUTION with the same text as a card's shows once. Built-in cards: `measure-mark`, `cut-straight`, `pilot-hole`, `countersink`, `glue-joint`, `clamp`, `square-diagonals`, `sand`, `finish-wipe`, `find-stud`, `drill-straight`, `level-check` (`cut-straight` is for a circular saw).

### 4.8 Steps

| Field | Meaning |
|---|---|
| `id` | Unique, required |
| `title` | Required. A command: "Attach the top shelf" (STE-linted) |
| `phase` | Phase name. A phase is a run of consecutive steps with one name; reusing an earlier, separate phase name is warning `W_PHASE_SPLIT` |
| `minutes`, `wait` | Work time for an experienced person; waiting time (glue, finish). Missing `minutes`: warning |
| `parts` | Part ids installed here. Each part is installed in exactly one step |
| `fasteners` | `[{ material, at, dir, len?, d?, repeat?: { count, step: [dx, dy, dz] } }]` (positional, drawn) or `[{ material, count }]` (counted, not drawn). `at` is the head position; `dir` the direction the screw travels |
| `uses` | `{ materialId: amount }` consumables |
| `finish` | `{ material, coats?, parts?: ids }` (default: every non-`each` part with `finish !== false`) |
| `cuts` | `true` or material ids: stock is cut here (sets "needed by" in the purchase plan) |
| `tools`, `teach` | Tool ids; technique ids |
| `warn` | `[{ type: "warning" \| "caution", text }]`, shown before the instructions |
| `do` | Instructions: string, or `{ t, new: true }` for a line shown only at "First time" |
| `check` | The inspection that ends the step. Missing: warning `W_NO_CHECK` |
| `why`, `tip` | Descriptive notes (why: First time only; tip: First time and Some experience) |
| `pose` | `"kit"` lays the cut parts flat on the floor (prepare steps) |
| `focus` | Part ids lit in the kit pose |
| `from` | `[dx, dy, dz]`: the path new parts arrive along |
| `view` | `{ az, el, zoom, note }`: az 0 front, 90 right side, 180 back; el degrees; zoom > 1 closer; `note` (120 characters or fewer, STE description) is a page-only line under the 3D view, at every level, never in print, `plan.md` or the no-script copy ("The picture shows the cube upright.") |
| `props` | Prop ids shown in this step |

### 4.9 Finish (project-wide)

`{ material, coats?, parts?: ids }`, same rules as a step finish.

## 5. Computed model (output)

### 5.1 Modes

`compute(project, { mode })` checks only what the mode needs:

| Mode | Needs | Used by |
|---|---|---|
| `estimate` | materials, parts (`size`, `material`) | `boq`, `cut`, `buy` |
| `plan` | + steps, every part installed once | `plan`, `safety` |
| `guide` | + `at` on every part, positional fasteners (counted ones warn), geometry checks | `check`, `build` |

The `estimate` mode runs no STE lint and reports no safety or plan findings. It still fills the safety summary.

### 5.2 Shape

All lengths in the model are millimetres; areas m² (also `areaDisplay` in the project unit). Money is a number in the project currency. A BOQ `rate` is the price as given; amounts and totals are rounded to the currency's minor unit (amount = qty x rate, then rounded).

```js
{
  engine: ENGINE_VERSION, format: 1, mode: "guide",
  meta: { id, title, summary, level, units, currency, tax, priceNote, pricesAsOf, estimate, kerf, trim },
  parts: [{ id, label, name, material, materialName, kind, shape, size, at, rotate, color, role,
            cut: { length, width, thick } | { a, b, thick } | null, step }],
  props: { [id]: { size, at, color, shape, rotate, hero, label } },
  materials: { [id]: { name, kind, spec, unit, color } },
  steps: [{ ...step, index, fasteners: [{ material, at, dir, len, d, head, color, count }], finish: { material, coats, parts }, minutes, wait }],
  tools: [{ ...tool, first }],
  techniques: { [id]: { name, why, warn, do, tools } },          // only those taught, with {kerf} filled
  cuts: [ { material, name, kind: "linear", color, optimal, search, boards: [{ stock: { length, price }, cuts: [{ id, label, len, at }], used, waste }] }
        | { material, name, kind: "sheet", color, sheets: [{ stock: { w, h, price }, cuts: [{ id, label, x, y, w, h, rotated }], usedArea, waste }] } ],
  boq: [{ code, group, key, id, name, spec, need, needQty, qty, unit, rate, amount, est, store, first, note, get }],  // get: buy | rent | borrow | kit
  purchase: [{ store, name, online, lead, note, url, orderBy, items: [boqKey], subtotal }],
  plan: { phases: [{ name, steps: [index], minutes, wait }], active, wait, levels: { new: 1.5, some: 1.2, pro: 1 } },
  totals: { subtotal, contingencyRate, contingency, taxRate, taxLabel, taxIncluded, tax, total, currency, area, areaDisplay, unknownPrices },
  safety: { tip: { height, depth, ratio, limit, anchored }, ppe: [ids], handoffs: [{ topic, text, name }], power: [toolIds], notes: [text],
            cleared: [{ topic, name, why, entry, hits: [{ path, where, text, context }] }] },  // the page leaves out cleared
  problems: [{ level, code, path, where, msg, hint }],
  counts: { error, warn, ste, info }
}
```

Cuts: `optimal` (linear materials only) is `true` when the plan is the proven lowest cost. `search` is `"exact"` (14 pieces or fewer) or `"fast"` (more than 14 pieces). `optimal` is `false` when the exact search stopped early, or when the fast search did not meet the lower bound (section 7, pack). `cut` prints one of three "Plan:" lines: proven lowest cost, the search stopped early, or a fast search made the plan.

Hand-offs: `name` is the reader name of a topic id ("Mains electrical work" for `mains`), else the topic as written. `topic` stays as given. Every reader output prints `name`.

Cleared hits: one entry for each topic that a `safety.cleared` entry clears. `topic` is the topic id, `name` its reader name, `why` the reason, `entry` the index of the entry in the raw `safety.cleared`, and `hits` each text the screen found (`text` is the matched words and `context` is the text itself, with each white-space run as one space, up to 160 characters: the first 159 and `…` when it is longer; `path` and `where` as in a problem). Only the safety review shows them: the page JSON leaves out `safety.cleared`, and no reader output prints it.

BOQ:

- Groups in order, with code letters: Timber and sheet `T`, Hardware `H`, Consumables `C`, Finish `F`, Safety `S`, Tools `X`; any other group name gets `O` and sorts last.
- Codes are numbered inside each group (`H01`, `H02`) so adding a timber row never renumbers hardware.
- `amount` is `null` when the price is unknown.
- `first` is the index of the first step that needs the row (0 when there are no steps).

Purchase plan:

- Trips sort online first, then by lead time (longest first), then by first-needed step, then name.
- Items in a trip sort by first-needed step.
- Borrowed tools go on a final "Borrow" trip; `included` rows are not bought.
- `orderBy` is null unless the CLI gets `--start YYYY-MM-DD` (start date minus lead days).
- An unknown store id is warning `W_UNKNOWN_STORE`. Rows with no store go on an "Any store" trip.
- The "Any store" trip has store id `_any` and the "Borrow" trip `_borrow`. Real store ids never start with `_`.

## 6. Problems and codes

`{ level: "error" | "warn" | "ste" | "info", code, path, where, msg, hint }`

- `path` is a JSON path into the project (`steps[3].do[1]`).
- `where` is for people ("step 4, line 2").
- `msg` says what is wrong with the found value.
- `hint` says how to fix it.

Errors block `build`. STE findings and `W_CLEARED_UNUSED` block `build` only under `--strict`. Other warnings and infos never block.

| Code | Level | When |
|---|---|---|
| `E_SCHEMA` | error | Wrong type, missing required field, value out of range, unknown enum (with "did you mean") |
| `E_UNKNOWN_KEY` | error | Unknown field (with "did you mean"); catches typos such as `kind: "linar"` → error via enum, `meterials` → error |
| `E_DUP_ID` | error | Duplicate part, step, tool or technique id, or one id twice in a step's `parts` or `teach` |
| `E_LABEL_MISMATCH` | error | Parts share a label but differ in name, material or size |
| `E_REF` | error | Unknown material, part, tool, technique, prop or step reference |
| `E_SECTION` | error | Part size does not match the linear section / sheet thickness. When every part of a linear material misses a section that looks nominal (an inch 1x/2x/4x size, or every part the same 6-19 mm under it), one error at `materials.<id>.section` with the actual size |
| `E_TOO_LONG` | error | Piece longer than the longest stock (after trim) |
| `E_SHEET_FIT` | error | Piece does not fit any sheet, given grain |
| `E_NOT_INSTALLED` | error | No step installs a part (plan, guide) |
| `E_INSTALLED_TWICE` | error | Two steps install one part |
| `E_POWER_NO_WARNING` | error | A step uses a power tool and has no WARNING |
| `E_TIP_OVER` | error | Height 600 mm (24 in) or more, height/depth above `safety.tipRatio`, and no part or fastener with role `anchor`. Under a limit below the default 2 (a step stool), the hint asks for a larger base, not a wall fixing |
| `E_HANDOFF` | error | Text mentions a hand-off topic (gas, mains wiring, structural/load-bearing, roof or height above 2 m, permit, asbestos, lead paint), and neither `handoff` nor `safety.cleared` names it |
| `E_GEOMETRY` | error | Two parts overlap by more than 1 mm in every axis (guide mode) |
| `W_FLOATING` | warn | A part touches no other part, prop or the floor (guide mode) |
| `W_FASTENER` | warn | A fastener head is not on a part surface, or its tip ends in air |
| `W_UNUSED_MATERIAL` | warn | A material nothing uses |
| `W_UNUSED_TOOL` | warn | A tool no step uses |
| `W_PRICE_UNKNOWN` | warn | A bought item with no price |
| `W_UNKNOWN_STORE` | warn | `store` names no entry in `stores` |
| `W_NO_CHECK` | warn | A step with no `check` |
| `W_NO_MINUTES` | warn | A step with no `minutes` |
| `W_PHASE_SPLIT` | warn | A phase name reused after a different phase |
| `W_COVERAGE_UNIT` | warn | Coverage looks per litre/kg while the unit is ml/g |
| `W_COUNTED_FASTENER` | warn | Guide mode, a fastener with `count` and no position (not drawn) |
| `W_TIP_SMALL` | warn | Height under 600 mm (24 in), height/depth above `safety.tipRatio`, no anchor (a lamp, a box): make the base wider or deeper, or add weight |
| `W_CLEARED_UNUSED` | warn | A `safety.cleared` entry clears nothing: the screen finds no text of its topic (for `lead-paint`, no old-paint text either), `handoff` names the topic, or an earlier entry clears it. Path `safety.cleared[k]`. Blocks under `--strict` |
| `STE_LENGTH` `STE_WORD` `STE_ING` `STE_PASSIVE` `STE_VERB_FIRST` `STE_TWO_ACTIONS` `STE_CONDITION_LAST` `STE_WARN_NO_RISK` | ste | Writing rules (section 7, ste). `STE_WARN_NO_RISK` is for kind `warning` only: no sentence after the command gives the risk |
| `I_ESTIMATE` | info | Prices are estimates |
| `I_TIP_UNCHECKED` | info | Not estimate mode (in practice plan mode), a part has no `at` and nothing is anchored: the tip-over rule could not run |
| `I_OLD_PAINT` | info | A reader text strips, sands, scrapes, heats, burns or removes old paint, or names old paint with a heat gun, a scraper, a sander or a stripper, and no `lead-paint` hand-off (an entry or an `E_HANDOFF`) or `lead-paint` cleared entry covers it: ask the age of the paint |
| `I_HANDOFF_CLEARED` | info | A topic in `safety.cleared` and not in `handoff` has screen hits: one info for the topic, at its first hit. The message names the matched words, the topic and the `why`; the hint says to make sure the guide has no such work, else to remove the entry and add the hand-off |
| `I_RIP_SHARE` | info | 2 or more rip strips of one linear material fit side by side across one board, and strips side by side give a cheaper plan or fewer boards at no extra cost; the plan cuts each from its own board length, and the hint names the saving |

## 7. Engine modules

All in `engine/lib/`, pure (no I/O) unless noted. Named exports only.

| Module | Exports | Notes |
|---|---|---|
| `version.mjs` | `ENGINE_VERSION`, `FORMAT` | `ENGINE_VERSION` is the pack version (section 10). `FORMAT` is `1` |
| `util.mjs` | `round(n, d)`, `amount(n, d)`, `plural(n, word)`, `groupBy(list, key)`, `esc(s)` (HTML), `term(s)` (terminal text: control characters become U+FFFD), `oneLine(s)` (a white-space run with a line break becomes one space; linear time), `words(s)`, `didYouMean(s, options)`, `stableSort(list, cmp)` | `round` adds no bump to a whole number or a value of 2^49 or more. `amount` keeps 2 significant digits for an amount between 0 and 0.01 ("0.004 L"). `plural` leaves abbreviations as written; a unit of more words changes its last word unless that word is an abbreviation ("5.5 cu ft", "16 shelf pins", "3 board feet"), and the noun before "of" ("2 pairs of gloves"); a note in brackets at the end stays ("3 tins (small)") |
| `locale.mjs` | `toMM(v, units)`, `fromMM(mm, units)`, `fmtLen(mm, units, { den })`, `fmtArea(m2, units)`, `fmtMoney(n, currency)`, `fmtRate(n, currency)`, `minorUnits(currency)`, `roundMoney(n, currency)`, `fmtDuration(minutes)` | inches show as fractions to 1/16 ("30 1/16 in"), or to 1/den (`{ den: 64 }`: "3/32 in", decimal inches off the step); `fmtRate` shows the minor unit at least and up to 4 decimals ("$0.045"); `minorUnits` comes from a fixed table (no ICU dependence), and money text has plain spaces; durations under 10 min to the minute, else to 5 min |
| `schema.mjs` | `SCHEMA` | The JSON Schema object; `engine/schema/project.schema.json` is `JSON.stringify(SCHEMA, null, 2)` + newline (a test checks) |
| `validate.mjs` | `validate(project, { mode, techniques }) → { project: normalized, problems }` (`techniques`: the built-in card ids) | Types, ranges, enums, required, unique ids, references, label consistency, unknown keys with did-you-mean. Normalizes: defaults, unit conversion to mm, fastener `repeat` expansion, `label` default |
| `geometry.mjs` | `boxOf(part)`, `bounds(items)`, `overlaps(parts, tol)`, `supports(parts, props, tol)`, `fastenerHits(fastener, parts, tol)`, `tipCheck(parts, props)` | Rotated parts use their rotated axis-aligned bounds |
| `pack.mjs` | `packLinear(pieces, stock, { kerf, trim, fmt }) → { boards, cost, problems, optimal, search }`, `packSheets(pieces, stock, { kerf, grain, fmt }) → { sheets, cost, problems }`, `expandPerLength({ price, per, max, step }, digits)` (prices rounded to `digits`, the currency's minor unit) | Linear: exact minimum cost (branch and bound, `search: "exact"`) for up to 14 pieces per material, with a 1.5M node cap (`optimal: false` when capped), else best-fit decreasing by cost per mm with a local improvement pass (`search: "fast"`, `optimal` only when the plan meets the lower bound); never worse than first-fit decreasing. When stock exists but no length is longer than the trim, `E_TOO_LONG` says so. Sheets: guillotine packing, both orientations when grain allows, cheapest sheet that holds each layout; never worse than shelf packing. Problems carry the part id; the model adds the path. Sheet areas are mm² (the model converts to m²) |
| `boq.mjs` | `buildBoq({ materials, tools, needs, cuts, area, units, currency, contingency, tax }) → { rows, totals }`, `GROUPS`, `OTHER`, `TOOL_KEY` | Section 5.2 |
| `purchase.mjs` | `buildPurchase(rows, stores, { start, currency }) → trips`, `orderBy(start, lead)`, `ANY_STORE`, `BORROW` | Section 5.2 |
| `plan.mjs` | `buildPlan(steps) → plan`, `timeFor(minutes, level)`, `phaseSplits(phases)`, `LEVELS`, `DEFAULT_PHASE` | Consecutive phases. A step with no phase is in phase "Build" |
| `safety.mjs` | `safetyChecks(project, ctx) → { problems, summary }`, `HANDOFF_TOPICS`, `PPE_FOR`, `topicOf(name)` (the topic id of an id or alias, else null; `validate.mjs` uses it for `safety.cleared`) | Power-tool WARNING, tip-over (the size leaves out parts with role `anchor`), hand-off screen with `safety.cleared`, `I_OLD_PAINT`, PPE notes by tool, material and finish. A `HANDOFF_TOPICS` entry has `patterns` and can have `skip`: a match that lies inside a skip match does not count (plug-in use of the mains, a distance from a gas heater). The screen reads each text with every white-space run as one space. `PPE_FOR` rules: saw, drill, sanding, mdf, noise, solder, heat, gloves, epoxy, solvent, flame, oil |
| `ste.mjs` | `lint(text, kind, { names, verbs }) → [{ code, msg, hint }]`, `sentences(text)`, `LIMITS`, `REPLACE`, `VERBS` | Every sentence of procedure text is checked for verb-first and two-actions; titles are linted as procedure; passive needs be + past participle (known list or -ed); a warning needs a risk sentence after its command (a sentence that is not a command, one with can, could, may, might, will or would, or a statement in the present simple: "Oil rags catch fire."). A later sentence that starts with Then, Also, Always or Never before a verb is still a command. A clause after the command (that, if, when, where, while, once, unless ...) does not make it a statement ("Hold the board where it is flat."), and a hazard word with a bare object is a command ("Sand edges by hand.") |
| `techniques.mjs` | `TECHNIQUES`, `fillTechnique(card, { kerf, units })` | Every line passes the linter |
| `model.mjs` | `compute(project, { mode, start }) → model` | Runs: validate → cuts → pack → BOQ → purchase → plan → safety → geometry (guide) → STE. Collects problems, sorts them error → warn → ste → info, fills `counts` |
| `markdown.mjs` | `planMd(model, { level })`, `boqMd(model)`, `boqCsv(model)`, `cutMd(model)`, `cutSvg(model, material)`, `buyMd(model)`, `reportText(model)`, `noscriptHtml(model)` | Plain Markdown, no HTML except `noscriptHtml` |
| `page.mjs` | `renderPage(model, { artifact, offline, tabs, three, web })`, `tabList(tabs)`, `webFiles()`, `TABS` | Reads its own `../web/*` once (the optional `web` override keeps tests pure); `three` = inlined sources for offline |
| `offline.mjs` | `THREE_VERSION`, `THREE_BASE`, `THREE_FILES` (url, sha384), `THREE_NOTICE`, `THREE_LICENSE` (the three.js r160 LICENSE text that `--offline` pages carry), `loadThree({ cacheDir, fetch, files })` | I/O. Fetches from jsDelivr only when `--offline`, verifies sha384, caches (never through a symbolic or hard link) |
| `capture.mjs` | `findBrowser()`, `browserWarnings()`, `browserArgs(profile, { platform, root })`, `removeStaleProfiles()`, `capture(url, opts)`, `captureUrl(url, hash)`, `CaptureError` | I/O. Headless Chrome/Edge over the DevTools protocol, Node's built-in WebSocket. `browserArgs` gives the browser switches: headless, the fresh profile, software WebGL, and the switches that ask for no background networking, component update, sync, pings or optimization-guide downloads (Chrome still sends its update, component, sign-in, time and device check-in requests). The result carries `route` (the page's `location.hash`). `browserWarnings` lists a `JIG_BROWSER` or `CHROME_PATH` that names a missing file; stale `jig-capture-*` profiles older than 1 hour are removed from `opts.tmp` (the profile parent folder, default `tmpdir()`). It refuses to write the image through a folder that is a symbolic link or a junction below the first root that holds the path (the page folder, else the current folder), found by name or by folder identity |
| `load.mjs` | `loadProject(file)`, `decodeText(buf, name)`, `parseJson(text, name)`, `jsonErrorAt(s)`, `LoadError` | I/O. `.json` → JSON.parse with line/column on error; `.mjs`/`.js` → dynamic import. `decodeText` reads UTF-8 (with or without a BOM) and UTF-16 LE or BE with a BOM |

## 8. CLI

`node engine/jig.mjs <command> [file] [options]` (inside a skill: `node "${CLAUDE_SKILL_DIR}/engine/jig.mjs" ...`).

| Command | Mode | Does |
|---|---|---|
| `new <id> [--units mm\|in] [--dir path] [--title text]` | - | Writes a starter `project.json` (from `templates/starter.json`). Refuses to overwrite (exit 3) |
| `check <project>` | guide | Validates and computes; prints the report. `--strict` |
| `build <project>` | guide | Check, then write the guide page. `--out file`, `--artifact`, `--offline`, `--tabs plan,shop,cut,build`, `--json`, `--force`, `--strict` |
| `plan <project>` | plan | Step-by-step plan, `--level new\|some\|pro`, `--format md\|json`, `--out`, `--force`, `--strict` |
| `boq <project>` | estimate | `--format md\|csv\|json`, `--out`, `--force` |
| `cut <project>` | estimate | `--format md\|json\|svg`, `--out`, `--force` (svg writes one file per material: `cut.svg` gives `cut-<material>.svg`) |
| `buy <project>` | estimate | `--format md\|json`, `--start YYYY-MM-DD`, `--out`, `--force` |
| `lint <file\|->` | - | STE lint of text or Markdown (`--kind procedure\|description\|warning\|title`, `--terms a,b`, `--verbs a,b`); a `.json`/`.mjs`/`.js` project lints all its reader text (in plan mode). A `.mjs`/`.js` file runs as code, as `load.mjs` imports it. Any finding is exit 1 |
| `safety <project>` | plan | The safety review, `--format md\|json`, `--out`: the summary (tip-over, power tools, protective equipment, hand-offs, cleared hand-off hits), a "Cleared hand-off hits" section that lists each `safety.cleared` topic with its `why` and every text it clears (place, matched words and the text itself), and the findings `E_POWER_NO_WARNING`, `E_TIP_OVER`, `E_HANDOFF`, `W_TIP_SMALL`, `W_CLEARED_UNUSED`, `I_TIP_UNCHECKED`, `I_OLD_PAINT`, `I_HANDOFF_CLEARED`. JSON: `{ engine, meta, safety, findings }` (`safety.cleared` as in section 5.2). Exit 1 on errors only |
| `capture <page.html\|url>` | - | `--out file.png\|.webp`, `--hash build/3`, `--width 1280`, `--height 900`, `--scale 1`, `--theme light\|dark`, `--select css`, `--wait ms`, `--reduced-motion`. Prints console errors and sideways scroll. When the page shows another route than `--hash` asked for, it prints "Route: #build/10 (asked for #build/99)" and exits 1. It warns for a `JIG_BROWSER` or `CHROME_PATH` that names a missing file |
| `schema` | - | Prints the JSON Schema, `--out` |
| `--help`, `<command> --help`, `help <command>`, `--version` | | |

Common options: `--report json` (machine report on stdout, human text on stderr), `--quiet`, `--debug` (stack trace of an error). `--force` writes the output despite errors and keeps exit code 1.

Exit codes:

- `0`: success.
- `1`: problems block the command (errors; STE findings and `W_CLEARED_UNUSED` under `--strict`; console errors on `capture`, or a page that shows another route than `--hash` asked for).
- `2`: usage error (unknown command or flag, a wrong flag value, no file argument, an `--out` of `-` (leave out `--out` to print on stdout), an `--out` that is the project file by its path text or by file identity (a junction or linked folder, an 8.3 short name, `::$DATA`), `cut --format svg` names that differ only in case).
- `3`: input or output failure (a file that is missing or unreadable, bad JSON, UTF-16 with no BOM, write failed, an output path that is a symbolic or hard link, an output path in a folder that is a symbolic link or junction below the first root that holds the path: the project folder, else the current folder, found by name or by folder identity (an 8.3 short name, a UNC share, a link above it); no browser for `capture`). `new` writes with `wx` and its own folder as the root, so it can write through a linked folder above its `--dir`.

Input files may be UTF-8 (with or without a BOM) or UTF-16 with a BOM. Terminal and Markdown text from the project has its control characters replaced (U+FFFD), and Markdown escapes `\`, `<` and `[`. The help and the hints show the engine path relative to the current folder, so a hint can be pasted as it is.

Flags are parsed with `node:util` `parseArgs` in strict mode, so an unknown flag is exit code 2 with a did-you-mean.

Output paths:

- The default output goes next to the project file: `<id>.html`, `<id>-3d.html` for `--tabs build`, and `<id>-artifact.html`.
- Missing folders are created.
- `--json` writes `<name>.json` beside the HTML.
- A JSON path that equals the HTML path is refused.

Report (`--report json`): `{ ok, engine, command, project: { id, title }, counts, problems, totals, outputs: [paths] }`, plus `safety` (safety command), `capture` (capture command, with `route` and `routeMismatch`) and `error: { exit, message }` (exit 2 or 3). [engine/docs/cli.md](../engine/docs/cli.md) has every option.

## 9. Guide page

- One self-contained HTML file: inline CSS, inline app + viewer, model JSON in `<script type="application/json" id="jig-data">` (with every `<` escaped as `\u003c`, in the model JSON and the import map). The model JSON leaves out `safety.cleared`, and the page shows no cleared entry.
- `app.js` has no static imports. It renders every tab first. The viewer then loads `three` with a dynamic `import()` through an import map that carries `integrity` (sha384) for each URL. If the import fails (offline, blocked CDN, no WebGL), the Plan/Shop/Cut/Build text still works and the viewer slot says why, telling "no network" apart from "no WebGL" and from a data error.
- `--offline` inlines three.js 0.160.0 and OrbitControls (MIT notice and the full MIT licence text, in HTML comments) and drops the Google Fonts link (system fonts).
- `<noscript>` carries `noscriptHtml(model)`: the plan, shopping list and steps as plain HTML.
- Tabs follow the WAI-ARIA tabs pattern (roving tabindex, arrow keys between tabs, `aria-controls`, `role=tabpanel`). A small live region announces "Step 4 of 10: Attach the bottom shelf". Focus moves to the step heading after navigation: a step chip, Next, Back, or a `#build/<n>` hash change (typed or linked), after which the URL shows the real step (`#build/0` becomes `#build/1`).
- Steps: Next marks a step done only when the step has no check; a Check box is ticked only by the reader.
- 3D: a part's letter tag hides while every sample point of the part is behind another solid. A tag stands on the centre of the part's own top face, a turned part too, or else on the first sample point that can be seen. A tag whose point is out of the view hides. In the kit pose, the tags go in part order, and a tag that covers more than a quarter of its area on an earlier tag hides. Before the first part goes in, a step that is not the kit pose shows the parts to come as a ghost (`data-auto-ghost` on the viewer); on that step "Show finished" is `aria-pressed="true"` and `aria-disabled="true"`, and a click does nothing. In the kit pose, and in a project with no parts (a repair), Apart and Show finished are `aria-pressed="false"` and `aria-disabled="true"`, and a click does nothing; a later step shows the reader's choice again. From 360 px wide, the viewer buttons stay on one row. On a narrower screen, they can go on two rows. A readout that does not fit beside them goes above them on one line, and its `title` holds the full text. A screen that is 520 px wide or less shows no readout. A ghost casts no shadow. Apart reframes the camera, and each screw moves with the part that its shank enters first. Apart never moves a part into a prop that shows: it slides the part along the prop face, or stops it short.
- A `view.zoom` never moves the camera nearer than the distance that shows all the lit parts.
- A project with no parts (a repair of an object modelled as props) frames its Plan-view props (`hero` not `false`), and Fig 1 gives their size. When parts exist, the framing and Fig 1 use only the parts.
- A step's `view.note` shows in a line under the 3D view and in the canvas label, at every level. It is hidden when the viewer has no picture, and in print. The line has `aria-hidden`, so a screen reader reads the note one time, in the label.
- The 3D canvas has `role="img"` and a label from the readout. It has keyboard orbit when focused (arrow keys turn, +/- zoom), a Pause button for the Plan view turn, and live reduced-motion handling. On touch it uses `touch-action: pan-y`, and one-finger orbit starts after a tap on the viewer.
- Contrast: every text/background token pair is at least 4.5:1 in both themes. Control borders are at least 3:1.
- Theme tokens on `:root`. Dark theme comes under `prefers-color-scheme` guarded by `:root:not([data-theme="light"])`, and again under `[data-theme="dark"]`.
- Print: every step in order, no 3D, no duplicates.
- Storage: `localStorage` key `jig:<id>` holds the ticks (done steps and bought items), level, tab and current step, wrapped in try/catch.
- Hash routes: `#plan`, `#shop`, `#cut`, `#build/<n>`. A malformed hash falls back to step 1. A typed or linked hash for a tab the page does not have is rewritten to the route the page shows, on load and on `hashchange`.
- `html { scroll-padding-top }` keeps a focused control and a step scrolled into view clear of the sticky tab bar (none on a single-tab page).
- The Parts table on the Cut list keeps each size on one line. Only when the table would scroll sideways does `app.js` set `data-fit`, one stage at a time until the table fits: `"stack"` (the material moves under the name), `"stack wrap"` (sizes wrap after a ×), `"stack wrap mat"` (a long material name breaks) and `"stack wrap mat break"` (a long part name breaks). In the BOQ, `fitBoq()` sets `data-break` on one item cell at a time, widest word first, until the table fits. In print, an item with a word of 20 letters or more (`data-long`) may break. Long words in the summary, trip items, the narrow BOQ and the step text (instructions, checks, notes, warnings, cards) break rather than scroll the page.
- Cut list: each sheet piece and board cut has a `<title>` ("F (F1): 964 × 70 mm"). A sheet letter is sized to its piece, and a piece too small for its letter is named in a line under its sheet or board ("Too small to show a letter: ..."). Two cut materials with one name show the material spec in the heading, as `cutMd` and `cutSvg` do.
- The Plan tiles (time, cost, parts, steps, tools) go 3 to a row. They go 2 to a row on a screen 520 px wide or less, and from 861 to 1100 px wide. The total tile can wrap after the currency code, and it never hides a digit.
- The BOQ tax row reads "includes €45.89" when the prices include the tax, else the amount.
- Money uses the fixed decimals table of `locale.mjs` (`DIGITS`), not the browser's ICU data.
- `--tabs` limits the tabs. A single tab hides the tab bar.
- `--artifact` writes a body fragment (title, the `claude:viewport-fit-sides` meta, the Google Fonts links, style, body) for the Artifact tool. The host's page skeleton adds the standard viewport meta.

## 10. Distribution and versioning

- One version for the whole pack. It lives in `.claude-plugin/plugin.json`, `plugin.json`, `gemini-extension.json`, every SKILL.md `metadata.version`, `engine/lib/version.mjs` and the top CHANGELOG entry. `scripts/bump-version.mjs <x.y.z>` updates all of them, and a test fails if they differ.
- `scripts/sync-engine.mjs` copies `engine/` into every `skills/*/engine/`, and example projects into `skills/jig/examples/` and `skills/jig-3d/examples/`. `--check` exits 1 on drift (CI).
- `scripts/set-owner.mjs --github <user> [--name "Display Name"] [--url https://...]` replaces the owner placeholders (see `docs/PUBLISHING.md` step 4) in manifests, README and docs before the first push.
- Release: run `scripts/bump-version.mjs`, then `scripts/build-examples.mjs` (the golden pages carry the engine version), then `scripts/sync-engine.mjs`; update the CHANGELOG, run the tests, tag `vX.Y.Z` and create a GitHub Release. See `docs/PUBLISHING.md`.

## 11. Tests

Run `node --test "tests/**/*.test.mjs"` on Node 22 or later. It needs no install.

- **Unit tests for each lib module:**
  - pack is checked against brute force on random cases;
  - validation messages are checked by code and path;
  - BOQ arithmetic;
  - purchase order;
  - STE rules fire on bad sentences and stay quiet on good ones;
  - safety rules;
  - geometry.
- **CLI tests:** exit codes, `--help`, unknown flags, `--report json` shape, output paths.
- **Golden tests** (`tests/golden.test.mjs`): each `examples/<id>/project.json` builds with 0 errors, 0 warnings and 0 STE findings, and the output matches the committed HTML byte for byte. `node scripts/build-examples.mjs` refreshes the committed pages.
- **Repo tests:**
  - SKILL.md frontmatter follows the spec (name equals the folder, description of 1024 characters or fewer with no `<` or `>`, only the six keys);
  - the body is under 500 lines;
  - links resolve;
  - no `SKILL.md` outside `skills/<name>/`;
  - engine copies match;
  - versions match;
  - files are under 256 KiB and there are 512 or fewer;
  - manifests parse and agree on name, version and description;
  - the docs agree with the engine: the built-in card table in format.md section 8, the rewrites.md finding counts, quoted WARNINGs that state a risk, the `--offline` size, the CI Node.js majors and the hand-off list.
- **Page tests** (`tests/page.test.mjs`): the formats, `round`, `amount` and the plural of `app.js` equal `locale.mjs` and `util.mjs`, the `app.js` `DIGITS` table equals `locale.mjs`, `taxWord` equals `markdown.mjs`, the `save()` keys, CSS rules, and (with Chrome, Chromium or Edge) live checks of the page through `capture()`.
