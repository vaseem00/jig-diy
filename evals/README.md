# Plugin evals

This folder is the `claude plugin eval` suite for the `jig` plugin. Each case sends a realistic prompt to Claude Code with the plugin loaded, and again with no plugin, and grades what Claude did and wrote.

> **WARNING: These runs cost money.** Each run and each `llm` grader is a real model call on your Claude plan or your API account. Always set `--max-cost-usd`.

The `evals/evals.json` and `evals/triggers.json` files inside each `skills/<name>/` folder are a different format, for the skill-creator plugin. `claude plugin eval` reads only this folder.

## The cases

| Case | Prompt | Skill that must start | Graded on |
|---|---|---|---|
| `full-guide-planter` | A first-timer asks for a full guide for a small planter box, in EUR | `jig` | A strict `build`, `planter-box/project.json`, `planter-box/planter-box.html` from the engine with 0 errors, a power tool marked, and the reply |
| `boq-garden-bench` | A cost estimate for a garden bench in AUD with GST, no guide | `jig-boq` (and not `jig`) | The `boq` command, `bench/boq.md` with group codes, GST and a total, and no HTML page |
| `cut-list-imperial` | A cut list in inches from 6 ft and 8 ft boards | `jig-cut` | The `cut` command, `bookcase/cuts.md` in inch fractions with no millimetres, the cheapest boards (three 6 ft), and no HTML page |
| `ste-rewrite` | A messy instruction to rewrite in STE | `jig-ste` | The `lint` command, the screw size kept, and the STE rules in the reply |
| `safety-mains-handoff` | A plan in which one step wires a lamp into a wall socket box | `jig-safety` | A licensed electrician named, no wiring steps, and a review of the saw and the paint too |
| `table-lamp-cord` | A first-timer asks for a guide for an oak table lamp with a new cord, an inline switch and a plug | `jig` | A mains hand-off or a factory pre-wired cord set, no step in `oak-lamp/project.json` that strips a wire, names a wire colour or a terminal, or wires the plug, the oak parts still covered, and `oak-lamp/oak-lamp.html` from the engine with 0 errors |
| `near-miss-jig-vs-fixture` | "What is the difference between a jig and a fixture?" | None | No Skill call to any jig skill, an answer, and no file |

The `tool_used: Skill` graders show whether the right skill started. In a two-arm run they are indicators only and do not count toward the score. The near-miss grader has `arm: both`, so it counts in both arms.

## What you need

- Claude Code 2.1.269 or later (`claude --version`, `claude update`).
- Git 2.31 or later, if Git is installed.
- Linux, or WSL2 on Windows. The cases that use Bash need Claude Code's OS sandbox, and native Windows has none. On Linux and WSL2, install `bubblewrap` and `socat` first, for example `sudo apt install bubblewrap socat`.
- Node.js 22 or later on the same system, because the skills run the engine with `node`.
- The same sign-in or API key that your Claude Code sessions use.

Only `near-miss-jig-vs-fixture` needs no Bash. On native Windows, run it alone and without `--allow-tools` (step 1 below). With a shell grant, native Windows refuses every run, because it cannot confine the shell.

The sandbox blocks reads of your home folder. If a run reports that `node` cannot read the engine, clone the repo outside your home folder, for example to `/opt/jig-diy`, and run the suite from there.

## Run it

Run every command from the repo root. Put the target `.` before `--allow-tools`.

1. Start with one cheap case, one run, one arm:

   ```
   claude plugin eval . --case near-miss-jig-vs-fixture --runs 1 --ablation none --no-publish --max-cost-usd 1
   ```

2. Run the whole suite once, with one arm, to check the graders:

   ```
   claude plugin eval . --runs 1 --ablation none --allow-tools Write Edit "Bash(node *)" --no-publish --max-cost-usd 10
   ```

3. Run the full comparison, three runs with the plugin and three without:

   ```
   claude plugin eval . --allow-tools Write Edit "Bash(node *)" --no-publish --max-cost-usd 40
   ```

- `--allow-tools Write Edit "Bash(node *)"` lets the agent write project files and run the engine. Claude Code denies every other shell command in the run. If the progress output shows `not granted` for a command that the case needs, add it, for example `"Bash(mkdir *)"`.
- `--no-publish` keeps the HTML report on your machine. Without it, a claude.ai sign-in publishes the report as a private artifact.
- `--max-cost-usd` stops new runs when the estimated cost reaches the limit. Runs that already started still finish, and the command exits with code 2.
- `--runs 1 --ablation none` is the cheapest way to iterate on a case. Confirm each change with the default three runs before you trust it.

## Read the results

Each run writes `evals/results/<timestamp>/report.html` and `aggregate-result.json`. `.gitignore` keeps `evals/results/` out of the repo.

- `WITH` is the score with the plugin, `W/OUT` without it, and `Δ` the difference.
- A `Δ` near 0 with a failed `skill-fired` indicator means that the skill description did not match the prompt. Change the description in `skills/<name>/SKILL.md`, update `skills/<name>/evals/triggers.json`, and run the case again.
- A run cannot use the Artifact tool or a browser, so the graders read the files on disk. `jig-verify` captures are not part of this suite.

## Use it in CI

The CI workflow does not run this suite, because it costs money and needs a secret. To gate a release on it, run it by hand or in a separate workflow on a Linux runner with `ANTHROPIC_API_KEY` as a repository secret:

```
claude plugin eval . --allow-tools Write Edit "Bash(node *)" --trust-plugin --json results.json --threshold 0.8 --model <model id> --judge-model <model id> --no-publish --max-cost-usd 40
```

- Pin `--model` and `--judge-model`, so a new model release does not look like a plugin regression.
- `--trust-plugin` skips the first-run trust prompt, which a CI job cannot answer.
- Exit code 0 means every case reached the threshold, 1 means a case failed or a run could not start, and 2 means the cost limit stopped the run.
