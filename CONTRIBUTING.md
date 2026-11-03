# Contributing to Jig

Thank you for your help. Bug reports, new example projects, better technique cards, clearer instructions and engine fixes are all welcome.

Before you start, read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). It is the contract for the project format, the computed model, the problem codes, the CLI and the page. Code, skills, tests and docs must agree with it.

## Contents

1. Set up
2. The checks
3. House rules
4. Common changes
5. Open a pull request

## 1. Set up

You need Node.js 22 or later and Git. There is nothing to install: the pack has no npm dependencies and no `package.json`.

```
git clone https://github.com/vaseem00/jig-diy.git
cd jig-diy
node --version
```

To try the plugin in Claude Code while you work, load it for one session from your clone:

```
claude --plugin-dir .
```

Run `/reload-plugins` after each change. If you also have the plugin installed from the marketplace, the `--plugin-dir` copy wins for that session.

## 2. The checks

Run all of them before you open a pull request. CI runs the same commands on Linux, macOS and Windows with Node.js 22, 24 and 26.

| Command | Checks |
|---|---|
| `node --test "tests/**/*.test.mjs"` | Unit, CLI, golden and repo tests. Keep the quotes: they make the glob work in PowerShell too |
| `node scripts/sync-engine.mjs --check` | Every `skills/<name>/engine/` copy is equal to `engine/` |
| `node scripts/check-repo.mjs` | Repo layout: SKILL.md places, file sizes, file count, names, no symlinks |
| `node scripts/build-examples.mjs` | Every example builds with `--strict` |
| `git status --short` | After the build, only the files you meant to change |
| `claude plugin validate . --strict` | The Claude Code manifests, skills and frontmatter |

If `sync-engine --check` reports drift, run `node scripts/sync-engine.mjs` and commit the copies.

If an example page changes after `build-examples`, the engine or the page changed its output. Commit the new page only when you meant that change, and say why in the pull request.

`claude plugin validate` needs the Claude Code CLI, but no sign-in. Without it on your machine, run `npx -y @anthropic-ai/claude-code@2.1.316 plugin validate . --strict`. CI uses this version. When you raise the pin in `.github/workflows/ci.yml`, raise it here and in `docs/PUBLISHING.md` too.

## 3. House rules

1. **Never edit generated files by hand.** These are copies: `skills/*/engine/`, `skills/jig/examples/`, `skills/jig-3d/examples/`, `skills/*/LICENSE.txt` and the icon in each skills/*/assets folder. Change the source in `engine/`, `examples/`, `LICENSE` or `assets/`, then run `node scripts/sync-engine.mjs`.
2. **Build to zero.** Every example builds with 0 errors, 0 warnings and 0 STE findings. Fix the project or the rule, never the HTML. Do not commit a page built with `--force`.
3. **Write reader text in STE style.** This covers instructions, warnings, checks, technique cards and page labels:
   - Put a command verb first.
   - Write one instruction in each sentence.
   - Keep a procedure sentence to 20 words or fewer, and a description sentence to 25 or fewer.
   - Use the active voice.
   - Put a condition before its command.
   - Use no -ing verb forms.
   - Put a WARNING (injury) or CAUTION (damage) before the instructions it covers.
   Run `node engine/jig.mjs lint <file>` on new text. [engine/docs/ste.md](engine/docs/ste.md) has the rules.
4. **Make one change in each pull request.** A fix, a feature or an example. Split unrelated changes.
5. **Add a line to the CHANGELOG.** Put it under `## [Unreleased]`, in the right group: Added, Changed, Fixed or Removed.
6. **Change the contract with the code.** If a change alters the project format, the model, a problem code, the CLI or the page, update [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) in the same pull request.
7. **Keep the engine plain and deterministic.**
   - Use Node.js ESM (`.mjs`), Node.js 22 or later, named exports and no npm packages.
   - Do not use the clock or random numbers in engine code. Tests may use a seeded generator.
   - Find files with `import.meta.url`. Use forward slashes in documents.
   - Give each file a short header comment, and comment only the functions that are not obvious.
8. **Keep each SKILL.md portable.**
   - Use only the six frontmatter keys: `name`, `description`, `license`, `compatibility`, `metadata` and `allowed-tools`.
   - Keep the `name` equal to the folder name.
   - Keep the description to 1024 characters or fewer, with no `<` or `>`.
   - Keep the body under 500 lines.
   - Never write a dollar sign followed by a digit, because Claude Code reads `$1` as an argument. Write prices as `USD 12.50`.
9. **Respect the hand-off list.** No skill, example or technique card gives steps for gas, mains wiring, structural or load-bearing work, roofs or work above 2 m, permit work, asbestos or lead paint.
10. **Respect the directory limits.**
    - Keep every non-image file under 256 KiB, and the repo at 512 files or fewer.
    - Do not add symlinks, Git LFS files, submodules, lockfiles or a top-level `bin/` folder.
    - Put a `SKILL.md` only at `skills/<name>/SKILL.md`. A test fixture never has a file named `SKILL.md`.

## 4. Common changes

### Fix a bug in the engine

1. Write a test in `tests/` that fails.
2. Fix the code in `engine/`.
3. Run `node scripts/sync-engine.mjs`, then all the checks.

### Add an example project

1. Make a folder `examples/<id>/` with a `project.json`. Use a kebab-case id.
2. Run `node scripts/build-examples.mjs <id>` until it reports 0 errors, 0 warnings and 0 STE findings.
3. Run `node engine/jig.mjs capture examples/<id>/<id>.html --hash build/1 --out <file>.png` for some steps, and look at each capture.
4. Run `node scripts/sync-engine.mjs`. It copies the project into `skills/jig/examples/` and `skills/jig-3d/examples/`.
5. Add a row to the Examples table in [README.md](README.md).

### Change a skill

1. Edit `skills/<name>/SKILL.md` or its `references/`.
2. If you change the description, update `skills/<name>/evals/triggers.json`: the queries that must start the skill and the near misses that must not.
3. Add or update a case in `skills/<name>/evals/evals.json` for new behaviour.
4. To measure the change with real model runs, use the suite in `evals/`. It costs money. [evals/README.md](evals/README.md) tells you how.

### Add a technique card

1. Add the card to `engine/lib/techniques.mjs`.
2. Make sure each line passes the STE linter. A test checks every card.
3. List the new id in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) section 4.7.

## 5. Open a pull request

1. Fork the repo and make a branch from `main`.
2. Make your change and run every check in section 2.
3. Open the pull request, and fill in the template.
4. For a change you can see on the page, attach captures: desktop width, 390 px width and the dark theme.

Maintainers release new versions with the steps in [docs/PUBLISHING.md](docs/PUBLISHING.md).

By contributing, you agree that your contribution is under the [MIT License](LICENSE), and you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
