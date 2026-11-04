# CLI reference

`engine/jig.mjs` is the one command-line tool of the pack. Every skill runs it. It needs Node.js 22 or later and no npm packages.

```
node engine/jig.mjs <command> [file] [options]
```

- Inside a skill, the path is `${CLAUDE_SKILL_DIR}/engine/jig.mjs`. If your agent does not fill in `${CLAUDE_SKILL_DIR}`, use the folder that holds SKILL.md.
- Run the commands from the user's folder. Relative paths start from the current folder.
- Windows paths and POSIX paths both work. Put quotes around a path that has spaces.
- `node engine/jig.mjs --help` lists the commands. `node engine/jig.mjs <command> --help` (or `help <command>`) lists the options of one command.
- The help and the hints show the path of the engine from the current folder (`node engine/jig.mjs` in the repo, the path of the skill copy elsewhere), so you can paste a hint as it is. The `--help` text ends with `Reference:` and the path of this file from the current folder (an absolute path when it is on another drive).

## Contents

1. [Commands](#1-commands)
2. [Rules for every command](#2-rules-for-every-command)
3. [The JSON report](#3-the-json-report)
4. [new](#4-new)
5. [check](#5-check)
6. [build](#6-build)
7. [plan, boq, cut, buy](#7-plan-boq-cut-buy)
8. [safety](#8-safety)
9. [lint](#9-lint)
10. [capture](#10-capture)
11. [schema](#11-schema)
12. [Examples in PowerShell and POSIX shells](#12-examples-in-powershell-and-posix-shells)
13. [Errors and fixes](#13-errors-and-fixes)

## 1. Commands

| Command | Mode | Does | Output |
|---|---|---|---|
| `new <id>` | - | Writes a starter project from [../templates/starter.json](../templates/starter.json) | `<id>/project.json` |
| `check <project>` | guide | Validates and computes the project, then prints the report | The report only |
| `build <project>` | guide | Checks the project, then writes the guide page | `<id>.html` next to the project |
| `plan <project>` | plan | Writes the step-by-step plan | Markdown or JSON |
| `boq <project>` | estimate | Writes the bill of quantities with the totals | Markdown, CSV or JSON |
| `cut <project>` | estimate | Writes the cut list, or a to-scale drawing for each material | Markdown, JSON or SVG files |
| `buy <project>` | estimate | Writes the shopping list: online orders first, then one trip for each store | Markdown or JSON |
| `safety <project>` | plan | Writes the safety review: tip-over, power tools, protective equipment, hand-offs, cleared hand-off hits, findings | Markdown or JSON |
| `lint <file\|->` | - | Lints text, Markdown or a whole project with the STE rules | The findings |
| `capture <page\|url>` | - | Makes a PNG or WebP image of a page in headless Chrome or Edge | The image, console errors, sideways scroll, a route that the page changed |
| `schema` | - | Prints the JSON Schema of the project format | JSON |

The mode sets what the project must have:

- The estimate mode needs materials and parts.
- The plan mode also needs steps that install each part one time.
- The guide mode also needs a position (`at`) on every part.

[format.md](format.md) section 12 has the details.

A project is a `.json` file, or a `.mjs` or `.js` module whose default export is the project. A module runs as code, so read a module from someone else before you use it.

A `.json` project and a text file for `lint` can be UTF-8 (with or without a byte order mark) or UTF-16 with a byte order mark. Windows PowerShell 5.1 writes UTF-16 with `>` and `Out-File`. UTF-16 with no byte order mark stops with exit code 3: save the file as UTF-8.

## 2. Rules for every command

**Streams.** Text for people goes to stderr: the report, the problems, the files written. Data goes to stdout: Markdown, CSV, JSON or the schema. With `--out`, the data goes to that file and stdout stays empty. `--out -` is not stdout: jig stops with exit code 2 and writes no file. Leave out `--out` to print the data on stdout.

**Options.** Write `--name value` or `--name=value`. A value that starts with `-` needs the `=` form: `--name=-5`. An unknown option stops the command with exit code 2 and the nearest option name: `Unknown option "--strcit" for check. Did you mean "--strict"?`.

**Output files.** The engine makes the folders of an output path. When `--out` names a folder that exists, or ends with `/` or `\`, the file goes into that folder with its default name:

| Command | Default file name |
|---|---|
| `build` | `<id>.html` (section 6) |
| `plan`, `boq`, `cut`, `buy`, `safety` | `<id>-<command>.<format>`, for example `pine-bookshelf-boq.csv` |
| `cut --format svg` | `<id>-cut-<material>.svg` |
| `capture` | `<page name>[-<hash>].png` |
| `schema` | `project.schema.json` |

Options of every command:

| Option | Does |
|---|---|
| `--report json` | Prints the JSON report (section 3) on stdout. The text for people stays on stderr. Data then goes only to `--out` files |
| `--quiet`, `-q` | Prints no text for people. A failure still prints one line, for example `jig check: 2 errors block the command.` |
| `--debug` | Adds the stack trace to an error line |
| `--help`, `-h` | Prints the help of the command and exits with 0 |

`node engine/jig.mjs --version` prints `jig` and the engine version.

Exit codes:

| Code | Meaning |
|---|---|
| `0` | Done |
| `1` | Problems block the command: errors in the project, STE findings and the warning `W_CLEARED_UNUSED` with `--strict`, any finding of `lint`, console errors on `capture`, or a page that shows another route than `capture --hash` asked for. With `--force` the output is written, and the code is still 1 |
| `2` | Usage error: an unknown command or option, a wrong option value, no file argument, an `--out` of `-`, an output path that clashes with another file. Two clashes stop every command: an `--out` that is the project file (also in other letter case, or by another path to the same file: a junction or linked folder, an 8.3 short name, `project.json::$DATA`), and `cut --format svg` drawing names that differ only in letter case |
| `3` | Input or output failure: a file that is missing or cannot be read, bad JSON, UTF-16 with no byte order mark, a module that fails to load, a file that cannot be written, an output path that is a symbolic link or a hard link to another file, an output path in a folder that is a symbolic link or a junction below the first folder that holds the path (the project folder, else the current folder; jig also finds that folder by its identity, through an 8.3 short name, a UNC share or a link above it), no browser, a page that does not open, an internal error |

Text from the project that goes to the terminal or into Markdown has its control characters (escape, carriage return, bell and others) changed to U+FFFD. Markdown output also escapes `\`, `<` and `[`, so project text cannot add HTML, a link or an image. In the report of `check` and `lint`, a line break in a project value becomes a space, so each problem stays on its own line.

An error prints one line on stderr. Add `--debug` to see the stack trace. An example:

```
jig check: pine/project.json:14:5: The JSON is not valid: Expected ',' or '}' after property value. Look for a missing or extra comma, quote or bracket near this place.
```

## 3. The JSON report

`--report json` prints one JSON object on stdout:

```json
{
  "ok": true,
  "engine": "x.y.z",
  "command": "check",
  "project": { "id": "pine-bookshelf", "title": "Pine bookshelf" },
  "counts": { "error": 0, "warn": 0, "ste": 0, "info": 1 },
  "problems": [
    { "level": "info", "code": "I_ESTIMATE", "path": "estimate", "where": "project", "msg": "The prices are estimates.", "hint": "Replace them with the prices at your store. ..." }
  ],
  "totals": { "subtotal": 231.06, "contingency": 23.11, "total": 254.17, "currency": "USD", "...": "..." },
  "outputs": []
}
```

| Field | Meaning |
|---|---|
| `ok` | `true` when the exit code is 0 |
| `engine` | The engine version, as `jig --version` prints it |
| `command` | The command that ran |
| `project` | `{ id, title }` of the project, or `null` (`capture`, `schema`, text `lint`) |
| `counts` | Problems by level: `error`, `warn`, `ste`, `info` |
| `problems` | Each problem: `level`, `code`, `path` (a JSON path into the project, such as `steps[3].do[1]`), `where` (for people, such as "step 4, line 2"), `msg` (what is wrong), `hint` (how to fix it). [format.md](format.md) section 13 has every code |
| `totals` | Subtotal, contingency, tax, total, currency, finished area and the count of unknown prices. `null` for `lint` and when there is no project |
| `outputs` | The absolute path of each file written. Data printed on stdout is not in the list |

Some commands add one field:

| Field | Command | Holds |
|---|---|---|
| `safety` | `safety` | The safety summary: `tip`, `ppe`, `handoffs`, `power`, `notes`, `cleared` |
| `capture` | `capture` | `url`, `route` (the hash the page shows), `routeMismatch`, `consoleErrors`, `sidewaysScroll` |
| `error` | any known command, on exit code 2 or 3 | `{ exit, message }`. `ok` is `false` and the other fields are empty |

## 4. new

```
node engine/jig.mjs new <id> [--units mm|in] [--dir path] [--title text]
```

Writes `project.json` from the starter template. The starter is a small pine stand: a top, two legs, screws, two tools you have, and two steps with checks. It checks with 0 errors, 0 warnings and 0 STE findings. Change its materials, parts and steps to your project.

| Option | Does |
|---|---|
| `--units mm\|in` | The unit of every length in the file. Default: `mm`. With `in`, each length changes to inches (nearest 1/16 in) and each finish coverage changes to ft² |
| `--dir path` | The folder for `project.json`. Default: a folder named `<id>` in the current folder |
| `--title text` | The title. Default: made from the id: `pine-bookshelf` gives "Pine bookshelf" |

- The id is lower-case letters, digits and single hyphens, 64 characters or fewer: `pine-bookshelf`. Another id stops with exit code 2.
- `new` never writes over a file. If `project.json` exists in the folder, it stops with exit code 3.
- `new` can write a new `project.json` through a linked folder above its `--dir`, because it never writes over a file. A message about a link names `--dir`.

## 5. check

```
node engine/jig.mjs check <project> [--strict]
```

Validates and computes the project in guide mode, then prints the report. The report gives the counts, the cost and the time, then every problem with its place and its fix. `check` writes no file.

- Exit code 1 when the project has errors. With `--strict`, STE findings also give exit code 1, and so does the warning `W_CLEARED_UNUSED` (a `safety.cleared` entry that clears nothing). Other warnings and the info codes never change the exit code.
- Fix every problem in the project, never in the rule. The goal is 0 errors, 0 warnings and 0 STE findings.

## 6. build

```
node engine/jig.mjs build <project> [--out file] [--artifact] [--offline] [--tabs list] [--json] [--force] [--strict]
```

Checks the project in guide mode, then writes one self-contained HTML page.

| Option | Does |
|---|---|
| `--out file` | The page path. A folder puts the page in it with its default name |
| `--artifact` | Writes a page body (title, the `claude:viewport-fit-sides` meta, fonts, style, body) for the Artifact tool. Its host adds the standard viewport meta. For any other host, publish the full `<id>.html` |
| `--offline` | Puts three.js 0.160.0 into the page, so the 3D view works with no network. The page gets about 0.9 MB larger, because it stores three.js (about 700 KB) as base64. The whole page is then about 1 MB |
| `--tabs list` | The tabs to show, from `plan,shop,cut,build`, in any order. One tab hides the tab bar. A project with nothing to cut and nothing to print (a kit of bought parts) has no cut tab: `--tabs` leaves `cut` out, and `--tabs cut` alone stops with exit code 2 |
| `--json` | Also writes the computed model as JSON next to the page |
| `--force` | Writes the page also when the project has errors. The exit code stays 1. Never share a page built with `--force` |
| `--strict` | STE findings and the warning `W_CLEARED_UNUSED` also stop the build |

The gate: when the project has errors (or, with `--strict`, STE findings or `W_CLEARED_UNUSED`), `build` writes no file and exits with 1. The report says what to fix.

Output paths:

| Options | Page | Model with `--json` |
|---|---|---|
| none | `<id>.html` next to the project | `<id>.json` next to the page |
| `--tabs build` | `<id>-3d.html` | `<id>-3d.json` |
| `--artifact` | `<id>-artifact.html` | `<id>-artifact.json` |
| `--tabs build --artifact` | `<id>-3d-artifact.html` | `<id>-3d-artifact.json` |
| `--out guide/page.html` | `guide/page.html` | `guide/page.json` |

- The model path is the page path with its extension changed to `.json`. If the two paths are the same (for example `--out page.json --json`), `build` stops with exit code 2 and writes nothing.
- An output path that is the project file stops with exit code 2, also when it reaches the project file by another path (a junction or linked folder, an 8.3 short name, `::$DATA`).
- An output path that is a symbolic link or a hard link to another file stops with exit code 3. So does an output path in a folder that is a symbolic link or a junction, below the first folder that holds the path: the project folder, else the current folder. jig finds that folder by its name or by its identity, so an 8.3 short name, a UNC share (`\\localhost\C$`) or a link above it does not get past the check. A current folder inside a linked folder of the project does not get past it either. On Linux and macOS, where the system gives jig only the real path of the current folder, jig also checks the path by the name of the current folder that the shell keeps in `$PWD`, when that name is the same folder. There, as in every other program, `..` in a path goes up from the real folder. jig does not write through links. A project that you open through a linked folder still writes next to itself.
- If the id is not valid (only with `--force`), the file name comes from the project file name.
- The first `--offline` build downloads three.js from cdn.jsdelivr.net and checks the sha384 hash of each file. It keeps a copy in the folder `jig-three-cache` in the temporary folder of the system. Later builds use the copy and need no network.
- The engine is deterministic: one project and one set of options give the same bytes on every machine.

## 7. plan, boq, cut, buy

```
node engine/jig.mjs plan <project> [--level new|some|pro] [--format md|json] [--out file] [--force] [--strict]
node engine/jig.mjs boq  <project> [--format md|csv|json] [--out file] [--force]
node engine/jig.mjs cut  <project> [--format md|json|svg] [--out file] [--force]
node engine/jig.mjs buy  <project> [--format md|json] [--start YYYY-MM-DD] [--out file] [--force]
```

Each command prints the report on stderr. It writes its output to stdout, or to the `--out` file. The plan command runs in plan mode. The boq, cut and buy commands run in estimate mode, so they need no steps and no positions.

- When the project has errors, the command writes no output and exits with 1. `--force` writes the output; the exit code stays 1.
- An `--out` that is the project file stops with exit code 2 before the report prints, and the project stays as it is.
- `plan --strict` also stops on STE findings and on `W_CLEARED_UNUSED`.
- `--level` sets the reader level of the plan: `new` (First time: every line, technique cards, Why notes), `some` or `pro`. Default: the `level` of the project.
- In the plan, a step with `prints` has a "Prints:" line: the printed parts and their printer time, which is part of the waiting time of the step.
- `--start` is the first day of the build. Each trip of the shopping list gets an order-by date: the start date minus the store's lead days. A date that is not a real `YYYY-MM-DD` date stops with exit code 2.
- Default format: `md`. Markdown output has no HTML.

| Command | `--format json` holds |
|---|---|
| `plan` | `{ engine, meta, plan, steps, tools, techniques, safety }` |
| `boq` | `{ engine, meta, boq, totals }` |
| `cut` | `{ engine, meta, parts, cuts, prints }`. Each part has `id`, `label`, `name`, `material`, `kind`, `cut`, and a 3D-printed part also `print` (`grams`, `hours`, `settings`, `est`, `step`). `prints` is there only when the project has printed parts: one entry for each printed material, `{ material, name, count, grams, hours, step, parts: [{ label, name, qty, grams, hours, settings, est }] }`. Lengths are in mm, also in an inch project |
| `buy` | `{ engine, meta, purchase, boq, totals }`. Each trip lists the `key` of its BOQ rows in `items` |

`boq --format csv` writes one row for each BOQ line, then the totals. The columns: `code, group, item, spec, need, need_qty, qty, unit, rate, amount, currency, est, get, store, first_step, note`. Lines end with CRLF.

- `need_qty` is in the project unit: mm or in of cut length for boards, m² or ft² for sheets, pieces for `each` materials, the material unit for `amount` materials, grams of filament for `printed` materials, the count for tools. The JSON output stays in mm and m².
- `rate` is the price as given (up to 4 decimals in Markdown: `$0.045`). `amount` is qty × rate, rounded to the minor unit of the currency.
- If a text cell starts with `=`, `+`, `-` or `@`, the engine puts `'` before it. It does the same for one of these characters right after a `;`, a line break or a tab. Then a spreadsheet does not run the text as a formula.
- A line break inside a text cell is LF. Control characters become U+FFFD.

`cut` prints a "Plan:" line under each board material:

- `Plan: proven lowest cost.`: no plan costs less. The exact search (14 pieces or fewer) finished, or the fast search (more than 14 pieces) made a plan at the lower bound.
- `Plan: the best plan found, not proven lowest cost. The search stopped early.`: the exact search hit its limit.
- `Plan: the best plan found, not proven lowest cost. The material has more than 14 pieces, so a fast search made the plan.`: no search stopped; a fast search packs a material with more than 14 pieces. The JSON output gives `search: "exact"` or `"fast"` next to `optimal` on each board material.

The totals of each material equal its BOQ amounts. The kerf and the trim show to 1/64 in ("3/32 in"), or as decimal inches when the value is not on a 1/64 in step.

A project with 3D-printed parts gets the title "Cut and print list", or "Print list" when it has no part to cut (then no kerf line). The Parts table holds the cut and the bought parts. A "Printed parts" table follows it: part letter, name, quantity, grams and hours for one part, material and print settings. A value that the engine estimates from the part size has the mark `est`. Under the table, one line for each printed material gives its parts, grams, printer hours and the spools to buy, as the BOQ row.

`cut --format svg` always writes files, one for each board or sheet material. Material ids that differ only in letter case (`Pine` and `pine`) would get the same file name on Windows and macOS: the command stops with exit code 2 and writes nothing.

| Options | Files |
|---|---|
| none | `<id>-cut-<material>.svg` next to the project |
| `--out drawings/cut.svg` | `drawings/cut-<material>.svg` |
| `--out drawings/` | `drawings/<id>-cut-<material>.svg` |

## 8. safety

```
node engine/jig.mjs safety <project> [--format md|json] [--out file]
```

Checks the project in plan mode and writes the safety review:

- Tip-over: the height, the depth of the base, the ratio and its limit, and whether a part attaches the object to a wall.
- The power tools, the protective equipment and the notes for each tool and finish.
- The hand-offs: the work a professional does. A topic id shows as its name: `mains` reads "Mains electrical work".
- The cleared hand-off hits: for each `safety.cleared` entry that clears a hit, the topic, the entry number, the `why`, and each text that the screen found, with its place, the words it found and the text itself. The hand-off screen is a safety net that also gives false alarms, and `safety.cleared` records a false alarm ([safety.md](safety.md) section 11). This section lets a person read each override. A project with no cleared hit says "Cleared hand-off hits: none."
- The findings: the errors `E_POWER_NO_WARNING`, `E_TIP_OVER` and `E_HANDOFF`, the warnings `W_TIP_SMALL` (an object under 600 mm (24 in) over the tip ratio) and `W_CLEARED_UNUSED` (a `safety.cleared` entry that clears nothing), and the info codes `I_TIP_UNCHECKED` (a part has no position, so the tip-over rule did not run), `I_OLD_PAINT` (a text works on old paint, and no lead-paint hand-off or cleared entry covers it) and `I_HANDOFF_CLEARED` (a `safety.cleared` entry clears the hits of its topic), each with its place and its fix.

An example of the cleared section:

```
## Cleared hand-off hits

The hand-off screen found these words, and safety.cleared says that they are not hand-off work. Read each text. If a text is hand-off work, remove the entry and add the hand-off.

- **Gas work**, cleared entry 1: The weed burner runs on a small propane tank. The guide makes no gas connection.
  - step 2, line 4: "propane" in: Keep the propane tank of the weed burner 3 m from the bench.
```

The command always writes the review. The exit code is 1 when the project has errors; the warning and the info codes do not change it. With `--format json`, the output is `{ engine, meta, safety, findings }`, and `findings` holds these eight codes. Each entry of `safety.handoffs` has `topic`, `text` and `name`. Each entry of `safety.cleared` has `topic` (the topic id), `name`, `why`, `entry` (the index in `safety.cleared` of the project) and `hits`: each text that it clears, as `{ path, where, text, context }`. `text` is the words that the screen found. `context` is the text itself, with each run of white space as one space, up to 160 characters (159 and "…" when it is longer). The report gets a `safety` field. The guide page leaves out `safety.cleared`.

## 9. lint

```
node engine/jig.mjs lint <file|-> [--kind procedure|warning|description|title] [--terms a,b] [--verbs a,b]
```

Lints text with the STE rules that a script can test. `-` reads the text from stdin. The rules:

- Sentence length.
- A command verb first, and one instruction in each sentence.
- The condition first.
- No -ing forms and no passive.
- The words that STE replaces.
- With `--kind warning`, a risk after the command (`STE_WARN_NO_RISK`): "Wear safety glasses. The bit can throw chips into your eyes."

| Kind | Use it for | Word limit |
|---|---|---|
| `procedure` (default) | Instructions and checks | 20 in each sentence |
| `warning` | WARNING and CAUTION text: a command first, then the risk | 20 |
| `description` | Why notes, tips and summaries | 25 |
| `title` | Step titles: one command | 10 |

- `--terms` lists technical names that the linter accepts, for example `--terms "Pocket hole,Kreg"`. `--verbs` lists extra command verbs (trade verbs such as `epoxy`). Put commas between the items.
- A `.json`, `.mjs` or `.js` file is a project. A `.mjs` or `.js` file runs as code when lint loads it (section 1), so never lint a module that you did not write. To lint the text in a code file or any other file, copy the text into a `.txt` file first. The linter reads every reader text of the project, each with its own kind. These texts are the summary, the titles, the lines, the warnings, the checks, the notes, the hand-offs, the `why` of each `safety.cleared` entry and the project technique cards.
- A project lint uses the `terms` and `verbs` of the project. `--terms` and `--verbs` add to them. `--kind` has no effect.
- In a text or Markdown file, each line is one text. A line that starts with a lower-case letter continues the line before it, when that line does not end a sentence.
- The linter skips these Markdown parts: front matter, code blocks, headings, tables, HTML lines, link definitions and rules. It removes list markers, quote markers, tick boxes, emphasis and link addresses before the lint.
- Each finding gives `where` ("line 7"), `path` (`steps.md:7`, or a JSON path in a project), the rule code, `msg` and `hint`.
- The exit code is 1 when there is one finding or more.

The linter cannot see meaning. [ste.md](ste.md) has the rules that you check yourself.

## 10. capture

```
node engine/jig.mjs capture <page.html|url> [--out file] [--hash route] [--width px] [--height px] [--scale n]
                            [--theme light|dark] [--select css] [--wait ms] [--reduced-motion]
```

Opens the page in headless Chrome, Chromium or Edge, writes an image, and prints the console errors and whether the page scrolls sideways.

| Option | Default | Does |
|---|---|---|
| `--out file` | `<page name>[-<hash>].png` next to the page; for a URL, `capture[-<hash>].png` in the current folder | The image. The extension sets the format: `.png` or `.webp` |
| `--hash route` | none | The tab or step to open: `plan`, `shop`, `cut`, `build/4` (steps count from 1) |
| `--width px` | 1280 | The window width. Use 390 for a phone |
| `--height px` | 900 | The window height |
| `--scale n` | 1 | The device pixel ratio. Use 2 for a close-up |
| `--theme` | `light` | The colour scheme that the page sees |
| `--select css` | the full page | Clips the image to the first element that matches. The element scrolls into view first |
| `--wait ms` | 4000 | The time to wait after the page loads. WebGL needs time to start and the parts need time to fly in |
| `--reduced-motion` | off | The page sees `prefers-reduced-motion: reduce` |

How it works:

- The search for a browser looks first at the `JIG_BROWSER` variable, then at `CHROME_PATH`. Then it looks in the standard install folders of Chrome, Chromium and Edge. A variable that names a missing file prints a warning on stderr, and the search goes on.
- The browser starts with a new temporary profile. The command removes the profile at the end, also after Ctrl+C. It also removes `jig-capture-*` profiles older than 1 hour that a stopped capture left. WebGL runs in software (SwiftShader), so the 3D view draws with no graphics card.
- The browser opens the page file or the URL that you give it. The capture command gives the browser switches that turn off its sync, pings and optimization-guide downloads. These switches do not stop all background traffic. Each time it starts, the browser still sends its own background requests to its maker (Google or Microsoft). With Chrome, this is about 10 requests: update checks, component downloads, a sign-in check, a time check and a device check-in. These requests carry no project data.
- The page opens with `?capture` added to its address, so the 3D viewer keeps its last frame for the image. The hash stays.
- Console errors are `console.error` calls, failed `console.assert` calls, uncaught exceptions, and browser errors. Failed network requests do not count: a guide with no network says in its viewer slot why the 3D view is empty.
- Without `--select`, the image is the full page height (16000 px or less) at the window width.
- The exit code is 1 when the page has console errors. Sideways scroll prints `Sideways scroll: yes` but does not change the exit code.
- A guide page changes a step that it does not have: `--hash build/99` on a page with 10 steps shows step 10. The image then shows another view, so the command prints `Route: #build/10 (asked for #build/99)` and exits with 1. `--hash build` with no step number is no mismatch.
- No browser found: exit code 3. Install Chrome or Edge, or set `JIG_BROWSER` to the browser program.

## 11. schema

```
node engine/jig.mjs schema [--out file]
```

Prints the JSON Schema (draft 2020-12) of the project format. It is the same as [../schema/project.schema.json](../schema/project.schema.json).

## 12. Examples in PowerShell and POSIX shells

The commands are the same in each shell. Only variables, loops and the reading of the exit code change.

Start a project, check it, and build the page (PowerShell):

```powershell
$jig = "C:/path/to/skill/engine/jig.mjs"
node $jig new pine-bookshelf --units mm --dir pine-bookshelf
node $jig check pine-bookshelf/project.json
node $jig build pine-bookshelf/project.json --strict
"exit code: $LASTEXITCODE"
```

The same in a POSIX shell (macOS, Linux):

```sh
JIG=/path/to/skill/engine/jig.mjs
node "$JIG" new pine-bookshelf --units mm --dir pine-bookshelf
node "$JIG" check pine-bookshelf/project.json
node "$JIG" build pine-bookshelf/project.json --strict
echo "exit code: $?"
```

Read the counts from the JSON report (PowerShell):

```powershell
$r = node $jig check pine-bookshelf/project.json --report json --quiet | ConvertFrom-Json
$r.counts
```

POSIX shell:

```sh
node "$JIG" check pine-bookshelf/project.json --report json --quiet \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).counts))"
```

Write each output to a file (the commands are the same in both shells):

```
node engine/jig.mjs plan pine-bookshelf/project.json --level new --out pine-bookshelf/plan.md
node engine/jig.mjs boq pine-bookshelf/project.json --format csv --out pine-bookshelf/boq.csv
node engine/jig.mjs cut pine-bookshelf/project.json --format svg --out pine-bookshelf/drawings/
node engine/jig.mjs buy pine-bookshelf/project.json --start 2026-11-14 --out pine-bookshelf/buy.md
node engine/jig.mjs build pine-bookshelf/project.json --tabs build --offline --strict
```

Lint text from stdin (PowerShell, then POSIX):

```powershell
"Using a drill, make the holes." | node $jig lint - --kind procedure
```

```sh
printf 'Using a drill, make the holes.\n' | node "$JIG" lint - --kind procedure
```

Capture every step of a guide with 10 steps (PowerShell, then POSIX):

```powershell
foreach ($n in 1..10) { node $jig capture pine-bookshelf/pine-bookshelf.html --hash "build/$n" --out ("pine-bookshelf/shots/step-{0:D2}.png" -f $n) }
```

```sh
for n in $(seq 1 10); do node "$JIG" capture pine-bookshelf/pine-bookshelf.html --hash "build/$n" --out "pine-bookshelf/shots/step-$(printf %02d "$n").png"; done
```

Use a browser that is not in a standard folder:

```powershell
$env:JIG_BROWSER = "D:/apps/chrome-win64/chrome.exe"
```

```sh
export JIG_BROWSER=/opt/chrome/chrome
```

## 13. Errors and fixes

| Error line | Fix |
|---|---|
| `Unknown command "bild". Did you mean "build"?` | Correct the command name |
| `Unknown option "--strcit" for check. Did you mean "--strict"?` | Correct the option. If the line names other commands, the option belongs to them |
| `The file "x/project.json" does not exist.` | Correct the path. Relative paths start from the current folder |
| `project.json:14:5: The JSON is not valid: ...` | Open the file at line 14, column 5. Look for a missing comma, an extra comma before `}` or `]`, or a missing quote |
| `project.mjs:9: The module cannot be loaded: SyntaxError: ...` | Correct the code at that line, or write the project as JSON |
| `The module has no default export.` | Write `export default { ... }` with the project object |
| `Stopped: the project has 2 errors. Fix the problems above, then run the command again.` | Read the problems above the line. Fix the project, then run the command again |
| `The output "x/project.json" is the project file. Give --out another name.` | Give `--out` another file name. The project did not change |
| `The file "x" is a link to another file. jig does not write through links.` | Remove the link, or give `--out` another path |
| `The folder "x" is a link to another folder. jig does not write through links. ...` | Remove the link, or give `--out` a path in a real folder |
| `The cut drawings of materials "Pine" and "pine" get the same file name ...` | Give one of the materials another id |
| `The file "x" looks like UTF-16 with no byte order mark. Save it as UTF-8.` | Save the file as UTF-8 in your editor |
| `--json would write the model over the page` | Give `--out` a name that ends in `.html` |
| `The file "x/project.json" exists, and new does not write over a file.` | Give another `--dir`, or use the file that is there |
| `--start cannot be "2026-02-30".` | Write a real date as `YYYY-MM-DD` |
| `three.js cannot be loaded for --offline: ...` | Connect to the network one time. Later offline builds use the copy in the temporary folder |
| `No Chrome, Chromium or Edge found.` | Install Chrome or Edge, or set `JIG_BROWSER` to the browser program |
| `The page "x.html" cannot open: ...` | Correct the path or the URL. Build the page first |
| `No element matches --select "x".` | Correct the CSS selector, or leave out `--select` |
| `Internal error: ...` | Run the command again with `--debug`, and report the error with the project file |
