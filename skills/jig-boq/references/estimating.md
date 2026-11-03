# Estimating

How to turn what the user says into a project that the BOQ can price, and the numbers to use when the user does not say them. [engine/docs/format.md](../engine/docs/format.md) defines every field. This file says how to choose the values.

## Contents

1. [From words to fields](#1-from-words-to-fields)
2. [Amounts the user rarely states](#2-amounts-the-user-rarely-states)
3. [Prices](#3-prices)
4. [Tax and currency by region](#4-tax-and-currency-by-region)
5. [Compare two options](#5-compare-two-options)
6. [Problems in an estimate](#6-problems-in-an-estimate)

## 1. From words to fields

| The user says | Field |
|---|---|
| "18 mm ply", "3/4 MDF" | A `sheet` material: `thick` is the actual thickness, `stock` the sheet sizes sold |
| "2x4s", "70 x 70 legs", "pine 1x10" | A `linear` material: `section` is the actual `[width, thick]`, `stock` the lengths sold |
| "four legs", "two shelves" | Parts that share one `label` and one size |
| "screws", "brackets", "hinges" | An `each` material, counted in `uses` (or in step fasteners when the project has steps) |
| "glue", "oil", "paint" | An `amount` material: glue in `uses` (ml), a finish in `finish` with `coverage` |
| "I have a drill" | A tool with `have: true`, or leave it out |
| "my neighbour has a saw" | A tool with `get: "borrow"` |
| "in pounds", "with VAT" | `currency`, `tax` |

### 1.1 An imperial list

The user writes: "Price a 2x4 workbench frame: four legs 34 in, two rails 72 in, four stretchers 21 in, and a top from 3/4 plywood, 72 x 24. Deck screws. I'm in Texas." The project:

```json
{
  "id": "stud-bench",
  "title": "Stud workbench",
  "units": "in",
  "currency": "USD",
  "tax": { "rate": 0.0825, "label": "Sales tax" },
  "priceNote": "Typical big-box store prices. Check them at your store.",
  "materials": {
    "stud": { "kind": "linear", "name": "Stud", "spec": "2x4 (1 1/2 x 3 1/2 in)", "section": [3.5, 1.5], "stock": [{ "length": 96, "price": 3.98 }, { "length": 120, "price": 5.48 }, { "length": 144, "price": 6.98 }] },
    "ply": { "kind": "sheet", "name": "Plywood", "spec": "23/32 in sanded pine", "thick": 0.71875, "stock": [{ "w": 96, "h": 48, "price": 54.98 }, { "w": 48, "h": 48, "price": 32.5 }] },
    "screw": { "kind": "each", "name": "Deck screw", "spec": "#10 x 3 in", "len": 3, "d": 0.19, "pack": 75, "packName": "box of 75", "price": 9.97 }
  },
  "parts": [
    { "id": "A1", "label": "A", "name": "Leg", "material": "stud", "size": [3.5, 34, 1.5] },
    { "id": "A2", "label": "A", "name": "Leg", "material": "stud", "size": [3.5, 34, 1.5] },
    { "id": "A3", "label": "A", "name": "Leg", "material": "stud", "size": [3.5, 34, 1.5] },
    { "id": "A4", "label": "A", "name": "Leg", "material": "stud", "size": [3.5, 34, 1.5] },
    { "id": "B1", "label": "B", "name": "Rail", "material": "stud", "size": [72, 3.5, 1.5] },
    { "id": "B2", "label": "B", "name": "Rail", "material": "stud", "size": [72, 3.5, 1.5] },
    { "id": "C1", "label": "C", "name": "Stretcher", "material": "stud", "size": [21, 3.5, 1.5] },
    { "id": "C2", "label": "C", "name": "Stretcher", "material": "stud", "size": [21, 3.5, 1.5] },
    { "id": "C3", "label": "C", "name": "Stretcher", "material": "stud", "size": [21, 3.5, 1.5] },
    { "id": "C4", "label": "C", "name": "Stretcher", "material": "stud", "size": [21, 3.5, 1.5] },
    { "id": "D", "name": "Top", "material": "ply", "size": [72, 0.71875, 24] }
  ],
  "uses": { "screw": 40 }
}
```

- "3/4 plywood" is 23/32 in thick: `0.71875`. "2x4" is `[3.5, 1.5]`.
- The 72 in top does not fit the 48 x 48 half sheet, so the plan buys a full sheet. Tell the user that the offcut (24 x 96 in less the kerf) can make a shelf.
- The ten frame pieces fit in four 8 ft studs (USD 15.92 at these prices), which is cheaper than the 10 ft and 12 ft lengths.
- Texas adds sales tax at the till, so `included` is left out and the BOQ adds a tax line.

### 1.2 Ready-made and kit parts

- A ready-made leg, a hinge or a bracket is an `each` material. In an estimate, count it in `uses`: `"uses": { "hairpin-leg": 4 }`. When the project grows into a plan or a guide, make it a part, so a step installs it.
- An `each` item counted only in `uses`, with no `len` or `d`, goes to the Consumables group. Give a leg, a hinge or a bracket the Hardware group: `"hairpin-leg": { "kind": "each", "name": "Hairpin leg", "spec": "400 mm, steel", "price": 9.5, "group": "Hardware" }`.
- A part that comes in a kit (a flat-pack repair) gets `"included": true` on its material. The BOQ lists it as "in the kit" and adds no cost.
- A service (store cutting, delivery) is an `each` material in its own group: `{ "kind": "each", "name": "Sheet cutting", "unit": "cut", "group": "Services", "price": 0.5 }`, with the number of cuts in `uses`. Its code starts with `O`.

## 2. Amounts the user rarely states

Use these starting values when the user gives no number, and list each one as an assumption. The product label is the authority.

| Item | Starting value |
|---|---|
| Screws in a butt joint | 2 for a board up to 100 mm (4 in) wide, 3 up to 250 mm (10 in), 4 above. Keep them 20 to 40 mm from an edge and 50 to 150 mm apart |
| Screw length | About 2.5 times the thickness of the part it goes through, with 25 mm (1 in) or more in the second part. A 19 mm board takes 4 x 45 to 50 mm (#8 x 2 in) |
| Screws in hardware | One for each hole: a corner bracket has 4, a butt hinge 6 (3 in each leaf), a cabinet hinge 4 |
| Back panel | One screw or nail every 150 mm (6 in) along each edge |
| PVA glue | About 0.2 L for each m² of glued face. A 19 x 235 mm butt joint takes about 1 ml. A small build needs one 250 ml bottle |
| Sandpaper | Two grits (120, then 180). By hand, about 1 sheet of each grit for each 1 m² (10 ft²). With an orbital sander, about 1 disc of each grit for each 1 m² |
| Varnish or paint | 10 to 12 m² per L for each coat (100 to 125 ft² per quart). 2 coats, 3 on a table top |
| Hardwax oil | About 24 m² per L for each coat. 2 coats |
| Danish oil | About 12 m² per L for each coat. 2 or 3 coats |
| Exterior stain on sawn wood | About 6 to 8 m² per L for each coat. 2 coats |
| Anti-tip kit | 1 kit for a unit up to 800 mm (32 in) wide, 2 above. Each kit has a strap and 2 screws into a stud, or 2 plugs for masonry |

- In a `mm` project, `coverage` is m² for one `unit`. In an `in` project, it is ft² for one `unit`. A finish sold by the quart in an `in` project has `"unit": "qt"` and `"coverage": 110`.
- If the finish is sold in ml, divide the m² per L by 1000: 12 m² per L is `"coverage": 0.012` for `"unit": "ml"`.

## 3. Prices

Use the best source you have, in this order:

1. **The user's price.** Set `est: false` on that material or tool. If every price is the user's, set `"estimate": false` on the project.
2. **A store page that you read now.** Keep `est`. Put the store in `priceNote` and the date in `pricesAsOf` (`YYYY-MM-DD`). Look up the largest items first: sheets and boards are often more than half the total.
3. **Your estimate.** Keep `est`, and write `"priceNote": "Typical prices. Check them at your store."`

Rules:

- If the user gives a range ("50 to 70"), use the upper end and say so. A budget that runs short stops the build.
- A board or sheet always needs a price, because the cut plan chooses stock by cost. Give each stock length a price that rises with length. If two lengths have one price, the plan buys only the longer one.
- If an item to buy has no price and you cannot estimate one, leave `price` out. The row shows "price?" and stays out of the total. Tell the user the total leaves it out.
- Keep the contingency. Set it to 0.15 for a first build or for prices older than 3 months.

## 4. Tax and currency by region

Rates change. Confirm the rate with the user, or with a source you read now. These are the usual forms:

| Region | `currency` | `tax` |
|---|---|---|
| United Kingdom | `GBP` | `{ "rate": 0.2, "label": "VAT", "included": true }` |
| Germany | `EUR` | `{ "rate": 0.19, "label": "VAT", "included": true }` |
| France | `EUR` | `{ "rate": 0.2, "label": "VAT", "included": true }` |
| Australia | `AUD` | `{ "rate": 0.1, "label": "GST", "included": true }` |
| New Zealand | `NZD` | `{ "rate": 0.15, "label": "GST", "included": true }` |
| India | `INR` | `{ "rate": 0.18, "label": "GST", "included": true }`. The rate depends on the product. Shelf prices (MRP) include it |
| Japan | `JPY` | `{ "rate": 0.1, "label": "Consumption tax", "included": true }` |
| Canada | `CAD` | `{ "rate": 0.13, "label": "HST" }`. From 0.05 to 0.15 by province, added at the till |
| United States | `USD` | `{ "rate": 0.0825, "label": "Sales tax" }`. From 0 to about 0.1 by state and city, added at the till |

- With `included: true`, the BOQ shows the tax inside the total. Without it, the BOQ adds a tax line.
- With no `tax`, the BOQ has no tax line. Say "tax not included" in your reply.
- Write prices in the file as plain numbers, in the project currency. Never mix currencies in one project.

## 5. Compare two options

When the user asks "MDF or plywood?", "pine or oak?" or "buy legs or cut them?":

1. Copy the project: `project.json` and `project-mdf.json`.
2. Change one thing in the copy: the material, the stock, or the parts it affects.
3. Run both with `--report json`, and read `totals.total` from each:
   ```
   node <skill folder>/engine/jig.mjs boq cabinet/project.json --report json
   node <skill folder>/engine/jig.mjs boq cabinet/project-mdf.json --report json
   ```
   `<skill folder>` is the folder that holds SKILL.md. Write its full path.
4. Show the two totals side by side, with the one difference that changes them most. Add one line on what else differs: MDF is heavier, sags sooner (an 18 mm MDF shelf sags past about 600 mm) and swells when wet.

## 6. Problems in an estimate

| Code | Usual cause | Fix |
|---|---|---|
| `E_SCHEMA` | A number in quotes, a missing `kind`, `section` or `stock`, a misspelt kind | Follow the hint. Write `18`, not `"18"` |
| `E_UNKNOWN_KEY` (error) | A misspelt field, or `price` on a linear or sheet material | Fix the name. A board or sheet price goes on each `stock` entry |
| `E_DUP_ID` | Two parts with one id | Give each part its own id. Use `label` for identical parts |
| `E_LABEL_MISMATCH` | One label on parts of different sizes | Give the odd part its own letter |
| `E_REF` | A part names a material that does not exist, or one of kind `amount` | Fix the id. Glue and finish go in `uses` and `finish`, not in parts |
| `E_SECTION` | A part at a nominal size: 2 x 4 in for a 2x4 | Use the actual size. Use `rip: true` for a narrower piece |
| `E_TOO_LONG` | A piece longer than the longest stock | Add a longer stock length, or split the part |
| `E_SHEET_FIT` | A piece larger than every sheet | Add a larger sheet, or split the part |
| `W_PRICE_UNKNOWN` | A tool or item to buy with no price | Add an estimate, or set the tool `have: true` or `get: "borrow"` |
| `W_UNKNOWN_STORE` | A `store` id not in `stores` | Fix the id, or add the store |
| `W_UNUSED_MATERIAL` | A material that no part, use or finish needs | Use it, or remove it |
| `W_UNUSED_TOOL` | A tool that no step uses. A project with no steps gives no such warning | Add the tool to the step that needs it, or remove it. The BOQ keeps an unused tool |
| `W_COVERAGE_UNIT` | Coverage for one L on a material sold in ml | Divide the coverage by 1000, or change the unit to L |
| `I_ESTIMATE` (info) | Prices are estimates | Tell the user. Set `est: false` on the prices the user gave |
