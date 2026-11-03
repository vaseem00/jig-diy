# Safety

What can hurt the reader or damage the work, what to wear, how to write a WARNING and a CAUTION, when an object must be attached to the wall, and which work this pack leaves to a professional. The engine checks four rules (`safety`). The rest is your review.

## Contents

1. [What the engine checks](#1-what-the-engine-checks)
2. [WARNING and CAUTION](#2-warning-and-caution)
3. [Protective equipment](#3-protective-equipment)
4. [Hazards by tool](#4-hazards-by-tool)
5. [Hazards by material and finish](#5-hazards-by-material-and-finish)
6. [Walls, loads and lifting](#6-walls-loads-and-lifting)
7. [Tip-over](#7-tip-over)
8. [Children](#8-children)
9. [Outdoor builds](#9-outdoor-builds)
10. [Hand-off](#10-hand-off)
11. [The words the hand-off screen finds](#11-the-words-the-hand-off-screen-finds)

## 1. What the engine checks

`safety <project>` runs in plan mode: the project needs steps, and each part installed in one step. `check` and `build` run the same rules.

| Code | Rule | Fix |
|---|---|---|
| `E_POWER_NO_WARNING` | A step uses a tool with `power: true` and has no WARNING, in the step or in a technique card it teaches. A CAUTION does not count | Add a WARNING before the instructions (section 4) |
| `E_TIP_OVER` | The object is 600 mm (24 in) tall or more, its height divided by base depth is more than `safety.tipRatio` (default 2), and no part, material or fastener has `role: "anchor"` | Add the wall fixing and its step (section 7). A step stool or a climbing toy (`safety.tipRatio` 1): make the base larger. Do not anchor it |
| `E_HANDOFF` | A reader text names a hand-off topic, and `handoff` has no entry for it | Add the entry, and remove any steps for that work (section 10). If the text is not that work, see section 11 |
| `W_TIP_SMALL` (warning) | The same ratio rule for an object under 600 mm (24 in) tall, such as a lamp or a box | Make the base wider or deeper, or put weight in the base (section 7). A wall fixing is for furniture 600 mm (24 in) tall or more |
| `W_CLEARED_UNUSED` (warning) | A `safety.cleared` entry clears nothing: the screen finds no text of its topic, `handoff` names the topic, or an earlier entry clears the topic | Remove the entry (section 11). `--strict` stops on this warning |
| `I_TIP_UNCHECKED` (info) | Plan mode: a part has no position (`at`), so the tip-over rule cannot run, and nothing has `role: "anchor"` | Work out the ratio by hand (below). If it is more than the limit and the object is 600 mm (24 in) tall or more, add the wall fixing and its step. If the object is smaller, make the base wider or deeper. Or give every part an `at` |
| `I_OLD_PAINT` (info) | A reader text strips, sands, scrapes, heats, burns or removes old paint ("Sand the old paint"), or names old paint with a heat gun, a scraper, a sander or a stripper ("the old paint with a heat gun"), and no `lead-paint` hand-off or `safety.cleared` entry covers it | Ask how old the paint is. Paint from before 1978 (US) or 1992 (UK) can contain lead: then add the `lead-paint` hand-off (section 10). Newer paint: record its age in `safety.cleared` (section 11) |
| `I_HANDOFF_CLEARED` (info) | A `safety.cleared` entry clears the hits of its topic. One info for each topic, at the first text | Make sure that the guide has no work of that topic. If it has, remove the entry and add the hand-off (section 11) |

The summary lists the tip result (`height`, `depth`, `ratio`, `limit`, `anchored`), the tools with `ppe: true`, the tools with `power: true`, the hand-offs, and protective-equipment notes found from the tools, the materials and the finishes.

What the engine cannot see:

- **Tip-over without positions.** The tip check needs `at` on every part. A plan-only project has no positions, so `tip` is empty, and the engine gives the info `I_TIP_UNCHECKED` (0 errors does not mean "checked"). Work out the ratio by hand: the height of the object divided by the depth of its base.
- **Work the text does not name.** The hand-off screen reads words. "Connect the new light" passes the screen, but it is mains work. Read each step for its meaning. The screen also gives false alarms (section 11).
- **Hazards with no rule.** A heavy sheet, a hidden cable, an oily rag, a toy-box lid, a gap in a bunk-bed rail, a TV mount on plasterboard, wood next to a stove, a heavy load on top (such as an aquarium), a load that hangs from the ceiling, a swing, a finish on an item that touches food. Use sections 3 to 10. If no row names the product, use the hazard classes below. Old paint gets only the info `I_OLD_PAINT`, and only when the text works on "old paint" (strips, sands, scrapes, heats, burns or removes it, or names it with a heat gun, a scraper, a sander or a stripper): ask the age of any painted item.

**A product with no row.** The rows in sections 3 to 10 name many products, but not all of them. If no row in this file names the product, use the classes.

- Find each hazard class of the product in the table below.
- Read the section for each class.
- Find the safety standard of the country for the product.
- Give the name of the standard in the reply.
- Use the standard and the instructions of the maker of each bought part.
- Do not give a safety gap, a load limit or a clearance from memory.
- Get each one from a standard, from a maker or from this file.
- If the build cannot meet the standard, do not write the guide.
- Give the user the name of a tested product or a professional.
- If you find no standard, write that in the reply.

| Class | Examples | Section |
|---|---|---|
| A child uses it, sits in it, sleeps in it or plays on it | A high chair, a safety gate, a toddler bed, a toy box, a toy | 8 |
| It carries a person, or holds a person off the ground | A step stool, a bench, a bed, a ladder, a platform, a raised play deck | 6, and 8 for a child, 9 for a deck |
| It hangs from a ceiling, a beam or a frame, or holds a load above a person | A rack, a swing, a hammock, a wall cabinet | 6 and 9 |
| It stands near heat | A log holder, a bench or a shelf next to a stove, a fireplace, a fire pit, a heater or a sauna heater | 5 and 9 |
| It touches food, or holds water or a heavy load on top | A cutting board, a bowl, an aquarium stand | 5 for food, 6 for the load |
| An animal lives in it, stands on it or chews it | A hutch, a coop, a kennel, a pet ramp | 9 |
| It has a lid, a door, a flap, a spring or a bought mechanism | A storage bench, a sandpit lid, a wall bed | 8 and 6 |
| It stands outdoors | A planter, a fence, a deck, a swing frame, a shed | 9 |
| It has lights, a heater, a motor or another electric part | A headboard with lights, a lit display cabinet, a sauna heater | 10: mains work is a hand-off. A plug-in 12 V kit or battery lights are not |

## 2. WARNING and CAUTION

| | WARNING | CAUTION |
|---|---|---|
| Risk | Injury or death | Damage to the work, a tool or the building |
| Example | Wear safety glasses. The bit can throw chips into your eyes. | Put a scrap block under the part. The bit can split the back face. |
| In a project | `{ "type": "warning", "text": "..." }` | `{ "type": "caution", "text": "..." }` |

Form:

- **Command first, then the risk.** The first sentence says what to do. The next sentence says what can happen. Write 20 words or fewer in each sentence.
- **One hazard in each warning.** Two hazards make two warnings.
- **"Do not" for a prohibition.** Write "Do not touch the blade", not "Never touch the blade" or "Avoid the blade".
- **Name the real risk.** Write "The blade can cut your fingers", not "This is dangerous".

Placement:

- Put each WARNING and CAUTION before the instructions it covers: in the step's `warn`, or in a technique card the step teaches.
- Repeat the warning in every step that has the hazard. Do not rely on a warning in an earlier step.
- Put a hand-off WARNING on the first step that comes near the work, and say the same at the start of the plan.
- Safety never depends on level. Warnings show at every level.

Product safety signs (ANSI Z535, ISO 3864) use CAUTION for a minor injury. In this pack, as in STE, a CAUTION is damage only: any risk of injury is a WARNING. The engine knows only the two types `warning` and `caution`.

| Do not write | Write |
|---|---|
| Be careful with the saw! | WARNING: Keep your hands 150 mm from the blade. The blade can cut your fingers. |
| Wear gloves when you apply the finish. | WARNING: Wear gloves. The finish can burn your skin. |
| Caution: hot! | WARNING: Do not touch the tip of the iron. The tip is hotter than 300 °C. |
| Note: the board may split. | CAUTION: Drill a pilot hole near the end. The wood can split. |

## 3. Protective equipment

| Equipment | When | Specification |
|---|---|---|
| Safety glasses | Every power tool, hammer, chisel, wire cutters, and any drill work above the head | Marked EN 166 (Europe, UK) or ANSI Z87.1 (US) |
| Face shield | Angle grinder, lathe | Over safety glasses |
| Ear protection | Saws, routers, planers, sanders, grinders, nail guns, impact drivers | Most of these tools are louder than 85 dB |
| Dust mask | Sanding, sawing MDF, cutting treated timber, sweeping dust | FFP2 (Europe, UK) or N95 (US) at least. FFP3 or P100 for a long job in a small room |
| Respirator | Spray finishes and solvent products in a room without moving air | Half mask with organic vapour filters: type A (Europe, UK), OV (US) |
| Nitrile gloves | Finishes, stains, glue, epoxy, wet cement | Disposable, chemical resistant |
| Work gloves | Rough timber, sheet metal, glass, carrying sheets | Cut resistant for metal and glass |
| Closed shoes | Every build | Safety boots for heavy sheets, slabs and posts |

- **No gloves at a spinning tool.** Do not wear gloves at a drill press, a lathe or a table saw. A glove can catch and pull the hand in.
- Tie back long hair. Remove loose sleeves, rings and chains near a spinning tool.
- In a project, give each item of equipment a tool entry with `ppe: true`, and list it in the steps that need it. The BOQ puts it in the Safety group.

**Children and pets in the home.** The work area is a hazard too, not only the finished object:

- "WARNING: Keep children and pets out of the work area. A child can touch a blade, a hot tool or wet finish."
- "WARNING: When you stop work, remove the battery from each tool. A child can start a tool." Unplug a corded tool.
- Put screws, blades and finishes out of reach when you stop work.

## 4. Hazards by tool

Each WARNING passes the linter as `warning`. Copy it into the step, or into a technique card the step teaches.

| Tool | Hazard | WARNING |
|---|---|---|
| Circular saw | Kickback | Support the board so that the cut stays open. A cut that closes on the blade makes the saw jump back toward you. |
| Circular saw (hands) | Blade contact | Keep your hands 150 mm from the blade. The blade can cut your fingers. |
| Circular saw (guard) | Blade below the board after the cut | Do not lock or remove the lower blade guard. The guard covers the blade after the cut. |
| Circular saw (stance) | Kickback | Stand to the side of the saw line. A saw that jumps back can hit you. |
| Circular saw (blade change) | Start by accident | Remove the battery before you change the blade. A saw that starts can cut you. |
| Jigsaw | Blade under the work | Keep your hand away from the area under the board. The blade comes out below the board. |
| Mitre saw | Hand near the blade | Clamp short parts to the fence. A hand on a short part is too near the blade. |
| Table saw | Kickback, hand pulled in | Use a push stick for a cut less than 150 mm wide. The blade can pull your hand in. |
| Router | Bit pulls the tool | Hold the router with two hands. The bit can pull the router along the edge. |
| Drill, driver | Bit catches and turns the part | Clamp small parts before you drill. A bit that catches can turn the part and your wrist. |
| Angle grinder | Broken disc, sparks | Keep the guard on the grinder. A broken disc can hit your face. |
| Sander | Fine dust | Wear a dust mask. Fine dust can hurt your lungs. |
| Nail gun | Nail through a hand | Keep your free hand 300 mm from the nail line. A nail can come out of the side of the wood. |
| Chisel | Slip | Keep the two hands behind the cutting edge. The chisel can slip and cut you. |
| Utility knife | Slip | Cut away from your body. The knife can slip. |
| Hammer | Nail flies out | Wear safety glasses. A nail can fly out of the wood. |
| Soldering iron | Burns, fumes | Put the hot iron in its stand. The tip is hotter than 300 °C. |
| Hot glue gun | Burns | Do not touch the nozzle or the hot glue. Hot glue can burn your skin. |
| Heat gun | Burns, fire. Lead fumes from old paint (section 10) | Put the hot heat gun on its stand. The nozzle can burn you and set wood dust on fire. |
| Ladder, step ladder | Fall | Keep three points of contact with the ladder. A fall from a ladder can cause a bad injury. |
| Ladder, step ladder (top step) | Tip | Do not stand on the top step of a step ladder. The ladder can tip. |
| Step stool (in use) | Fall, tip | Stand in the middle of the step. A foot on the edge can tip the stool. |
| Bench, chair (in use) | Tip | Do not stand on the bench. The bench can tip. |
| Power tool outdoors | Shock | Connect the tool through an RCD (GFCI). A damaged cable on wet ground can kill. |

- Give each power tool `power: true` in the project. The engine then asks for a WARNING in each step that uses it.
- A first-time reader with no table saw: use a circular saw with a guide, or the store's cut service. Do not teach a table saw in a first-time guide.
- Unplug a corded tool, or remove the battery, before you change a blade or a bit.

## 5. Hazards by material and finish

| Material | Hazard | Text |
|---|---|---|
| Wood dust, MDF dust | Lungs. Wood dust can cause cancer (IARC group 1) | WARNING: Wear a dust mask. Wood dust can cause cancer. |
| Treated timber | Chemicals in the dust and the smoke | WARNING: Wear gloves. The chemicals in treated timber can hurt your skin. WARNING: Wear a dust mask. The dust from treated timber can hurt your lungs. WARNING: Do not burn the offcuts. The smoke from treated timber is toxic. |
| Old railway sleepers | Creosote | Do not use them in a bed that grows food or where children play |
| Solvent finish (oil-based varnish, lacquer, spirits) | Fumes, fire, skin | WARNING: Open a window. Solvent fumes can make you ill. WARNING: Keep flames and sparks away. Solvent fumes can catch fire. WARNING: Wear nitrile gloves. A solvent finish can hurt your skin. |
| Oil finish (linseed, tung, Danish oil, hardwax oil) | Oily rags heat up and catch fire | WARNING: Put used rags flat outdoors to dry, or in a closed metal can of water. Oily rags can catch fire. |
| Spray paint | Fumes, spray in the air | WARNING: Spray outdoors, or wear a respirator with organic vapour filters. The mist can hurt your lungs. |
| Epoxy | Skin allergy | WARNING: Wear nitrile gloves. Wet epoxy can cause a skin allergy. |
| Contact adhesive | Fire | WARNING: Keep flames and sparks away. The fumes can catch fire. |
| Wet cement, concrete, mortar | Alkaline burns | WARNING: Wear gloves. Wet cement can burn your skin. WARNING: Wear safety glasses. Wet cement can burn your eyes. |
| Sheet metal | Cut edges | WARNING: Remove the sharp edges with a file. A cut edge can cut your hand. |
| Water-based finish | Low. Still mist and smell | Open a window. Wear gloves |
| Paint stripper | Fumes, skin burns | Use a stripper with no dichloromethane (methylene chloride). On old paint, see lead paint in section 10. WARNING: Wear nitrile gloves. Stripper can burn your skin. WARNING: Wear safety glasses. Stripper can burn your eyes. WARNING: Open a window. Stripper fumes can make you ill. |
| Items that touch food (cutting board, bowl, spoon) | Finish and wood in contact with food | Use a finish that the maker labels safe for food contact, or food-grade mineral oil. Let it cure for the full time on the can. Use a close-grain hardwood such as maple or beech. Do not use MDF, plywood or treated timber |

**Wood near heat.** Keep wood items and finishes out of the clearance that the maker of the heat source gives. This is on the stove label, or in the manual of a heater or a sauna heater. If a stove has no label, keep them 900 mm (36 in) from the stove. Use a finish that its maker rates for the heat. Do not put a log holder on the hearth in front of the stove door. Put this WARNING on the step that puts the item in its place, with the label clearance when it is larger: "WARNING: Keep the log holder 900 mm or more from the stove. A hot stove can set wood on fire."

Common CAUTIONs (damage):

| Damage | CAUTION |
|---|---|
| Split near an end | Drill a pilot hole near the end. The wood can split. |
| Split back face | Put a scrap block under the part. The bit can split the back face. |
| Starved glue joint | Do not tighten the clamp too much. Too much force pushes out all the glue. |
| Scratches under the finish | Do not sand across the grain. Cross scratches show through the finish. |
| Screw through the face | Use screws 6 mm shorter than the two parts together. A long screw comes out of the face. |
| Glue stains | Remove wet glue with a damp cloth. Dry glue stops the stain. |

## 6. Walls, loads and lifting

**Cables and pipes in walls.** Before you drill a wall:

- Cables often run straight up, down or across from a socket or a switch, and within 150 mm (6 in) of a ceiling or a corner.
- Use a cable and pipe detector. A detector can miss a cable, so drill only as deep as the fixing needs.
- WARNING: Do not drill above, below or beside a socket or a switch. Cables run there.

**Fixings.** Match the fixing to the wall and the load:

| Wall or load | Fixing | Note |
|---|---|---|
| Wood studs | Wood screw into the centre of the stud, 30 mm (1 1/4 in) or more into the wood | Studs are at 400 or 600 mm centres (16 or 24 in). The `find-stud` card teaches it. Add the thickness of the plasterboard and the bracket to the screw length |
| Masonry, concrete | Masonry bit, wall plug and screw sized for the plug | Use the hammer setting only in masonry |
| Plasterboard (drywall) only | Hollow-wall anchor rated for the load | Light loads only: pictures, a small shelf with light items. Not for a TV mount, a wall cabinet, an anti-tip strap, or anything above a bed or a seat |
| Metal studs | Toggle anchor or a screw for metal studs | |
| TV mount, wall cabinet, heavy mirror, a fold-down desk or a seat on wall brackets, or any load above a bed, a sofa or a seat | Wood studs or masonry only, with the screws and the method that the mount or bracket maker gives. Do not use hollow-wall anchors in plasterboard alone | A tilting or arm mount pulls the top screws out of the wall. For a desk or a seat, use brackets that the maker rates for the weight of a person who leans on them. Nothing above a cot (below) |
| Ceiling: storage rack, hammock or swing hook, hanging chair | Bolts or coach screws into the centre of a ceiling joist or a beam. Use the size and the load limit that the rack or hook maker gives. Do not attach a load to plasterboard alone. Do not attach a load to a roof truss without a yes from the truss maker or an engineer | A load that hangs pulls the screws out of the wood. A person who swings adds more load |

**Loads.** Use brackets and fixings with a rated load above the real load. A 19 mm pine shelf with books sags past about 800 mm span. [method.md](method.md) section 3 has the spans.

- Do not put a shelf above the head of a bed, a cot or a seat. Suggest another wall. If the user still wants one above a bed or a seat (never above a cot), keep it to light, soft items, fix it to studs or masonry, and put this WARNING on the step that installs it: "WARNING: Put only light, soft items on this shelf. Items that fall can hurt a person in the bed."
- For a TV mount, put this WARNING on the step that attaches it: "WARNING: Attach the TV mount to wood studs or to masonry. A TV that falls can kill a child."
- For a rack that hangs from the ceiling, put this WARNING on the step that loads it: "WARNING: Do not put more load on the rack than the maker's limit. A rack that falls can hurt a person below it." Tell the reader to keep people and cars out from under a rack while they load it.
- For a hook that holds a person (a hammock, a swing, a hanging chair), put this WARNING on the step that attaches it: "WARNING: Attach the hook to the centre of a joist or a beam. A hook that pulls out can drop a person."

**Heavy loads on furniture.** A full aquarium, a water container or a stack of books can weigh more than the furniture that holds it.

- A full aquarium weighs about 1.2 kg for each litre (10 lb for each US gallon). Follow the rules of the tank maker for the stand.
- Support the top at each corner and along each edge, and put the stand on a solid, level floor.
- The tip check of the engine does not count a load on top of the object, such as an aquarium. Add the height of the load to the height of the object, and work out the ratio by hand (section 7).
- Connect pumps, heaters and lights near water through an RCD (GFCI). Let each cable hang in a loop below the socket, so that water drips off before it gets to the plug.
- On the step that puts the stand in its place, give the weight of the full tank: "WARNING: Put the stand on a solid, level floor. A full 200 L tank weighs about 240 kg. It can break a weak floor."

**Furniture that carries a person** (step stools, benches, seats, ladders, platforms, beds and bunk beds). The full weight of a person, and more when they step up, goes through a few joints:

- Carry the load in glued joints with long-grain contact, or on a rail or a cleat under the top. Screws into end grain alone can pull out. In a bed frame, bolt or glue each joint.
- Keep the step or the seat inside the footprint of the legs, with little or no overhang. Weight on an overhang outside the legs can tip the stool.
- Make the base of a step stool at least as deep and as wide as the top step is high, or splay the legs so that the base is larger than the top. The tip limit of 2 in section 7 is for furniture against a wall, not for a thing a person stands on.
- In a project for a step stool, set `safety.tipRatio` to 1, so that the engine checks the base: `W_TIP_SMALL` under 600 mm (24 in); from 600 mm, `E_TIP_OVER`. Make the base larger. Do not attach a stool to a wall.
- Brace a stool or a bench against racking with a rail or a stretcher between the legs.
- Put this WARNING on the step that attaches the top of a step stool: "WARNING: Stand in the middle of the top. A foot on the overhang can tip the stool." A bench or a seat is not a step. Give it "WARNING: Do not stand on the bench. The bench can tip."
- End the last build step with the check "Put your full weight on the stool slowly. Make sure that no joint moves." For a bench: "Put your full weight on the bench slowly. Make sure that no joint moves."
- The engine has no rule for the load on the joints or the overhang. Read them yourself. A bunk or loft bed has more rules (section 8).

**Bought kits and mechanisms** (a wall-bed lift, a gas-spring flap, a swing kit, a burner kit). A bought part has its own rules:

- Do the steps of a bought kit or mechanism in the order of its instructions.
- Copy each safety instruction of the kit maker into the step that has the hazard.
- Do not open or adjust a gas spring or a coil spring that the maker seals. A gas spring or a coil spring keeps a large force.
- Put this WARNING on the first step of the kit, for example a wall-bed lift: "WARNING: Do the steps of the lift kit in the order of its instructions. A spring that releases can push the bed open."

**Lifting.** Lift with a helper when a part weighs more than 20 kg (45 lb), is longer than 2.4 m (8 ft), or is a full sheet. A full 2440 x 1220 x 18 mm MDF sheet weighs about 40 kg. The same sheet of plywood weighs about 30 kg.

## 7. Tip-over

- **The engine rule:** if the height divided by the depth of the base is more than `safety.tipRatio` (default 2), an object 600 mm (24 in) tall or more needs a wall fixing. Without one, the build stops with `E_TIP_OVER`. For a step stool or a climbing toy, set `safety.tipRatio` to 1 and make the base larger (sections 6 and 8).
- **A small object:** under 600 mm, the same ratio gives the warning `W_TIP_SMALL`, not an error. A lamp or a box does not go on a wall: make the base wider or deeper, or put weight in the base, until the ratio is at the limit or below.
- **The rule for a home with children:** attach any storage unit taller than 700 mm (27 in) to the wall, whatever the ratio. A chest of drawers with its drawers open tips more easily than its ratio shows.
- **The fixing:** an anti-tip strap or bracket near the top, screwed into a stud or into masonry with a plug. Do not use plasterboard alone.
- **In the project:** give the strap (a part, or its material) `role: "anchor"`. Add a step that attaches it, after the finish.
- **The WARNING on that step:** "Attach the bookcase to the wall. A bookcase that falls can kill a child."
- Tell the reader to put heavy items on the bottom shelves, and not to put a television on furniture that is not attached to the wall.

## 8. Children

A product for a child is often a regulated product. Read this section before you design one, and say in the reply which standard applies. A product for a child under 5 that holds, carries or confines the child is a regulated product. A high chair, a safety gate, a bed rail, a toddler bed and a bath seat are examples.

| Item | Rule |
|---|---|
| Any storage unit taller than 700 mm (27 in) | Attach it to the wall (section 7) |
| Other products that hold, carry or confine a child under 5 (a high chair, a safety gate, a bed rail, a toddler bed) | 16 CFR 1130 lists these products in the US. Each has a mandatory standard: ASTM F404 (16 CFR 1231) for a high chair, ASTM F1004 (16 CFR 1239) for a gate. In Europe: EN 14988 for a high chair, EN 1930 for a gate. Give the name of the standard in the reply. If the build cannot meet the standard, do not build it: suggest a tested product. The cot and changing-table rows are examples of this rule |
| Toy box | Follow the toy-chest rules in the toy standard of the country (ASTM F963 in the US, mandatory under 16 CFR 1250). Install a lid stay that holds the lid open in any position. Do not install a latch. Give the box air: two or more 25 mm (1 in) holes in each of two opposite sides near the top, or stops that keep a 13 mm (1/2 in) gap under the closed lid. Do not make a hole or a gap of 5 to 13 mm (3/16 to 1/2 in): a finger can get caught in it. Keep the gap at the hinge less than 5 mm (3/16 in) or more than 13 mm (1/2 in) in every lid position |
| Lid, door or flap that a child can lift (a storage bench, a blanket chest, a window seat, a sandpit lid) | Install a stay that holds the lid open in any position. If a child can get into the box, do not install a latch. Give the box air as for a toy box. Keep each hinge gap less than 5 mm (3/16 in) or more than 13 mm (1/2 in) in every position |
| Bunk or loft bed | A bunk or loft bed must meet the standard of the country: 16 CFR 1513 (ASTM F1427) in the US, EN 747 in Europe. Put guard rails on the four sides of the upper bed, with one opening for the ladder. Put the top of each rail at least 160 mm (6 1/4 in) above the top of the mattress (16 CFR 1513 asks for 5 in, EN 747 for more). Do not leave a gap of more than 75 mm (3 in) in the rails or the ends, between a rail and the frame, or between the ladder and the frame. 75 mm is below the US limit of 89 mm (3 1/2 in) for the openings in a rail and below a rail. Make the guard rail on the wall side continuous from end to end. Where a guard rail meets an end of the bed, leave a gap of 5 mm (3/16 in) or less. The US limit at the ends of the wall-side rail is 5.6 mm (0.22 in). Bolt or glue each joint of the frame. Do not use screws into end grain alone. No child under 6 on the upper bed |
| Cot or crib for a baby | Do not build one from a general guide. A cot must meet the safety standard of the country (for example EN 716, or 16 CFR 1219 in the US) |
| Changing table | A changing table must meet the standard of the country: 16 CFR 1235 (ASTM F2388) in the US, EN 12221 in Europe. Build a barrier on all four sides of the changing surface, at least 100 mm (4 in) above the top of the pad. Attach the table to the wall. For a changing top on a chest of drawers, attach the top to the chest and the chest to the wall. If the build cannot meet the standard, do not build it: suggest a tested table |
| Toys for children under 3 | Follow the toy standard of the country (ASTM F963 and 16 CFR 1501 in the US, EN 71-1 in Europe and the UK). Use no part that fits fully in a small-parts tester in any position: it can choke a child. A small-parts tester is a tube 32 mm (1 1/4 in) wide and 25 to 57 mm (1 to 2 1/4 in) deep. Use no ball, and no round part on a cord, that is smaller than 45 mm (1 3/4 in). Glue and pin wheels, axles and pegs so that a child cannot pull them out |
| Climbing toy (triangle, arch, ramp, climbing frame) | Follow the toy standard of the country (EN 71-8 for activity toys in Europe and the UK, ASTM F963 in the US). Lock a frame that folds in the open position with a stay or a pin. Attach each ramp or board to the frame. Set `safety.tipRatio` to 1, and make the base as wide and as deep as the toy is tall. Push the top from the side, and make sure that the frame does not tip. Use no hinge gap that can catch a finger. Put a soft mat around the toy. As for a step stool, make the base larger: do not attach the toy to a wall to pass the tip check |
| Finish on toys and furniture for children | Use a finish labelled safe for toys (EN 71-3). Let it cure for the full time on the can |

The WARNINGs and checks for these items:

- Bunk or loft bed, on the step that installs the guard rails: "WARNING: Do not leave a gap of more than 75 mm in the rails or the ends of the upper bed. A child's head can get caught in a larger gap." End the step with the check "Make sure that no gap in the rails or the ends is more than 75 mm."
- Bunk or loft bed, on the same step: "WARNING: Do not leave a gap of more than 5 mm between a guard rail and an end of the bed. A child can slip into the gap and get caught by the neck." Also check "Make sure that no gap between a guard rail and an end of the bed is more than 5 mm."
- Lid, on the step that installs the stay: "WARNING: Install a stay that holds the lid open in any position. A lid that falls can hurt the head or the neck of a child."
- Changing table, on the wall-fixing step: "WARNING: Attach the table to the wall. A table that falls can kill a child." On the last step: "WARNING: Keep one hand on the baby at all times. A baby can roll off the table."
- Toy for a child under 3, on the step that makes a ball or a round part: "WARNING: Do not use a ball smaller than 45 mm in a toy for a child under 3. A small ball can block the throat of a child."
- Climbing toy, on the step that joins the two frames: "WARNING: Lock the two frames open before a child climbs on them. A frame that folds can catch fingers." End the last step with the check "Push the top of the frame from the side. Make sure that the frame does not tip."

## 9. Outdoor builds

- **Dig safely.** Buried cables and gas pipes can be under a garden. Before you dig a post hole, find out where they run. In the US, call 811. In other countries, ask the utility companies for their plans.
- **Decks and platforms.** Many US places use the International Residential Code. Under this code, a deck needs a permit when it attaches to the house. It also needs a permit when a point of the deck is more than 760 mm (30 in) above the ground. A deck larger than 18.5 m² (200 ft²), or a deck at the exit door of the house, also needs a permit. Many places change these rules: ask the local building office. A deck more than 760 mm above the ground needs a guard rail. In England, a deck more than 300 mm above the ground needs planning permission. The ledger board that attaches a deck to the house is structural work.
- **Fences.** A fence higher than 2 m, or 1 m next to a road, needs planning permission in England. Other places have their own limits. Ask the local building office.
- **Beds that grow food.** Use naturally durable timber (cedar, larch), or line the inside faces of treated timber with a plastic liner. Do not use old railway sleepers.
- **Swings, hammocks and play frames.** Use the instructions of the swing kit maker. If the swing or the play frame is for a child, use the standard of the country too. This is EN 71-8 in Europe and the UK, and ASTM F1148 in the US. Make the frame from the plans of the swing kit maker, or buy a tested frame. Hang a swing only from a frame or a beam that its maker or an engineer rates for a swing. A pergola, a porch beam or a tree branch has no load limit for a swing until its maker or an engineer gives one. Keep 1.8 m (6 ft) of clear space at the sides of the frame. In front of and behind a swing, keep a clear space of two times the height of the top beam. Put at least 230 mm (9 in) of wood chips, mulch or shredded rubber under the frame and in all of the clear space. Grass, soil, concrete and paving are not safe surfaces. Use only swing hangers, hooks and chains that the maker sells for a swing. Attach the frame to the ground with ground anchors. On the step that hangs the swing: "WARNING: Hang the swing only from a beam that its maker or an engineer rates for a swing. A beam that breaks can drop a person.", "WARNING: Keep the area in front of and behind the swing clear for two times the height of the top beam. A swing that moves can hit a child." and "WARNING: Put 230 mm of wood chips, mulch or rubber under the swing. A fall on grass or soil can cause a head injury." On the step that sets the frame: "WARNING: Attach the frame to the ground with ground anchors. A frame that moves can tip over."
- **Fire pits.** Ask the local fire service for the distances to buildings, fences, trees and seats, and follow the instructions of the fire pit maker. Many places in the US use the International Fire Code. It asks for 7.6 m (25 ft) between an open fire and a structure or combustible material. For a portable fire bowl, it asks for 4.6 m (15 ft). Do not build wood seats nearer to the fire than the distance that the fire service gives. A gas or propane fire pit is gas work (section 10). Wood near a stove: section 5.
- **Hutches, coops and kennels.** Use untreated solid timber on every face that the animal can touch or chew. Use treated timber only for the legs and the outside frame, out of reach of the animal. Use only a finish that the maker labels safe for animals, on the outside faces, and let it dry fully before the animal goes in. On the step that applies the finish: "WARNING: Do not use treated timber or wood stain inside the hutch. A rabbit can chew the wood and become ill."
- **Power outdoors.** Use an outdoor-rated extension lead and an RCD (GFCI).

## 10. Hand-off

Some work can kill, burn a house down or bring a building down when an amateur gets it wrong. This pack never writes steps for it. A guide covers the safe parts and names the professional for the rest. If the main job is a hand-off topic ("rewire the kitchen", "move the gas cooker", "take out this wall"), write no guide: say who to call and what to ask.

| Topic (`handoff` id) | The work | Who | What to ask | What the guide can still cover |
|---|---|---|---|---|
| Gas (`gas`) | Any work on gas pipes, meters, boilers, cookers, hobs, fires, heaters, gas or propane fire pits and fire tables, LPG bottles with their hoses and regulators | A licensed gas engineer (Gas Safe registered in the UK, a licensed gas fitter or plumber elsewhere) | "Can you disconnect and reconnect the cooker, and test for leaks?" | Cabinets and shelves near the appliance, with the clearances the engineer gives. The frame of a fire table, with the vent openings and clearances that the burner kit maker gives |
| Mains wiring (`mains`) | Fixed wiring, sockets, switches, light fittings, hard-wired appliances, the breaker panel or consumer unit, new circuits. A like-for-like swap is also mains work. An appliance with no plug is hard-wired, so a connection to it is mains work. In a bathroom, a shaver socket, an extractor fan, an electric towel rail and a mirror light are mains work. A new or replaced mains cord, plug, inline switch or lamp holder on a lamp or an appliance (100 to 250 V). Any connection of a wire to a terminal of these items | A licensed electrician (in England and Wales, registered with a competent person scheme) | "Can you install a socket here, and give me a certificate for the work?" For a lamp: "Can you fit and test the cord, the switch and the lamp holder?" | A bought lamp with its own plug. A factory pre-wired, certified lamp cord set (plug, switch and lamp holder already fitted, no wire connections to make). LED strips with a plug-in 12 V or 24 V adapter. Battery lights. The furniture, with a cable route the electrician agrees |
| Structural work (`structural`) | Load-bearing walls, beams, joists, posts, new openings, notches in joists, a chimney breast, a new or larger loft hatch, a deck ledger on the house | A structural engineer for the design, then a builder | "Is this wall load-bearing? What beam and supports does the opening need?" | Non-structural parts after the engineer signs off: shelves, cladding, trim |
| Work at height (`height`) | Work above 2 m (6 ft), roofs, gutters, high stairwells | A roofer, or a contractor with a scaffold or a tower | "Can you do this from a scaffold, and what does access cost?" | Parts made on the ground. Work below 2 m from a step ladder |
| Permit work (`permit`) | Work that the local rules control: decks, fences over the limit, sheds over the size limit, structural and electrical work | The local building office (building department, building control, council) | "Does this work need a permit or planning permission? Which drawings do you need?" | The guide, after the user has the answer |
| Asbestos (`asbestos`) | Textured ceilings, old floor tiles, cement sheets, pipe lagging in a building from before 2000 | A licensed asbestos surveyor to test, a licensed contractor to remove | "Can you test this material for asbestos before I drill or cut it?" | Nothing on that material until the test is clear |
| Lead paint (`lead-paint`) | Old paint: from before 1978 in the US, before 1992 in the UK | A lead test kit, then a certified lead-safe contractor (EPA RRP certified in the US) | "Can you test this paint for lead, and remove it safely?" | New parts, and old wood after a clear test |

What to write in a project:

- A `handoff` entry for each topic: `{ "topic": "mains", "text": "A licensed electrician connects the light to the mains." }`. The topic is the id, or a plain name such as "mains wiring".
- A WARNING on the first step that comes near the work:

| Topic | WARNING |
|---|---|
| Gas | Do not touch the gas pipe or the gas appliance. A licensed gas engineer does all gas work. |
| Mains wiring | Do not connect the light to the mains. A licensed electrician makes all mains connections. |
| Mains wiring (a lamp) | Do not fit a new cord, plug, switch or lamp holder to the lamp. A licensed electrician does this mains work. |
| Structural work | Do not cut any part of a load-bearing wall. A structural engineer and a builder do this work. |
| Work at height | Do not work above 2 m on a ladder. A professional with a scaffold does this work. |
| Permit work | Ask the local building office whether the work needs a permit. The office can stop work that has no permit. |
| Asbestos | Do not drill, cut or sand old ceilings, floor tiles or cement sheets. They can contain asbestos. |
| Lead paint | Do not sand, scrape or heat old paint. Old paint can contain lead. |

What to say instead of steps:

- Say what the professional does and why, in one sentence: "Moving a socket is mains work, so a licensed electrician must do it."
- Give the question to ask, from the table.
- Offer the safe part: "I can write the guide for the shelves. The electrician moves the socket first."
- For a lamp, write steps for the wood parts only. In place of the wiring, offer a factory pre-wired cord set or a plug-in 12 V kit, or hand the wiring to an electrician: "I can write the guide for the oak base. Buy a pre-wired cord set, or ask an electrician to fit the cord." Write no step that strips a wire, names a wire colour or a terminal, or wires a plug.
- Old painted furniture: ask when it was painted. Paint from before 1978 (US) or 1992 (UK) can contain lead. Write no heat, sand or scrape step for it before a clear lead test.
- If the user smells gas: tell them to leave the building, to operate no switches, and to call the gas emergency number from outside.
- Do not give "just this once" steps, tips that make the work easier, or a list of the parts the work needs.

## 11. The words the hand-off screen finds

The hand-off screen is a safety net. It finds common words only, and it does not know what a step does:

- **It misses work.** "Connect the new light" passes the screen, but it is mains work.
- **It gives false alarms.** "Keep the propane tank of the weed burner 3 m from the bench" stops the build with `E_HANDOFF`, but it is not gas work.

Your reading of the request decides, as section 10 says. Read each step for its meaning. If a step is hand-off work, add the `handoff` entry and remove the steps for that work, also when the screen is quiet.

The screen reads every reader text: the title, the summary, step titles, instructions, checks, notes (why, tip and the 3D view note), warnings, part, material and tool names, and technique cards. It matches whole words in any case. The screen reads each run of spaces or line breaks as one space. A warning that names a topic counts too. A hand-off WARNING ("Do not connect the light to the mains. A licensed electrician makes all mains connections.") goes with its `handoff` entry. A WARNING that only keeps the reader away from the work ("Do not drill near the fuse box. Cables run there.") is not that work: it is a false alarm (below). So is a text that tells the reader to switch off the power at the consumer unit.

**A false alarm.** When the screen finds a topic in a text that is not that work, do not change the words to get past the screen. Add an entry to `safety.cleared`:

```json
{ "safety": { "cleared": [{ "topic": "gas", "why": "The weed burner runs on a small propane tank. The guide makes no gas connection." }] } }
```

- `topic` is the topic id of the hit, or a common name as in `handoff`. `why` says why the text is not that work, in STE descriptive sentences of 10 to 240 characters.
- The entry changes the `E_HANDOFF` of its topic to the info `I_HANDOFF_CLEARED`: one info for each topic.
- For lead paint, the entry records the answer to the question of `I_OLD_PAINT`. Give the age of the paint in `why`: "The owner painted the chair in 2015." The entry also stops `I_OLD_PAINT`. Paint from before 1978 (US) or 1992 (UK) is a hand-off, not an entry.
- An entry clears every text of its topic, also a step that you add later. The safety review (`safety`) lists each text that an entry clears, with the `why`. Read each one before you deliver the guide.
- An entry that clears nothing is the warning `W_CLEARED_UNUSED`: the screen finds no text of its topic, `handoff` names the topic, or an earlier entry clears the topic. Remove it. `--strict` stops on this warning, so you cannot clear a topic before the screen finds it.
- Never use `safety.cleared` for real hand-off work. Never use it only to get a build through. If you are not sure, the work is hand-off work.
- The guide page does not show `safety.cleared`.

| Topic | Words |
|---|---|
| Gas | "gas" with line, pipe, piping, pipework, supply, appliance, meter, valve, boiler, cooker, stove, hob, oven, range, dryer, fireplace, fire, fire pit, fire table, burner, heater, furnace, water heater, leak, main, connection, fitting, hose, regulator, bottle, cylinder or tank (not a toy, pretend or play cooker, and not the gas cylinder or strut of a chair, a stool, a seat or a lid). "Natural gas", "mains gas", "gas-fired", "gas-powered". "Propane", "LPG", "butane" (but not a propane torch, a blowtorch, a lighter, a weed burner, a cartridge or a canister, or butane to refill a lighter or a soldering iron). Move, install, replace, fit, relocate, remove or connect a boiler (not a boiler cupboard, cabinet, box, surround, shelf or door), and a boiler flue. Hook up, connect or attach an item to the gas (not a gas strut, spring, lift or piston). A regulator with a patio heater, a BBQ, a bottle or a cylinder in the sentence. A distance from a gas appliance or a gas meter does not count: "away from a gas heater", "750 mm above the gas hob", "clear of the gas hob", "next to the gas cooker", "1 m from the gas pipe". Nor does a place next to one: over, beside, around or near the gas hob, or on each side of it. "Between the gas hob and the wall" does not count either. Nor the dig advice of section 9: "buried cables and gas pipes", "where the gas pipes run" |
| Mains wiring | "mains" (but not mains water, mains gas, mains-powered, mains-operated, mains adapter, plug, lead or charger). "Hard-wired". Wire or connect a heater, a sauna, immersion or storage heater, a hot tub, a spa or underfloor heating to the supply, a supply cable, a control unit, a contactor, an isolator, a spur or a thermostat (not the water supply, a hose or a pipe, and not a 1 to 49 V item). Install, fit, move, relocate or replace a sauna heater (not its guard or stones). Breaker, fuse, electric, electrical, service or distribution panel, box or board (not after a 1 to 49 V voltage: "the 12 V fuse box"). "Consumer unit", "junction box", "ring main". A new circuit (not a new circuit board). A dedicated, cooker, radial, immersion or shower circuit. Add, run or install a circuit (not a circuit board, or an LED, buzzer, bulb, simple, series, parallel, electronic, toy or model circuit). Wire or connect an item to a light, lighting, ring or radial circuit. Armoured cable. 100 to 250 V wiring, wire, circuit, cable, supply, outlet, socket, receptacle or line (not the cable of a tool: "the 230 V cable of the saw"). A 100 to 250 V cord, lamp cord, flex or lead only after fit, wire, connect, strip, replace, change, install, shorten, lengthen, extend, repair, splice, feed, thread or "new" in the same clause (but not a pre-wired, ready-made, moulded or certified one, or a cord set or kit). Switch, light switch, outlet, socket or receptacle wiring. Wire, install, replace, add, move, fit, swap, relocate or reposition a light, dimmer or smart switch, a wall or power socket, a power outlet, an outlet, a receptacle, a light fixture or fitting, a ceiling light or fan, a wall or pendant light, a circuit breaker, a spur, a recessed light, a downlight, a can light, a chandelier, an extractor or exhaust fan (not a fan for an enclosure, a case, a tent, a booth, a 3D printer or a solder fume box), an electric shower, an electric or heated towel rail or radiator, a shaver point or unit, a mirror light or an EV charger, with up to two words (new, old, existing, GFCI, AFCI, USB, wall, kitchen, bathroom, smart ...) before it, or one word such as under-cabinet before a light fixture (not plug-in, battery, USB or solar). A cover, plate, grille, filter, duct, bracket or shelf for one is not mains work, nor a plumbing outlet (a pipe, hose, tap, valve or trap), nor a spur of a fence or a gate post. A socket with one or two words such as new, old, double, USB, switched, fused, outdoor, weatherproof, shaver, floor or 13 A before it, or a socket in a wall or a room (not a socket set, wrench or head screw, a socket on a tool, or a socket in a case, an enclosure or a front panel). Move, relocate or reposition a socket. A two- or three-prong outlet. A ceiling box, a ceiling rose (not a plaster or decorative rose). Replace or swap a switch, with a dimmer, a smart switch, a wall or a door near it. Wire or connect a light to the switch (not fairy, string, battery, USB, solar or toy lights). A (switched) fused spur, a fused connection unit. Connect an item to a spur. A wire nut. Wire, rewire, fit, connect, strip, replace, change or install a (new) mains lead, plug, cable, cord or flex. Wire or rewire a plug (not the plug of a 12 V, USB, battery, LED-strip or adapter item). Rewire a lamp, light, plug, socket, switch, outlet or cord, a house, or a room, a shed or a garage (not a USB, battery, solar, bike, guitar, toy, doll's, model or DC one). Lamps and appliances: wire the lamp ("Wire the new table lamp", not a part of the lamp, or a USB or LED lamp). Wire, connect, replace or swap a lamp or bulb holder (an E27, B22 or batten holder, not an E10 torch bulb holder), or fit a new one. Wires or cores to the lamp holder, and lamp holder terminals. Wire, replace or change a lamp socket, cord or switch. A plug, a switch (also a foot, rocker, rotary, toggle, push, pull or cord switch), an inline switch, a dimmer or a lamp holder on a cord, flex, lead or cable, and the reverse (not a cable tie or clip, or the cable of a 12 V, USB, solar, battery or LED-strip item). Connect the (lamp) flex. A (new) flex, cord, cable or lead to a lamp, light, lamp holder or plug. Replace, repair, splice, shorten, lengthen, extend or change a cord, flex or lead on a lamp or an appliance (an iron, a kettle, a toaster, a heater, a vacuum, a radio). Splice a cord or a flex (not a rope, hammock, swing, pulley or blind cord, or a cord that makes a loop, an eye or a knot). Fit, change or replace a (13 A or mains) plug, with a flex, a lamp or an appliance near it (not a wall, bath or sink plug, or a plug socket, hole or cutter). A fuse terminal. A cord grip with a plug, a lamp holder or a sheath. Brown and blue wires in one sentence. The pins, terminals or contacts of a lamp holder. Connect an item to 100 to 250 V (not to an adapter, a charger or a site transformer). Live, neutral or earth wire, conductor, core or terminal. "L terminal", "N terminal". A hot conductor or terminal, and a hot wire with brass, silver, outlet, socket, breaker, neutral, ground, lamp or panel in the sentence (not a hot-wire foam cutter, a hot wire in a sentence about foam, or "the hot wire away"). A brass or silver screw or terminal of a socket, outlet, receptacle, holder, switch or plug, and a brass or silver terminal (not a terminal block, a crimp terminal, a doorbell or chime terminal, or one in a sentence with a 1 to 49 V voltage). Ribbed or smooth wires with brass or silver screws. A bare copper or ground wire with a ground or green screw, a ground wire with a green screw, terminal, wire or nut, a green ground screw, a green-and-yellow wire, core or conductor. Low-voltage work does not count for many of these rules: a 1 to 49 V voltage, a battery (not a battery charger), crocodile clips, a doorbell or chime, GND, a PCB or circuit board, an LED strip or USB (not a USB charger) in the next 60 characters. The low-voltage rule is not for fixed mains items. An outlet, a receptacle, a light switch, a circuit breaker or a ceiling fan still counts when a USB or battery word comes after it. An example is "Replace the outlet with a USB outlet". Only a low-voltage item that holds it stops the hit, as in "the light switch of the battery box". Plug-in use does not count: plug or unplug a tool, a lamp or an adapter into or from the mains, a socket or an outlet. A wire, cable, terminal or fitting in that phrase still counts |
| Structural work | "Load-bearing" (not "a load-bearing capacity of 50 kg"). "Structural" with wall, beam, joist, member, column, support, work or change (not structural timber or posts). Remove, demolish, knock down, take down, knock out or take out a wall or a partition. "Knock through". Open up, widen, remove part of, or make or knock an opening in a wall or a doorway. Cut a doorway, an archway or a serving hatch in a wall, or an opening, a hatch or a hole in a wall between rooms. Fit or install a steel beam, an RSJ or a lintel. A notch in a joist. Cut or saw through or into a joist. Cut, saw, trim, shorten or remove a ceiling joist or an existing joist, or a joist at the hatch (not a joist hanger, bracket or strap, and not the new joists of a deck or a shed). Widen or enlarge the loft hatch, or make it wider. Cut a hole or an opening in the ceiling for the loft hatch or the loft ladder. Drill or bore a hole through the joists (not pilot, screw, clearance or nail holes). Remove, take out, cut into or cut through a chimney breast, and a chimney breast after knock out, knock down or demolish. Remove, take out or cut out the bricks of a chimney breast. Cut or make a recess, an opening or a niche in a chimney breast (not a shelf in the recess next to it, and not a fixing in its bricks). Cut, install or fit a loft hatch (not its door, cover or ladder). A ledger (board) to, of, on or against the house, home or building, or with a rim joist or band joist in the sentence. None of these counts for the wall, the doorway, a notch in a joist or a ceiling joist of a doll's house, a playhouse, a kennel, a hutch, a cabinet, a drawer or a box. The wall, the doorway and the lintel of a shed, a greenhouse, a summer house, a tree house, a wardrobe, a bookcase, a raised bed, a compost bin, a vivarium or a pizza oven do not count either. A "unit" or a bare "oven" still counts |
| Work at height | "Work at height". A scaffold (not scaffold boards, planks or tube). Climb, get, go, walk, stand, step or work on a roof, also with one word before "roof" ("the shed roof"), but not a birdhouse roof or the roof of a bird box. The roof of a house, home, building or garage. A house roof (but not a bird, dog, doll's, play, hedgehog, bat, cat or chicken house roof, the roof space, or "before building roof panels"), rooftop, roof work, access, repairs or ladder. Roof tiles (not old, reclaimed or spare ones). Off or from the roof, on the house or garage roof. An extension ladder. A ladder above 2 m, a "3 m ladder", "2.5 m above the floor", "3 m up the wall" (heights under 2 m or 6 ft do not count). A step ladder counts from 2.5 m (8 ft). A ladder shelf, bookcase, rack or desk does not count, nor a stored ladder: on a rack or hooks, or after store, stow, hang or "for the" ("the hooks for the extension ladder"). House or upstairs gutters, gutters on the house (not on a garden building). A ladder with upstairs windows or the stairs in the sentence (not a stored ladder). An aerial on a chimney. The eaves of the house. A shed or tree house roof still counts |
| Permit work | Building permit, consent, control, regulations or codes. Planning permission, consent, approval or application. Electrical, plumbing, construction, demolition or zoning permit. Zoning rules, laws, board, office, department, approval or variance. The, a or your building or planning department, office or inspector (not the gerund: "building office shelves"). Needs, requires, get or apply for a permit |
| Asbestos | "Asbestos". Artex. Old (pipe) lagging, and remove, strip, scrape, replace, take off, cut off or break off pipe lagging (not new or foam lagging). Old (fibre) cement sheets, boards, roofs or panels. Scrape, sand, drill, remove, strip or cut a textured ceiling or coating |
| Lead paint | "Lead paint", "lead-based paint", paint that contains lead (but not lead-free), lead in the old paint, paint that can or may contain lead ("Old paint can contain lead", "It may contain lead") |

A WARNING about a plug-in item names the item, not the supply: "Do not open the power supply. It can give you an electric shock."

The screen cannot see work that the text does not name. Read each step for its meaning, too.
