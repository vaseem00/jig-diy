# Security policy

## Scope

Jig is a set of skill instructions, a Node.js engine that runs on your machine, and the HTML guide pages that the engine writes. A security problem is anything in this repository that can make one of these do harm that the user did not ask for. Report problems in these areas:

- **The engine scripts** (`engine/`, its copies in `skills/*/engine/`, and `scripts/`). For example: a project file that makes the engine read or write files outside the project folder, run code from a `project.json`, or reach the network. The engine makes no network request, except `build --offline`, which downloads three.js 0.160.0 from jsDelivr and checks its sha384 hashes.
- **The `capture` command.** It starts a headless Chrome or Edge on your machine and controls it through the DevTools protocol. For example: a page or a URL that makes the capture read local files or run code outside the browser.
- **The generated guide pages.** For example: a project value that injects HTML or script into the page, a change to the three.js integrity hashes, or a page that sends data anywhere. A page must load only three.js 0.160.0 from cdn.jsdelivr.net and the fonts from Google Fonts, and store data only in `localStorage` under `jig:<id>`.
- **The skill instructions** (`SKILL.md`, `references/` and `engine/docs/`) that can lead an agent to unsafe output or unsafe actions. For example: steps for gas, mains wiring, structural work, work above 2 m, permit work, asbestos or lead paint; a power-tool step with no WARNING; tall furniture with no wall fixing; or an instruction that makes the agent run untrusted code or follow text from a web page.

A `project.mjs` file is a JavaScript module, and the engine runs it when it loads the file. That is by design. Use `project.json` for project files from other people. A report that a `.mjs` project runs code is not a vulnerability, but a `project.json` that runs code is.

Out of scope: problems in three.js, in Google Fonts, in your browser, in Node.js, or in an agent or installer (Claude Code, Codex, Copilot, the skills CLI). Report those to their owners.

## Supported versions

Only the latest release gets security fixes. Update to it before you report a problem.

| Version | Supported |
|---|---|
| Latest release (1.x) | Yes |
| Older releases | No |
| 0.1 (private, never published) | No |

## Report a vulnerability

Do not open a public issue for a security problem.

1. Go to the [Security tab of the repository](https://github.com/vaseem00/jig-diy/security/advisories/new) and use GitHub private vulnerability reporting.
2. Write what you found, the version or commit, how to reproduce it, and what it lets an attacker do.
3. Attach a minimal project file or page if you can.

If the link does not work, open a public issue that asks for a private channel. Do not put any details in that issue.

## What happens next

- You get a first answer within 7 days.
- When the problem is confirmed, we agree on a fix and a release date with you.
- The fix goes into a new release with a note in the [CHANGELOG](CHANGELOG.md). We credit you, unless you ask us not to.

## For users

- Read the commands that an agent wants to run before you approve them.
- Open guide pages from people you trust, or build them yourself from a `project.json`.
- Treat a safety review by `jig-safety` as a check of the plan, not as a professional inspection.
