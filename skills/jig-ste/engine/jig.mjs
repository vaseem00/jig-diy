#!/usr/bin/env node
// jig CLI: node engine/jig.mjs <command> [file] [options]. The one entry point of every skill in the pack
// (ARCHITECTURE.md section 8, engine/docs/cli.md). Human text goes to stderr; data (md, csv, json, svg) goes to stdout
// or to --out files. Exit codes: 0 done, 1 problems block the command, 2 usage error, 3 input or output failure.

import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { compute } from "./lib/model.mjs";
import { planMd, boqMd, boqCsv, cutMd, cutSvg, buyMd, reportText, printList } from "./lib/markdown.mjs";
import { lint as steLint } from "./lib/ste.mjs";
import { SCHEMA } from "./lib/schema.mjs";
import { ENGINE_VERSION } from "./lib/version.mjs";
import { didYouMean, oneLine, plural, round, term } from "./lib/util.mjs";
import { orderBy } from "./lib/purchase.mjs";
import { fmtLen } from "./lib/locale.mjs";
import { decodeText, loadProject, LoadError } from "./lib/load.mjs";

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const TABS = ["plan", "shop", "cut", "build"];
// The findings of the safety review: the errors, the small-object tip warning, the info that the tip-over check did
// not run (so "No safety findings." never follows "Tip-over: not known"), and each override of the hand-off screen.
const SAFETY_CODES = new Set(["E_POWER_NO_WARNING", "E_TIP_OVER", "E_HANDOFF", "W_TIP_SMALL", "W_CLEARED_UNUSED", "I_TIP_UNCHECKED", "I_OLD_PAINT", "I_HANDOFF_CLEARED"]);
// The warnings that --strict also blocks: a safety.cleared entry that clears nothing, so no topic is cleared in advance.
const STRICT_WARNINGS = new Set(["W_CLEARED_UNUSED"]);
const strictWarnings = (M) => (M?.problems ?? []).filter((p) => STRICT_WARNINGS.has(p.code)).length;
const unusedText = (n) => plural(n, "unused safety.cleared entry");
const ZERO = { error: 0, warn: 0, ste: 0, info: 0 };
const FT2 = 0.09290304; // m² in one square foot
const SELF = fileURLToPath(import.meta.url);
const BOM = new RegExp(`^${String.fromCharCode(0xfeff)}`); // a byte order mark at the start of a text file

// A path for a command line: forward slashes, in double quotes when it holds a space or a shell character.
const arg = (p) => { const s = String(p).split(sep).join("/"); return /[\s"'`$&|;<>()]/.test(s) ? JSON.stringify(s) : s; };
// The command that runs this engine from the current folder: "node engine/jig.mjs" in the repo, the path of the skill
// copy from the user's folder (absolute when relative() crosses a drive), so a hint can be pasted as it is.
const me = () => `node ${arg(relative(process.cwd(), SELF) || SELF)}`;
// The CLI reference of this engine copy, from the current folder in the same way.
const docRef = () => { const doc = join(dirname(SELF), "docs", "cli.md"); return arg(relative(process.cwd(), doc) || doc); };

export class CliError extends Error {
  constructor(exit, message, cause) { super(message, cause ? { cause } : undefined); this.name = "CliError"; this.exit = exit; }
}
const usage = (msg) => new CliError(2, msg);
const fail = (msg, cause) => new CliError(3, msg, cause);

// ---- commands and options (the help text comes from here)

const S = "string", B = "boolean";
const COMMON = {
  report: { type: S, arg: "json", help: "Print a JSON report on stdout. The human report stays on stderr." },
  quiet: { type: B, short: "q", help: "Print no human report. A failure still prints one line." },
  debug: { type: B, help: "Print the stack trace of an error." },
  help: { type: B, short: "h", help: "Show the help of the command." },
};
const out = (what) => ({ type: S, arg: "file", help: `Write ${what} to this file, not to stdout. The command makes the folders that it needs.` });
const force = (what) => ({ type: B, help: `Write ${what} also when the project has errors. The exit code stays 1.` });
const strict = { type: B, help: "Let STE findings and unused safety.cleared entries (W_CLEARED_UNUSED) block the command too." };

export const COMMANDS = {
  new: {
    args: "<id>", about: "Write a starter project.json from templates/starter.json: a small pine stand with 3 parts and 2 steps.",
    options: {
      units: { type: S, arg: "mm|in", help: "The unit of every length in the file. Default: mm. With in, the starter lengths change to inches." },
      dir: { type: S, arg: "path", help: "The folder for project.json. Default: a folder named <id> in the current folder." },
      title: { type: S, arg: "text", help: 'The title of the object. Default: made from the id ("pine-bookshelf" gives "Pine bookshelf").' },
    },
    example: "new pine-bookshelf --units mm --dir pine-bookshelf",
  },
  check: {
    args: "<project>", about: "Validate and compute the project in guide mode, then print the report.",
    options: { strict },
    example: "check pine-bookshelf/project.json",
  },
  build: {
    args: "<project>", about: "Check the project in guide mode, then write the guide page. Errors stop the build.",
    options: {
      out: { type: S, arg: "file", help: "The page path. Default: <id>.html next to the project (<id>-3d.html for --tabs build, <id>-artifact.html for --artifact)." },
      artifact: { type: B, help: "Write a page body (title, the claude:viewport-fit-sides meta, fonts, style, body) for the Artifact tool. Its host adds the viewport meta." },
      offline: { type: B, help: "Put three.js 0.160.0 into the page, so the 3D view works with no network (about 0.9 MB more)." },
      tabs: { type: S, arg: "list", help: "The tabs to show, from plan,shop,cut,build. One tab hides the tab bar. A project with nothing to cut or print has no cut tab." },
      json: { type: B, help: "Also write the computed model as <page name>.json next to the page." },
      force: force("the page"),
      strict,
    },
    example: "build pine-bookshelf/project.json --strict",
  },
  plan: {
    args: "<project>", about: "Write the step-by-step plan (plan mode: no positions needed).",
    options: {
      level: { type: S, arg: "new|some|pro", help: "The reader level. Default: the level in the project." },
      format: { type: S, arg: "md|json", help: "The output format. Default: md." },
      out: out("the plan"), force: force("the plan"), strict,
    },
    example: "plan step-stool/project.json --level new --out step-stool/plan.md",
  },
  boq: {
    args: "<project>", about: "Write the bill of quantities with the totals (estimate mode: materials and parts only).",
    options: { format: { type: S, arg: "md|csv|json", help: "The output format. Default: md." }, out: out("the BOQ"), force: force("the BOQ") },
    example: "boq workbench/project.json --format csv --out workbench/boq.csv",
  },
  cut: {
    args: "<project>", about: "Write the cut list: each board and sheet to buy, the cuts on it and the waste (estimate mode).",
    options: {
      format: { type: S, arg: "md|json|svg", help: "The output format. Default: md. svg always writes one file for each material." },
      out: { type: S, arg: "file", help: "Write the cut list to this file. With svg: the name base, so cut.svg gives cut-<material>.svg." },
      force: force("the cut list"),
    },
    example: "cut workbench/project.json --format svg --out workbench/cut.svg",
  },
  buy: {
    args: "<project>", about: "Write the shopping list: online orders first, then one trip for each store (estimate mode).",
    options: {
      format: { type: S, arg: "md|json", help: "The output format. Default: md." },
      start: { type: S, arg: "YYYY-MM-DD", help: "The start date of the build. Each trip gets an order-by date." },
      out: out("the shopping list"), force: force("the shopping list"),
    },
    example: "buy workbench/project.json --start 2026-11-14 --out workbench/buy.md",
  },
  lint: {
    args: "<file|->", about: 'Lint text or Markdown with the STE rules. For a .json, .mjs or .js project, lint all of its reader text. Use "-" to read stdin.',
    options: {
      kind: { type: S, arg: "procedure|warning|description|title", help: "The kind of text. Default: procedure. A project gives each text its own kind." },
      terms: { type: S, arg: "a,b", help: "Technical names the linter accepts, with commas between them." },
      verbs: { type: S, arg: "a,b", help: "Extra command verbs the linter accepts (trade verbs), with commas between them." },
    },
    example: "lint steps.md --kind procedure --verbs epoxy",
  },
  safety: {
    args: "<project>", about: "Write the safety review: tip-over, power tools, protective equipment, hand-offs, cleared hand-off hits and the safety findings (plan mode).",
    options: { format: { type: S, arg: "md|json", help: "The output format. Default: md." }, out: out("the review") },
    example: "safety bookcase/project.json",
  },
  capture: {
    args: "<page.html|url>", about: "Open a page in headless Chrome or Edge, write a PNG or WebP image, and print the console errors and sideways scroll.",
    options: {
      out: { type: S, arg: "file", help: "The image, .png or .webp. Default: <page name>[-<hash>].png next to the page." },
      hash: { type: S, arg: "route", help: "The tab or step to open: plan, shop, cut, build/4 (steps count from 1)." },
      width: { type: S, arg: "px", help: "The window width. Default: 1280. Use 390 for a phone." },
      height: { type: S, arg: "px", help: "The window height. Default: 900." },
      scale: { type: S, arg: "n", help: "The device pixel ratio. Default: 1." },
      theme: { type: S, arg: "light|dark", help: "The colour scheme that the page sees. Default: light." },
      select: { type: S, arg: "css", help: "Clip the image to the first element that matches. Default: the full page." },
      wait: { type: S, arg: "ms", help: "The time to wait after the page loads. Default: 4000, so that WebGL starts." },
      "reduced-motion": { type: B, help: "The page sees the reduced-motion setting." },
      tour: { type: S, arg: "s", help: "Show the Plan view tour at this time in seconds. Default: the tour holds still at 0 s, the finished object." },
      sheet: { type: B, help: "Make one review sheet: every route as a tile with its name. Default routes: each tab, then every step." },
      routes: { type: S, arg: "list", help: "With --sheet: the routes to show, separated by commas, for example plan,build/2,build/5." },
      cols: { type: S, arg: "n", help: "With --sheet: the tiles in one row. Default: 3." },
    },
    example: "capture pine-bookshelf/pine-bookshelf.html --hash build/4 --out shots/step-04.png",
  },
  schema: {
    args: "", about: "Print the JSON Schema of the project format.",
    options: { out: out("the schema") },
    example: "schema --out project.schema.json",
  },
};

// ---- help

const BRIEF = {
  new: "Write a starter project.json.", check: "Validate the project and print the report.", build: "Check, then write the guide page.",
  plan: "Write the step-by-step plan.", boq: "Write the bill of quantities.", cut: "Write the cut list or the cut drawings.",
  buy: "Write the shopping list in store order.", lint: "Lint text, Markdown or a project with the STE rules.",
  safety: "Write the safety review.", capture: "Make an image of a page. Print its console errors.", schema: "Print the JSON Schema of the project format.",
};
const pad = (s, n) => (s.length >= n ? `${s}  ` : s.padEnd(n));
const flag = (k, o) => `${o.short ? `-${o.short}, ` : ""}--${k}${o.type === S ? ` <${o.arg}>` : ""}`;
const optionLines = (opts) => Object.entries(opts).map(([k, o]) => `  ${pad(flag(k, o), 30)}${o.help}`);

export function helpText(cmd) {
  if (!cmd) {
    return [
      `jig ${ENGINE_VERSION}: guides, plans, bills of quantities, shopping lists and cut lists for DIY builds.`, "",
      `Usage: ${me()} <command> [file] [options]`, "", "Commands:",
      ...Object.entries(COMMANDS).map(([k, c]) => `  ${pad(`${k} ${c.args}`.trim(), 26)}${BRIEF[k]}`),
      "", "Common options:", ...optionLines(COMMON), "",
      `Run "${me()} <command> --help" to see the options of one command.`,
      "Exit codes: 0 done, 1 problems block the command, 2 usage error, 3 input or output failure.",
      `Reference: ${docRef()}`, "",
    ].join("\n");
  }
  const c = COMMANDS[cmd];
  return [
    `Usage: ${me()} ${cmd}${c.args ? ` ${c.args}` : ""} [options]`, "", c.about, "",
    ...(Object.keys(c.options).length ? ["Options:", ...optionLines(c.options), ""] : []),
    "Common options:", ...optionLines(COMMON), "", "Example:", `  ${me()} ${c.example}`, "",
  ].join("\n");
}

// ---- arguments

function parseCommand(cmd, args) {
  const all = { ...COMMANDS[cmd].options, ...COMMON };
  const options = Object.fromEntries(Object.entries(all).map(([k, o]) => [k, o.short ? { type: o.type, short: o.short } : { type: o.type }]));
  try {
    return parseArgs({ args, options, strict: true, allowPositionals: true });
  } catch (e) {
    const name = /'(-{1,2}[^'\s=]+)/.exec(e.message)?.[1] ?? "";
    if (e.code === "ERR_PARSE_ARGS_UNKNOWN_OPTION") {
      const flags = Object.entries(all).flatMap(([k, o]) => [`--${k}`, ...(o.short ? [`-${o.short}`] : [])]);
      const near = didYouMean(name, flags), key = name.replace(/^-+/, "");
      const owners = Object.keys(COMMANDS).filter((c) => c !== cmd && Object.hasOwn(COMMANDS[c].options, key));
      const more = near ? ` Did you mean "${near}"?` : owners.length ? ` It is an option of ${owners.join(", ")}.` : "";
      return { error: `Unknown option "${name}" for ${cmd}.${more} Run "${me()} ${cmd} --help" to see the options.` };
    }
    if (/argument missing/.test(e.message)) return { error: `The option ${name} needs a value: ${flag(name.replace(/^-+/, ""), all[name.replace(/^-+/, "")] ?? { type: S, arg: "value" })}.` };
    if (/does not take an argument/.test(e.message)) return { error: `The option ${name} takes no value.` };
    if (/ambiguous/.test(e.message)) return { error: `The value of ${name} starts with "-". Write it as ${name}=<value>.` };
    return { error: e.message.split("\n")[0] };
  }
}

// The one positional argument of a command.
function one(ctx, what) {
  const p = ctx.positionals;
  if (!p.length) throw usage(`Give the ${what}: ${me()} ${ctx.cmd} <${what}>. Run "${me()} ${ctx.cmd} --help" to see the options.`);
  if (p.length > 1) throw usage(`Give one ${what} only. Found: ${p.map((x) => `"${x}"`).join(", ")}.`);
  return p[0];
}
const none = (ctx) => { if (ctx.positionals.length) throw usage(`${ctx.cmd} takes no file. Found: "${ctx.positionals[0]}".`); };

function choice(name, value, list) {
  if (list.includes(value)) return value;
  const m = didYouMean(String(value), list);
  throw usage(`--${name} cannot be "${value}".${m ? ` Did you mean "${m}"?` : ""} Use one of: ${list.join(", ")}.`);
}

function number(name, value, { min, max, int = false, dflt }) {
  if (value === undefined) return dflt;
  const n = Number(value);
  if (!/^\s*[\d.]+\s*$/.test(value) || !Number.isFinite(n) || n < min || n > max || (int && !Number.isInteger(n)))
    throw usage(`--${name} cannot be "${value}". Use ${int ? "a whole number" : "a number"} from ${min} to ${max}.`);
  return n;
}

const list = (s) => (s === undefined ? [] : String(s).split(",").map((x) => x.trim()).filter(Boolean));

function tabsOf(value) {
  if (value === undefined) return undefined;
  const want = list(value).map((t) => t.toLowerCase());
  if (!want.length) throw usage(`--tabs needs one or more of: ${TABS.join(", ")}.`);
  for (const t of want) choice("tabs", t, TABS);
  return TABS.filter((t) => want.includes(t));
}

// ---- files

const cwd = () => process.cwd();
const show = (p) => { const r = relative(cwd(), p); return r && !r.startsWith("..") && !isAbsolute(r) ? r : p; };
// Two paths of one file: the same text (in any case on Windows and macOS), or, when both exist, the same file identity
// (device and inode). The identity catches a path through a junction or a linked folder, an 8.3 short name and
// "::$DATA". An inode of 0 (some network and FAT volumes) is no identity, so those paths compare as text only.
const CASELESS = process.platform === "win32" || process.platform === "darwin";
const sameFile = (a, b) => {
  if (!a || !b) return false;
  if (CASELESS ? a.toLowerCase() === b.toLowerCase() : a === b) return true;
  try {
    const x = statSync(a, { bigint: true, throwIfNoEntry: false }), y = statSync(b, { bigint: true, throwIfNoEntry: false });
    return !!x && !!y && x.ino !== 0n && x.dev === y.dev && x.ino === y.ino;
  } catch { return false; }
};
const isLink = (d) => { try { return !!lstatSync(d, { throwIfNoEntry: false })?.isSymbolicLink(); } catch { return false; } };
// A folder on the way up is the root: the same text, or (when the folder is not itself a link) the same folder identity.
// The identity catches a root spelled with an 8.3 short name, a UNC admin share (\\localhost\C$) or through a linked
// folder above it.
const isRootDir = (dir, root) => (CASELESS ? dir.toLowerCase() === root.toLowerCase() : dir === root) || (!isLink(dir) && sameFile(dir, root));

// A folder on the way to an output that is a link (a symbolic link or a junction) to another folder. The walk goes up
// from the output to the first root that holds it, in the order given (the project folder, else the current folder),
// so a linked "out" folder in a project cannot send a file outside it, also from a current folder inside that link. A
// link above the root, or a path that no root holds, is not refused. Folders that the write makes are new, real folders.
function linkedFolder(path, roots, opt = "--out") {
  for (const root of roots.filter(Boolean)) {
    let link = null;
    for (let dir = dirname(path); ; dir = dirname(dir)) {
      if (isRootDir(dir, root)) {
        if (link) throw fail(`The folder "${show(link)}" is a link to another folder. jig does not write through links. Remove the link, or give ${opt} another path.`);
        return;
      }
      if (!link && isLink(dir)) link = dir;
      if (dirname(dir) === dir) break;
    }
  }
}

// The current folder as the shell names it ($PWD), when that is another spelling of process.cwd(), else null. On Linux
// and macOS the kernel gives the current folder by its real path, so after "cd proj/out", where out is a linked folder,
// only $PWD still shows the link. $PWD counts only when it names the same folder (device and inode): a parent process
// that changed the folder without updating $PWD leaves a stale value. Windows keeps the path as given in process.cwd().
function shellCwd() {
  const pwd = process.env.PWD, here = cwd();
  if (process.platform === "win32" || !pwd || !isAbsolute(pwd) || resolve(pwd) === here) return null;
  return sameFile(resolve(pwd), here) ? resolve(pwd) : null;
}

// Every output goes through here. It never writes through a link: a symbolic link, or a hard link (a file with more
// than one name), could point outside the project folder. Nor through a linked folder below base (the project folder)
// or the current folder. An output in the current folder is checked also by the shell's name of that folder, so a
// current folder inside a linked folder of the project is refused on every system. flag: the writeFileSync flag ("wx":
// never replace a file). opt: the option the messages name.
function writeFile(path, data, base, { flag, opt = "--out" } = {}) {
  linkedFolder(path, [base, cwd()], opt);
  const shell = shellCwd(), rel = shell && relative(cwd(), path);
  if (shell && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel)) linkedFolder(join(shell, rel), [base, shell], opt);
  let st;
  try { st = lstatSync(path, { throwIfNoEntry: false }); } catch { st = undefined; }
  if (st && (st.isSymbolicLink() || (st.isFile() && st.nlink > 1)))
    throw fail(`The file "${show(path)}" is a link to another file. jig does not write through links. Remove the link, or give ${opt} another path.`);
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, data, flag ? { flag } : undefined);
  } catch (e) { throw fail(`The file "${show(path)}" cannot be written (${e.code ?? e.message}).`, e); }
}

// An --out that names the project file itself is refused before anything is written (exit 2).
const notProject = (p, file) => { if (file && sameFile(p, file)) throw usage(`The output "${show(p)}" is the project file. Give --out another name.`); };
// The same check right after the load, for an --out that is a file path (not a folder), before the report prints.
function guardOut(outArg, file) {
  if (outArg === undefined || /[\\/]$/.test(outArg)) return;
  const p = resolve(outArg);
  if (!(existsSync(p) && statSync(p).isDirectory())) notProject(p, file);
}

// An output path: --out as given, a file in --out when it is a folder, or name in base.
function target(outArg, base, name) {
  if (outArg === undefined) return join(base, name);
  const p = resolve(outArg);
  if (/[\\/]$/.test(outArg) || (existsSync(p) && statSync(p).isDirectory())) return join(p, name);
  return p;
}

// The file name of the outputs: the project id, or the project file name when the id is not usable.
const nameOf = (M, file) => (ID.test(M.meta.id ?? "") ? M.meta.id : parse(file).name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project");

// A text file or stdin: UTF-8, or UTF-16 with a byte order mark (decodeText).
function readText(src) {
  let buf;
  try { buf = readFileSync(resolve(src)); } catch (e) {
    throw fail(e.code === "ENOENT" ? `The file "${src}" does not exist.` : `The file "${src}" cannot be read (${e.code ?? e.message}).`, e);
  }
  return decodeText(buf, src);
}

async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return decodeText(Buffer.concat(chunks), "stdin");
}

// Data to --out (name is the file name when --out is a folder), or to stdout. With --report json, stdout holds only
// the report, so data goes only to --out. file: the project file, which --out never replaces.
function emit(ctx, text, outArg, name, file) {
  if (outArg !== undefined) {
    const p = target(outArg, cwd(), name);
    notProject(p, file);
    writeFile(p, text, file && dirname(file));
    ctx.outputs.push(p);
    ctx.log(`Wrote ${show(p)}.`);
  } else if (!ctx.reportJson) process.stdout.write(text);
}

const json = (v) => `${JSON.stringify(v, null, 2)}\n`;

// ---- the report

function reportOf(ctx, M, ok, extra = {}) {
  return Object.assign({
    ok, engine: ENGINE_VERSION, command: ctx.cmd, project: M ? { id: M.meta.id || null, title: M.meta.title || null } : null,
    counts: M ? M.counts : { ...ZERO }, problems: M ? M.problems : [], totals: M ? M.totals : null, outputs: ctx.outputs,
  }, extra);
}

// Prints the JSON report when asked. Under --quiet a blocked command still prints one line, so it never fails silently.
function finish(ctx, M, ok, extra = {}) {
  if (ctx.reportJson) process.stdout.write(json(reportOf(ctx, M, ok, extra)));
  if (!ok && ctx.values.quiet) {
    const c = extra.counts ?? M?.counts ?? ZERO, cap = extra.capture?.consoleErrors?.length ?? 0, route = extra.capture?.routeMismatch ? 1 : 0;
    const ste = extra.counts || ctx.values.strict ? c.ste : 0, unused = !extra.counts && ctx.values.strict ? strictWarnings(M) : 0, n = cap + route + c.error + ste + unused;
    const what = cap || route ? [cap && plural(cap, "console error"), route && "a route that the page changed"].filter(Boolean).join(" and ")
      : [c.error && plural(c.error, "error"), ste && `${ste} STE ${ste === 1 ? "finding" : "findings"}`, unused && unusedText(unused)].filter(Boolean).join(" and ");
    process.stderr.write(`jig ${ctx.cmd}: ${what || "problems"} ${n === 1 ? "blocks" : "block"} the command. Run it without --quiet to see ${n === 1 ? "it" : "them"}.\n`);
  }
  return ok ? 0 : 1;
}

// What blocks a command: errors, and under --strict the STE findings and the unused safety.cleared entries.
function blockers(M, strictMode) {
  const c = M.counts, unused = strictMode ? strictWarnings(M) : 0;
  const why = [c.error && plural(c.error, "error"), strictMode && c.ste && `${c.ste} STE ${c.ste === 1 ? "finding" : "findings"} (--strict)`,
    unused && `${unusedText(unused)} (--strict)`].filter(Boolean);
  return why.length ? why.join(" and ") : null;
}

async function load(ctx, mode, extra = {}) {
  const src = one(ctx, "project");
  const { project, file } = await loadProject(src);
  return { M: compute(project, { mode, ...extra }), file };
}

// The data commands: compute, print the report, then write the output unless errors block it.
async function data(ctx, mode, { extra, strictMode = false, render }) {
  const { M, file } = await load(ctx, mode, extra);
  guardOut(ctx.values.out, file);
  const blocked = blockers(M, strictMode);
  ctx.log(`${reportText(M)}\n`);
  if (blocked && !ctx.values.force) {
    ctx.log(`Stopped: the project has ${blocked}. Fix the problems above, then run the command again.`);
    return finish(ctx, M, false);
  }
  render(M, file);
  if (blocked) ctx.log(`Forced: the project has ${blocked}. Do not use this output.`);
  return finish(ctx, M, !blocked);
}

// ---- new: the starter, and its inch version

const titleOf = (id) => { const s = id.replace(/-/g, " "); return s[0].toUpperCase() + s.slice(1); };

// Every length of a project, converted from mm to inches (nearest 1/16 in); coverage from m² to ft² per unit.
// Stock lengths and sheet sides go to the inch sizes that stores sell: the nearest whole foot when it is within 5%
// (1200 mm gives 48 in, 2440 mm gives 96 in, a 1220 x 2440 mm sheet 48 x 96 in).
export function toInches(P) {
  const L = (v) => { const r = Math.round((v / 25.4) * 16) / 16; return r === 0 && v > 0 ? 0.0625 : r || 0; };
  const F = (v) => { const r = L(v), f = Math.round(r / 12) * 12; return f && Math.abs(f - r) <= 0.05 * f ? f : r; };
  const fix = (o, keys, f = L) => { for (const k of keys) if (typeof o?.[k] === "number") o[k] = f(o[k]); else if (Array.isArray(o?.[k])) o[k] = o[k].map(f); };
  P.units = "in";
  fix(P, ["kerf", "trim"]);
  for (const m of Object.values(P.materials ?? {})) {
    fix(m, ["section", "thick", "len", "d"]);
    for (const s of m.stock ?? []) fix(s, ["length", "w", "h"], F);
    if (m.perLength) fix(m.perLength, ["per", "max", "step"]);
    if (typeof m.coverage === "number") m.coverage = round(m.coverage / FT2, 1);
  }
  for (const p of [...(P.parts ?? []), ...Object.values(P.props ?? {})]) fix(p, ["size", "at"]);
  for (const s of P.steps ?? []) {
    fix(s, ["from"]);
    for (const f of s.fasteners ?? []) { fix(f, ["at", "len", "d"]); if (f.repeat) fix(f.repeat, ["step"]); }
  }
  return P;
}

// JSON with short arrays and objects on one line, like the example projects.
const inline = (v) => (Array.isArray(v) ? `[${v.map(inline).join(", ")}]`
  : v && typeof v === "object" ? (Object.keys(v).length ? `{ ${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${inline(x)}`).join(", ")} }` : "{}")
  : JSON.stringify(v));
export function pretty(v, indent = "", key = 0) {
  const flat = inline(v);
  if (v === null || typeof v !== "object" || indent.length + key + flat.length <= 130) return flat;
  const next = `${indent}  `, arr = Array.isArray(v);
  const items = arr ? v.map((x) => pretty(x, next)) : Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${pretty(x, next, k.length + 4)}`);
  return `${arr ? "[" : "{"}\n${items.map((s) => next + s).join(",\n")}\n${indent}${arr ? "]" : "}"}`;
}

// ---- text lint

// Markdown text on one line (as markdown.mjs t()): no control characters; a backslash, "<" and "[" get a backslash,
// so project text cannot start raw HTML, a link or an image.
const md = (s) => term(oneLine(s)).replace(/\\/g, "\\\\").replace(/</g, "\\<").replace(/\[/g, "\\[");
// Inline Markdown to plain text. Each repeat has a bound, so a long line of "![" or "*a" stays linear in time.
const inlineMd = (s) => s.replace(/!\[[^\]\n]{0,500}\]\([^)\n]{0,2000}\)/g, "").replace(/\[([^\]\n]{1,500})\]\([^)\n]{0,2000}\)/g, "$1").replace(/<[^<>\n]{1,500}>/g, "")
  .replace(/(\*\*|__)(.{1,500}?)\1/g, "$2").replace(/(^|[^\w*])\*(?!\s)(.{1,500}?)\*(?![\w*])/g, "$1$2").replace(/(^|\W)_(?!\s)(.{1,500}?)_(?!\w)/g, "$1$2")
  .replace(/`{1,20}([^`]{0,2000})`{1,20}/g, "$1").replace(/\\([\\`*_{}[\]()#+\-.!<>|])/g, "$1").replace(/\s+/g, " ").trim();

// The reader texts of a text or Markdown file: [{ line, text }]. Each line is one text; a line that starts with a
// lower-case letter continues the text before it when that text does not end a sentence. Front matter, code blocks,
// headings, tables, HTML lines, link definitions and rules are left out; list and quote markers and emphasis are removed.
export function textUnits(src) {
  const out = [];
  let fence = null, front = false, last = null;
  String(src ?? "").replace(BOM, "").split(/\r\n|\r|\n/).forEach((raw, i) => {
    const s0 = raw.trim(), f = /^(`{3,}|~{3,})/.exec(s0);
    if (i === 0 && s0 === "---") return void (front = true);
    if (front) { if (s0 === "---" || s0 === "...") front = false; return; }
    if (fence) { if (f && f[1][0] === fence[0] && f[1].length >= fence.length) fence = null; return; }
    if (f) { fence = f[1]; last = null; return; }
    if (/^(=+|-+)$/.test(s0) && last?.line === i) { out.pop(); last = null; return; } // setext heading: the line before is a heading
    if (!s0 || /^#{1,6}(\s|$)/.test(s0) || s0.startsWith("|") || /^([-*_])(\s*\1){2,}$/.test(s0) || /^<!--|^<\/?[a-z][^>]*>$/i.test(s0) || /^\[[^\]]+\]:\s/.test(s0)) {
      last = null;
      return;
    }
    let s = s0.replace(/^(>\s?)+/, "");
    const item = /^(?:[-*+•]|\d+[.)])\s+/.test(s);
    s = inlineMd(s.replace(/^(?:[-*+•]|\d+[.)])\s+/, "").replace(/^\[[ xX]\]\s+/, ""));
    if (!s) return void (last = null);
    if (last && !item && !/[.!?:]["'’”)\]]*$/.test(last.text) && /^\p{Ll}/u.test(s)) return void (last.text += ` ${s}`);
    out.push((last = { line: i + 1, text: s }));
  });
  return out;
}

// The lint report. Each value stays on its line (oneLine), so a text with a line break cannot fake a report line.
function lintReport(name, what, problems) {
  const L = [`jig ${ENGINE_VERSION} lint: ${name}, ${what}`, `Findings: ${problems.length} STE`];
  for (const p of problems) L.push(`  ${oneLine(p.where)}${p.path ? ` [${oneLine(p.path)}]` : ""} ${p.code}: ${oneLine(p.msg)}`, ...(p.hint ? [`    ${oneLine(p.hint)}`] : []));
  return `${L.join("\n")}\n`;
}

// ---- safety review

function safetyMd(M, findings) {
  const u = M.meta.units, S = M.safety, tool = (id) => M.tools.find((t) => t.id === id)?.name ?? id, tip = S.tip;
  const tipText = !tip ? "not known, because a part has no position"
    : tip.ratio === null ? `${fmtLen(tip.height, u)} tall, with no base on the floor`
    : `${fmtLen(tip.height, u)} tall and ${fmtLen(tip.depth, u)} deep: ratio ${tip.ratio}, limit ${tip.limit}, ${tip.anchored ? "attached to a wall" : "not attached to a wall"}`;
  const L = [`# Safety review: ${md(M.meta.title)}`, "",
    `- Tip-over: ${tipText}.`,
    `- Power tools: ${S.power.length ? md(S.power.map(tool).join(", ")) : "none"}.`,
    `- Protective equipment: ${S.ppe.length ? md(S.ppe.map(tool).join(", ")) : "none in the tools"}.`,
    `- Hand-offs: ${S.handoffs.length ? md(S.handoffs.map((h) => h.name ?? h.topic).join(", ")) : "none"}.`,
    `- Cleared hand-off hits: ${S.cleared?.length ? md(S.cleared.map((c) => c.name).join(", ")) : "none"}.`, ""];
  if (S.handoffs.length) L.push("## Hand-offs", "", "A professional does this work:", "", ...S.handoffs.map((h) => `- **${md(h.name ?? h.topic)}**: ${md(h.text)}`), "");
  // Every override of the hand-off screen, with each text it clears, so that a person reads each one.
  if (S.cleared?.length) L.push("## Cleared hand-off hits", "",
    "The hand-off screen found these words, and safety.cleared says that they are not hand-off work. Read each text. If a text is hand-off work, remove the entry and add the hand-off.", "",
    ...S.cleared.flatMap((c) => [`- **${md(c.name)}**, cleared entry ${c.entry + 1}: ${md(c.why)}`,
      ...c.hits.map((h) => `  - ${md(h.where)}: "${md(h.text)}"${h.context ? ` in: ${md(h.context)}` : ""}`)]), "");
  if (S.notes?.length) L.push("## Protective equipment", "", ...S.notes.map((n) => `- ${md(n)}`), "");
  L.push("## Findings", "");
  if (!findings.length) L.push("No safety findings.", "");
  for (const p of findings) L.push(`- **${p.code}**, ${md(p.where)}: ${md(p.msg)}`, `  Fix: ${md(p.hint)}`);
  return `${L.join("\n").trimEnd()}\n`;
}

// ---- the commands

const pick = (M, keys) => Object.fromEntries([["engine", M.engine], ...keys.map((k) => [k, M[k]])]);

// The routes of a built jig page, from its own file: each tab it has, then every step (build/1 ...). null when the file
// is not a jig page.
function pageRoutes(file) {
  let html;
  try { html = readFileSync(file, "utf8"); } catch { return null; }
  const data = /<script type="application\/json" id="jig-data">([\s\S]*?)<\/script>/.exec(html);
  if (!data) return null;
  let M;
  try { M = JSON.parse(data[1]); } catch { return null; }
  const tabs = (/data-tabs="([^"]*)"/.exec(html)?.[1] ?? TABS.join(" ")).split(/[\s,]+/).filter((t) => TABS.includes(t));
  const steps = Array.isArray(M.steps) ? M.steps : [];
  return [...tabs.filter((t) => t !== "build"), ...(tabs.includes("build") ? steps.map((s, i) => `build/${i + 1}`) : [])]
    .map((hash) => ({ hash, label: hash.startsWith("build/") ? `${hash.slice(6)} · ${oneLine(String(steps[Number(hash.slice(6)) - 1]?.title ?? "")).slice(0, 48)}` : hash }));
}

// capture --sheet: every route as a tile in one image, for the review loop (engine/docs/verify.md).
async function sheet(ctx, src, url, opts) {
  const v = ctx.values;
  if (opts.select !== undefined) throw usage("--select does not work with --sheet. Each tile is the window.");
  if (opts.hash !== undefined) throw usage("--hash does not work with --sheet. Use --routes.");
  const cols = number("cols", v.cols, { min: 1, max: 12, int: true, dflt: 3 });
  let routes;
  if (v.routes !== undefined) {
    routes = v.routes.split(",").map((r) => r.trim().replace(/^#/, "")).filter(Boolean).map((hash) => ({ hash, label: hash }));
    if (!routes.length) throw usage("--routes has no route. Give routes separated by commas, for example plan,build/2.");
  } else {
    routes = url ? null : pageRoutes(resolve(src));
    if (!routes) throw usage(url ? "A sheet of a URL needs --routes." : `The page "${src}" is not a jig guide page. Give --routes.`);
  }
  const img = url ? target(v.out, cwd(), "capture-sheet.png") : target(v.out, dirname(resolve(src)), `${parse(src).name}-sheet.png`);
  if (!/\.(png|webp)$/i.test(img)) throw usage(`--out must end in .png or .webp. Found: "${v.out}".`);
  const { captureSheet, findBrowser, browserWarnings } = await import("./lib/capture.mjs");
  for (const w of browserWarnings()) ctx.log(w);
  if (!findBrowser()) throw fail("No Chrome, Chromium or Edge found. Install one, or set JIG_BROWSER to the browser program.");
  let r;
  try {
    r = await captureSheet(url ?? pathToFileURL(resolve(src)).href, { ...opts, wait: v.wait === undefined ? undefined : opts.wait,
      out: img, cols, hashes: routes.map((x) => x.hash), labels: routes.map((x) => x.label) });
  } catch (e) {
    if (e?.name === "CaptureError") throw fail(e.message, e);
    throw e;
  }
  ctx.outputs.push(r.out);
  const plain = (h) => String(h ?? "").replace(/^#/, "").replace(/^build\/0+(?=\d)/, "build/");
  const moved = r.shots.filter((s) => plain(s.route) !== plain(s.hash) && !(plain(s.hash) === "build" && /^build\/\d+$/.test(plain(s.route))));
  ctx.log([`Wrote ${show(r.out)} (${plural(r.shots.length, "tile")}).`,
    ...moved.map((s) => `Route: ${s.route || "(none)"} (asked for #${plain(s.hash)})`),
    `Console errors: ${r.consoleErrors.length || "none"}`, ...r.consoleErrors.map((e) => `  ${e.split("\n")[0]}`),
    `Sideways scroll: ${r.sideways.length ? r.sideways.join(", ") : "no"}`, ""].join("\n"));
  return finish(ctx, null, !r.consoleErrors.length && !moved.length,
    { capture: { sheet: true, routes: r.shots, routeMismatch: moved.length > 0, consoleErrors: r.consoleErrors, sidewaysScroll: r.sideways.length > 0 } });
}

const RUN = {
  async new(ctx) {
    const v = ctx.values, id = one(ctx, "id");
    if (!ID.test(id) || id.length > 64) {
      const fix = id.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64) || "pine-bookshelf";
      throw usage(`The id "${id}" has the wrong format. Use lower-case letters, digits and single hyphens, for example "${fix}".`);
    }
    const units = choice("units", v.units ?? "mm", ["mm", "in"]);
    if (v.title !== undefined && !v.title.trim()) throw usage("--title cannot be empty.");
    const file = join(resolve(v.dir ?? id), "project.json");
    const exists = (cause) => fail(`The file "${show(file)}" exists, and new does not write over a file. Give another --dir, or remove the file.`, cause);
    if (existsSync(file)) throw exists();
    let P;
    try { P = JSON.parse(readFileSync(new URL("./templates/starter.json", import.meta.url), "utf8")); } catch (e) { throw fail(`The starter template cannot be read (${e.code ?? e.message}).`, e); }
    P.id = id;
    P.title = v.title?.trim() ?? titleOf(id);
    if (units === "in") toInches(P);
    // The new project folder is the root, so a linked folder above it (~/Projects on another drive) is fine: new never
    // writes over a file ("wx" also refuses a file that appears after the check above).
    try { writeFile(file, `${pretty(P)}\n`, dirname(file), { flag: "wx", opt: "--dir" }); } catch (e) { throw e?.cause?.code === "EEXIST" ? exists(e.cause) : e; }
    ctx.outputs.push(file);
    // The hint runs as it is from the current folder: the real engine path, not "engine/jig.mjs".
    ctx.log(`Wrote ${show(file)}: a starter project with lengths in ${units === "in" ? "inches" : "millimetres"}.\n`
      + `Next: change its materials, parts and steps, then run: ${me()} check ${arg(show(file))}\n`
      + "For a cost or a cut list only, run boq or cut. They need only the materials and the parts.\n");
    return finish(ctx, null, true, { project: { id, title: P.title } });
  },

  async check(ctx) {
    const { M } = await load(ctx, "guide");
    const blocked = blockers(M, ctx.values.strict);
    ctx.log(`${reportText(M)}${blocked ? `\nCheck failed: ${blocked}.` : "\nCheck passed."}\n`);
    return finish(ctx, M, !blocked);
  },

  async build(ctx) {
    const v = ctx.values, asked = tabsOf(v.tabs);
    const { M, file } = await load(ctx, "guide");
    const blocked = blockers(M, v.strict);
    const { renderPage, tabsFor } = await import("./lib/page.mjs");
    // A project with nothing to cut or print has no cut tab: --tabs leaves it out, and --tabs cut alone is a usage error
    // (when the project has no errors that hide its parts).
    let tabs = asked;
    if (asked) try { tabs = tabsFor(M, asked); } catch (e) { if (!blocked) throw usage(`--tabs ${asked.join(",")}: ${e.message}`); }
    const suffix = `${tabs && tabs.length === 1 && tabs[0] === "build" ? "-3d" : ""}${v.artifact ? "-artifact" : ""}`;
    const html = target(v.out, dirname(file), `${nameOf(M, file)}${suffix}.html`), p = parse(html);
    const model = v.json ? join(p.dir, `${p.name}.json`) : null;
    if (sameFile(model, html)) throw usage(`--json would write the model over the page "${show(html)}". Give --out a name that ends in .html.`);
    for (const x of [html, model]) if (sameFile(x, file)) throw usage(`The output "${show(x)}" is the project file. Give --out another name.`);
    ctx.log(`${reportText(M)}\n`);
    if (blocked && !v.force) {
      ctx.log(`Stopped: the project has ${blocked}. Fix the problems above, then run the command again.\n`);
      return finish(ctx, M, false);
    }
    let three;
    if (v.offline) {
      const { loadThree } = await import("./lib/offline.mjs");
      try { three = await loadThree({ cacheDir: join(tmpdir(), "jig-three-cache") }); } catch (e) { throw fail(`three.js cannot be loaded for --offline: ${e.message}`, e); }
    }
    let page;
    try { page = await renderPage(M, { artifact: !!v.artifact, offline: !!v.offline, tabs, three }); } catch (e) { if (/no cut tab/.test(e.message)) throw usage(`--tabs ${asked.join(",")}: ${e.message}`); throw e; }
    writeFile(html, page, dirname(file));
    ctx.outputs.push(html);
    if (model) { writeFile(model, json(M), dirname(file)); ctx.outputs.push(model); }
    ctx.log(`Wrote ${show(html)} (${Math.ceil(Buffer.byteLength(page) / 1024)} KiB)${model ? ` and ${show(model)}` : ""}.`);
    if (blocked) ctx.log(`Forced: the page has ${blocked}. Do not share it.`);
    return finish(ctx, M, !blocked);
  },

  async plan(ctx) {
    const v = ctx.values, level = v.level === undefined ? undefined : choice("level", v.level, ["new", "some", "pro"]);
    const format = choice("format", v.format ?? "md", ["md", "json"]);
    return data(ctx, "plan", { strictMode: v.strict, render: (M, file) =>
      emit(ctx, format === "md" ? planMd(M, { level }) : json(pick(M, ["meta", "plan", "steps", "tools", "techniques", "safety"])), v.out, `${nameOf(M, file)}-plan.${format}`, file) });
  },

  async boq(ctx) {
    const v = ctx.values, format = choice("format", v.format ?? "md", ["md", "csv", "json"]);
    return data(ctx, "estimate", { render: (M, file) =>
      emit(ctx, format === "md" ? boqMd(M) : format === "csv" ? boqCsv(M) : json(pick(M, ["meta", "boq", "totals"])), v.out, `${nameOf(M, file)}-boq.${format}`, file) });
  },

  async cut(ctx) {
    const v = ctx.values, format = choice("format", v.format ?? "md", ["md", "json", "svg"]);
    return data(ctx, "estimate", { render: (M, file) => {
      if (format !== "svg") {
        // A printed part carries its print (grams, hours, settings); prints lists them by material (only when there are any).
        const parts = M.parts.map(({ id, label, name, material, kind, cut, print }) => ({ id, label, name, material, kind, cut, ...(print ? { print } : {}) }));
        const prints = printList(M);
        return emit(ctx, format === "md" ? cutMd(M) : json({ ...pick(M, ["meta"]), parts, cuts: M.cuts, ...(prints.length ? { prints } : {}) }), v.out, `${nameOf(M, file)}-cut.${format}`, file);
      }
      // One SVG for each material: <base>-<material>.svg. Ids that differ only in case ("ply-6", "Ply-6") give one
      // file on Windows and macOS: refused on every platform, before any file is written, so a zip stays safe.
      const p = target(v.out, dirname(file), `${nameOf(M, file)}-cut`), base = join(dirname(p), parse(p).name);
      if (!M.cuts.length) ctx.log("Nothing to draw: no part is cut from a board or a sheet.");
      const files = M.cuts.map((c) => [c, `${base}-${c.material}.svg`]), seen = new Map();
      for (const [c, f] of files) {
        const k = f.toLowerCase(), a = seen.get(k);
        if (a) throw usage(`The cut drawings of materials "${a}" and "${c.material}" get the same file name "${show(f)}" on Windows and macOS. Give one of the materials another id.`);
        seen.set(k, c.material);
      }
      for (const [c, f] of files) {
        writeFile(f, cutSvg(M, c.material), dirname(file));
        ctx.outputs.push(f);
        ctx.log(`Wrote ${show(f)}.`);
      }
    } });
  },

  async buy(ctx) {
    const v = ctx.values, format = choice("format", v.format ?? "md", ["md", "json"]);
    if (v.start !== undefined && !orderBy(v.start)) throw usage(`--start cannot be "${v.start}". Write a real date as YYYY-MM-DD, for example 2026-11-14.`);
    return data(ctx, "estimate", { extra: { start: v.start ?? null }, render: (M, file) =>
      emit(ctx, format === "md" ? buyMd(M) : json(pick(M, ["meta", "purchase", "boq", "totals"])), v.out, `${nameOf(M, file)}-buy.${format}`, file) });
  },

  async safety(ctx) {
    const v = ctx.values, format = choice("format", v.format ?? "md", ["md", "json"]);
    const { M, file } = await load(ctx, "plan");
    guardOut(v.out, file);
    const findings = M.problems.filter((p) => SAFETY_CODES.has(p.code));
    ctx.log(`${reportText(M)}\n`);
    emit(ctx, format === "md" ? safetyMd(M, findings) : json({ ...pick(M, ["meta", "safety"]), findings }), v.out, `${nameOf(M, file)}-safety.${format}`, file);
    return finish(ctx, M, M.counts.error === 0, { safety: M.safety });
  },

  async lint(ctx) {
    const v = ctx.values, src = one(ctx, "file"), terms = list(v.terms), verbs = list(v.verbs);
    const kind = choice("kind", v.kind ?? "procedure", ["procedure", "warning", "description", "title"]);
    if (src !== "-" && /\.(json|mjs|js)$/i.test(src)) {
      const { project } = await loadProject(src);
      const P = project && typeof project === "object" && !Array.isArray(project) ? { ...project } : project;
      if (P !== project) {
        if (terms.length) P.terms = Array.isArray(P.terms) ? [...P.terms, ...terms] : terms;
        if (verbs.length) P.verbs = Array.isArray(P.verbs) ? [...P.verbs, ...verbs] : verbs;
      }
      const M = compute(P, { mode: "plan" }), found = M.problems.filter((p) => p.level === "ste");
      ctx.log(lintReport(src, "every reader text of the project", found));
      if (M.counts.error) ctx.log(`The project also has ${plural(M.counts.error, "error")}, so the lint can miss some text. Run check to see them.\n`);
      return finish(ctx, M, !found.length, { counts: { ...ZERO, ste: found.length }, problems: found, totals: null });
    }
    const text = src === "-" ? await readStdin() : readText(src), name = src === "-" ? "stdin" : src.replace(/\\/g, "/");
    const units = textUnits(text);
    const found = units.flatMap(({ line, text: t }) => steLint(t, kind, { names: terms, verbs })
      .map((f) => ({ level: "ste", code: f.code, path: `${name}:${line}`, where: `line ${line}`, msg: f.msg, hint: f.hint })));
    ctx.log(lintReport(name, `${plural(units.length, "text")} as ${kind}`, found));
    return finish(ctx, null, !found.length, { counts: { ...ZERO, ste: found.length }, problems: found });
  },

  async capture(ctx) {
    const v = ctx.values, src = one(ctx, "page");
    const opts = {
      width: number("width", v.width, { min: 100, max: 10000, int: true, dflt: 1280 }),
      height: number("height", v.height, { min: 100, max: 20000, int: true, dflt: 900 }),
      scale: number("scale", v.scale, { min: 0.25, max: 4, dflt: 1 }),
      wait: number("wait", v.wait, { min: 0, max: 120000, int: true, dflt: 4000 }),
      theme: v.theme === undefined ? undefined : choice("theme", v.theme, ["light", "dark"]),
      select: v.select, reducedMotion: !!v["reduced-motion"], hash: v.hash?.replace(/^#/, "") || undefined,
      tour: v.tour === undefined ? undefined : number("tour", v.tour, { min: 0, max: 3600, dflt: 0 }),
    };
    const url = /^(https?|file):/i.test(src) ? src : null;
    if (!url && !existsSync(resolve(src))) throw fail(`The page "${src}" does not exist.`);
    if (!v.sheet && (v.routes !== undefined || v.cols !== undefined)) throw usage("--routes and --cols need --sheet.");
    if (v.sheet) return sheet(ctx, src, url, opts);
    const slug = opts.hash ? `-${opts.hash.replace(/[^A-Za-z0-9]+/g, "-")}` : "";
    const img = url ? target(v.out, cwd(), `capture${slug}.png`) : target(v.out, dirname(resolve(src)), `${parse(src).name}${slug}.png`);
    if (!/\.(png|webp)$/i.test(img)) throw usage(`--out must end in .png or .webp. Found: "${v.out}".`);
    const { capture, findBrowser, browserWarnings } = await import("./lib/capture.mjs");
    for (const w of browserWarnings()) ctx.log(w);
    if (!findBrowser()) throw fail("No Chrome, Chromium or Edge found. Install one, or set JIG_BROWSER to the browser program.");
    let r;
    try { r = await capture(url ?? pathToFileURL(resolve(src)).href, { ...opts, out: img }); } catch (e) {
      if (e?.name === "CaptureError") throw fail(e.message, e);
      throw e;
    }
    ctx.outputs.push(r.out);
    // A jig page rewrites a step or tab it does not have (#build/99 opens the last step): the image then shows another
    // view than the one asked for, which blocks the command like a console error. "build" with no step number opens
    // a step of the page's choice and shows it in the URL (#build/1): that is no mismatch. Nor is "build/03" -> "build/3".
    const plain = (h) => { let s = String(h ?? "").replace(/^#/, ""); try { s = decodeURIComponent(s); } catch { /* as written */ } return s.replace(/^build\/0+(?=\d)/, "build/"); };
    const route = r.route ?? "", got = plain(route), want = plain(opts.hash);
    const mismatch = opts.hash !== undefined && got !== want && !(want === "build" && /^build\/\d+$/.test(got));
    ctx.log([`Wrote ${show(r.out)}.`, ...(mismatch ? [`Route: ${route || "(none)"} (asked for #${opts.hash})`] : []),
      `Console errors: ${r.consoleErrors.length || "none"}`, ...r.consoleErrors.map((e) => `  ${e.split("\n")[0]}`),
      `Sideways scroll: ${r.sidewaysScroll ? "yes" : "no"}`, ""].join("\n"));
    return finish(ctx, null, !r.consoleErrors.length && !mismatch,
      { capture: { url: r.url, route, routeMismatch: mismatch, consoleErrors: r.consoleErrors, sidewaysScroll: r.sidewaysScroll } });
  },

  async schema(ctx) {
    none(ctx);
    emit(ctx, json(SCHEMA), ctx.values.out, "project.schema.json");
    return finish(ctx, null, true);
  },
};

// ---- main

// main(argv) -> exit code. Never throws: failures print one line on stderr (the stack only with --debug).
export async function main(argv = process.argv.slice(2)) {
  const reportJson = argv.includes("--report=json") || argv.some((a, i) => a === "--report" && argv[i + 1] === "json");
  const debug = argv.includes("--debug");
  let cmd = null;
  try {
    const first = argv[0];
    if (first === undefined) { process.stderr.write(helpText()); return 2; }
    if (["--version", "-v", "-V", "version"].includes(first)) { process.stdout.write(`jig ${ENGINE_VERSION}\n`); return 0; }
    if (["--help", "-h", "help"].includes(first)) {
      const sub = argv[1];
      if (sub && !Object.hasOwn(COMMANDS, sub)) throw usage(`Unknown command "${sub}".${didYouMean(sub, Object.keys(COMMANDS)) ? ` Did you mean "${didYouMean(sub, Object.keys(COMMANDS))}"?` : ""}`);
      process.stdout.write(helpText(sub));
      return 0;
    }
    if (!Object.hasOwn(COMMANDS, first)) {
      const near = first.startsWith("-") ? null : didYouMean(first, Object.keys(COMMANDS));
      throw usage(first.startsWith("-") ? `Give the command first, for example: ${me()} check project.json ${first}.`
        : `Unknown command "${first}".${near ? ` Did you mean "${near}"?` : ""} Run "${me()} --help" to see the commands.`);
    }
    cmd = first;
    const parsed = parseCommand(cmd, argv.slice(1));
    if (parsed.error) throw usage(parsed.error);
    const { values, positionals } = parsed;
    if (values.help) { process.stdout.write(helpText(cmd)); return 0; }
    if (values.report !== undefined && values.report !== "json") throw usage(`--report cannot be "${values.report}". Use --report json.`);
    // "-" is not stdout: every command would write a file named "-". Data goes to stdout when --out is left out (with
    // --report json, stdout holds the report, so "-" cannot mean stdout). "./-" still names a file.
    if (values.out === "-") throw usage('--out cannot be "-". To print the data on stdout, leave out --out. To write a file, give its name.');
    // Human text goes through term(): project text cannot send escape codes or a carriage return to the terminal.
    const ctx = { cmd, values, positionals, reportJson: values.report === "json", outputs: [], log: (t) => { if (!values.quiet) process.stderr.write(term(t.endsWith("\n") ? t : `${t}\n`)); } };
    return await RUN[cmd](ctx);
  } catch (e) {
    const exit = e instanceof CliError ? e.exit : 3;
    const msg = e instanceof CliError || e instanceof LoadError ? e.message : `Internal error: ${e?.message ?? e}. Run again with --debug to see the stack trace.`;
    const stack = debug && e?.stack ? `${e.stack}\n${e.cause?.stack ? `Cause: ${e.cause.stack}\n` : ""}` : "";
    process.stderr.write(term(`jig${cmd ? ` ${cmd}` : ""}: ${msg}\n${stack}`));
    if (reportJson && cmd) {
      process.stdout.write(json({ ok: false, engine: ENGINE_VERSION, command: cmd, project: null, counts: { ...ZERO }, problems: [], totals: null, outputs: [], error: { exit, message: msg } }));
    }
    return exit;
  }
}

// Run when called as a script (not when imported by a test).
const invoked = (() => {
  if (!process.argv[1]) return false;
  let a = resolve(process.argv[1]), b = SELF;
  try { a = realpathSync(a); b = realpathSync(b); } catch { /* compare as given */ }
  return sameFile(a, b);
})();
if (invoked) {
  process.stdout.on("error", (e) => { if (e.code === "EPIPE") process.exit(process.exitCode ?? 0); else throw e; }); // a reader that stops early
  process.exitCode = await main();
}
