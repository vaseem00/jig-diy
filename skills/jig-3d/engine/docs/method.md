# The method

How to plan and explain a build so a first-timer and an expert can both follow it, and why each part of a guide exists. [format.md](format.md) gives the fields that hold each decision. [ste.md](ste.md) gives the writing rules. [safety.md](safety.md) gives the hazards and the hand-off list.

## Contents

1. [The reader's questions](#1-the-readers-questions)
2. [Numbers to collect first](#2-numbers-to-collect-first)
3. [Design the object as it is built](#3-design-the-object-as-it-is-built)
4. [Steps](#4-steps)
5. [Levels](#5-levels)
6. [Writing](#6-writing)
7. [Bill of quantities](#7-bill-of-quantities)
8. [Purchase plan](#8-purchase-plan)
9. [Safety](#9-safety)
10. [Time](#10-time)
11. [The 3D](#11-the-3d)

## 1. The reader's questions

A person who wants to build something asks five questions, in this order. Each part of the guide answers one, and nothing answers a question before the reader asks it.

| Question | Answer | Where |
|---|---|---|
| What will I get, and can I do it? | The finished object, time, cost, difficulty, tools | Plan |
| What do I buy, where, and when? | Trips in order, then the BOQ | Shop |
| How do I get my parts out of the stock? | Boards and sheets to scale, with the cuts, and the parts to print. A kit build has neither, and the tab is not shown | Cut list, Print list, or Cut and print |
| What do I do now? | One step: picture, warnings, instructions, check | Build |
| Did I do it right? | The check at the end of each step | Build |

The first screen answers the first question with a picture and one sentence.

## 2. Numbers to collect first

Collect real numbers before you design anything. A guide built on a nominal size or an invented price is wrong in every later number. The numbers depend on how the object is made, so choose the route first (2.1).

If the user's country, units or currency are unknown and they change the result, ask once. Otherwise use millimetres (inches when the user writes in feet and inches), the user's likely currency, and mark the prices as estimates.

### 2.1 Choose how it is made

Wood is one route, not the default. Build each object the way people who make that kind of object build it, from the materials and bought parts that do the job at the lowest real cost. A robot from plywood, or an e-reader in a wooden box, is a wrong guide even when every number in it is correct.

| The object | The usual route | Materials and bought parts |
|---|---|---|
| Furniture, shelves, storage, benches, workbenches | Timber and sheet goods | Pine, plywood, MDF; screws, glue, brackets |
| Outdoor builds: planters, raised beds, fences, sheds | Outdoor timber | Treated pine, cedar, larch; exterior screws |
| Racks, carts, frames for heavy loads, machine frames | Metal | Slotted steel angle, steel or aluminium tube with bolt-on brackets, aluminium extrusion (2020, 2040) with T-nuts |
| Robots and small vehicles | A bought chassis kit, or 3D-printed parts on a kit or an extrusion frame | Chassis kit (decks, motors, wheels, caster, standoffs), controller board, motor driver, sensors, battery pack |
| Electronic devices: an e-reader, a clock, a weather station, a speaker, a game handheld, a remote | Bought modules in a 3D-printed case, or in a bought project box | Development board, display, battery with protection, PLA or PETG case, or an ABS project box |
| Small boxes, organisers, brackets, holders | 3D print when the part is small and shaped; sheet goods or a bought box when it is large and flat | PLA, PETG; plywood, acrylic sheet |
| Light frames outdoors or in the garden: a cover frame, a trellis | Pipe and fittings | PVC or galvanised pipe and the fittings of the same system |
| Lamps and lights | A body of any route, with a certified pre-wired cord set or a plug-in 12 V or USB LED kit | As the body needs. The light is always bought ([safety.md](safety.md) section 10) |

Rules for the choice:

- **Buy before you make.** If a kit, a module or a box costs less than its materials plus the tools that make it, buy it. A round robot chassis kit with decks, motors, wheels and standoffs costs about the same as the plywood alone, and it needs no saw.
- **Use the reader's tools.** Choose the route that needs no tool the reader does not have. A 3D-printed part needs a printer: if the reader has none, price a print service (a library, a makerspace or an online service) as an `each` material, or choose a bought box.
- **Match the job.** The material must take the load, the heat, the water and the wear: metal for a frame that carries a machine, PETG (not PLA) for a part in a hot car or near a motor, outdoor timber outdoors.
- **Say the route in the reply.** Give the route, the reason in one sentence, and the main alternative with its cost: "The chassis is a bought kit. A 3D-printed chassis costs about the same in filament but takes 9 hours of printer time."
- **Mix routes when the object mixes them.** A wooden desk with a printed cable clip, or a robot kit with a printed pad holder, is normal. Each part gets the material it would really have.

### 2.2 Actual timber sizes

North American softwood is sold by a nominal size. The actual size is smaller:

| Nominal | Actual (in) | Actual (mm) |
|---|---|---|
| 1x2, 1x3, 1x4 | 3/4 x 1 1/2, 3/4 x 2 1/2, 3/4 x 3 1/2 | 19 x 38, 19 x 64, 19 x 89 |
| 1x6, 1x8 | 3/4 x 5 1/2, 3/4 x 7 1/4 | 19 x 140, 19 x 184 |
| 1x10, 1x12 | 3/4 x 9 1/4, 3/4 x 11 1/4 | 19 x 235, 19 x 286 |
| 2x2, 2x4 | 1 1/2 x 1 1/2, 1 1/2 x 3 1/2 | 38 x 38, 38 x 89 |
| 2x6, 2x8 | 1 1/2 x 5 1/2, 1 1/2 x 7 1/4 | 38 x 140, 38 x 184 |
| 2x10, 2x12 | 1 1/2 x 9 1/4, 1 1/2 x 11 1/4 | 38 x 235, 38 x 286 |
| 4x4 | 3 1/2 x 3 1/2 | 89 x 89 |

- Common lengths: 8, 10, 12 and 16 ft for 2x stock (8 ft = 96 in = 2438 mm), and 4, 6 and 8 ft for 1x boards at large stores.
- Metric markets name planed timber by its sawn size. Planed timber (PAR, PSE, "dressed") is about 5 mm smaller in each dimension: "PAR 25 x 100" is about 20 x 94 mm. Read the finished size on the label, or measure one board.
- Some metric sizes are already actual: CLS studs (38 x 63, 38 x 89 mm), Australian framing pine (70 x 35, 90 x 35, 90 x 45 mm).
- Use the stock lengths that the user's store lists. Do not guess them.

### 2.3 Sheets

| Market | Common sheet | Thickness |
|---|---|---|
| North America | 4 x 8 ft (48 x 96 in); half and quarter sheets at large stores | "3/4 in" sanded plywood is 23/32 in (18.3 mm); "1/2 in" is 15/32 in (11.9 mm) |
| Metric markets | 2440 x 1220 mm; also 2500 x 1250 mm, and 1525 x 1525 mm birch plywood | 6, 9, 12, 15, 18 mm |

Many stores cut sheets to size. Add each cut size that the store sells as its own `stock` entry.

### 2.4 Fasteners

- **Screw length:** about 2.5 times the thickness of the part the screw goes through, with at least 25 mm (1 in) in the second part. A 19 mm board takes 4 x 45 to 50 mm screws (#8 x 2 in). A 38 mm board takes 5 x 80 to 90 mm screws (#10 x 3 in).
- **Pilot hole:** about the core diameter of the screw: 2.5 to 3 mm for a 4 mm screw in softwood, 3 mm in hardwood. A pilot hole stops a split near an end.
- **Spacing:** keep screws 20 to 40 mm from an edge and 50 to 150 mm apart. Three screws hold a 235 mm wide butt joint.
- **Thin panels:** a 6 mm back takes 3 x 16 mm pan-head screws or 18-gauge brads.
- **Wall fixings:** a screw into a wood stud holds the load. Studs are at 400 or 600 mm centres (16 or 24 in). Choose a screw that goes 30 mm (1 1/4 in) or more into the stud after the bracket and the plasterboard: a 4 x 50 mm screw through a 3 mm bracket and 12.5 mm plasterboard. Masonry needs plugs. Plasterboard alone takes only light loads on a hollow-wall anchor: not an anti-tip strap, a TV mount, a wall cabinet or a load above a bed ([safety.md](safety.md) section 6).

### 2.5 Glue and finish

| Product | Numbers to use |
|---|---|
| PVA wood glue | About 10 min to assemble, 30 to 60 min in clamps, 24 h to full strength. Outdoors, use a D3 or D4 (Type II or I) glue |
| Water-based varnish or paint | Recoat after 2 to 4 h. Brushed coverage about 10 to 12 m² per L per coat (400 to 500 ft² per US gallon, 100 to 125 ft² per quart) |
| Oil-based varnish | Recoat after 6 to 24 h, same coverage |
| Hardwax oil | Recoat after 8 to 12 h, about 24 m² per L per coat |

The can is the authority. Put the numbers from the user's product in `coverage`, `coats` and `wait`.

### 2.6 Prices

Never present an invented price as fact. Every rate the user did not give is an estimate: it shows an `est` badge. Say where the estimate comes from in `priceNote` and when in `pricesAsOf`. Set `est: false` only on a price the user gave or a quote you read.

### 2.7 Kits and modules

- **Model the kit as it comes.** The kit is one `each` material with its price. Each part inside it (a deck, a motor, a wheel, the standoffs) is its own material with `included: true`, so the BOQ lists it as "in the kit" and the reader can check the box contents against it. Put the screws of the kit in `fasteners` with an `included` material too.
- **Real sizes come from the listing or the part.** Read the deck diameter, the hole pattern, the motor size and the wheel diameter in the listing or the kit drawing. If they are not there, give a typical size, mark it, and ask the reader to measure the real part before the step that depends on it.
- **The kit's own order.** A kit has an order that works. Follow it, and add the steps that the kit leaves out: the checks, the warnings, the wire routes.
- **Modules plug together.** Prefer modules with pin headers and screw terminals, and jumper wires, to soldering. If a module needs soldering, say so in the route, add the soldering iron to the tools, and teach the joint with a technique card.
- **The voltages must match.** Check every module against the supply: the motor rating, the regulator input of the board, the logic level of each sensor (3.3 V or 5 V). Write the numbers in the `why` of the wiring step.
- **Software is part of the guide.** A guide with a programmable board ships its program as a file next to the project, with the wiring list at the top. The steps name the file, the board and the upload method.

### 2.8 3D printing

| Number | Typical value |
|---|---|
| Bed size of a home printer | 220 × 220 mm; a part larger than the bed is two parts with a joint |
| Material | PLA for indoor parts. PETG for heat (above about 50 °C), sun, water and parts near a motor |
| Wall and infill | 3 walls and 15 to 25% infill for a case; 4 walls and 40% infill for a bracket that carries a load |
| Clearance | 0.2 to 0.3 mm on each side for a part that fits into another part |
| Threads | M3 brass heat-set inserts in plastic, or M3 screws into a 2.5 mm hole for light loads |
| Time and filament | The slicer is the authority: put its grams and hours on the part |

Print each part flat on its largest face, with no supports when the shape allows it. Say the print settings in the part's print settings and the time as printer time, not work time.

### 2.9 Metal, pipe and plastic sheet

- **Aluminium extrusion** is sold by its profile: 2020 is 20 × 20 mm with a 6 mm slot for M5 T-nuts. Cut it with a hand saw and a mitre box, or buy it cut to length.
- **Slotted steel angle** bolts together with its own nuts and bolts. It needs no welding.
- **PVC pipe** is sold by a nominal size. The outside diameter is fixed: US Schedule 40 1/2 in is 21.3 mm, 3/4 in is 26.7 mm, 1 in is 33.4 mm. Use the fittings of the same system.
- **Acrylic sheet** cracks when you drill it with a wood bit at high speed. Use a bit for plastic, or a low speed and a backing board. A laser-cut service gives clean parts from a drawing.

## 3. Design the object as it is built

Use the route from 2.1. Choose joints a beginner can make with the tools named, and say why in the step's `why`.

Wood:

| Joint | Tools | Use for | Note |
|---|---|---|---|
| Butt joint with glue and screws | Drill, countersink bit | Boxes, shelves, benches | Screws into end grain hold less. Use glue and three screws |
| Pocket screws | Pocket-hole jig, drill | Frames, table aprons | Hides the screws. The jig is one more tool |
| Metal brackets | Drill | Shelves, frames, repairs | Fastest. The brackets show |
| Dowels | Drill, dowel jig | Hidden joints | Needs accurate holes |
| Dado (housing) | Router or table saw | Shelves in a carcass | Stiffest shelf. The parts overlap, so list them in `joins` |

Other routes:

| Joint | Tools | Use for | Note |
|---|---|---|---|
| Machine screw and nut through kit holes | Screwdriver, pliers | Chassis kits, acrylic and metal sheet | Use the holes the kit has. Drill a new hole only where the kit has none |
| Standoffs | Screwdriver | Boards and decks above a deck | Keep the pins of a board off the deck |
| Heat-set insert and machine screw | Soldering iron, screwdriver | 3D-printed cases and brackets | Holds a screw that you remove again and again |
| Snap fit or slide fit | None | 3D-printed lids and covers | Give 0.2 to 0.3 mm of clearance on each side |
| T-nut and bracket | Hex key | Aluminium extrusion frames | Put the T-nuts in the slot before you close the frame |
| Nut and bolt through slotted angle | Spanner | Steel racks and frames | Brace each frame with a corner plate |
| Push-fit pipe fitting | Pipe cutter | Pipe frames | Use PVC cement only where the frame never comes apart |
| Hook-and-loop tape, mounting tape | None | Battery boxes, light modules, pads | The part comes off for a charge or a wash |

- **Include the parts that hold the parts:** cleats, back panels, brackets, anti-tip straps, feet and levelling shims. A back panel squares a carcass.
- **Mind the span.** A 19 mm pine or plywood shelf that carries books sags past about 800 mm. An 18 mm MDF shelf sags past about 600 mm. Add a centre support or a front lip, or use a thicker board.
- **Give every part a letter**, the same letter for identical parts, a real size and a real position.
- **Plan for tipping.** If an object 600 mm (24 in) tall or more is tall and shallow (height more than twice the depth), it gets a wall fixing. A smaller object over the ratio (a lamp, a box) gets a wider or heavier base. In a home with children, anchor any storage unit taller than about 700 mm (27 in), even when the ratio is lower.
- **Furniture that carries a person** (a step stool, a bench, a seat, a bed, a ladder, a platform): glue every load joint, keep the top inside the legs, and end with a load check. Make the base of a step stool as deep and as wide as it is tall, and set `safety.tipRatio` to 1 so that the engine checks it. [safety.md](safety.md) section 6 has the rules and the WARNING.
- **Children's products** (any item that a child uses, sits in, sleeps in or plays on, for example a bunk bed, a changing table, a high chair, a safety gate, a toy box, a toy, a climbing toy): [safety.md](safety.md) section 8 has the standards, the gaps and the WARNINGs. Do not build a cot.
- **Loads that hang or sit on top** (a ceiling rack, a swing or hammock hook, a fold-down desk, an aquarium stand): [safety.md](safety.md) section 6 has the fixings, the weights and the WARNINGs. A swing frame outdoors: section 9.
- **A product with no row:** if no line above and no row of [safety.md](safety.md) names the product, read safety.md section 1 (a product with no row). It gives the hazard classes and the rule for the safety standard of the country. Give no safety gap, load limit or clearance from memory.

## 4. Steps

- **One visible change per step.** If the pictures of step n and step n+1 look the same, merge them. If a step adds two sub-assemblies, split it.
- **Size:** 2 to 6 instructions and 1 to 4 new parts. Up to about 20 screws when they repeat one pattern (a back panel).
- **Order:** prepare, then build, then finish. Inside a phase, use the order a real person can do. Work with gravity, keep clamping possible, square a frame before a part locks its shape, and apply the finish before a fixing that is hard to reach.
- **Every step ends with a check** that catches the error the next step hides: square before the back goes on, level before the glue sets, all parts cut before the build starts.
- **Preparation steps use the kit pose.** The parts lie flat with their letters, like the parts page of a flat-pack manual. `focus` lights the parts the step works on.
- **Teach once, link after.** A technique card opens the first time a First time reader meets it. After that, it is one line in the card list.

Orders that work:

| Build | Order |
|---|---|
| Box or carcass (bookshelf, cabinet) | Cut, sand, mark and drill; bottom shelf on one side; top shelf; second side; middle shelves; square and attach the back; finish; wall fixing |
| Table, bench or frame | Cut, sand; two end frames (legs and short rails); join them with the long rails; top; finish |
| Planter or raised bed | Cut, sand; corner posts and the first course; the other courses; bottom slats or liner; finish before any soil goes in |
| Wall shelf | Cut, sand, finish; find the studs and mark a level line; brackets; shelf |
| Robot or vehicle from a chassis kit | Check the kit contents; motors and wheels on the lower deck; caster; power parts (battery box, motor driver); controller on standoffs; sensors; wiring; load the program and test with the top deck off; top deck; the tool (pad, brush, gripper) |
| Electronic device in a printed case | Print the parts; test the modules on the bench with the program loaded; insert the threads; fit the modules in the case; wire them; close the case; test again |
| Metal or extrusion frame | Cut or check the lengths; two end frames; the long members; square the frame; braces; feet or wheels; shelves or panels |
| Repair | Examine; remove the damaged part; prepare the joint; glue or fix; clamp and wait; finish to match. Model the object that exists as props with a label (the legs, the seat), and only the new or replaced pieces as parts. With no parts, the 3D view and the Fig 1 size come from the props in the Plan view. When a repair has parts, the 3D view and Fig 1 show only the parts, so Fig 1 gives the size of the new pieces. Say so in the reply |

## 5. Levels

The steps are the same for every reader. Only the depth changes:

| Level | Sees | Time shown |
|---|---|---|
| First time (`new`) | Every instruction, the `new` lines (extra care: "Measure each length two times"), technique cards open the first time, Why and Tip notes | x 1.5 |
| Some experience (`some`) | Instructions, technique cards closed, Tip notes | x 1.2 |
| Experienced (`pro`) | Instructions, warnings and checks | x 1.0 |

WARNINGs, CAUTIONs and checks show at every level. Safety never depends on level. Write `minutes` for an experienced person at an even pace. The multipliers are an estimate; say so if the user asks about time.

## 6. Writing

Write each instruction as one STE sentence that a tired person in a garage can follow:

- A command verb first, one instruction per sentence, 20 words or fewer. Descriptions (why, tip, summary): 25 words or fewer.
- Put a condition before its command: "If the lengths are not equal, push the long corners together."
- Use active voice and no -ing verb forms.
- Write numbers and units every time: "Drill a 3 mm pilot hole", never "a small pilot hole".
- Use one word for one thing. If the part is a "shelf", it is never a "board" or a "plank" in a later step. Use the part letter: "shelf B".
- Give a WARNING for a risk of injury and a CAUTION for a risk of damage. Put them before the instructions. Start with a command, then give the reason.

[ste.md](ste.md) has the full rules, the word list and before-and-after rewrites.

## 7. Bill of quantities

- **Every quantity is computed.** Boards come from the cut packing, screws from `fasteners`, glue and sandpaper from `uses`, finish from the area x coats / coverage. If you want to type a quantity, model the thing that uses it instead.
- **Need and purchase are two columns:** "24 pieces + 10% spare" and "1 pack of 50". The reader sees why they buy more than they use.
- **Codes** are a group letter and a number inside the group: T timber and sheet, P printing (filament), H hardware, C consumables, F finish, S safety, X tools, O other (for example a group "Electronics"). A reader can tell a helper "I could not get H06", and a new timber row never changes that code.
- **Contingency** is 10% by default, on its own line. Prices change and cuts go wrong.
- **Tax:** with `tax.included`, prices hold the tax. Otherwise the tax is a line on the total.
- **Estimates are marked.** Every rate the user did not give carries `est`.

## 8. Purchase plan

- Online orders come first, the longest lead time first: they must be placed before the build starts. With a start date, each trip gets an order-by date.
- Then one trip per store. Each line shows the step that first needs it, so a reader can split a trip.
- Borrowed tools are a separate list: ask a friend or a tool library.
- Buy the tools you do not have before the first step that uses them.

## 9. Safety

- A power tool in a step needs a WARNING in that step or in a technique card it teaches. The engine enforces this.
- An object 600 mm (24 in) tall or more that can tip gets a wall-fixing step with a WARNING about children. The engine checks the height-to-depth ratio. A smaller object over the ratio gets a wider or heavier base.
- Finish steps name ventilation, gloves and the rag-fire risk of oil finishes.
- An item near a stove, a fireplace, a heater or a sauna heater keeps the clearance that the maker of the heat source gives. This is on the stove label, or in the manual of the heater. If a stove has no label, keep the item 900 mm (36 in) from the stove. An item near a fire pit keeps the distance that the local fire service gives. The step that puts the item in place has a WARNING ([safety.md](safety.md) sections 5 and 9).
- Name the protective equipment each step needs: glasses for drills and saws, ear protection for saws and sanders, a dust mask for sanding, gloves for finishes.
- Batteries, chargers, soldering and printers have their own rules ([safety.md](safety.md) section 12): a bought cell or pack with protection, its matching charger, no charge unattended, ventilation for solder and plastic fumes.
- Hand off what a non-professional must not do: gas, mains wiring, structural changes, work above 2 m, permit work, asbestos and lead paint. Write the guide around it, say who does that part, and never write steps for it.

## 10. Time

- Active minutes come from the steps. Waiting (glue, finish, printer time) is shown apart, because a reader plans a weekend around it.
- The plan shows the phases as a bar scaled by minutes, with the step chips under each phase.
- Durations under 10 minutes show to the minute. Longer ones round to 5 minutes.

## 11. The 3D

The 3D answers four questions for each step: which part, where, which way round, and fixed where. It is not decoration.

- **Real parts, real positions.** Every part is a box or a cylinder at its true size and position. Screws are true size too, and rings keep them visible at full-object scale.
- **One lit set.** Done parts are plain. This step's parts are lit in the one accent colour. Future parts are hidden ("Show finished" ghosts them).
- **Arrive along the path.** New parts move in from outside the model, and screws travel in along their axis. Set `from` when the real path differs: a drawer slides in from the front, a top drops from above.
- **Camera with the work.** Set `view` for steps on the back, the top or the inside, so the screw heads face the reader. Keep one scale across the assembly steps unless a step needs `zoom`.
- **Words stay out of the picture.** Part letters and screw rings are the only marks in the 3D. All words are in the step card.
- **Context props, not parts.** A wall, a bench or a floor goes in `props` and shows only on the steps that list it, and in the Plan view unless `hero: false`.
- **The picture shows the assembled orientation.** The 3D stays upright, so each step reads as progress. Write the text to agree with it: "Stand the frame upright with the back toward you." If the real work must happen on the floor or on the back, say so in the text, and set the step's `view.note` to "The picture shows the <object> upright." The note shows only under the 3D view. Never mention the picture in `do`, `check`, `why` or `tip`: print and `plan.md` have no picture.
- **Apart and Show finished** answer "how do the parts meet" and "where does this step lead".
- **The part doing the work opens up.** When this step's parts sit inside parts built before (wiring in a case, a shelf pin behind a side, a bracket under a top), set `view.xray: true`: the parts built before show as glass and the lit parts show through them. A camera that sees inside beats ten orbits round the outside. The reader can turn X-ray on or off on any step.

If a step's picture does not answer the four questions, fix the camera or the step before you add words.

### 11.1 Show it working

A reader trusts a build when they see the finished object work: the drawer slides out its full travel and clears the frame, the lid opens and stops, the wheel turns. Add a `motion` (format.md section 9.3) for each part that moves after the build. The Plan view then tours itself: the finished object sways round its front, each motion opens and closes, then the object goes together step by step, and the loop starts again. Any click, drag, key or slider hands control to the reader; 25 s of quiet hands it back. Pause stops the tour until Play.

These rules come from machine explainers whose every gauge reads the model that moves the parts:

- **Start from the real thing.** Take the travel and the pivot from the real hardware: the drawer slide length on its packet, the hinge pin centre from the hinge drawing, the wheel axle from the kit's dimension drawing. Never guess a travel from a picture.
- **One number drives each motion.** The 3D, the slider and the value under it all come from `travel`. Check one by hand: a 70 mm wheel that turns 360 degrees rolls 220 mm (70 x 3.14).
- **Fix a collision with a number.** `W_MOTION_HIT` means the motion drives a part into another. Change the travel, the pivot or the part position. Never turn the camera away from it.
- **One accent, and it means something.** In the tour, the lit part is the part that moves now, or the part that goes in now. Nothing else is lit.
- **Hold each state long enough to read.** A tour state holds 1 s for a short line, plus 0.25 s for each word after three. The engine times the tour from the step titles and the motion texts, so short titles give a brisk tour.
- **Frame 0 is the finished object.** The tour starts on the finished object, so a capture, a share card or a reader who looks for one second sees what they build.
- **A screen capture holds still.** `capture --tour <s>` shows the tour at one time, so a review sees the same frame each time.
