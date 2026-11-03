# Design notes

These notes record why Jig has its shape: which ideas came from which source, what Jig changed on the way, and what it left out. They replace `references/lineage.md` of the private 0.1 skill. The contract for the code is [ARCHITECTURE.md](ARCHITECTURE.md). These notes are the reasons behind it.

Quotations are short and come from the source named. Where a source was read only through a summary or is general practice, the text says so.

## Contents

1. The problem
2. anatomy: one model, one thesis, checks to zero
3. visual-explainer: the answer as a picture
4. ASD-STE100 and the STE community skills: the words
5. IKEA and LEGO manuals: one change for each picture
6. Maintenance manuals: warnings first, a check last
7. Diátaxis: one page for the learner and the expert
8. BOQ practice: quantities a builder can trust
9. Smaller influences
10. The blend
11. What Jig did not take
12. Lessons from 0.1
13. Known limits of 1.0

## 1. The problem

Most DIY instructions fail in one of two ways:

- **The essay.** Long paragraphs of advice, "you might want to", ten actions in one step. The reader cannot act on it with a tool in one hand.
- **The pretty lie.** A materials list typed by hand that does not agree with the steps: 16 screws in the list and 24 in the build. The reader finds the error in the store or, worse, at step 9.

Jig answers both with one rule: **the build is the explanation, and every number comes from one model.** The reader understands a project when they see it go together, one visible change at a time. Behind each picture is one `project.json`. The cut list, the boards to buy, the screw count, the glue, the finish, the cost and the time all come from it, so nothing can disagree.

## 2. anatomy: one model, one thesis, checks to zero

[anatomy](https://github.com/wheresryan22/anatomy) by wheresryan22 (MIT License) is a skill that explains a technical idea as an isometric drawing of a real physical object. Jig is not a drawing skill, but it took more from anatomy than from any other source. The 0.1 notes read its `SKILL.md` phrase by phrase. The ideas that survived into 1.0:

| anatomy says | What the words do | Jig took it as |
|---|---|---|
| "Every number the figure shows comes from the same model" | One sentence that removes a whole class of bugs | One model, every number: `compute(project)` is the only source of quantities, cost, time and 3D |
| "The object is the explanation" | One bold thesis before the workflow | "The build is the explanation" at the top of the `jig` skill |
| "even if they never say 'isometric'" | The skill fires on the need, not the keyword | Each description lists needs ("materials list", "how do I make") and ends "even if they never say 3D or STE" |
| Two named failure modes | A reviewer can name the fault | "The essay" and "the pretty lie" |
| "Size it before you start" with a hard stop for the largest tier | Protects the user's time | Small, Standard and Big. Big is not started: Jig proposes one sub-assembly |
| "Truth first" | Facts before the picture | Real stock sizes (a 2x4 is 38 x 89 mm), real coverage, real drying times before any part |
| A stated coordinate system | Stops a class of position errors | x right, y up, z toward the viewer, `at` is the minimum corner |
| "Run the audit to zero" | A machine gate, not a mood | Build to zero: no page while the report has an error |
| "a stand-in shape that silences the audit is a bug" | Forbids gaming the check | "Fix the model, not the rule." Never type a quantity, never edit the HTML |
| "Verify like a critic" | The agent reviews before the owner does | `jig-verify`: capture each step at desktop width, phone width and dark theme, and read every image |
| One lit accent in the tone hierarchy | Colour has one job | Done parts plain, this step's parts lit, future parts hidden |
| Words stay out of the drawing | Every mark sits on something real | Only part letters and screw rings in the 3D. All words are in the step card |
| Calm motion that stops under reduced motion | Motion explains, and respects the reader | Parts arrive along their path, the Plan view turns slowly, and both stop for reduced motion. 1.0 adds a Pause button |
| Progressive disclosure: SKILL.md, then references, then examples | The agent reads only what the step needs | Each skill has a short `SKILL.md`, `references/` on demand, and shared docs in `engine/docs/` |
| Examples as the first reference | Show the bar, do not describe it | "Open the example closest to the request before you start" |
| `evals/evals.json` and checks as scripts | Taste turned into tests | Eval cases for each skill, a plugin eval suite, and a `node:test` suite |

Structural patterns also came from anatomy: a thesis before the rules, numbers instead of adjectives, rules that carry the incident that made them, and publish only on request.

## 3. visual-explainer: the answer as a picture

[visual-explainer](https://github.com/nicobailon/visual-explainer) by nicobailon (MIT License) turns terminal output into one self-contained HTML page. The 0.1 notes read it through a summary of its `SKILL.md`, so the phrases below are as quoted there.

- "Draw the mechanism, not the name." Jig shows shelf B arrive at its line, not a box with the word "shelf".
- "Every number gets a picture." Cuts are drawn to scale, phase bars are scaled by minutes, and rings show each screw.
- "One claim per figure." One visible change for each step.
- The first screen shows the answer. Jig's Plan tab opens on the finished object, the cost and the time.
- "Write close to Simplified Technical English." This confirmed STE as the register for explainers.
- A renderer that lists the problems, and an agent that fixes them with small edits. Jig's report lists each problem with a path and a fix, and the agent edits the model.

## 4. ASD-STE100 and the STE community skills: the words

ASD-STE100 Simplified Technical English comes from aircraft maintenance. Issue 9 came out on 15 January 2025. ASD now calls it a standard, and it is free on request. Its core is a set of writing rules and a dictionary of about 900 approved words, each with one meaning.

Several community agent skills paraphrase the writing rules (for example PostHog's "writing simplified technical english", "asd-ste100" in mflux and "simplified-english" in Paperclip; read through summaries). They agree on the parts a script can check:

- 20 words or fewer in a procedure sentence, 25 in a description.
- One instruction in each sentence, with a command verb first.
- Active voice.
- One word for one thing.

Jig took these and added two from the Hemingway-style rules of the iceberg editing skill: the condition before the command, and the answer first. The linter in `engine/lib/ste.mjs` checks every sentence of reader text and every step title. It does not hold the dictionary. Jig is STE-style, not certified STE. ASD-STE100 is a trademark of ASD.

## 5. IKEA and LEGO manuals: one change for each picture

General practice, not one document:

- A parts page comes first, with letters and counts. In Jig this is the kit pose (`pose: "kit"`) and the parts table.
- Each panel shows one change of state, with the new parts shown clearly. In Jig each step adds 1 to 4 parts, lit.
- Fasteners show with counts. In Jig, rings mark each screw head, and the card shows "3 x 4 x 50 mm".
- The picture shows the side where the work is. In Jig a step can set `view` for the back, the top or the inside.
- Tall furniture carries a tip-over warning. In Jig, an object 600 mm (24 in) tall or more with a height more than twice the depth is error `E_TIP_OVER` until a part has `role: "anchor"`. A smaller object gets the warning `W_TIP_SMALL`.

## 6. Maintenance manuals: warnings first, a check last

From aircraft maintenance manuals written in STE with S1000D practice (general practice):

- A WARNING covers a risk of injury, and a CAUTION covers a risk of damage. Both come before the instructions they cover. Jig shows them first in each step card, at every level.
- Every task ends with an inspection. Each Jig step ends with a `check` that the reader can see or measure: "Make sure that the two diagonals are equal within 2 mm." A step with no check is warning `W_NO_CHECK`.
- Work that needs a licence goes to a licensed person. Jig's hand-off list (gas, mains wiring, structural work, work above 2 m, permits, asbestos, lead paint) gives no steps, only who to call.

## 7. Diátaxis: one page for the learner and the expert

[Diátaxis](https://diataxis.fr/) separates a tutorial, which serves a learner, from a how-to guide, which serves a practitioner. A DIY reader can be either, and can change during one build. Jig keeps one set of steps and changes only the depth with a level switch:

- **First time** shows every line, opens each technique card the first time it appears, and adds Why and Tip notes.
- **Some experience** closes the technique cards and keeps the tips.
- **Experienced** shows the instructions, the warnings and the checks.

Warnings and checks never depend on the level. The iceberg skill's writing profiles pointed the same way.

## 8. BOQ practice: quantities a builder can trust

Construction estimating (general practice) gives the shape of the bill of quantities:

- Each row has a code, a description, a quantity, a unit, a rate and an amount.
- Groups have letters, and codes count inside each group, so `H06` stays `H06` when a timber row is added. In 0.1 every code moved. 1.0 fixes this.
- The exact need and the quantity to buy are separate. Jig shows both: 1.7 L of finish needed, two 1 L cans to buy.
- Waste and spares are explicit, with a contingency line and tax on the total.
- Rates that are not quotes carry a mark. Jig marks them `est`.

The purchase plan follows ordinary logistics: order the long lead time first, buy just in time, and make one trip to each store, with items in the order the steps need them.

## 9. Smaller influences

- **deep-research** splits a question into parts that do not overlap and together cover all of it. Jig installs each part in exactly one step (`E_NOT_INSTALLED`, `E_INSTALLED_TWICE`).
- **dataviz** asks for one system that works in light and dark. Jig's page has theme tokens with a contrast of 4.5:1 or more in both themes.
- **artifact-diagramming** asks when a picture earns its place. Jig's 3D must answer which part, where, which way round, and fixed where.
- **Instructables** shows the common form (intro, supplies, numbered steps) and its common failure: a supplies list typed by hand. Jig computes the list.

## 10. The blend

| Jig rule | From |
|---|---|
| One model, every number computed | anatomy (one model, truth first), and the Instructables failure |
| The build is the explanation, one visible change for each step | anatomy, IKEA and LEGO, visual-explainer (one claim for each figure) |
| First screen: the finished object and one line | visual-explainer |
| One lit accent, only letters and rings in the picture | anatomy (tone hierarchy, words out of the drawing), IKEA callouts |
| Parts arrive along their path, still under reduced motion | anatomy (calm motion) |
| STE writing, linted | ASD-STE100, the STE community skills, iceberg (condition first) |
| WARNING and CAUTION before the step, a check at the end | Maintenance manuals |
| Levels: the same steps at a different depth | Diátaxis, iceberg profiles |
| Small, Standard and Big sizes, and hand-offs | anatomy (size tiers), trade safety practice |
| Each part installed exactly once | deep-research, anatomy (each part sits on another) |
| Build to zero, no gaming the check | anatomy (audit to zero) |
| Read every capture at phone width and in dark | anatomy (verify like a critic), visual-explainer |
| BOQ with codes, need against buy, contingency, `est` marks | Construction estimating |
| Purchase plan by lead time and first step | Logistics practice |
| Publish only on request | anatomy |

## 11. What Jig did not take

- **Hand-drawn isometric SVG.** anatomy draws one object from one fixed camera. A DIY reader must see their own object from the side where they work, so Jig uses a 3D orbit with a depth buffer. Boards that touch need no paint-order tuning.
- **The metaphor object.** anatomy invents a machine to explain an idea. In DIY the object is the subject, so "invent a machine" becomes "build the real thing".
- **Shaders and an optical audit.** Jig's checks are about quantities, installation, safety and words, not light effects.
- **A network-free page by default.** anatomy's gallery forbids network calls. Jig loads three.js from a CDN to keep pages small, with integrity hashes, and offers `--offline` for a page with no network at all.

## 12. Lessons from 0.1

An audit of the private 0.1 skill found the defects that shaped 1.0. The [CHANGELOG](../CHANGELOG.md) lists each fix. The design lessons:

- **Text first, picture second.** In 0.1 the app and the viewer were one module with a static three.js import. When the CDN failed, the whole page was blank, even the shopping list. In 1.0 the app renders every tab and then loads the viewer with a dynamic import. The viewer says why it is empty: no network, no WebGL or a data error.
- **A gate needs a validator.** In 0.1 a missing price gave a NaN total and a typo in `kind` removed the timber, with 0 errors. In 1.0 a schema and a validator run first, and each problem has a path and a fix.
- **Cheap is a number, not a heuristic.** First-fit decreasing paid 15% too much for the bookshelf pine and up to 27% in random tests. 1.0 searches for the lowest cost.
- **Lint every sentence.** The 0.1 linter read only the first sentence of each text.
- **Installers copy one folder.** The skills CLI, Codex and Agent Skills hosts copy only the folder that holds a `SKILL.md`, and the directory blocks symlinks. So each of the nine skills carries its own copy of the engine, and a script keeps the copies equal.
- **Names share one folder.** Installers put skills side by side in one flat folder, and other packs already use the name `jig`. So every sub-skill name starts with `jig-`.
- **JSON runs no code.** A `project.mjs` from a stranger runs when loaded. 1.0 prefers `project.json`.
- **Accessibility is part of the build.** 0.1 failed contrast in two places, turned the 3D with no pause, and lost the keyboard focus. 1.0 checks contrast, follows the WAI-ARIA tabs pattern and adds keyboard orbit.

## 13. Known limits of 1.0

- Parts are boxes and cylinders, with rotation. Curved parts and cut joinery are not drawn.
- Board cuts are exact up to 14 pieces of one material, then a heuristic takes over. Sheets use guillotine cuts, which a skilled person can sometimes beat.
- The STE linter checks the writing rules, not the dictionary.
- Prices and times are estimates unless the user gives them.
- The page and the rules are in English only.
