# Publishing Jig

This guide is for the owner of the repo. It gives the exact steps to publish Jig for the first time and to release each update after that. Do the steps in order. Each step gives the commands for Windows (PowerShell) and for macOS or Linux (a POSIX shell such as bash or zsh) where they differ.

Until you run step 4, the commands show the placeholders `YOUR-GITHUB-USER` and `YOUR-NAME`. Step 4 replaces them in every file, this one included, so the later commands then show your own names.

## Contents

0. What it costs
1. Retire the old personal skill
2. Install the tools
3. Sign in to GitHub
4. Set the owner
5. Run every check
6. Test the plugin on your machine
7. Create the repo and push
   - 7.1 Path A: a private repo first, with the directory name check
   - 7.2 Path B: a public repo at once, then the directory name check
8. Add the topics and the repo settings
9. Tag and release 1.0.0
10. Seed skills.sh
11. Test the Claude Code marketplace install
12. Submit to Anthropic's directory
13. Submit to the other directories
14. Release an update

## 0. What it costs

| Step | Cost |
|---|---|
| Git, GitHub CLI, Node.js, a public GitHub repo, GitHub Actions on a public repo | Free |
| Your own Claude Code marketplace (steps 7 to 11) | Free |
| skills.sh listing (step 10) | Free |
| **Anthropic's directory (step 12)** | **Needs a paid Claude plan**: Pro, Max or Ultra; on Team, the Owner; on Enterprise, an Owner or a member with the Directory permission |
| **`claude plugin eval` (optional, see [evals/README.md](../evals/README.md))** | **Costs money**: each run uses your Claude plan or your API account |
| **OpenAI plugin directory (step 13)** | Free to submit, but **needs a verified OpenAI organization** |
| awesome-copilot, Cursor Marketplace, Gemini CLI gallery (step 13) | Free |

> **Check the name early.** The plugin name `jig` and the marketplace name `jig-diy` must never change after users install them. Anthropic's directory can refuse a name that another organization uses, or hold a short common word for review. If a directory listing matters to you, run the directory's Validate check before anyone can install the plugin. Step 7 gives two paths: path A (7.1) keeps the repo private until the name passes, and path B (7.2) makes the repo public at once and checks the name before steps 9 to 11 announce it.

## 1. Retire the old personal skill

The private 0.1 skill lives at `~/.claude/skills/jig`. If it stays there, it and the plugin both answer to `/jig`, and a global `npx skills add` replaces the folder without a question. Move it out of the skills folder before you install anything. Keep the backup outside `.claude/skills`, or Claude Code loads it again.

Windows (PowerShell):

```powershell
$old = "$env:USERPROFILE\.claude\skills\jig"
$backup = "$env:USERPROFILE\jig-0.1-backup"
if (Test-Path $old) { Move-Item -LiteralPath $old -Destination $backup }
Get-ChildItem $backup | Select-Object Name
```

macOS or Linux:

```bash
[ -d ~/.claude/skills/jig ] && mv ~/.claude/skills/jig ~/jig-0.1-backup
ls ~/jig-0.1-backup
```

Start a new Claude Code session and type `/jig`. Make sure that no skill named `jig` shows in the list.

## 2. Install the tools

You need Git, the GitHub CLI (`gh`) and Node.js 22 or later. The skills CLI in step 10 needs Node.js 22.20 or later.

Windows (PowerShell):

```powershell
winget install --id Git.Git -e
winget install --id GitHub.cli -e
winget install --id OpenJS.NodeJS.LTS -e
```

Skip the last line if `node --version` already shows 22.20 or later. Close PowerShell and open it again, so that it finds the new commands.

macOS (with [Homebrew](https://brew.sh/)):

```bash
brew install git gh node
```

Linux: install `git` and `node` (22.20 or later) from your package manager or from [nodejs.org](https://nodejs.org/), and `gh` with the [GitHub CLI Linux instructions](https://github.com/cli/cli/blob/trunk/docs/install_linux.md).

Then, on every system:

```
git --version
gh --version
node --version
git config --global user.name "<your name>"
git config --global user.email "<your email>"
```

To keep your email address private, use the `noreply` address from [github.com/settings/emails](https://github.com/settings/emails).

## 3. Sign in to GitHub

```
gh auth login
```

Choose these answers: GitHub.com, HTTPS, "Yes" to authenticate Git with your GitHub credentials, and "Login with a web browser". Then make sure that it worked:

```
gh auth status
gh auth setup-git
```

## 4. Set the owner

Open a terminal in the repo folder. Preview the change, then apply it:

```
node scripts/set-owner.mjs --github <user> --name "<name>" --dry-run
node scripts/set-owner.mjs --github <user> --name "<name>"
```

- `<user>` is the GitHub user or organization that owns the repo, for example `alice`.
- `<name>` is the name for the licence and the author fields, for example `Alice Smith`.
- Add `--url https://...` if the author link must not be your GitHub profile.

The script replaces `YOUR-GITHUB-USER` and `YOUR-NAME` in the manifests, README, docs, every SKILL.md and its synced copies, LICENSE and `.github/`. It does not touch `scripts/` and `tests/`.

Then do one edit by hand: open `CODE_OF_CONDUCT.md` and replace `YOUR-CONTACT-EMAIL` with an email address that you read. Conduct reports go there.

## 5. Run every check

All of these must pass before the first push:

```
node --test "tests/**/*.test.mjs"
node scripts/sync-engine.mjs --check
node scripts/check-repo.mjs
node scripts/build-examples.mjs
node scripts/sync-engine.mjs --check
claude plugin validate . --strict
```

- Keep the quotes around the test glob. They make it work in PowerShell.
- If `sync-engine --check` reports drift, run `node scripts/sync-engine.mjs`, then run the checks again.
- If Claude Code is not on this machine, use `npx -y @anthropic-ai/claude-code@2.1.316 plugin validate . --strict`. It needs no sign-in.

## 6. Test the plugin on your machine

Test the real install path before anything is public. `claude plugin validate` does not find every problem: a missing source folder, for example, shows only at install time.

```
claude plugin marketplace add ./
claude plugin install jig@jig-diy
claude plugin details jig
```

`plugin details` must list nine skills. Start a session and ask for a small guide, for example "Make a build guide for a cedar planter, 600 x 300 x 300 mm". Make sure that `jig` runs and writes a page. Then remove the test install:

```
claude plugin uninstall jig@jig-diy
claude plugin marketplace remove jig-diy
```

Also check what the skills CLI finds. This installs nothing and sends nothing:

```
npx skills add ./ --list
```

It must list the nine skills under one group.

## 7. Create the repo and push

```
git init -b main
git add .
git status --short
```

Make sure that no placeholder is left. The search skips `scripts/` and `tests/`, which hold the placeholders on purpose, and this file, which names them. It must print nothing:

```
git grep -n -E "YOUR-(GITHUB-USER|NAME|CONTACT-EMAIL)" -- . ":(exclude)scripts" ":(exclude)tests" ":(exclude)docs/PUBLISHING.md"
```

If it prints a line, fix that file, run `git add .` and search again.

Set the release date: in `CHANGELOG.md`, change the date in the heading `## [1.0.0] - YYYY-MM-DD` to the day you plan to tag the release (step 9). If you tag on a different day, correct the date and commit again before you tag. Then commit:

```
git add CHANGELOG.md
git commit -m "Jig 1.0.0"
```

Then create the repo on GitHub. Choose one of the two paths below. Path A checks the plugin name in Anthropic's directory while the repo is still private. Path B is simpler: the repo is public at once, and you check the name before you announce it.

### 7.1 Path A: a private repo first

1. Create the private repo and push:

   ```
   gh repo create vaseem00/jig-diy --private --source . --push --description "DIY build guides for AI agents: a plan, a bill of quantities, a shopping plan, a cut list and 3D build steps from one model."
   ```

   CI runs on the private repo too, and it uses the Actions minutes of your GitHub plan.
2. Open [claude.ai/directory/manage](https://claude.ai/directory/manage) in the Claude organization that must own the listing (step 12, "Before you start").
3. Connect GitHub for that organization. If the portal shows "GitHub isn't connected for this Claude organization", select **Connect GitHub**, and connect a GitHub account that can push to the repo.
4. Select **Submit new**, then **Plugin bundle**. Enter the repo `vaseem00/jig-diy`, leave the plugin path empty, and leave **Branch or tag** empty to follow `main`.
5. When the portal shows "This repository is private.", confirm the source upload. The source then goes to Anthropic for automated scanning, and Anthropic reviewers can read it.
6. If the portal shows "The Claude GitHub App can't reach this repository", select **Install the Claude GitHub App**. Install it on this repo only, then go back to the portal.
7. Select **Validate**. If it says "Name is taken", or holds the name for a reviewer, stop: choose the final name now (step 12.3).
8. When the name passes, stop there, and make the repo public:

   ```
   gh repo edit vaseem00/jig-diy --visibility public --accept-visibility-change-consequences
   ```

9. Continue with step 8. In step 12, if **Submissions** lists a draft for this repo, open it instead of a new submission, because an organization has one submission for each repo and folder.

### 7.2 Path B: a public repo at once

1. Create the public repo and push:

   ```
   gh repo create vaseem00/jig-diy --public --source . --push --description "DIY build guides for AI agents: a plan, a bill of quantities, a shopping plan, a cut list and 3D build steps from one model."
   ```

2. Right away, before steps 9 to 11 announce the plugin, do step 12 up to its **Validate** button (12.1 to 12.3). A public repo validates before you connect GitHub. If the name passes, continue with step 8, and finish step 12 later.

On either path, open the Actions tab, or run `gh run watch`, and wait until CI passes on all nine test jobs (three systems, three Node.js versions) and the validate job.

## 8. Add the topics and the repo settings

The topics help the skill indexes and the Gemini CLI gallery find the repo:

```
gh repo edit vaseem00/jig-diy --add-topic agent-skills,claude-skills,claude-code-plugin,diy,woodworking,gemini-cli-extension
```

Turn on private vulnerability reporting, which [SECURITY.md](../SECURITY.md) points to:

```
gh api -X PUT repos/vaseem00/jig-diy/private-vulnerability-reporting
```

In the web page of the repo, open **Settings > General > Releases** and turn on **release immutability**. awesome-copilot (step 13) needs a tag that cannot move.

## 9. Tag and release 1.0.0

1. Make sure that the date in the `## [1.0.0]` heading of `CHANGELOG.md` is today (step 7). Copy the text under `## [1.0.0]` into a notes file outside the repo:
   - Windows: `notepad "$env:TEMP\jig-notes.md"`
   - macOS or Linux: `nano /tmp/jig-notes.md`
2. Make the tag and the release:

   ```
   git tag -a v1.0.0 -m "Jig 1.0.0"
   git push origin v1.0.0
   ```

   Windows:

   ```powershell
   gh release create v1.0.0 --verify-tag --title "Jig 1.0.0" --notes-file "$env:TEMP\jig-notes.md"
   ```

   macOS or Linux:

   ```bash
   gh release create v1.0.0 --verify-tag --title "Jig 1.0.0" --notes-file /tmp/jig-notes.md
   ```

3. Make sure that the release shows as **Latest** on the Releases page.

The `v1.0.0` tag is the one that users, awesome-copilot and the Gemini gallery use. You need `claude plugin tag --push` (which makes the tag `jig--v1.0.0`) only if another plugin declares a version range on Jig.

## 10. Seed skills.sh

skills.sh has no form. It lists a public repo after the first install through the skills CLI with telemetry on. Do one install in a throwaway folder, so it does not touch your own skills.

Windows (PowerShell):

```powershell
Remove-Item Env:DISABLE_TELEMETRY, Env:DO_NOT_TRACK -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force "$env:TEMP\jig-seed" | Out-Null
Set-Location "$env:TEMP\jig-seed"
npx skills add vaseem00/jig-diy -a claude-code -y
```

macOS or Linux:

```bash
unset DISABLE_TELEMETRY DO_NOT_TRACK
mkdir -p /tmp/jig-seed && cd /tmp/jig-seed
npx skills add vaseem00/jig-diy -a claude-code -y
```

- The install needs Git on the PATH and Node.js 22.20 or later.
- Run it from a normal network, not a VPN that blocks `api.github.com`. The CLI sends telemetry only after GitHub confirms that the repo is public.
- After a few minutes, open `https://skills.sh/vaseem00/jig-diy`. The security audits (Gen, Socket, Snyk) run on their own and show on each skill page.
- The `skills.sh.json` file in the repo sets the groups on that page.
- Delete the throwaway folder when the page shows.

There is no "Official" badge to apply for. Do not claim one.

## 11. Test the Claude Code marketplace install

In a new Claude Code session (with the old skill retired, step 1):

```
/plugin install jig --marketplace vaseem00/jig-diy
```

Or in two steps: `/plugin marketplace add vaseem00/jig-diy`, then `/plugin install jig@jig-diy`.

- Type `/jig:` and make sure that the nine skills show.
- Ask "What will a 2x4 workbench with a plywood top cost?" and make sure that `jig:jig-boq` answers.
- In `/plugin`, open **Marketplaces**, select `jig-diy` and turn on auto-update, so that you get each release you make.

If the install fails with a permission error on GitHub, set `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` and try again.

## 12. Submit to Anthropic's directory

**Needs a paid Claude plan.** This is the only route into Claude's own plugin directory and the community marketplace (`claude-community`). Both `claude-plugins-official` and `claude-plugins-community` close outside pull requests, so do not open one.

These steps were checked against [claude.com/docs/plugins/submit](https://claude.com/docs/plugins/submit), [claude.com/docs/directory/publish](https://claude.com/docs/directory/publish) and [claude.com/docs/plugins/pre-submission-checklist](https://claude.com/docs/plugins/pre-submission-checklist) on 2026-11-03. If the portal shows something else, follow the portal.

A finding has one of four results: **Blocks** (fix it before you submit), **Policy hold** (held for a reviewer: you can submit, and a person reads the version before it goes live; a hold is not a rejection), **Warning** or **Note**. The scan can raise the same hold again on each new version. What can hold Jig:

- **Bundled images.** The README shows its screenshots with Markdown image syntax. An HTML img tag for a bundled image, or a bundled image path in backticks or a code block, holds the version for a reviewer. Keep it that way when you edit the README or the docs (a repo test checks the README).
- **The icon.** The icon fields in the manifests, and the copy of the icon that scripts/sync-engine.mjs makes for each skill, can still raise a Policy hold. That is not a rejection: wait for the reviewer.

Before you start:

- Submit from the account or organization that must own the listing for the long term. The first organization to submit a repo and folder owns that listing.
- Use a plan and a role that can submit: Pro, Max or Ultra; on Team, the Owner; on Enterprise, an Owner or a member with the Directory permission.
- Connect GitHub in that Claude organization, with a GitHub account that can push to the repo. A GitHub connection in another Claude organization does not count.
- Each organization can make 10 submissions in 24 hours. Drafts and withdrawn submissions count.

Steps:

1. Open [claude.ai/directory/manage](https://claude.ai/directory/manage) and select **Submit new**. If you started a submission in step 7, open it from **Submissions** instead.
2. Choose **Plugin bundle**. (Skills alone are not a submission type.)
3. **Source and Validate.** Enter the repo `vaseem00/jig-diy` and leave the plugin path empty (the plugin is at the root). Leave **Branch or tag** empty to follow `main`. Do not enter the `v1.0.0` tag: a tag stays on its commit, so later releases would not reach the directory until you change the tag. Run **Validate**.
   - If it says "Name is taken", or holds `jig` as a generic name, stop. Choose the final name before any user installs the plugin, because a published name cannot change.
   - Fix each problem that blocks the submission, push, and validate again. A result applies to one commit, so validate again after each push.
4. **Listing details.** The portal reads them from `.claude-plugin/plugin.json` and the README. Check the display name (Jig), the description, the icon and the links.
   - The icon is ./assets/icon.svg. The docs ask for the path of an image file in the plugin, and the directory accepts SVG files. The file assets/icon.png is the same art as a 512 x 512 PNG. If the Listing details step shows no icon or a broken one, change the icon field in `.claude-plugin/plugin.json` to ./assets/icon.png, push, and validate again.
5. **Data handling.** Give answers that match the README section "What it fetches and stores":
   - Personal data read or stored: none. No telemetry, no analytics, no account.
   - Data sent to other services: no user data. When a guide page opens, the browser downloads three.js 0.160.0 from `cdn.jsdelivr.net` (with sha384 integrity hashes) and the Archivo and JetBrains Mono fonts from Google Fonts. These requests carry only what every browser request carries, such as the IP address. `build --offline` downloads three.js 0.160.0 from jsDelivr once.
   - Retention: the plugin keeps nothing. The page keeps the ticks (done steps and bought items), level, tab and current step in the reader's browser, under `localStorage` key `jig:<id>`, until the reader clears it.
   - Under 18: not intended for children. The guides cover power tools, so a child needs an adult with them.
   - Code that runs: Node.js scripts on the user's machine. They read the project file and write outputs in the user's folder. `capture` starts a local headless Chrome or Edge. The browser starts with a new, empty profile, and it opens the page file or the URL that you give it. The capture command gives the browser switches that turn off its sync, pings and optimization-guide downloads. These switches do not stop all background traffic. Each time it starts, the browser still sends its own background requests to its maker (Google or Microsoft). With Chrome, this is about 10 requests: update checks, component downloads, a sign-in check, a time check and a device check-in. These requests carry no project data.
   - Credentials and secrets: none.
6. **Compliance.** Check that the contact email is an address you read. Read and accept the four acknowledgements.
7. **Review and submit.**
   - Under **How new versions reach the directory**, keep **GitHub push webhook** (the default) or choose **Scheduled check only**. The webhook needs admin access to the repo on GitHub: after you submit, select **Set up push updates**.
   - Leave **Auto-publish passing versions** off. The directory follows `main`, so it scans every merge to `main` as a candidate version. You then publish only the release commits.
   - Select **Submit for review**.
8. **Publish.** When the **Versions** tab shows that the version passed, select **Publish** on the plugin's page. By default an Anthropic reviewer then publishes it. The **Auto-publish** row on the **Overview** tab shows the setting in force.

A person reviews a new listing, and every version gets an automated scan. Select **Publish** for each passing version that is a release, unless the **Overview** tab shows that auto-publish applies. While a new version waits, the listing keeps the last published version. Claude Code users can then find Jig with `/plugin directory`.

## 13. Submit to the other directories

### Codex and the OpenAI plugin directory

- **Self-serve, free:** users run `codex plugin marketplace add vaseem00/jig-diy` and install Jig from `/plugins`. There is nothing to submit.
- **OpenAI plugin directory (ChatGPT and Codex): needs a verified OpenAI organization.**
  1. Make sure that you are an owner of the organization, or have Apps Management write access, and that the organization has individual or business verification.
  2. Make the upload file from the release tag, one folder above the repo: `git archive --format zip -o ../jig-diy-1.0.0.zip v1.0.0`.
  3. Upload it at [platform.openai.com/plugins](https://platform.openai.com/plugins) and wait for the skill scans.
  4. Add 5 positive and 3 negative test cases. Take them from `skills/*/evals/triggers.json`.
  5. Add release notes from the CHANGELOG, and accept the policy attestations.
  6. Each later update needs a new ZIP and a new review.

### VS Code

There is nothing to submit. Users run **Chat: Install Plugin from Source** with the repo URL. The plugin list that VS Code shows comes from awesome-copilot (below).

### GitHub Copilot (awesome-copilot)

awesome-copilot is the plugin marketplace built into Copilot CLI and VS Code. It takes outside plugins only through an issue form.

1. Test the install first: `copilot plugin install vaseem00/jig-diy`.
2. Get the commit of the release: `git rev-parse "v1.0.0^{commit}"`.
3. Open [github.com/github/awesome-copilot/issues/new/choose](https://github.com/github/awesome-copilot/issues/new/choose) and choose the external plugin form.
4. Fill it in: name `jig`, a short description, the repo `vaseem00/jig-diy`, no path (the plugin is at the root), version `1.0.0`, the tag `v1.0.0` and its 40-character commit, licence `MIT`, the author, and lowercase keywords from `plugin.json`.
5. Wait for the automated gates (an install test with Copilot CLI) and a maintainer's decision. Listings are reviewed again about every 6 months.

The version in the form must equal the version in `plugin.json`.

### Cursor Marketplace

1. Apply at [cursor.com/marketplace/publish](https://cursor.com/marketplace/publish). Cursor lists only open-source plugins, and reads the root `plugin.json`.
2. Wait for the manual review. Cursor also reviews each update.
3. When Jig is listed, change the Cursor part of the README from the manual copy to the Marketplace install.

### Gemini CLI extension gallery

There is no form. The gallery crawls public repos once a day. It needs:

- `gemini-extension.json` at the repo root (done),
- the `gemini-cli-extension` topic (step 8),
- a GitHub release marked Latest, with a tag that equals the version in `gemini-extension.json` (step 9).

Test it with `gemini extensions install https://github.com/vaseem00/jig-diy`. Google moved its consumer tiers from Gemini CLI to Antigravity CLI in June 2026, so this gallery reaches fewer people now.

### Later, when Jig has users

- [VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills): a pull request, after the skill has real use.
- [travisvn/awesome-claude-skills](https://github.com/travisvn/awesome-claude-skills): a pull request at 10 or more stars. Say that AI helped to write it.
- [hesreallyhim/awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code): the web issue form, filled in by you, when the repo is 14 days old or has 100 stars.

## 14. Release an update

1. **Merge the changes.** Each pull request adds a line under `## [Unreleased]` in `CHANGELOG.md`.
2. **Choose the version** with [Semantic Versioning](https://semver.org/):
   - patch (1.0.1): fixes only;
   - minor (1.1.0): new features, new optional project fields, new skills;
   - major (2.0.0): a project format, CLI or output change that breaks the projects that users have now.
3. **Bump it everywhere.** The script sets the version in every SKILL.md, the three manifests and `engine/lib/version.mjs`, and adds the CHANGELOG heading:

   ```
   node scripts/bump-version.mjs 1.1.0 --dry-run
   node scripts/bump-version.mjs 1.1.0
   ```

   Add `--date YYYY-MM-DD` to set the release date. Without it, the script uses today.
4. **Read the CHANGELOG.** The lines from Unreleased now sit under the new heading. Edit them if needed.
5. **Rebuild and sync.** The engine version is in every built page, so the example pages change:

   ```
   node scripts/build-examples.mjs
   node scripts/sync-engine.mjs
   ```

6. **Run every check** from step 5.
7. **Commit, push and wait for CI:**

   ```
   git add .
   git commit -m "Release 1.1.0"
   git push
   ```

8. **Tag and release** as in step 9, with the new version and its CHANGELOG section.
9. **Let the channels pick it up:**
   - Claude Code users get the new version when they update (`claude plugin update jig@jig-diy`, or auto-update). A version that does not change reaches nobody.
   - Anthropic's directory scans the new commit on `main`. When the **Versions** tab shows that it passed, select **Publish** (or **Publish update**) on the plugin's page, unless the **Overview** tab shows that auto-publish applies. A version can also show **Policy hold**: it then waits for a reviewer, and the listing keeps the last published version until the reviewer clears it. A hold is not a rejection (step 12).
   - The Gemini gallery follows the release marked Latest.
   - Skills CLI users run `npx skills update`.
   - awesome-copilot pins a tag: follow its contributing guide to move the entry to the new tag.
   - The OpenAI directory needs a new ZIP and a new review. Cursor reviews the update.

Never rename the plugin `jig` or the marketplace `jig-diy`. Change the display name instead.
