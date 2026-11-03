## What this changes



## Why



## Checks

Tick each item that applies. For an item left open, say why.

- [ ] `node --test "tests/**/*.test.mjs"` passes.
- [ ] `node scripts/sync-engine.mjs --check` reports no drift. I did not edit `skills/*/engine/` or another generated copy by hand.
- [ ] `node scripts/check-repo.mjs` reports 0 problems.
- [ ] `node scripts/build-examples.mjs` builds every example with 0 errors, 0 warnings and 0 STE findings.
- [ ] After the build, `git status --short` shows only the changes I meant. If an example page changed, this pull request says why.
- [ ] `claude plugin validate . --strict` passes.
- [ ] New or changed reader text follows the STE rules in `engine/docs/ste.md`, and `node engine/jig.mjs lint` reports no findings for it.
- [ ] No step, card or example gives instructions for gas, mains wiring, structural work, work above 2 m, permit work, asbestos or lead paint.
- [ ] A change to the project format, the model, a problem code, the CLI or the page also updates `docs/ARCHITECTURE.md`.
- [ ] A changed skill description comes with updated queries in `skills/<name>/evals/triggers.json`.
- [ ] The engine stays deterministic: no clock, no random numbers, no machine paths in the output.
- [ ] This pull request makes one change.
- [ ] A line under `## [Unreleased]` in `CHANGELOG.md`.

## Screenshots

For a change you can see on the page: desktop width, 390 px width and the dark theme.
