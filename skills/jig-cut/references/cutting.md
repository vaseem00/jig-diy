# Cutting

How to set the numbers that decide a cut plan, how to read the plan, and two worked plans. [engine/docs/format.md](../engine/docs/format.md) defines every field. This file says how to choose the values.

## Contents

1. [Kerf by saw](#1-kerf-by-saw)
2. [Board ends and trim](#2-board-ends-and-trim)
3. [Grain on sheets](#3-grain-on-sheets)
4. [Rip cuts](#4-rip-cuts)
5. [Cut-to-size and round stock](#5-cut-to-size-and-round-stock)
6. [Store cutting and transport](#6-store-cutting-and-transport)
7. [Read the output](#7-read-the-output)
8. [A plan in inches](#8-a-plan-in-inches)
9. [A plan in mm with grain](#9-a-plan-in-mm-with-grain)
10. [Problems and fixes](#10-problems-and-fixes)

## 1. Kerf by saw

| Saw | Kerf | `kerf` in mm | `kerf` in inches |
|---|---|---|---|
| Hand saw, Japanese pull saw | 1 to 2 mm | `2` | `0.0625` (1/16) |
| Jigsaw | 1.5 to 2 mm | `2` | `0.0625` |
| Circular saw, thin-kerf blade | 2.2 to 2.5 mm | `2.5` | `0.09375` (3/32) |
| Circular, mitre or table saw, full-kerf blade | 3 to 3.2 mm | `3` | `0.125` (1/8) |
| Track saw | 2.2 to 2.6 mm | `2.5` | `0.09375` |
| Store panel saw | 3 to 4.5 mm | `4` | `0.15625` (5/32) |

- If you do not know the saw, use 3 mm (1/8 in). A kerf a little too large wastes 1 mm a cut. A kerf too small makes the last piece short.
- The plan puts one kerf between two pieces, and none after the last piece on a board.
- Tell the reader to cut on the waste side of each line, so the kerf comes out of the waste.

## 2. Board ends and trim

- `trim` is cut from the start of each board. The first piece starts at `trim`.
- Factory ends are often not square, and some have splits, paint or stamps. Use 10 mm (3/8 in) for clean factory ends, and 25 mm (1 in) for ends with splits or paint.
- The far end of the board gets no trim. If the far end is bad too, set `trim` to the margin at the start, and give each stock length minus the margin at the far end: a 2400 mm board becomes `"length": 2390` at the same price. Tell the user why the drawing shows 2390.
- Sheets get no trim: factory sheet edges are square. If the sheet edges are damaged, give each sheet 10 mm smaller in each direction.

## 3. Grain on sheets

| Sheet | `grain` on the material | Parts |
|---|---|---|
| MDF, hardboard, plain chipboard | leave out (no grain) | Pieces turn to save wood |
| Veneered plywood, wood-look melamine | `true` | The long side of each piece runs along the sheet's long side |
| Construction plywood that is painted or hidden | leave out | Pieces turn to save wood |

Part settings on a sheet with `grain: true`:

| The part | `grain` on the part |
|---|---|
| Cabinet side 720 tall x 560 deep: grain runs up | leave out (`"along"`: the long side, 720, follows the grain) |
| Top or shelf 764 wide x 560 deep: grain runs left to right | leave out |
| Low, deep side 400 tall x 560 deep, with the grain up | `"across"`: the grain follows the short side |
| Back, carcass bottom, any hidden part | `"any"`: the piece turns if that saves wood |

If a piece fits a sheet only when it turns, and its grain rule stops it, the report gives `E_SHEET_FIT` with a hint. Set `"any"` only when the grain is not seen.

## 4. Rip cuts

- A rip cut makes a part narrower than the board. Set `rip: true`. The thickness must still match the section.
- The engine packs ripped pieces by length only. Each one uses the full board width for its length, and the rest of the width is waste. When two strips can come from one width, the board count can err high. When strips side by side save boards or money, the report gives the info `I_RIP_SHARE` with the number of strips that fit across one board, and its hint names the saving (fewer boards, or a lower cost).
- For a cost estimate only, you can model a blank: two 60 mm strips from a 140 mm board make one part 123 mm wide (60 + 3 + 60) with `rip: true` and its own letter. Say in the reply that blank E splits into two strips. Do not use a blank in a project for jig or jig-plan: those need the real parts.
- A table saw rips best. A circular saw with a rip fence or a guide also works. Put the push-stick WARNING before rip cuts on a table saw.

## 5. Cut-to-size and round stock

- **Sold by length:** `"perLength": { "price": 18, "per": 1000, "max": 2400, "step": 100 }` is 18 for each 1000 mm, in 100 mm steps, up to 2400 mm. The engine makes one stock length for each step, so the plan buys the shortest length that holds each board's pieces.
- **Dowels, rods, round bars:** `"profile": "round"` and `"section": [25, 25]` for a 25 mm diameter. Give the part `"shape": "cylinder"` and two sides of 25: `"size": [25, 600, 25]`.
- **Lengths sold at one price:** if 2.4 m and 3.0 m cost the same, the plan uses only 3.0 m. That is correct: more wood for the same price.

## 6. Store cutting and transport

- Many stores cut sheets on a panel saw, often for a fee for each cut. Set `kerf` to 4 when the store cuts. Model the fee as a service in jig-boq (an `each` material in its own group).
- Ask the store to make the first long cuts, so the pieces fit in the car. Give the store the sheet drawing.
- Boards over 2.4 m (8 ft) and full sheets (2440 x 1220 mm, 4 x 8 ft) do not fit in most cars. If the plan buys them, ask the user how they carry them: delivery, store cutting, a roof rack or a van.
- A full 18 mm sheet weighs about 30 kg in plywood and 40 kg in MDF. Tell the user to lift it with a helper, and to cut it on supports so that both pieces stay up after the cut.
- If the store sells cut sizes (half sheets, quarter sheets, 600 mm shelves), add each one as its own stock entry. The plan uses it when it costs less.

## 7. Read the output

- **Markdown (`--format md`).** For each material: the boards or sheets to buy with their price, then each board's cuts in order. A board line gives each piece's letter, length and start position from the board end, and the waste at the end. A sheet gives each piece's letter, size and corner position, and marks a piece that turns.
- **SVG (`--format svg`).** One drawing for each material, to scale: each board or sheet, each piece with its letter and size, and the waste. The scale is the same for all boards of one material, so a short board looks short.
- **JSON (`--format json`).** The `cuts` list of the model. Lengths are mm, also in an inch project. Linear: `boards[].stock`, `boards[].cuts[] { id, label, len, at }`, `used`, `waste`. Sheet: `sheets[].cuts[] { id, label, x, y, w, h, rotated }`, `usedArea`, `waste` (m²).
- Positions include the trim and the kerfs. A piece at 895 mm on a board with a 10 mm trim starts 895 mm from the board end.

## 8. A plan in inches

The user writes: "Cut list from 2x4s: four legs 34 in, two rails 72 in, four stretchers 21 in. 8 ft studs are 3.98, 10 ft 5.48, 12 ft 6.98. 1/8 in kerf."

```json
{
  "id": "stud-frame",
  "title": "Stud frame",
  "units": "in",
  "kerf": 0.125,
  "estimate": false,
  "materials": {
    "stud": { "kind": "linear", "name": "Stud", "spec": "2x4 (1 1/2 x 3 1/2 in)", "section": [3.5, 1.5], "stock": [{ "length": 96, "price": 3.98 }, { "length": 120, "price": 5.48 }, { "length": 144, "price": 6.98 }] }
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
    { "id": "C4", "label": "C", "name": "Stretcher", "material": "stud", "size": [21, 3.5, 1.5] }
  ]
}
```

The user gave the prices, so `"estimate": false` removes the `est` marks. The plan (10 pieces, so the exact search proves it):

| Board | Cuts (letter, length, start) | Waste |
|---|---|---|
| 8 ft | B 72 in at 0, C 21 in at 72 1/8 in | 2 7/8 in |
| 8 ft | B 72 in at 0, C 21 in at 72 1/8 in | 2 7/8 in |
| 8 ft | A 34 in at 0, A 34 in at 34 1/8 in, C 21 in at 68 1/4 in | 6 3/4 in |
| 8 ft | A 34 in at 0, A 34 in at 34 1/8 in, C 21 in at 68 1/4 in | 6 3/4 in |

Four 8 ft studs cost USD 15.92. Three longer studs (12, 10 and 10 ft) hold the same pieces but cost USD 17.94.

## 9. A plan in mm with grain

The user writes: "Cut list for a cabinet from 18 mm birch plywood, 2440 x 1220, grain on the faces. Two sides 720 x 560, top and bottom 764 x 560, two shelves 764 x 540."

```json
{
  "id": "birch-cabinet",
  "title": "Birch cabinet",
  "currency": "EUR",
  "materials": {
    "birch": { "kind": "sheet", "name": "Birch plywood", "spec": "18 mm, B/BB", "thick": 18, "grain": true, "stock": [{ "w": 2440, "h": 1220, "price": 64 }, { "w": 1220, "h": 1220, "price": 38 }] }
  },
  "parts": [
    { "id": "A1", "label": "A", "name": "Side", "material": "birch", "size": [18, 720, 560] },
    { "id": "A2", "label": "A", "name": "Side", "material": "birch", "size": [18, 720, 560] },
    { "id": "B1", "label": "B", "name": "Panel", "material": "birch", "size": [764, 18, 560] },
    { "id": "B2", "label": "B", "name": "Panel", "material": "birch", "size": [764, 18, 560] },
    { "id": "C1", "label": "C", "name": "Shelf", "material": "birch", "size": [764, 18, 540] },
    { "id": "C2", "label": "C", "name": "Shelf", "material": "birch", "size": [764, 18, 540] }
  ]
}
```

The plan: one full sheet (EUR 64, less than two half sheets at EUR 76). Two rows of three pieces, each 560 mm high, with the grain along 2440 for every piece: up the sides, left to right on the panels and shelves. About 2.49 m² of the 2.98 m² sheet is used.

## 10. Problems and fixes

| Code | Usual cause | Fix |
|---|---|---|
| `E_SECTION` | A part at a nominal size (2 x 4 in), or a part that is narrower than the board without `rip`. On `materials.<id>.section`: the section itself is the nominal size (`[4, 2]` for a 2x4) | Use the actual size. Set `rip: true` for a strip. Set a 2x4 section to `[3.5, 1.5]` |
| `E_TOO_LONG` | A piece longer than the longest stock after the trim | Add a longer stock length, or split the part with a joint |
| `E_SHEET_FIT` | A piece larger than every sheet, or a grain rule that stops it turning | Add a larger sheet, set the part `grain: "any"` if the grain is hidden, or split it |
| `E_REF` | A part names a material that does not exist, or one of kind `amount` | Fix the id |
| `E_SCHEMA` | A number in quotes, a missing `price` on a stock entry, `kerf` over 10 mm | Follow the hint. Write `3`, not `"3"` |
| `E_LABEL_MISMATCH` | One letter on pieces of different sizes | Give the odd piece its own letter |
| `E_UNKNOWN_KEY` (error) | `price` on the material instead of on each stock entry | Move the price into `stock` |
