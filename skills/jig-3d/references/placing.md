# Placing parts, fasteners and the camera

How to give every part, screw and step of a 3D build a true position, so the picture matches the object to the millimetre. [engine/docs/format.md](../engine/docs/format.md) defines each field. This file says how to choose the numbers.

## Contents

1. [Coordinates](#1-coordinates)
2. [Place each part from a neighbour](#2-place-each-part-from-a-neighbour)
3. [Joints that overlap on purpose](#3-joints-that-overlap-on-purpose)
4. [Fasteners](#4-fasteners)
5. [Round and turned parts](#5-round-and-turned-parts)
6. [Props](#6-props)
7. [Steps for the picture](#7-steps-for-the-picture)
8. [Camera and paths](#8-camera-and-paths)
9. [Geometry problems and fixes](#9-geometry-problems-and-fixes)
10. [Look at every step](#10-look-at-every-step)

## 1. Coordinates

- x to the right, y up, z toward the viewer. The floor is y = 0.
- `at` is the minimum corner of the part's box: the left, bottom, back corner. The box covers `at` to `at + size`.
- `size` is `[x, y, z]` as the part stands in the finished object. A side that stands up is `[19, 900, 235]`. A shelf that lies flat is `[762, 19, 235]`.
- All lengths use the project `units`. In an `in` project, write 3/4 in as `0.75`.

## 2. Place each part from a neighbour

Start with the part on the floor. Give every other part an `at` that comes from a part already placed, never from the eye.

| The part | Its `at` |
|---|---|
| Stands on the floor | y = 0 |
| Sits on top of P | y = P.y + P.height |
| Touches the right face of P | x = P.x + P.width |
| Touches the left face of P | x = P.x - its width |
| Touches the front of P | z = P.z + P.depth |
| Touches the back of P (a back panel) | z = P.z - its depth |
| Fills the gap between sides L and R | x = L.x + L.width, and its length = R.x - (L.x + L.width) |
| Flush with the top of P | y = P.y + P.height - its height |
| Centred in the depth of P | z = P.z + (P.depth - its depth) / 2 |

Example, a bench: the legs are 412 mm tall, so the top sits at y = 412. The rail is 89 mm high and flush with the leg tops, so it sits at y = 412 - 89 = 323. Section 14.2 of format.md has the whole project.

For more than about 20 parts, write `project.mjs` with named constants (`const T = 19, W = 800;`) so each position reads as arithmetic. Write `project.json` when the numbers are few.

## 3. Joints that overlap on purpose

A shelf in a dado, a tenon in a mortise and a halving joint really overlap. List the other part in `joins` on one of the two parts: `"joins": ["A1"]`. Any other overlap of more than 1 mm is error `E_GEOMETRY`, because two solid parts cannot share space.

## 4. Fasteners

A screw has a head position `at` and a direction `dir`:

- Put `at` on the face where the screw goes in. A screw through side A1 (x from 0 to 19) into a shelf has `at.x = 0` and `dir: [1, 0, 0]`.
- The tip is `at + dir x len`. It must end inside a part. A 50 mm screw from x = 0 ends at x = 50, inside the shelf that starts at x = 19.
- Use axis directions: `[1, 0, 0]`, `[-1, 0, 0]`, `[0, -1, 0]` (down), `[0, 0, 1]` (toward the front). Use `[1, -1, 0]` and the like only for a screw that really goes in at an angle, such as a pocket screw.
- Put a row in one fastener with `repeat: { "count": 3, "step": [0, 0, 77.5] }`. The first screw counts as one of the three.
- Keep screws 20 to 40 mm from an edge, so the ring sits on the face and the reader sees where to drill.
- A screw into a wall ends inside the wall prop.
- Give every screw the reader drives a position. A counted fastener (`count` with no `at`) is not drawn, and the check warns.

## 5. Round and turned parts

- `shape: "cylinder"`: two equal sides of `size` are the diameter, the third is the length. A dowel 25 mm thick and 600 mm long that stands up is `[25, 600, 25]`. Its material has `profile: "round"` and `section: [25, 25]`.
- `rotate: [rx, ry, rz]` turns the part in degrees about its box centre, x first, then y, then z. Place the part as if it were not turned, then turn it. A brace at 45° is `"rotate": [0, 0, 45]`.
- The checks use the turned box's axis-aligned bounds. A turned brace can look like it overlaps the frame. If it really touches only at its ends, list the frame parts in its `joins`.

## 6. Props

A prop is a box that gives context and is never bought: a wall, a bench, a floor area, a radiator.

- Show a prop only in the steps that need it (`props: ["wall"]`). It also shows in the Plan view unless `hero: false`.
- Put a wall behind the object: its front face at the object's back face, or a few millimetres behind it.
- A part fixed to a wall (a bracket, a cleat) touches the wall prop, so it does not float.

## 7. Steps for the picture

- **One visible change.** If two steps look the same, merge them. If a step adds two sub-assemblies, split it.
- **1 to 4 new parts per step**, and the screws that fix them.
- **The order a person can do.** The first assembly step starts from a part that stands or lies on the floor. Each later part touches a part already installed.
- **Every part once.** Each part is in the `parts` of exactly one step.
- **A parts page first.** A first step with `pose: "kit"` and `cuts: true` lays every cut part flat with its letter, like the parts page of a flat-pack manual. `focus` lights the parts the step works on.

## 8. Camera and paths

The camera must show the face where the work happens. Set `view` on a step when it does not.

| The work | `view` |
|---|---|
| Screws from the sides or the front | `{ "az": 30, "el": 25 }` |
| The right side | `{ "az": 90, "el": 20 }` |
| A back panel or screws from the back | `{ "az": 200, "el": 25 }` |
| Screws from above | `{ "az": 20, "el": 55 }` |
| Inside a box | `{ "az": 15, "el": 15, "zoom": 1.4 }` |
| Small hardware: hinges, brackets | add `"zoom": 1.5` to 2. The zoom stops when all the parts of the step are in the view. For two parts that are far apart, use one step for each part |
| The underside: feet, casters | The 3D cannot look from below: an `el` below about 1 is held at the horizon. Use `{ "az": 30, "el": 5, "zoom": 1.5 }` to look along the floor, and say in the text which face the screws go into |

`el` is 1 to 89. The viewer holds a lower value at the horizon, so a negative `el` shows about the same picture as `"el": 1`.

The 3D always shows the object upright, with each part in its final place. It cannot turn the object on its back or on its side. Write each step so that the text agrees with the picture: "Stand the frame upright with the back toward you" for a back panel, not "Put the frame on the floor with the front face down". If the work must happen with the object lying down, say so in the text, and set the step's `view.note`: `"view": { "az": 205, "el": 26, "note": "The picture shows the cube upright, from the back." }`. The note shows under the 3D view at every level, and never in print or `plan.md`. Never mention the picture in `do`, `check`, `why` or `tip`.

New parts arrive from outside the model. Set `from` when the real path is different. The values below are for a `mm` project; in an `in` project, use about 12 in for 300 mm.

| Real movement | `from` |
|---|---|
| A top drops onto a frame | `[0, 300, 0]` |
| A drawer slides in from the front | `[0, 0, 400]` |
| A shelf slides in between two sides | `[0, 0, 300]` |
| A back panel comes from behind | `[0, 0, -300]` |
| A side comes from the right | `[300, 0, 0]` |

Keep one scale across the assembly steps. Use `zoom` only where small parts need it.

## 9. Geometry problems and fixes

| Problem | What the reader would see | Fix |
|---|---|---|
| `E_GEOMETRY` | Two parts in one space | Recompute `at` from the neighbour (section 2), or add `joins` for a real joint |
| `W_FLOATING` | A part in the air | Fix `at`, or add the wall or bench it hangs on as a prop |
| `W_FASTENER` | A ring in the air, or a screw tip that comes out of the wood | Put `at` on the entry face and point `dir` into the part. Use a shorter `len` |
| `W_COUNTED_FASTENER` | Screws in the text but not in the picture | Give `at` and `dir`, with `repeat` for a row |
| `E_TIP_OVER` | A shallow object 600 mm (24 in) tall or more with no wall fixing | Add an anchor part (`role: "anchor"`), the wall prop and a fixing step with a WARNING. A step stool or a climbing toy (`safety.tipRatio` 1): make the base larger. Do not anchor it |

## 10. Look at every step

Capture each step by its hash (`#build/1`, `#build/2` and so on) and read every PNG. At each step, ask:

- Are this step's parts lit, lettered and in their final place?
- Is nothing from a later step visible?
- Do the rings sit on the screw heads, on the face the reader drills?
- Is the camera on the side of the work, with the whole object or the work area in frame?
- Does the arrival path match how a person really moves the part?

Capture one step at phone width (390) and one in dark theme too. With `--reduced-motion`, parts appear in place with no fly-in.
