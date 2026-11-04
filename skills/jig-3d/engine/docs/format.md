# Project format

A project is one file that holds the whole build: what you buy, what you cut, where each part goes and the steps that put it together. The engine computes every number from it: the cut plan, the bill of quantities (BOQ), the shopping trips, the time and the 3D.

- Write `project.json`. It runs no code, so it is safe to share and to open from someone else.
- Write `project.mjs` only when many positions need arithmetic. Its default export is the same object. The engine runs it as code, so read a `.mjs` project from someone else before you build it.
- Start from the starter: `node engine/jig.mjs new <id>` copies [../templates/starter.json](../templates/starter.json). Inside a skill, the path is `${CLAUDE_SKILL_DIR}/engine/jig.mjs`. If your agent does not fill in `${CLAUDE_SKILL_DIR}`, use the folder that holds SKILL.md.
- The JSON Schema is [../schema/project.schema.json](../schema/project.schema.json). `node engine/jig.mjs schema` prints it. Add `"$schema": "<path to that file>"` to a project to get editor help; the engine ignores the field.
- [cli.md](cli.md) lists the commands. [method.md](method.md) says how to plan the build that this file describes.

## Contents

1. [World and units](#1-world-and-units)
2. [Top level](#2-top-level)
3. [Stores](#3-stores)
4. [Materials](#4-materials)
5. [Tools](#5-tools)
6. [Parts](#6-parts)
7. [Props](#7-props)
8. [Techniques](#8-techniques)
9. [Steps](#9-steps)
10. [Project-wide uses and finish](#10-project-wide-uses-and-finish)
11. [Hand-off and safety](#11-hand-off-and-safety)
12. [What each mode needs](#12-what-each-mode-needs)
13. [Problems and fixes](#13-problems-and-fixes)
14. [Examples](#14-examples)

## 1. World and units

- `units` is `"mm"` (the default) or `"in"`. Every length in the file uses it: part and prop `size` and `at`, `from`, stock lengths, sheet sizes, `section`, `thick`, `kerf`, `trim`, `perLength`, and fastener `at`, `len`, `d` and `repeat.step`.
- These are not lengths: `rotate` and `view.az`/`view.el` (degrees), `view.zoom` (a factor), `minutes`, `wait`, prices and `coverage` (area per unit of finish: m² in a `mm` project, ft² in an `in` project).
- JSON has no fractions. Write inches as decimals: 1 1/2 in is `1.5`, 30 1/16 in is `30.0625`.
- The engine works in millimetres inside. It shows lengths in the project unit: `mm` as whole numbers or one decimal, `in` as fractions to 1/16 ("30 1/16 in").
- Axes: x to the right, y up, z toward the viewer. The floor is y = 0.
- A part's `at` is the minimum corner of its box before rotation, so the box covers `at` to `at + size`. A side 19 mm thick, 900 mm tall and 235 mm deep that stands at the left is `"size": [19, 900, 235], "at": [0, 0, 0]`.

## 2. Top level

| Field | Type | Default | Meaning |
|---|---|---|---|
| `jig` | `1` | `1` | Format version |
| `id` | text | required | Output file name and browser storage key. Lower-case letters, digits and single hyphens, 1 to 64 characters: `"pine-bookshelf"` |
| `title` | text | required | The object: `"Pine bookshelf"` |
| `summary` | text | `""` | One or two STE descriptive sentences, 25 words or fewer each |
| `level` | `new` \| `some` \| `pro` | `some` | Level the page opens at: First time, Some experience, Experienced |
| `units` | `mm` \| `in` | `mm` | See section 1 |
| `currency` | ISO 4217 code | `USD` | `"EUR"`, `"GBP"`, `"INR"`, `"JPY"`. Money is rounded to the currency's minor unit |
| `tax` | `{ rate, label?, included? }` | none | Sales tax or VAT. `rate` is a share from 0 to 1: 7% is 0.07, 20% is 0.2. `included: true` shows prices with the tax inside; otherwise the tax is added to the total. `label` default "Tax" |
| `priceNote` | text | `""` | Where the prices come from |
| `pricesAsOf` | `YYYY-MM-DD` | none | Date of the prices, shown next to them |
| `estimate` | true \| false | `true` | Rates show an `est` badge unless a material or tool sets `est: false` |
| `kerf` | length, 10 mm or less | 3 mm (1/8 in) | Saw cut width |
| `trim` | length | `0` | Waste cut from the start of each board to square the factory end. The first piece starts at `trim` |
| `contingency` | 0 to 0.5 | `0.1` | Spare budget as a share from 0 to 0.5: 10% is 0.1. Shown as its own BOQ line |
| `terms` | text list | `[]` | Technical names the STE linter accepts: `["trestles", "countersunk"]` |
| `verbs` | text list | `[]` | Extra command verbs the STE linter accepts: `["solder", "caulk"]` |
| `stores` | `{ id: Store }` | `{}` | Where to buy (section 3) |
| `materials` | `{ id: Material }` | required | What is bought and used (section 4) |
| `tools` | Tool list | `[]` | Tools the steps use (section 5) |
| `parts` | Part list | required | What is cut, made or installed (section 6) |
| `props` | `{ id: Prop }` | `{}` | Context boxes: a wall, a bench, a floor. Never bought (section 7) |
| `techniques` | `{ id: Technique }` | `{}` | Extra cards, or cards that replace a built-in card (section 8) |
| `steps` | Step list | `[]` | The build sequence (section 9). `plan`, `check` and `build` need it |
| `uses` | `{ materialId: amount }` | `{}` | Consumables not tied to a step (section 10) |
| `finish` | Finish list | `[]` | Finishes not tied to a step (section 10) |
| `handoff` | `[{ topic, text }]` | `[]` | Work this guide leaves to a professional (section 11) |
| `safety` | `{ tipRatio?, cleared? }` | `{ tipRatio: 2 }` | `tipRatio`: height-to-depth ratio above which an object 600 mm (24 in) tall or more needs an anchor. `cleared`: `[{ topic, why }]`, hits of the hand-off screen that are not hand-off work (section 11) |

Ids (material, store, prop, technique, tool, part and step ids) use letters, digits, `.`, `_` and `-`, start with a letter or a digit, and have 64 characters or fewer.

Numbers have upper limits, so that no value becomes infinite after the unit conversion. A length, a position, an amount, a count or a time is 1,000,000 or less (in the project unit). A price is 1,000,000,000 or less. `view.az` is -360 to 360. A larger value is error `E_SCHEMA`.

## 3. Stores

`stores` maps an id to `{ name, online?, lead?, note?, url? }`.

| Field | Meaning |
|---|---|
| `name` | Required. "Timber yard", "Hardware store", "Online order" |
| `online` | `true`: an online order. Online trips come first in the purchase plan |
| `lead` | Delivery time in days. With `buy --start YYYY-MM-DD`, the plan gives an order-by date |
| `note` | Shown on the trip: "Pick straight boards." |
| `url` | Web address that starts with `http://` or `https://` |

A `store` id that is not in `stores` is warning `W_UNKNOWN_STORE`, and the item goes on an "Any store" trip.

## 4. Materials

`materials` maps an id to a material. The `kind` sets which other fields it takes.

Fields every kind takes:

| Field | Meaning |
|---|---|
| `name` | Required. Name in the BOQ and the shopping list: "Pine board" |
| `kind` | Required. `linear`, `sheet`, `each`, `amount` or `printed` |
| `spec` | Size or grade as the store writes it: "19 x 235 mm (1x10)" |
| `store` | Store id |
| `color` | `#rrggbb` in the 3D view and the cut drawings |
| `group` | BOQ group name. Default from the kind: Timber and sheet (linear, sheet). Printing (printed). Hardware for an `each` material that is a part or a fastener, or has `len`, `d` or `head`; else Consumables (sandpaper). Finish for an `amount` material that a finish uses; else Consumables (glue) |
| `est` | `false` when the price is a real quote. Default: the project `estimate` |
| `note` | Shown next to the item in the shopping list |
| `role` | `"anchor"`: a wall fixing. Parts and fasteners of this material count for the tip-over check |

BOQ groups come in this order, with their code letters: Timber and sheet `T`, Printing `P`, Hardware `H`, Consumables `C`, Finish `F`, Safety `S`, Tools `X`. Any other group name gets `O` and comes last. Codes count up inside each group (`H01`, `H02`), so a new timber row never renumbers the hardware.

### 4.1 linear: boards, battens, rods

| Field | Meaning |
|---|---|
| `section` | Required. `[width, thick]`, the actual size, not the nominal size: a 2x4 is `[89, 38]` mm or `[3.5, 1.5]` in |
| `profile` | `"rect"` (default) or `"round"` for a dowel, rod or pipe. A round section is `[d, d]` |
| `stock` | `[{ length, price }]`: the board lengths the store sells, with the price of one board. Required unless `perLength` |
| `perLength` | `{ price, per, max, step? }`: cut-to-size pricing. `price` for each `per` length, boards up to `max`, sold in `step` increments (default `step` = `per`). The step must be `max` or less, and `max / step` 100,000 or less: otherwise error `E_SCHEMA` |

A material can give both `stock` and `perLength`: the packer uses both. Do not put `price` on a linear or sheet material: it is error `E_UNKNOWN_KEY`, because the price goes on each `stock` entry or in `perLength`.

A part of a linear material has two sides that match the section within 1.5 mm. The third side is its cut length. A part with `rip: true` can be narrower than the section width, but its thickness must match. The engine packs the pieces into stock at the lowest total cost, with `kerf` between pieces and `trim` at the start of each board. A piece longer than the longest stock (after trim) is error `E_TOO_LONG`. The engine cuts each rip strip from its own board length. It does not put strips side by side across one board (info `I_RIP_SHARE`).

When every part of a linear material misses its section and the section looks like a nominal size (an inch 1x, 2x or 4x size, or every part the same 6 to 19 mm under it), the engine gives one `E_SECTION` on `materials.<id>.section`, with the actual size: "A 2x4 is 3 1/2 x 1 1/2 in."

### 4.2 sheet: plywood, MDF, board

| Field | Meaning |
|---|---|
| `thick` | Required. Sheet thickness |
| `stock` | Required. `[{ w, h, price }]`: sheet sizes with the price of one sheet. Add a half sheet as its own entry when the store sells one |
| `grain` | `true`: pieces keep their long side along the sheet's long side, unless the part says `grain: "across"` or `"any"`. Default `false`: pieces turn freely |

One side of a sheet part matches `thick`. The other two sides are the piece. The engine packs pieces with guillotine cuts (each cut goes from edge to edge, as a panel saw cuts) and buys the cheapest sheet that holds each layout. A piece that fits no sheet is error `E_SHEET_FIT`.

### 4.3 each: screws, hinges, brackets, sheets of sandpaper

| Field | Meaning |
|---|---|
| `price` | Price of one pack |
| `pack` | Pieces in one pack. Default 1 |
| `packName` | "box of 50" |
| `unit` | Word for one piece. Default "piece" |
| `spare` | Spare share 0 to 1. Default 0.1 for fasteners, else 0 |
| `len`, `d` | Fastener length and diameter. A fastener in a step uses them unless it gives its own |
| `head` | `"flat"` (countersunk), `"pan"` or `"hex"` |
| `included` | `true`: it comes in a kit. The BOQ lists it as "in the kit" and the shopping list leaves it out |

The quantity is the parts made of it, plus the fasteners in steps, plus `uses`. A part of an `each` material (a bracket, a hinge, a ready-made leg) is counted, not cut.

### 4.4 amount: glue, finish, filler

| Field | Meaning |
|---|---|
| `unit` | Required. "L", "ml", "kg", "g", "m", "roll", "qt" |
| `price` | Price of one pack |
| `pack` | Amount in one pack, in `unit`. Default 1 |
| `packName` | "250 ml bottle", "0.946 L can" |
| `coverage` | Area that ONE `unit` covers in one coat: m² in a `mm` project, ft² in an `in` project. Required when the material is a finish |
| `coats` | Coats to apply. Default 1 |
| `spare` | Spare share 0 to 1. Default 0.1 for finishes, else 0 |

The quantity is the `uses` amounts, plus each finish: finished area x coats / coverage. Coverage is per unit, so a finish sold in ml covers about 0.011 m² per ml, not 11. A coverage above 1 with unit `ml` or `g` is warning `W_COVERAGE_UNIT`.

Packs to buy, for every kind that has packs: `ceil(need x (1 + spare) / pack)`. The BOQ shows the need and the packs in two columns, so the reader sees why they buy more than they use.

### 4.5 printed: filament for 3D-printed parts

| Field | Meaning |
|---|---|
| `price` | Price of one spool |
| `spool` | Grams of filament in one spool. Default 1000 |
| `packName` | "1 kg spool". Default: "1 kg spool", or "750 g spool" for a spool that is not whole kilograms |
| `density` | Filament density in g/cm³. Default 1.24 (PLA). PETG is about 1.27, ABS about 1.04 |
| `fill` | Share of the solid part volume that the printer fills, walls and infill together, more than 0 and up to 1. Default 0.3 |
| `rate` | Grams of filament that the printer lays down in one hour. Default 12 |
| `spare` | Spare share 0 to 1, for failed prints and purge. Default 0.1 |

A part of a printed material is printed, not cut. Its grams and hours come from its `print` (section 6), the slicer numbers. A value that is not there is an estimate from the part size:

- grams = solid volume in cm³ x `density` x `fill`, to 1 g (1 g or more). The solid volume is the box of `size`, or the cylinder of a part with `shape: "cylinder"`.
- hours = grams / `rate`, to 0.1 h (0.1 h or more).

An estimate gives the info `I_PRINT_ESTIMATE`, one time for the project. Slice each part and put the slicer numbers in `print`.

The BOQ has one row for each printed material, in the group Printing (`P`). The need is the count of parts and the total grams. Spools to buy: `ceil(grams x (1 + spare) / spool)`. The row note gives the printer hours. The printer time is waiting time of the step with `prints` (section 9), not work time.

## 5. Tools

`tools` is a list of `{ id, name, spec?, have?, get?, price?, days?, qty?, store?, power?, ppe?, est? }`.

| Field | Meaning |
|---|---|
| `id`, `name` | Required. Steps name tools by `id` |
| `spec` | "fine blade, 40 teeth or more" |
| `have` | `true`: the reader has it. Listed in the plan only, never bought |
| `get` | `"buy"` (default), `"rent"` or `"borrow"`, when the reader does not have it |
| `price` | Price to buy one, or the price for one day to rent one |
| `days` | Rental days. Default 1. A rented tool costs qty x days x price |
| `qty` | How many. Default 1. A bought tool costs qty x price |
| `store` | Store id |
| `power` | `true`: a power tool. Each step that uses it needs a WARNING, in the step or in one of its technique cards (`E_POWER_NO_WARNING`) |
| `ppe` | `true`: protective equipment. It goes in the BOQ group "Safety" and in the safety summary |
| `est` | `false` when the price is a real quote |

A borrowed tool costs 0 and goes on a final "Borrow" trip. A bought or rented tool with no price is warning `W_PRICE_UNKNOWN`: the row shows "price?" and stays out of the total. A tool that no step uses is warning `W_UNUSED_TOOL` (not in a project with no steps). An unused tool stays in the BOQ, so the estimate is an upper bound.

## 6. Parts

`parts` is a list of `{ id, label?, name, material, size, at?, shape?, rotate?, color?, rip?, grain?, role?, finish?, joins?, print? }`.

| Field | Meaning |
|---|---|
| `id` | Required, unique: "A1", "A2" |
| `label` | The letter the reader sees, shared by identical parts: "A". Default: the id. Parts that share a label must share `name`, `material` and `size` (`E_LABEL_MISMATCH`) |
| `name` | Required. One word for the part everywhere: "Side", "Shelf". The text uses this word and no other |
| `material` | Required. Id of a `linear`, `sheet`, `each` or `printed` material |
| `size` | Required. `[x, y, z]`, every side more than 0, before rotation. Cut sizes come from `size` |
| `at` | Minimum corner `[x, y, z]` before rotation. Required for `check` and `build` |
| `shape` | `"box"` (default) or `"cylinder"`: two equal sides are the diameter, the third is the length along the axis |
| `rotate` | `[rx, ry, rz]` in degrees about the box centre, applied x, then y, then z. Geometry checks use the rotated box's axis-aligned bounds |
| `color` | `#rrggbb` in 3D. Default: the material color |
| `rip` | `true`: the part may be narrower than the board width (a rip cut) |
| `grain` | On a sheet with grain: `"along"` (default), `"across"` or `"any"` |
| `role` | `"anchor"`: a wall fixing for the tip-over check |
| `finish` | `false`: leave the part out of the finished area (a hidden back, a bought bracket) |
| `joins` | Part ids this part may overlap on purpose: a shelf in a dado, a tenon in a mortise. Other overlaps over 1 mm are error `E_GEOMETRY` |
| `print` | Only on a part of a `printed` material: `{ grams?, hours?, settings? }`. `grams` and `hours` are the slicer numbers for one part; a missing value is an estimate (section 4.5). `settings` is text for the reader: "0.2 mm layers, 20% infill, no supports". It is linted as a description. Parts that share a label must share `print` (`E_LABEL_MISMATCH`). `print` on another part is error `E_SCHEMA` |

Each part is installed in exactly one step (`E_NOT_INSTALLED`, `E_INSTALLED_TWICE`). A printed part is printed in the step with `prints` (section 9), and installed in its own assembly step.

## 7. Props

`props` maps an id to `{ size, at, color?, shape?, rotate?, hero?, label? }`: context boxes such as a wall, a bench or a floor area. A step shows the props it lists in its `props`. The Plan view shows every prop with `hero` not `false`. Props never go in the BOQ. `at` is required for `check` and `build` (guide mode) only. The dark theme shows props darker, so a white wall does not glare.

A repair: model the object that exists as props with a label (the legs, the seat). Model only the new or replaced pieces as parts. With no parts, the 3D view and the Fig 1 size come from the props in the Plan view. When a repair has parts, the 3D view and Fig 1 show only the parts, so Fig 1 gives the size of the new pieces. Say so in the reply.

## 8. Techniques

A technique card teaches one skill once, and every step that needs it links to it with `teach`. `techniques` maps an id to `{ name, why?, warn?, do, tools? }`:

| Field | Meaning |
|---|---|
| `name` | Required. Card title: "Drill a pilot hole" |
| `why` | Why the technique works, in STE descriptive sentences |
| `warn` | `[{ type, text }]`, shown on the card (section 9) |
| `do` | Required. Instructions in STE |
| `tools` | Tool names the technique needs |

Card text (`why`, `warn`, `do`) can use two placeholders:

- `{kerf}`: the engine fills in the project kerf ("3 mm", "1/8 in", "3/32 in").
- `{mm value|inch value}`, such as `{150 mm|6 in}` or `{2 mm|1/16 in}`: the engine fills in the value for the project unit.

A project card with a built-in id replaces the built-in card. A WARNING on a card counts for the power-tool rule of every step that teaches it. A step shows a WARNING or CAUTION text once, also when the step and one or more of its cards have the same text. The drill cards (`pilot-hole`, `countersink`, `drill-straight`) share one WARNING text, so a step that teaches two of them shows it once.

The built-in cards say this (the values shown are the mm values; an inch project gets 6 in, 1/16 in and its kerf). They name no grit size and no awl. Where a card needs a support, it says "a bench or a sawhorse": name the support the project uses (trestles, a workbench) in the step or the tools.

| Card | Name | Instructions | WARNING and CAUTION | Tools |
|---|---|---|---|---|
| `measure-mark` | Measure and mark | (1) Hook the tape on the square end of the board. (2) Read the tape at eye level. (3) Make a small V mark with a sharp pencil. (4) Put the square against the edge of the board. (5) Draw a line through the V along the square. (6) Write an X on the waste side of the line. | none | Tape measure, Pencil, Square |
| `cut-straight` | Cut on the line | (1) Clamp the board to a bench or a sawhorse, with the line near the support. (2) Put a second support under a long waste piece, near the line. (3) Do not cut between two supports that are far apart. (4) Align the blade with the waste side of the line. (5) Let the saw reach full speed before it touches the wood. (6) Push the saw slowly along the line. (7) Let a short waste piece fall. Do not hold it. (8) Before you lift the saw, let the blade stop. | WARNING: Wear safety glasses. The saw can throw chips into your eyes. WARNING: Wear ear protection. A loud saw can hurt your ears. WARNING: Keep your hands 150 mm from the blade. The blade can cut your fingers. WARNING: Stand to the side of the saw line. A saw that jumps back can hit you. WARNING: Support the board so that the cut stays open. A cut that closes on the blade makes the saw jump back toward you. WARNING: Do not lock or remove the lower blade guard. The guard covers the blade after the cut. | Saw, Clamp |
| `pilot-hole` | Drill a pilot hole | (1) Select a drill bit that is a little smaller than the screw shaft. (2) Mark the hole position with a pencil. (3) Clamp small parts before you drill. (4) Hold the drill at 90° to the face. (5) Drill to the depth of the screw. | WARNING: Wear safety glasses. The drill bit can throw chips into your eyes. | Drill, Drill bit |
| `countersink` | Countersink the hole | (1) Put the countersink bit in the pilot hole. (2) Drill until the cone is as wide as the screw head. (3) Remove the dust from the hole. | WARNING: Wear safety glasses. The drill bit can throw chips into your eyes. | Drill, Countersink bit |
| `glue-joint` | Glue a joint | (1) Apply a thin line of glue to one face. (2) Spread the glue with your finger or a scrap. (3) Put the parts together in 10 minutes or less. (4) Wipe off the extra glue with a wet cloth. | none | Wet cloth |
| `clamp` | Clamp two parts | (1) Put a scrap block between each clamp jaw and the wood. (2) Tighten the clamp until the joint closes. (3) When a thin line of glue comes out, stop. | CAUTION: Do not tighten the clamp too much. Too much force pushes out all the glue. | Clamps, Scrap blocks |
| `square-diagonals` | Square a frame | (1) Measure the frame from corner to corner. (2) Measure the other diagonal. (3) If the two lengths are not equal, push the long diagonal corners together. (4) Measure again until the two lengths are equal within 2 mm. | none | Tape measure |
| `sand` | Sand a face | (1) Wrap the sandpaper around a flat block. (2) Sand along the grain with a medium grit. (3) Remove the dust with a dry cloth. (4) Sand again with a finer grit. | WARNING: Wear a dust mask. Fine dust can hurt your lungs. CAUTION: Do not sand across the grain. Cross scratches show through the finish. | Sanding block, Sandpaper, Dust mask |
| `finish-wipe` | Apply a wipe-on finish | (1) Stir the can for 1 minute. (2) Apply a thin coat with a lint-free cloth. (3) Wait for the time on the can. (4) Sand lightly with fine sandpaper between coats. | WARNING: Wear nitrile gloves. The finish can hurt your skin. WARNING: Open a window. Finish fumes can make you ill. WARNING: Put used rags flat outdoors to dry, or in a closed metal can of water. Oily rags can catch fire. | Lint-free cloth, Gloves |
| `find-stud` | Find a stud in the wall | (1) Move a cable and pipe detector over the area. (2) Mark each cable and pipe that the detector finds. (3) Do not drill within 150 mm of a ceiling or a corner. (4) Move a stud finder slowly along the wall. (5) Mark the two edges of the stud. (6) Drill a 2 mm test hole between the marks. (7) If the bit goes into wood, use that position. | WARNING: Do not drill above, below or beside a socket or a switch. Cables run there. WARNING: Use a cable and pipe detector before you drill. A drill can hit a cable or a pipe. | Cable and pipe detector, Stud finder, Drill |
| `drill-straight` | Drill a straight hole | (1) Mark the center of the hole with a pencil. (2) Clamp the part to a bench or a sawhorse. (3) Put the tip of the bit on the mark. (4) Hold the drill at 90° to the face. (5) Examine the drill from the front and from the side. (6) Start the drill at low speed. (7) When the bit is in the wood, increase the speed. (8) Pull out the bit often to remove the chips. | WARNING: Wear safety glasses. The drill bit can throw chips into your eyes. CAUTION: Put a scrap block under the part. The bit can split the back face when it comes out. | Drill, Square |
| `level-check` | Level a part | (1) Put the spirit level on the part. (2) Read the position of the bubble. (3) Turn the level end to end on the same spot. (4) Read the bubble again. (5) If the bubble is not between the lines, adjust the low end of the part. (6) Do the check again. | none | Spirit level |

The `cut-straight` card is for a circular saw: its WARNINGs name kickback and the lower blade guard. A jigsaw or a hand-saw project needs its own card: give it another id, or the id `cut-straight` to replace the built-in card.

Each card also has a `why` line. The page shows a card the first time a First time reader meets it.

## 9. Steps

`steps` is a list. Each step is one visible change to the object.

| Field | Meaning |
|---|---|
| `id` | Required, unique |
| `title` | Required. A command: "Attach the top shelf". Linted as a procedure line |
| `phase` | Phase name: "Prepare", "Build", "Finish". A phase is a run of consecutive steps with one name. Reusing a name after a different phase is warning `W_PHASE_SPLIT` |
| `minutes` | Work time for an experienced person. Missing: warning `W_NO_MINUTES` |
| `wait` | Waiting time: glue, finish. Shown apart from work time |
| `parts` | Part ids installed in this step. 1 to 4 per step reads best |
| `fasteners` | Fasteners installed in this step (section 9.1) |
| `uses` | `{ materialId: amount }`: consumables of kind `each` or `amount` (glue ml, sandpaper sheets) |
| `finish` | `{ material, coats?, parts? }`: an `amount` material with `coverage`. Default parts: every part that is not of an `each` or `printed` material and has no `finish: false`. A `parts` list can also name parts of an `each` or `printed` material. The area counts all six faces of each part, so it is an upper bound. The 3D view lights the finished parts |
| `cuts` | `true`, or a list of `linear`/`sheet` material ids: the stock is cut in this step. It sets "needed by" in the purchase plan |
| `prints` | `true`, or a list of `printed` material ids: the printer makes the parts of these materials in this step. Their printer hours go into the waiting time of this step (machine time, the same at every level). It sets "needed by" of the filament in the purchase plan. The first step that prints a material gets its parts. A printed material that no step prints is warning `W_NO_PRINT_STEP` |
| `tools` | Tool ids |
| `teach` | Technique ids |
| `warn` | `[{ type: "warning" \| "caution", text }]`, shown before the instructions. A WARNING is for a risk of injury, a CAUTION for a risk of damage. Start the text with a command, then give the risk |
| `do` | Instructions, one action each: a string, or `{ "t": "...", "new": true }` for a line shown only at First time |
| `check` | The inspection that ends the step: "Make sure that the two diagonals are equal within 2 mm." Missing: warning `W_NO_CHECK` |
| `why` | Why the step is done this way. Shown at First time only |
| `tip` | A tip. Shown at First time and Some experience |
| `pose` | `"kit"`: the cut and printed parts lie flat on the floor with their letters (preparation steps) |
| `focus` | Part ids lit in the kit pose |
| `from` | `[dx, dy, dz]`: the path the new parts arrive along. A drawer slides in from the front (`[0, 0, 400]`), a top drops from above (`[0, 300, 0]`) |
| `view` | `{ az, el, zoom, note }`: camera. `az` 0 is the front, 90 the right side, 180 the back. `el` is the height of the camera in degrees: the schema takes -90 to 90, but the viewer cannot look from below, so it holds an `el` below about 1 at the horizon. Use 1 to 89. `zoom` above 1 is closer. `note` (120 characters or fewer, linted as a description) is a short line under the 3D view, at every level. It is never in print, `plan.md` or the no-script copy, where there is no picture |
| `props` | Prop ids shown in this step |

Every level sees the warnings, the instructions and the check. Safety never depends on level.

The 3D always shows the object upright, with each part in its final place. It cannot show the object on its back or on its side, or from below. Write the step text so that it agrees with the picture. If the real work must happen with the object lying down, say so in the step text, and set `view.note` to "The picture shows the <object> upright." Never mention the picture in `do`, `check`, `why` or `tip`: print and `plan.md` show those, and they have no picture.

### 9.1 Fasteners

A fastener is positional (drawn in 3D) or counted (not drawn):

```json
{ "material": "screw-4x50", "at": [0, 69.5, 40], "dir": [1, 0, 0] }
{ "material": "screw-4x50", "at": [0, 69.5, 40], "dir": [1, 0, 0], "repeat": { "count": 3, "step": [0, 0, 77.5] } }
{ "material": "nail-40", "count": 24 }
```

- `material` is the id of an `each` material.
- `at` is the head position, on the surface where the fastener goes in. `dir` is the direction the fastener travels. `[0, 0, 0]` is an error.
- `len` and `d` default to the material's `len` and `d`.
- `repeat: { count, step }` makes `count` fasteners (the first one included, 500 or fewer), each moved by `step` from the one before. Use it for a row of screws.
- The head must sit on a part surface, and the tip must end inside a part. Otherwise: warning `W_FASTENER`.
- A counted fastener goes into the BOQ but not into the 3D. In guide mode it is warning `W_COUNTED_FASTENER`. Use positions for every fastener the reader drives.

### 9.2 Text and levels

| Text | Kind | Limit | Shown at |
|---|---|---|---|
| `title`, `do`, `check`, technique `do` | procedure | 20 words a sentence | Every level |
| `warn[].text` | warning | 20 words a sentence | Every level |
| `do` line with `new: true` | procedure | 20 words | First time |
| `why`, technique `why` | description | 25 words | First time |
| `tip` | description | 25 words | First time, Some experience |
| `view.note` | description | 25 words, 120 characters | Every level, under the 3D view only |
| `summary`, `handoff[].text` | description | 25 words | Every level |
| `safety.cleared[].why` | description | 25 words, 10 to 240 characters | Never: only the safety review shows it |

The linter also checks: a command verb first, one instruction per sentence, the condition before the command, active voice, no -ing verb forms and common word replacements. [ste.md](ste.md) has the rules and the word list.

## 10. Project-wide uses and finish

- `uses`: `{ materialId: amount }` for consumables that no single step uses: a pack of cloths for the whole job.
- `finish`: `[{ material, coats?, parts? }]` for a finish that no single step applies: a pre-finished sheet. Same rules as a step `finish`.

## 11. Hand-off and safety

- `handoff` is a list of `{ topic, text }`: work this guide leaves to a professional. The hand-off screen reads all the reader text. If the text names a hand-off topic and `handoff` does not, it is error `E_HANDOFF`. The topics: gas, mains wiring, structural or load-bearing work, roof work or work above 2 m, permit work, asbestos and lead paint. [safety.md](safety.md) lists the words the screen looks for.
- Use a topic id as `topic`: `gas`, `mains`, `structural`, `height`, `permit`, `asbestos` or `lead-paint`. Common names such as `"mains wiring"` also match. Say in `text` who does what: "A licensed electrician connects the light to the mains."
- Put the same hand-off in a WARNING on the first step that comes near it, and never write steps for it.
- The screen is a safety net: it finds common words only. It misses work, and it gives false alarms. `safety.cleared` records a false alarm: a list of `{ topic, why }`. `topic` is a topic id or a common name, as in `handoff`. Another topic is error `E_SCHEMA`. `why` says why the text is not that work, in STE descriptive sentences of 10 to 240 characters. For lead paint, `why` gives the age of the paint, and the entry also stops `I_OLD_PAINT`.
- An entry changes the `E_HANDOFF` of its topic to the info `I_HANDOFF_CLEARED`, and `safety` lists each text that it clears. An entry that clears nothing is the warning `W_CLEARED_UNUSED`, and `--strict` stops on it. Never use `safety.cleared` for real hand-off work, or only to get a build through. [safety.md](safety.md) section 11 says when to use it. The page does not show it.

```json
{
  "safety": {
    "cleared": [{ "topic": "gas", "why": "The weed burner runs on a small propane tank. The guide makes no gas connection." }]
  }
}
```

- `safety.tipRatio` (default 2): if the object's height divided by its depth is more than this, it needs a part or a fastener with role `anchor` (on the part or on its material), or the build stops with `E_TIP_OVER`. Add a wall-fixing step with a WARNING about children. This applies from a height of 600 mm (24 in). A smaller object over the ratio (a lamp, a box) gets the warning `W_TIP_SMALL` instead: make the base wider or deeper, or put weight in the base. For a step stool, set `tipRatio` to 1: its base must be as deep as it is tall ([safety.md](safety.md) section 6).
- A tool with `power: true` needs a WARNING in each step that uses it (`E_POWER_NO_WARNING`).

## 12. What each mode needs

Each command computes the model in one mode and checks only what that mode needs.

| Mode | Needs | Commands |
|---|---|---|
| `estimate` | `materials`, and `parts` with `size` and `material` | `boq`, `cut`, `buy` |
| `plan` | + `steps`, and every part installed in exactly one step | `plan`, `safety` |
| `guide` | + `at` on every part and prop, positional fasteners, geometry checks | `check`, `build` |

So a plan-only project can leave out every `at`, and a cost estimate can leave out the steps. Add them when you need the next mode.

## 13. Problems and fixes

Each problem has a `path` into the project (`steps[3].do[1]`), a `where` for people ("step 4, line 2"), a `msg` and a `hint`. Errors stop `build`. STE findings and the warning `W_CLEARED_UNUSED` stop it only with `--strict`. Fix the model. Never bend a rule to silence it.

| Code | Usual cause | Fix |
|---|---|---|
| `E_SCHEMA` | Wrong type, missing field, value out of range, unknown enum. A `perLength` step more than `max`, or more than 100,000 board lengths. `print` on a part that is not of a `printed` material | Follow the hint. Write numbers without quotes (`3`, not `"3"`). A rate is a share: 7% is 0.07 |
| `E_UNKNOWN_KEY` | A misspelt field (`meterials`), or `price` on a linear material | Fix the name. A board price goes on each `stock` entry |
| `E_DUP_ID` | Two parts, steps, tools or techniques with one id, or one id two times in a step's `parts` or `teach` | Give each its own id. Use `label` for identical parts. Remove the second entry from the step |
| `E_LABEL_MISMATCH` | One label on parts that differ | Give the odd part its own letter |
| `E_REF` | An id that does not exist, or a material of the wrong kind | Fix the id, or add the item |
| `E_SECTION` | A part drawn at a nominal size: 25 mm for a 19 mm board. On `materials.<id>.section`: every part misses a section that looks nominal (a 2x4 written as `[4, 2]`) | Use the actual size. Use `rip: true` for a narrower piece. If the parts are right, set the section to the actual size: a 2x4 is `[3.5, 1.5]` in |
| `E_TOO_LONG` | A piece longer than any stock | Add a longer stock length, or split the part with a joint |
| `E_SHEET_FIT` | A piece larger than any sheet, given the grain | Add a larger sheet, set the part `grain: "any"`, or split it |
| `E_NOT_INSTALLED` | No step installs a part | Add the part to the step that fits it in place |
| `E_INSTALLED_TWICE` | Two steps install one part | Keep it in one step. Use `focus` to light it in a kit step |
| `E_POWER_NO_WARNING` | A power-tool step with no WARNING | Add a WARNING to the step, or teach a card that has one |
| `E_TIP_OVER` | 600 mm (24 in) tall or more, shallow, with no anchor | Add the anti-tip part with role `anchor` and a wall-fixing step. A step stool or a climbing toy (`safety.tipRatio` 1): make the base larger. Do not anchor it |
| `E_HANDOFF` | Text names gas, mains wiring, structure, height, a permit, asbestos or lead paint | Add a `handoff` entry, and remove any steps for that work. If the text is not that work (a false alarm), add a `safety.cleared` entry (section 11) |
| `E_GEOMETRY` | Two parts overlap by more than 1 mm | Recompute `at` from the neighbouring part, or list the part in `joins` for a real joint |
| `W_FLOATING` | A part touches nothing | Fix its `at`, or add the wall or bench it hangs on as a prop |
| `W_FASTENER` | A head is off the surface, or a tip ends in air | Put `at` on the entry face and point `dir` into the part. Use a shorter `len` |
| `W_UNUSED_MATERIAL`, `W_UNUSED_TOOL` | Nothing uses it | Use it in a step, or remove it |
| `W_PRICE_UNKNOWN` | A bought item with no price | Add an estimated price, or set the tool `have: true` or `get: "borrow"` |
| `W_UNKNOWN_STORE` | A store id not in `stores` | Fix the id, or add the store |
| `W_NO_CHECK`, `W_NO_MINUTES` | A step with no check or no time | Add them |
| `W_PHASE_SPLIT` | A phase name used again after another phase | Rename it, or move the step |
| `W_COVERAGE_UNIT` | Coverage per L given for a unit in ml | Divide the coverage by 1000, or change the unit to L |
| `W_COUNTED_FASTENER` | A counted fastener in guide mode | Give `at` and `dir`, with `repeat` for a row |
| `W_TIP_SMALL` | Under 600 mm (24 in) tall, over `safety.tipRatio`, with no anchor (a lamp, a box) | Make the base wider or deeper, or put weight in the base. A wall fixing is for furniture 600 mm (24 in) tall or more |
| `W_CLEARED_UNUSED` | A `safety.cleared` entry clears nothing: no text of its topic, a topic that `handoff` names, or a second entry for one topic | Remove the entry. `--strict` stops on this warning |
| `W_NO_PRINT_STEP` | Plan or guide mode: no step has `prints` for a printed material, so its printer time is in no step | Add `"prints": true` to the step in which the printer makes the parts, or add the material id to its `prints` list |
| `STE_*` | A sentence breaks a writing rule | Rewrite the sentence. Add a real trade word to `terms` or `verbs` |
| `STE_WARN_NO_RISK` | A WARNING or CAUTION with no risk sentence after its command: "When you drill, wear safety glasses." | Give the risk in a second sentence: "Wear safety glasses. The bit can throw chips into your eyes." |
| `I_ESTIMATE` (info) | Prices are estimates | Tell the reader. Set `est: false` on prices the user gave |
| `I_TIP_UNCHECKED` (info) | Plan mode: a part has no `at`, so the tip-over rule cannot run, and nothing has role `anchor` | Divide the height by the base depth. Above `safety.tipRatio`, add an anchor part and a wall-fixing step to an object 600 mm (24 in) tall or more. Make the base of a smaller object wider or deeper. Or give every part an `at` |
| `I_OLD_PAINT` (info) | A text strips, sands, scrapes, heats, burns or removes old paint, or names old paint with a heat gun, a scraper, a sander or a stripper, and nothing names lead paint | Ask how old the paint is. Paint from before 1978 (US) or 1992 (UK) can contain lead: then add the `lead-paint` hand-off ([safety.md](safety.md) section 10). Newer paint: give its age in a `lead-paint` entry of `safety.cleared` |
| `I_HANDOFF_CLEARED` (info) | A `safety.cleared` entry clears the hits of its topic: one info for each topic | Make sure that the guide has no work of that topic. If it has, remove the entry and add the hand-off |
| `I_PRINT_ESTIMATE` (info) | A printed part has no slicer `grams` or `hours`, so the engine estimates them from the part size. One info for the project, at the first such part | Slice each part. Put the slicer numbers in `print`: `"print": { "grams": 24, "hours": 1.5 }` |
| `I_RIP_SHARE` (info) | Two or more rip strips of one material fit side by side across one board, and strips side by side give fewer boards or a lower cost than the plan, which cuts each strip from its own board length | The hint names the saving ("The plan then needs 1 board, not 6"). To get it, plan the rip cuts by hand. The BOQ stays an upper bound |

## 14. Examples

### 14.1 The smallest project

The estimate mode needs only this much:

```json
{
  "id": "garden-stake",
  "title": "Garden stake",
  "materials": {
    "batten": { "kind": "linear", "name": "Pine batten", "section": [38, 19], "stock": [{ "length": 2400, "price": 3.2 }] }
  },
  "parts": [{ "id": "A1", "label": "A", "name": "Stake", "material": "batten", "size": [38, 600, 19] }]
}
```

### 14.2 A complete guide project

A low bench in mm, priced in EUR with VAT included. It builds with 0 errors.

```json
{
  "jig": 1,
  "id": "spruce-bench",
  "title": "Spruce bench",
  "summary": "A low bench for two people. You cut four parts from two boards and attach them with glue and screws.",
  "level": "new",
  "units": "mm",
  "currency": "EUR",
  "tax": { "rate": 0.19, "label": "VAT", "included": true },
  "priceNote": "Example prices from a German DIY store. Replace them with the prices at your store.",
  "pricesAsOf": "2026-11-01",
  "kerf": 3,
  "trim": 10,
  "terms": ["trestles"],
  "stores": {
    "diy": { "name": "DIY store", "note": "Pick straight boards. Look along each edge before you buy it." },
    "online": { "name": "Online order", "online": true, "lead": 3 }
  },
  "materials": {
    "board": { "kind": "linear", "name": "Spruce board", "spec": "38 x 235 mm, planed", "section": [235, 38], "stock": [{ "length": 2000, "price": 21.9 }, { "length": 2500, "price": 26.9 }], "store": "diy", "color": "#e3c79b" },
    "batten": { "kind": "linear", "name": "Spruce batten", "spec": "38 x 89 mm, planed", "section": [89, 38], "perLength": { "price": 3.2, "per": 1000, "max": 3000, "step": 500 }, "store": "diy", "color": "#e3c79b" },
    "screw-5x80": { "kind": "each", "name": "Wood screw", "spec": "5 x 80 mm, countersunk", "pack": 50, "packName": "box of 50", "price": 7.49, "len": 80, "d": 5, "head": "flat", "store": "diy", "color": "#8f959c" },
    "glue": { "kind": "amount", "name": "Wood glue", "spec": "PVA, D3", "unit": "ml", "pack": 250, "packName": "250 ml bottle", "price": 6.99, "store": "diy" },
    "sand-120": { "kind": "each", "name": "Sandpaper", "spec": "120 grit", "unit": "sheet", "pack": 10, "price": 4.99, "store": "online" },
    "oil": { "kind": "amount", "name": "Hardwax oil", "spec": "clear, satin", "unit": "L", "pack": 0.375, "packName": "0.375 L tin", "price": 14.95, "coverage": 24, "coats": 2, "store": "online" },
    "cloths": { "kind": "each", "name": "Lint-free cloth", "pack": 10, "price": 3.99, "group": "Finish", "store": "online" }
  },
  "tools": [
    { "id": "tape", "name": "Tape measure", "have": true },
    { "id": "pencil", "name": "Pencil", "have": true },
    { "id": "square", "name": "Try square", "price": 8.99, "store": "diy" },
    { "id": "saw", "name": "Circular saw", "spec": "fine blade, 40 teeth or more", "get": "borrow", "power": true },
    { "id": "trestles", "name": "Two trestles", "get": "borrow" },
    { "id": "clamps", "name": "Bar clamp", "spec": "600 mm", "qty": 2, "price": 11.99, "store": "diy" },
    { "id": "drill", "name": "Cordless drill", "have": true, "power": true },
    { "id": "bits", "name": "Drill bit set", "spec": "3 mm bit and countersink bit", "price": 9.99, "store": "diy" },
    { "id": "block", "name": "Sanding block", "price": 3.49, "store": "diy" },
    { "id": "glasses", "name": "Safety glasses", "ppe": true, "price": 5.99, "store": "diy" },
    { "id": "ears", "name": "Ear protection", "ppe": true, "price": 8.99, "store": "diy" },
    { "id": "mask", "name": "Dust mask", "spec": "FFP2", "ppe": true, "price": 6.99, "store": "diy" },
    { "id": "gloves", "name": "Nitrile gloves", "ppe": true, "price": 4.99, "store": "online" }
  ],
  "parts": [
    { "id": "A1", "label": "A", "name": "Top", "material": "board", "size": [800, 38, 235], "at": [0, 412, 0] },
    { "id": "B1", "label": "B", "name": "Leg", "material": "board", "size": [38, 412, 235], "at": [60, 0, 0] },
    { "id": "B2", "label": "B", "name": "Leg", "material": "board", "size": [38, 412, 235], "at": [702, 0, 0] },
    { "id": "C1", "label": "C", "name": "Rail", "material": "batten", "size": [604, 89, 38], "at": [98, 323, 98.5] }
  ],
  "steps": [
    {
      "id": "cut", "phase": "Prepare", "title": "Cut the parts", "pose": "kit", "cuts": true, "minutes": 30,
      "tools": ["tape", "pencil", "square", "saw", "trestles", "clamps", "glasses", "ears"],
      "teach": ["measure-mark", "cut-straight"],
      "do": [
        "Put the board on the two trestles.",
        "Mark each cut from the cut list.",
        { "t": "Measure each length two times before you cut.", "new": true },
        "Cut each part on the waste side of the line.",
        "Write the part letter on the bottom face of each part."
      ],
      "check": "Make sure that you have one part A, two parts B and one part C.",
      "why": "Parts with letters are easy to find. Two measurements stop most errors."
    },
    {
      "id": "sand", "phase": "Prepare", "title": "Sand the parts", "pose": "kit", "minutes": 25,
      "tools": ["block", "mask"], "uses": { "sand-120": 3 }, "teach": ["sand"],
      "do": ["Sand all faces and edges with 120 grit.", "Remove the dust with a dry cloth."],
      "check": "Make sure that no saw marks show on the edges."
    },
    {
      "id": "frame", "phase": "Build", "title": "Attach the rail to the legs", "parts": ["B1", "B2", "C1"], "minutes": 25,
      "tools": ["drill", "bits", "clamps", "glasses"], "uses": { "glue": 10 }, "teach": ["pilot-hole", "countersink", "glue-joint"],
      "fasteners": [
        { "material": "screw-5x80", "at": [60, 345, 117.5], "dir": [1, 0, 0], "repeat": { "count": 2, "step": [0, 45, 0] } },
        { "material": "screw-5x80", "at": [740, 345, 117.5], "dir": [-1, 0, 0], "repeat": { "count": 2, "step": [0, 45, 0] } }
      ],
      "warn": [{ "type": "warning", "text": "Wear safety glasses. The drill bit can throw chips into your eyes." }],
      "do": [
        "Apply glue to the two ends of rail C.",
        "Put the rail between the two legs B.",
        "Align the top edge of the rail with the top ends of the legs.",
        "Clamp the legs to the rail.",
        "Drill two pilot holes through each leg into the rail.",
        "Install two screws through each leg."
      ],
      "check": "Make sure that the frame stands flat on the floor.",
      "why": "The glue makes the joint stiff. The screws hold the joint while the glue dries."
    },
    {
      "id": "top", "phase": "Build", "title": "Attach the top", "parts": ["A1"], "minutes": 20,
      "from": [0, 300, 0], "view": { "az": 20, "el": 45 },
      "tools": ["tape", "pencil", "drill", "bits", "glasses"], "uses": { "glue": 15 },
      "fasteners": [
        { "material": "screw-5x80", "at": [79, 450, 40], "dir": [0, -1, 0], "repeat": { "count": 3, "step": [0, 0, 77.5] } },
        { "material": "screw-5x80", "at": [721, 450, 40], "dir": [0, -1, 0], "repeat": { "count": 3, "step": [0, 0, 77.5] } }
      ],
      "warn": [
        { "type": "warning", "text": "Wear safety glasses. The drill bit can throw chips into your eyes." },
        { "type": "warning", "text": "Do not stand on the bench. The bench can tip." }
      ],
      "do": [
        "Apply glue to the top ends of the legs and the rail.",
        "Put top A on the frame with 60 mm of overhang at each end.",
        "Draw a line across the top above the center of each leg.",
        "Drill three pilot holes on each line.",
        "Countersink each hole.",
        "Install three screws on each line."
      ],
      "check": "Make sure that each screw head is flush with the top or a little below it."
    },
    {
      "id": "finish", "phase": "Finish", "title": "Apply the oil", "minutes": 30, "wait": 720,
      "tools": ["gloves"], "uses": { "cloths": 2 }, "finish": { "material": "oil", "coats": 2 }, "teach": ["finish-wipe"],
      "do": [
        "Remove all dust with a dry cloth.",
        "Apply a thin coat of oil to all faces.",
        "After 20 minutes, wipe off the extra oil.",
        "Wait 12 hours.",
        "Apply the second coat."
      ],
      "check": "When the oil is dry, put your full weight on the bench slowly. Make sure that no joint moves."
    }
  ]
}
```

How the positions come from the neighbours: the legs stand on the floor (y = 0) and are 412 mm tall, so the top sits at y = 412. The rail is 89 mm high and its top edge is flush with the leg tops, so it sits at y = 412 - 89 = 323. It runs from the inner face of leg B1 (60 + 38 = 98) to the inner face of leg B2 (702), so its length is 604. It is centred in the depth: (235 - 38) / 2 = 98.5. Each top screw head sits on the top face (412 + 38 = 450) above the centre of a leg (60 + 19 = 79), travels down, and ends 80 mm lower, inside the leg.

Where the WARNINGs come from: the cut, sand and finish steps get theirs from the cards they teach (`cut-straight`, `sand`, `finish-wipe`), one hazard in each WARNING. The frame and top steps give their own. A person sits on a bench, so the top step has the WARNING "Do not stand on the bench. The bench can tip.", and the last step ends with the load check ([safety.md](safety.md) section 6). The bench is not a step: a step stool gets the overhang WARNING and `safety.tipRatio` 1.

### 14.3 Imperial units

```json
{
  "units": "in",
  "kerf": 0.125,
  "materials": {
    "stud": { "kind": "linear", "name": "Stud", "spec": "2x4 (1 1/2 x 3 1/2 in)", "section": [3.5, 1.5], "stock": [{ "length": 96, "price": 4.12 }, { "length": 120, "price": 5.98 }] },
    "ply": { "kind": "sheet", "name": "Plywood", "spec": "23/32 in sanded pine", "thick": 0.71875, "grain": true, "stock": [{ "w": 96, "h": 48, "price": 54.98 }, { "w": 48, "h": 48, "price": 32.5 }] },
    "screw": { "kind": "each", "name": "Deck screw", "spec": "#10 x 3 in", "pack": 75, "price": 9.97, "len": 3, "d": 0.19 },
    "stain": { "kind": "amount", "name": "Wood stain", "unit": "qt", "pack": 1, "price": 14.98, "coverage": 100 }
  }
}
```

`coverage: 100` means 100 ft² for one quart, in an `in` project.

### 14.4 Cut-to-size pricing, rip cuts, round and turned parts

```json
"materials": {
  "oak": { "kind": "linear", "name": "Oak board", "section": [140, 20], "perLength": { "price": 18, "per": 1000, "max": 2400, "step": 100 } },
  "dowel": { "kind": "linear", "name": "Beech dowel", "section": [25, 25], "profile": "round", "stock": [{ "length": 1000, "price": 3.5 }] }
},
"parts": [
  { "id": "E1", "label": "E", "name": "Strip", "material": "oak", "size": [600, 20, 60], "at": [0, 0, 0], "rip": true },
  { "id": "F1", "label": "F", "name": "Rod", "material": "dowel", "shape": "cylinder", "size": [25, 600, 25], "at": [0, 20, 0] },
  { "id": "G1", "label": "G", "name": "Brace", "material": "oak", "size": [400, 20, 140], "at": [100, 300, 0], "rotate": [0, 0, 45] }
]
```

- Oak costs 18 for each 1000 mm, in 100 mm steps, up to 2400 mm.
- Strip E is a rip cut: 60 mm wide from a 140 mm board. The engine cuts each rip strip from its own board length. It does not put strips side by side across one board (info `I_RIP_SHARE`).
- Rod F is a cylinder along y: two sides of 25 are the diameter.
- Brace G is turned 45° about z. Its cut length is still 400.

### 14.5 3D-printed parts

A board with two printed hooks and a printed peg. The printer makes the parts in step 1, and step 2 glues them to the board.

```json
"materials": {
  "pla": { "kind": "printed", "name": "PLA filament", "spec": "1.75 mm, black", "price": 21.99, "spool": 1000, "store": "online", "color": "#333333" },
  "board": { "kind": "linear", "name": "Pine board", "section": [90, 18], "stock": [{ "length": 1000, "price": 4.5 }] }
},
"parts": [
  { "id": "A1", "label": "A", "name": "Plate", "material": "board", "size": [300, 18, 90], "at": [0, 0, 0] },
  { "id": "B1", "label": "B", "name": "Hook", "material": "pla", "size": [40, 60, 20], "at": [40, 18, 35], "print": { "settings": "0.2 mm layers, 20% infill, no supports" } },
  { "id": "B2", "label": "B", "name": "Hook", "material": "pla", "size": [40, 60, 20], "at": [220, 18, 35], "print": { "settings": "0.2 mm layers, 20% infill, no supports" } },
  { "id": "C1", "label": "C", "name": "Peg", "material": "pla", "shape": "cylinder", "size": [20, 50, 20], "at": [140, 18, 35], "print": { "grams": 7, "hours": 0.8 } }
],
"steps": [
  { "id": "print", "title": "Print the hooks and the peg", "pose": "kit", "prints": true, "minutes": 10, "do": ["Load the PLA filament.", "Start the print."], "check": "Make sure that each part is complete." },
  { "id": "glue", "title": "Glue the hooks to the plate", "parts": ["A1", "B1", "B2", "C1"], "minutes": 15, "do": ["Apply glue to the base of each part.", "Put each part on the plate."], "check": "Make sure that each part is tight." }
]
```

- Hook B has no slicer numbers. Its box is 40 x 60 x 20 mm = 48 cm³, so it needs 48 x 1.24 x 0.3 = 18 g and 18 / 12 = 1.5 h (info `I_PRINT_ESTIMATE`).
- Peg C gives the slicer numbers: 7 g and 0.8 h.
- The BOQ row `P01` needs 3 parts and 43 g. With 10% spare that is 47.3 g, so you buy one 1 kg spool.
- Step 1 gets 1.5 + 1.5 + 0.8 = 3.8 h of printer time as waiting time. The work time stays 10 minutes.
- The page calls the cut tab "Cut and print". It is "Print list" when no part is cut. A kit of bought parts only has no cut tab.

### 14.6 project.mjs

Use a module when positions repeat in patterns that `repeat` cannot express. Keep the helpers small and name the numbers.

```js
// Pine bookshelf: 800 wide, 900 tall, 235 deep. x right, y up, z toward the viewer.
const T = 19, W = 800, H = 900, D = 235;
const SHELF_Y = [60, 330, 600, H - T];               // bottom face of each shelf
const sideScrews = (shelf, side) => ({
  material: "screw-4x50",
  at: [side === "left" ? 0 : W, SHELF_Y[shelf] + T / 2, 40],
  dir: [side === "left" ? 1 : -1, 0, 0],
  repeat: { count: 3, step: [0, 0, (D - 80) / 2] },
});

export default {
  id: "pine-bookshelf",
  title: "Pine bookshelf",
  materials: { /* ... */ },
  parts: SHELF_Y.map((y, i) => ({ id: `B${i + 1}`, label: "B", name: "Shelf", material: "pine-1x10", size: [W - 2 * T, T, D], at: [T, y, 0] })),
  steps: [{ id: "bottom", title: "Attach the bottom shelf", parts: ["B1"], fasteners: [sideScrews(0, "left")] }],
};
```
