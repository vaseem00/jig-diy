# Verdict

How to read the images, how to rank the faults, and how to write the verdict.

## Contents

1. [How to read an image](#1-how-to-read-an-image)
2. [Fault levels](#2-fault-levels)
3. [The verdict](#3-the-verdict)
4. [An example verdict](#4-an-example-verdict)
5. [What a capture cannot show](#5-what-a-capture-cannot-show)

## 1. How to read an image

- **Open each image.** Look at it at full size. Then answer the checklist questions for that view, one by one.
- **Compare neighbours.** Put step n and step n+1 side by side. The only change must be the parts of step n+1. If the two images look the same, the steps can merge. If two sub-assemblies appear at once, the step must split.
- **Match the lit parts to the step.** The lit parts must be the `parts` of that step, and their letters must match the instructions ("shelf B").
- **Zoom on the rings.** When the rings are small, capture the viewer alone at a larger scale: `--select <css selector of the viewer> --scale 2`. Open the HTML to find the selector.
- **Read the text in the image.** WARNING and CAUTION boxes come before the numbered instructions. The check closes the step.
- **Read the small text in both themes.** Part letters, cut labels, `est` badges and the totals must be clear in light and in dark.

## 2. Fault levels

| Level | Means | Examples |
|---|---|---|
| **BLOCK** | Do not share the page until it is fixed | Report errors; a page built with `--force`; console errors; a page that differs from its project; a power-tool step with no WARNING; tall furniture with no wall fixing; steps for hand-off work; a wrong total |
| **FIX** | The reader can do the wrong thing, or cannot read the page | Rings on the hidden side; a later part shows early; the camera on the wrong side; a label that cannot be read; sideways scroll on a phone; a check that catches nothing |
| **POLISH** | The page is correct but can be clearer | Tight framing; an extra zoom; two steps that look the same |

The verdict is **PASS** when there is no BLOCK and no FIX fault. List the POLISH items under it.

## 3. The verdict

Start with one line, then the table, then the facts:

```
FIX: 4 faults (2 BLOCK, 2 FIX), 1 polish item.

| # | Level | Where | Image | Fault | Fix in the project |
|---|---|---|---|---|---|

Report: error 0, warn 1, ste 0. The page is the same as a fresh build.
Captures: pine-bookshelf/shots/ (20 images). Open step-04.png and shop.png first.
Not checked: keyboard, levels, print, no network.
```

Each fix names the field and the value, so the user or the jig skill can apply it: `steps[3].view = { "az": 270 }`, not "change the camera".

## 4. An example verdict

A pine bookshelf with 10 steps. The images are in `pine-bookshelf/shots/`.

FIX: 4 faults (2 BLOCK, 2 FIX), 1 polish item.

| # | Level | Where | Image | Fault | Fix in the project |
|---|---|---|---|---|---|
| 1 | BLOCK | Step 2 | step-02.png | The sanding step uses the random orbit sander and shows no WARNING. The tool has no `power: true`, so the build did not stop | Set `power: true` on the sander tool, and teach `sand` in step 2 (its card has the dust-mask WARNING) |
| 2 | BLOCK | Shop | shop.png | The glue row shows "price?" and the total leaves it out. The report has `W_PRICE_UNKNOWN` | Give `materials.glue` an estimated `price` |
| 3 | FIX | Step 4 | step-04.png | The three screw rings are on the left face of side A, and the camera shows the right side | Set `steps[3].view` to `{ "az": 270 }` |
| 4 | FIX | Cut list, dark | dark-cut.png | The labels on the walnut board are hard to read on the dark wood colour | Give `materials.walnut` a lighter `color`, for example `#9a6b45` |

Polish: steps 5 and 6 look almost the same in step-05.png and step-06.png. Merge them, or add the two middle shelves in one step.

Report: error 0, warn 1 (`W_PRICE_UNKNOWN`), ste 0. The page is the same as a fresh build.

## 5. What a capture cannot show

These need a person at a browser. Do them yourself when you have a browser you can drive, or list them as not checked:

| Check | How |
|---|---|
| Keyboard | Tab reaches every control. The arrow keys move between tabs. After a step chip, focus moves to the step heading |
| Levels | First time shows the extra lines, technique cards and Why notes. Experienced still shows every WARNING, CAUTION and check |
| Print | The print preview shows every step in order, with no 3D and no step twice |
| No network | With the network off, the text of every tab works, and the viewer says why it is empty |
| Screen reader | The live region reads "Step 4 of 10: ..." after a step change, not the whole card |
