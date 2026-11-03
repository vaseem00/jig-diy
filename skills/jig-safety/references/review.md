# Review

How to review a build for safety: the questions to ask at each step, how to write a finding, and a worked review of a tall bookcase.

## Contents

1. [The questions at each step](#1-the-questions-at-each-step)
2. [The questions for the whole build](#2-the-questions-for-the-whole-build)
3. [How to write a finding](#3-how-to-write-a-finding)
4. [A worked review: the tall bookcase](#4-a-worked-review-the-tall-bookcase)
5. [When the user pushes back](#5-when-the-user-pushes-back)

## 1. The questions at each step

Read the steps in order. For each step, ask:

| Question | Look for | Where the answer is |
|---|---|---|
| **Tool:** does the step use a power tool, a blade, heat or a ladder? | A WARNING before the instructions, in the step or in a technique card it teaches. The tool marked `power: true` | [safety.md](../engine/docs/safety.md) section 4 |
| **Equipment:** what must the reader wear? | Glasses, ear protection, a dust mask, gloves, listed as tools with `ppe: true` in this step | safety.md section 3 |
| **Material:** does the step cut, sand or heat a material with its own hazard? | MDF dust, treated timber, old paint, sheet metal | safety.md section 5 |
| **Finish:** does the step apply a finish? | Gloves, an open window, and the oily-rag WARNING for an oil finish. An item that touches food: a food-safe finish, and no MDF, plywood or treated timber | safety.md section 5 |
| **Wall:** does the step drill a wall or fix to it? | The cable WARNING, the stud or plug, a fixing rated for the load, a screw 30 mm or more into the stud. A TV mount, a wall cabinet or a load above a bed or a seat: studs or masonry only. A load that hangs from the ceiling: bolts or coach screws into a joist or a beam, not plasterboard, not a truss without the truss maker's yes | safety.md section 6 |
| **Load and lift:** is a part heavy, long or overhead? | A helper for more than 20 kg (45 lb), a full sheet, or a part longer than 2.4 m (8 ft) | safety.md section 6 |
| **Person:** does the object carry a person, or will a child use it? | Glued load joints, a top inside the legs, a base as deep as a step stool is tall, a load check at the end. A bench or a seat: "Do not stand on the bench". In a bunk bed: guard rails on four sides and no gap of more than 75 mm, a continuous rail on the wall side, and 5 mm or less at the ends of a guard rail. Lid stays and air holes on a toy box, and a lid stay on any lid that a child can lift. Barriers on a changing table, no small parts and no ball smaller than 45 mm in a toy for a child under 3. A climbing toy: a locked frame, attached ramps, a base as wide as it is tall. A high chair, a safety gate or another product that holds a child under 5: the standard of the country, or a tested product | safety.md sections 6 and 8 |
| **Order:** can the order cause harm? | Unplug before a blade change. Clamp before the cut. Finish before the wall fixing. Fix to the wall before the shelves get loaded. A bought kit or mechanism: its steps in the order of the kit instructions | [method.md](../engine/docs/method.md) section 4 |
| **Hand-off:** does the step touch gas, mains wiring, structure, height, a permit, asbestos or lead paint? | Read the meaning, not only the words: "connect the cable to the switch" is mains work, and so is a new cord, plug, switch or lamp holder on a lamp. A step that `safety.cleared` clears gets the same question | safety.md section 10 |

## 2. The questions for the whole build

- **Tip-over:** divide the height by the depth of the base. More than 2, and 600 mm (24 in) tall or more: it needs a wall fixing. More than 2 and under 600 mm (a lamp, a box): make the base wider or deeper, or put weight in it (`W_TIP_SMALL`). A storage unit taller than 700 mm (27 in) in a home with children: it needs a wall fixing too. A step stool: a base as deep and as wide as it is tall (`tipRatio` 1).
- **Where it stands:** a child's room, a kitchen, outdoors, a rented flat (the wall fixing needs the owner's yes), next to a stove, a fireplace or a heater (the clearance that its maker gives, or 900 mm from a stove with no label), next to a fire pit (the distance that the local fire service gives), above a bed or a seat, a swing or a play frame (clear space of two times the beam height in front and behind, 230 mm of soft fill, ground anchors), a swing on a pergola, a porch beam or a tree (a yes from its maker or an engineer), a heavy load on top such as an aquarium (the weight on the floor, and the load height in the tip ratio).
- **A product with no row:** its hazard classes and the standard of the country ([safety.md](../engine/docs/safety.md) section 1). Did the guide take each safety gap, load limit and clearance from a standard, a maker or safety.md?
- **Who is near:** children or pets in the home: keep them out of the work area, and put tools and finishes away.
- **The building:** its age (asbestos before 2000; lead paint before 1978 in the US, before 1992 in the UK), and the wall type. For old painted furniture, ask when it was painted, before any heat, sand or scrape step.
- **Permits:** decks, fences over the height limit, sheds over the size limit, and any structural or electrical work.
- **Cleared hand-off hits:** the hand-off screen is a safety net, and `safety.cleared` records its false alarms. Read every entry under "Cleared hand-off hits" in the `safety` review: the topic, the `why`, and each text that the entry clears. An entry clears every text of its topic, also a step added later.
  - A text that is hand-off work: STOP. Remove the entry, add the hand-off, and remove the steps for that work.
  - A `why` that does not explain the text: FIX. Write the real reason, or remove the entry and add the hand-off.
  - A lead-paint entry: the `why` gives the age of the paint, from 1978 (US) or 1992 (UK) or later, or a clear lead test. An older or unknown age: STOP.
  - `W_CLEARED_UNUSED`: remove the entry. An entry is never made before the screen finds the topic.
- **The reader:** a first-timer gets no table saw and no work at height. Suggest the store's cut service or a circular saw with a guide.

## 3. How to write a finding

Each finding has four parts: the level, the place, the risk, and the fix.

| Level | Means | Example |
|---|---|---|
| **STOP** | Hand-off work, or a risk of death. Nothing is built until it is fixed | Mains wiring in the steps. A tall unit with no wall fixing in a child's room |
| **FIX** | A missing or wrong safety item that the build needs | A power-tool step with no WARNING. No gloves for the finish |
| **NOTE** | A better way that lowers a risk | Ask the store to cut the sheets |

Write the fix as the reader's text and, for a project, as the field to add:

```json
{ "type": "warning", "text": "Wear safety glasses. The saw can throw chips into your eyes." }
{ "type": "warning", "text": "Wear ear protection. A loud saw can hurt your ears." }
```

Give one hazard in each WARNING. Two hazards make two WARNINGs ([safety.md](../engine/docs/safety.md) section 2).

Check each new WARNING and CAUTION with `lint --kind warning` before you deliver it.

## 4. A worked review: the tall bookcase

The project is `evals/files/tall-bookcase/project.json`: a plywood bookcase, 1800 mm tall and 286 mm deep with its back, for a child's bedroom, with a light under the top shelf. It has 9 steps, so it is Standard.

**Screen.** The main job is a bookcase: not hand-off work. But step 9 says "Connect the cable to the terminals of the light switch". That is mains wiring. The engine's screen does not find it, because the text does not name the mains. The meaning does.

**Engine.** `safety` reports four errors:

| Code | Where | Message |
|---|---|---|
| `E_POWER_NO_WARNING` | step 1 | The step uses the power tool "Circular saw", but it has no WARNING |
| `E_POWER_NO_WARNING` | step 7 | The step uses the power tool "Cordless drill", but it has no WARNING |
| `E_POWER_NO_WARNING` | step 9 | The step uses the power tool "Cordless drill", but it has no WARNING |
| `E_TIP_OVER` | project | 1800 mm tall and 286 mm deep: ratio 6.29, limit 2. Nothing anchors it to a wall |

Its summary lists glasses and a dust mask as equipment, and notes for the saw (ear protection), the drill, the sander and the oil (rags).

**Findings.**

| # | Level | Where | Risk | Fix |
|---|---|---|---|---|
| 1 | STOP | Step 9 | The light connects to the mains at the switch: mains wiring by an amateur can kill | Remove instructions 2 and 3 of step 9. Add `{ "topic": "mains", "text": "A licensed electrician connects the light to the mains." }` to `handoff`, and a WARNING: "Do not connect the light to the mains. A licensed electrician makes all mains connections." Or use a plug-in LED light |
| 2 | STOP | Whole build | Ratio 6.29 in a child's bedroom: a bookcase that falls can kill a child | Add an anti-tip strap material with `role: "anchor"`, and a last step that attaches the top shelf to a stud, with the WARNING "Attach the bookcase to the wall. A bookcase that falls can kill a child." |
| 3 | FIX | Step 1 | The circular saw has no WARNING | Teach `cut-straight`: its card gives the glasses, ear-protection, hands, stance, kickback and blade-guard WARNINGs, one hazard in each. Add safety glasses and ear protection as tools with `ppe: true` |
| 4 | FIX | Steps 7 and 9 | The drill has no WARNING | Teach `pilot-hole`, or add "Wear safety glasses. The bit can throw chips into your eyes." |
| 5 | FIX | Step 8 | The Danish oil step has no gloves and no rag WARNING | Add nitrile gloves with `ppe: true`, teach `finish-wipe`, or add "Put used rags flat outdoors to dry, or in a closed metal can of water. Oily rags can catch fire." |
| 6 | NOTE | Step 1 | Full 18 mm plywood sheets weigh about 30 kg | Ask a helper to lift each sheet, or ask the store to cut the sheets to the cut list |

**Site checks to tell the user.** The wall type behind the bookcase, and a stud near the top. Cables near the light switch and near the sockets in the room.

**After the fixes.** `safety` reports 0 errors. Step 9 holds only the light fixing under the shelf, and the hand-off names the electrician.

## 5. When the user pushes back

- **"I've done wiring before."** Say that this pack writes no mains, gas or structural steps for anyone, and that the rules exist because a fault can kill someone later. Offer the electrician questions and the safe parts.
- **"It's only 1.5 m, it won't tip."** Give the number: a 1500 mm unit that is 300 mm deep has a ratio of 5. A child who climbs the shelves moves the centre of weight forward.
- **"I can't drill into a rented wall."** Ask the owner. Suggest a lower unit, or a wider base: a unit that is 600 mm tall and 300 mm deep has a ratio of 2.
- **"Skip the warnings, I'm experienced."** Keep them. The level switch hides Why notes and tips for an experienced reader, but never a WARNING.
