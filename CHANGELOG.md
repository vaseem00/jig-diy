# Changelog

All notable changes to this project are in this file.

The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html). One version covers the whole pack: the plugin, every skill and the engine.

## [Unreleased]

## [1.0.0] - 2026-11-03

The first public release. Jig turns a DIY project into one interactive build guide: a step-by-step plan, a bill of quantities, a purchase plan, a to-scale cut list and a 3D viewer that assembles the object part by part. The text follows the writing rules of ASD-STE100 Simplified Technical English, and a level switch serves a first-timer and an expert. Nine Agent Skills share one engine. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) is the contract for this release.

### Added

**Nine skills**

| Skill | Does |
|---|---|
| `jig` | The full interactive guide: plan, shopping, cut list and 3D build steps on one page |
| `jig-plan` | A printable step-by-step plan |
| `jig-boq` | A bill of quantities with a cost estimate |
| `jig-buy` | A purchase plan: online orders first, one trip for each store, order-by dates |
| `jig-cut` | A cut list for boards and sheets, with to-scale drawings |
| `jig-3d` | The 3D assembly viewer only |
| `jig-ste` | Writes, rewrites and lints procedures in ASD-STE100 style |
| `jig-safety` | A safety review of a plan, a project file or a guide |
| `jig-verify` | Checks a built guide page with screenshots and a checklist |

Each skill carries its own copy of the engine, so a skill works when it is installed alone.

**The engine**

- `engine/jig.mjs`: one command-line tool in plain Node.js, with no npm packages. The commands: `new`, `check`, `build`, `plan`, `boq`, `cut`, `buy`, `lint`, `safety`, `capture` and `schema`.
- One project file (`project.json`) holds the materials, the tools, the parts with real sizes and positions, and the steps. The engine computes every number from it: the cut plan, the quantities, the cost, the time and the 3D. A JSON Schema (draft 2020-12) describes the format.
- Each problem has a code, a path into the project, a message and a fix, with "did you mean" for typos. `build` writes a page only when the project has 0 errors. `--strict` also stops on STE findings and on a `safety.cleared` entry that clears nothing.
- `--report json` on every command, and fixed exit codes: 0 done, 1 problems, 2 usage error, 3 input or output failure.
- Millimetre and inch projects (inches as fractions to 1/16 in), any ISO 4217 currency, sales tax or VAT, and a contingency.
- The same project gives the same output, byte for byte.
- Geometry checks in guide mode: parts that overlap (`E_GEOMETRY`), parts that float (`W_FLOATING`) and screws that miss a part (`W_FASTENER`).
- The build option `--artifact` writes the page body for the Artifact tool.

**The outputs**

- **Guide page** (`build`): one self-contained HTML file with Plan, Shop, Cut list and Build tabs, a level switch, light and dark themes, print, keyboard control and screen-reader support. The 3D viewer loads three.js 0.160.0 with Subresource Integrity, or holds it inline with `--offline`. Without network or WebGL, the text of every tab still works.
- **Plan** (`plan`): the steps for one reader level, in Markdown or JSON.
- **Bill of quantities** (`boq`): exact need, packs to buy, codes in each group, contingency and tax, in Markdown, CSV or JSON.
- **Purchase plan** (`buy`): one trip for each store, a Borrow trip for borrowed tools, and order-by dates.
- **Cut list** (`cut`): the lowest-cost boards and sheets with kerf, end trim and grain, in Markdown, JSON or one SVG drawing for each material.
- **3D build steps**: each step lights the parts that it adds, with letters on the parts and rings on the screw heads.
- **Technique cards**: 12 built-in cards, such as measure and mark, a pilot hole, a glue joint and a wipe-on finish. A card opens the first time a First time reader meets it. A project can add its own cards, or replace a built-in card with a card that has the same id.
- **Safety review** (`safety`): tip-over, power tools, protective equipment, hand-offs, cleared hand-off hits and the safety findings, in Markdown or JSON.
- **STE lint** (`lint`) of any text, Markdown file or project, and **screenshots** (`capture`) of a page in headless Chrome or Edge, with console errors and sideways scroll.
- Three example projects with their built pages: `pine-bookshelf`, `raised-garden-bed` (inches) and `plywood-storage-cube` (sheet goods).

**Safety**

- A WARNING before every step that uses a power tool.
- Tip-over: an object 600 mm (24 in) tall or more needs a wall fixing above its height-to-depth limit. A smaller object gets a warning. `safety.tipRatio` sets the limit, for example 1 for a step stool.
- The hand-off screen: a text about gas, mains wiring, structural work, roofs or work above 2 m, permits, asbestos or lead paint stops the build until `handoff` names the professional. The guide gives no steps for that work.
- The screen is a safety net. A false alarm goes in `safety.cleared` with its reason, and the safety review lists each text that an entry clears, so that a person reads every override. Old paint gets a question about its age.
- Protective-equipment notes by tool, material and finish.
- Guidance for regulated and high-risk builds: children's products (bunk and loft beds, changing tables, toy boxes, toys for a child under 3, climbing toys) with their standards, a high chair, a safety gate and other products that hold a child under 5, lids that a child can lift, furniture that carries a person, bought kits and mechanisms, TV mounts and loads on walls and ceilings, wood near a stove, a heater or a fire pit, swings and other outdoor builds, and lamps (a new mains cord, plug or lamp holder is mains work).
- A general rule for a product that the safety docs do not name: its hazard classes and the safety standard of the country. The agent gives no safety gap, load limit or clearance from memory.

**Channels**

- Claude Code: the plugin `jig` in the marketplace `jig-diy`. The skills answer as `/jig:<name>`.
- The skills CLI and skills.sh (`npx skills add`), for Claude Code, Codex, Cursor, Antigravity CLI and other agents.
- Codex, Cursor, GitHub Copilot and VS Code: an Agent Plugins manifest, and `agents/openai.yaml` for each skill.
- Gemini CLI: an extension manifest.

**Requirements**

- Node.js 22 or later for the engine. There is nothing to install.
- Chrome or Edge on the same machine for `capture` and `jig-verify` only.
- A browser with WebGL for the 3D view.

### Known limits

- The hand-off screen is a safety net. It finds common words only: it misses some work, and it gives some false alarms. The agent reads each step for its meaning. A `jig-safety` review is not a professional inspection.
- Prices are estimates unless the user gives them. The page marks each estimated price `est`. Times are estimates for an experienced person, and the page changes them for the level of the reader.
- A board cut plan is proven lowest cost up to 14 pieces of one material. A larger set gets a fast search, and the `cut` output says which.
- Parts are boxes and cylinders. Joinery shows as simple shapes.
- The writing rules are the ones that a script can test. The text is not certified STE, and it is in English only.

## [0.1.0] - 2026-11-02

The private first version, a single personal skill at `~/.claude/skills/jig`. It was not published.

### Added

- One `jig` skill: SKILL.md, a model in `kit/model.mjs`, an STE linter, technique cards, a three.js viewer, a page builder (`scripts/build.mjs`) and references.
- The pine bookshelf example as a `project.mjs` module with its built pages.

[Unreleased]: https://github.com/vaseem00/jig-diy/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/vaseem00/jig-diy/releases/tag/v1.0.0
