# Walkthrough: the pine bookshelf

How the reference project (`examples/pine-bookshelf.json`) went from one request to a guide that builds to zero. Each section is one workflow step from SKILL.md, with the decision and its reason. The last section shows how to apply the changes users ask for most.

## Contents

1. [The request](#1-the-request)
2. [Size and screen](#2-size-and-screen)
3. [Truth first](#3-truth-first)
4. [Design](#4-design)
5. [Steps](#5-steps)
6. [The model](#6-the-model)
7. [Build and read the report](#7-build-and-read-the-report)
8. [Look at it](#8-look-at-it)
9. [Deliver](#9-deliver)
10. [Changes on request](#10-changes-on-request)

## 1. The request

> I want a simple bookshelf for the living room, about 80 cm wide and 90 cm tall. I have never built anything. I have a drill, and a friend can lend me a circular saw.

Three facts decide most of the guide: the size (800 x 900 mm), the level (first time, so `level: "new"`) and the tools (a drill the user has, a saw to borrow).

## 2. Size and screen

- 9 parts and 10 steps: more than 8 steps, so **Standard**. Build it, and say it takes a while.
- Hand-off screen: no gas, no mains wiring, no structural work, nothing above 2 m, no permit, no asbestos and no lead paint (new wood, no old paint to sand). Nothing to hand off. The wall fixing drills the wall: in a building from before 2000, ask about a textured wall coating first, and test it for asbestos before you drill it ([safety.md](../engine/docs/safety.md) section 10).
- Tip-over: 900 mm tall and 241 mm deep (235 + the 6 mm back) is a ratio of 3.7, more than 2. The report gives the same height: it leaves the wall bracket out (ratio 3.73). The guide needs a wall fixing and a WARNING about children. Plan it now, not after the first build fails.

## 3. Truth first

| Fact | Value | Why it matters |
|---|---|---|
| Board | Pine 1x10, actual 19 x 235 mm | `section: [235, 19]`. A part drawn at 25 mm thick fails with `E_SECTION` |
| Board lengths | 2440, 1830 and 1220 mm at the timber yard | The engine picks the cheapest mix: two 2440 boards, each cut into one side and two shelves |
| Back | 6 mm birch plywood; sheets of 2440 x 1220 and 1220 x 1220 mm | One 800 x 900 back fits the smaller sheet |
| Shelf screws | 4 x 50 mm countersunk, three per joint | 2.5 times the 19 mm board, with 31 mm in the shelf |
| Back screws | 3 x 16 mm pan head | Short enough to stay inside a 19 mm part |
| Finish | Water-based wipe-on varnish, 11 m² per L, 2 coats | Litres come from the area, not from a guess |
| Prices | Example US prices with a date | Every rate shows `est`. `priceNote` says to replace them |

## 4. Design

- **Joints:** butt joints with glue and screws. A first-timer can make them with a drill and a countersink bit. The `why` of the first assembly step says so.
- **Shelf positions:** bottom faces at 60, 330, 600 and 881 mm. The 60 mm gap lifts the bottom shelf off the floor. The top shelf is flush with the top ends of the sides.
- **Span:** the shelves are 762 mm between the sides, under the 800 mm limit for a 19 mm pine shelf that carries books.
- **The parts that hold the parts:** the back panel squares the frame, and the anti-tip kit (one bracket on the top shelf, one on the wall, a strap between them) stops a fall.
- **Letters:** sides A, shelves B, back C, shelf bracket D, wall bracket E. Identical parts share a letter, so the reader looks for "two parts A, four parts B".
- **Context:** the wall is a prop. It shows only in the wall-fixing step and in the Plan view, and it never goes in the BOQ.

## 5. Steps

| # | Step | Parts | Why here |
|---|---|---|---|
| 1 | Cut the parts | kit | Every later step needs the parts. Kit pose shows them with letters |
| 2 | Sand the parts | kit | Flat parts are easier to sand than a box |
| 3 | Drill the sides | kit, focus A | Holes in both sides at one height make the shelves level |
| 4 | Attach the bottom shelf | A1, B1 | One side on its back edge, one shelf: easy to clamp |
| 5 | Attach the top shelf | B4 | Side plus two shelves makes a U that can stand |
| 6 | Attach the second side | A2 | The U holds the second side at the right height |
| 7 | Install the middle shelves | B2, B3 | They slide between two fixed sides |
| 8 | Attach the back panel | C1 | Square first; the back then locks it. The frame stands upright with its back to the reader, as the picture shows it. Camera from the back (`az: 205`) |
| 9 | Apply the finish | none | Every face is still easy to reach. `wait` holds the drying time |
| 10 | Attach the shelf to the wall | D1, E1 | Last, in its final place, with the wall prop and a WARNING |

Each step ends with a check that catches the error the next step hides. Step 8 checks that the diagonals are equal within 2 mm before the back locks the shape.

## 6. The model

The positions come from the numbers, never from the eye:

```json
{ "id": "B1", "label": "B", "name": "Shelf", "material": "pine-1x10", "size": [762, 19, 235], "at": [19, 60, 0] }
```

The shelf starts at x = 19, the inner face of side A1, and is 800 - 2 x 19 = 762 long. Its three screws at the left end are one row:

```json
{ "material": "screw-4x50", "at": [0, 69.5, 40], "dir": [1, 0, 0], "repeat": { "count": 3, "step": [0, 0, 77.5] } }
```

The head sits on the outer face of side A1 (x = 0), at the middle of the shelf thickness (60 + 19 / 2 = 69.5). The screw travels +x into the shelf. The back edge is at z = 0 and the front edge at z = 235, so the row runs from 40 mm in front of the back edge to 40 mm behind the front edge: z = 40, 117.5 and 195.

- The anti-tip kit is a material with `role: "anchor"`, so its parts meet the tip-over rule. The measured height leaves them out. The kit screws are `included: true`: listed, not bought. They hold bracket D to the top shelf.
- The wall screws come from the wall type ([safety.md](../engine/docs/safety.md) section 6), not from the kit. Bracket E is 3 mm thick and the plasterboard 12.5 mm, so a 50 mm screw goes 34.5 mm into the stud: 30 mm or more, as section 6 asks. A 30 mm kit screw would go only 14.5 mm into the stud.
- Step 8 sets `view: { "az": 205, "el": 24 }` because its screws go in from the back.
- Step 10 sets `props: ["wall"]` and `view: { "az": 25, "el": 32, "zoom": 5 }` to show the brackets close up.

## 7. Build and read the report

Run `check` after the materials and parts, and again after the steps. Then build with `--strict`. A good report reads 0 errors, 0 warnings and 0 STE findings. Then read it like a buyer:

- Pine: two 2440 boards, each with one side and two shelves (900 + 762 + 762 mm and two 3 mm kerfs). Would you buy these boards? Yes. Is the waste sensible? About 10 mm per board.
- Shelf and wall screws (4 x 50 mm): 26 plus 10% spare fits in one pack of 50.
- Does each count match the object? Four shelves, 24 shelf screws, 2 wall screws, 18 back screws, 2 kit screws: 46.

Typical first-build problems on this project, and the fix in the model:

| Problem | Fix |
|---|---|
| `E_SECTION` on a shelf | It was drawn 25 mm thick. Use 19 |
| `E_GEOMETRY` between B1 and A1 | The shelf started at x = 0. Start it at the side's inner face, x = 19 |
| `E_TIP_OVER` | The anti-tip material had no `role: "anchor"` |
| `W_FASTENER` on a back screw | The head was on the wrong face. Put it on the back face of the panel (z = -6) and point it +z |
| `STE_ING` on a tip | "Sanding the edges first helps." became "Sand the edges first." |

## 8. Look at it

Capture the Plan tab, step 1, every assembly step, Shop, Cut list, phone width (390) and dark theme, and read each PNG. Faults to look for on this project:

- Step 8 with the default camera shows the front, and every back screw is hidden. The fix is `view.az: 205`.
- The brackets in step 10 are too small to read at full-object scale. The fix is `zoom: 5`.
- Step 7 lights both middle shelves, so its text must cover both: "Do the same steps for the last shelf." as its own line.

## 9. Deliver

Give the page path, and the artifact link if the host publishes pages. Then tell the user, in a few lines: Standard size; the total cost with contingency; the work time at First time (1.5 times the experienced time) and the 4 h of drying; prices are estimates; find a stud in the wall before step 10; report 0 / 0 / 0.

## 10. Changes on request

Change the model, then build again. The page, the BOQ and the cut list follow.

| The user says | Change in the model |
|---|---|
| "Make it cheaper" | A cheaper back (3 mm hardboard), oil instead of varnish, borrowed clamps. Never change a price or a count by hand |
| "I only have a hand saw" | The saw tool becomes a hand saw (`power: false`). Replace `cut-straight` with a project card for a hand saw. Raise the cut step's `minutes`. Keep a WARNING about the blade: "Keep your free hand 150 mm from the saw. The teeth can cut your hand." |
| "Give it to me in inches" | Set `units: "in"` and convert every length: 19 mm is 0.75, 235 is 9.25, 800 is 31.5. Use 96 in boards and `kerf: 0.125`. `coverage` becomes ft² per unit |
| "I am in the UK" | `currency: "GBP"`, `tax: { "rate": 0.2, "label": "VAT", "included": true }`, metric stock lengths from the store, the planed size from the label |
| "Make it 1800 mm tall" | More shelves and a second anti-tip point. Check the span and the ratio. The step count may reach Standard's limit of 16 |
| "Add doors" | Hinges as an `each` material, door parts, two more steps. Still Standard. A glass door with lights wired to the mains is a hand-off |
| "I have never used a drill" | Keep `level: "new"`, add `new: true` lines with extra care, and teach `drill-straight` |
