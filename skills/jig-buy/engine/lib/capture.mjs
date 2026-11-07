// Screenshots a page in headless Chrome, Chromium or Edge over the DevTools protocol, with Node's built-in WebSocket.
// It reports the console errors and whether the page scrolls sideways. No npm packages, no fixed debugging port.

import { spawn } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, delimiter, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export class CaptureError extends Error {
  constructor(message, cause) { super(message, cause ? { cause } : undefined); this.name = "CaptureError"; }
}

const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
const later = (ms) => new Promise((ok) => setTimeout(ok, ms).unref()); // a time limit that does not keep Node running
const LINUX = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge", "microsoft-edge-stable"];

// Standard install places, in order: Chrome, Chromium, Edge.
function candidates(env, platform) {
  if (platform === "win32") {
    const roots = [env.PROGRAMFILES, env["PROGRAMFILES(X86)"], env.LOCALAPPDATA, "C:\\Program Files", "C:\\Program Files (x86)"].filter(Boolean);
    return [
      ...roots.map((r) => join(r, "Google", "Chrome", "Application", "chrome.exe")),
      ...roots.map((r) => join(r, "Chromium", "Application", "chrome.exe")),
      ...roots.map((r) => join(r, "Microsoft", "Edge", "Application", "msedge.exe")),
    ];
  }
  if (platform === "darwin") {
    const apps = ["/Applications", join(env.HOME ?? homedir(), "Applications")];
    return [["Google Chrome", "Google Chrome"], ["Chromium", "Chromium"], ["Microsoft Edge", "Microsoft Edge"]]
      .flatMap(([app, bin]) => apps.map((a) => `${a}/${app}.app/Contents/MacOS/${bin}`));
  }
  const path = String(env.PATH ?? "").split(delimiter).filter(Boolean);
  return [
    ...LINUX.flatMap((n) => path.map((d) => join(d, n))),
    "/opt/google/chrome/chrome", "/snap/bin/chromium", "/opt/microsoft/msedge/msedge",
  ];
}

// findBrowser({ env, platform, exists }) -> the path of a Chrome, Chromium or Edge program, or null.
// JIG_BROWSER, then CHROME_PATH, then the standard install places.
export function findBrowser({ env = process.env, platform = process.platform, exists = existsSync } = {}) {
  for (const p of [env.JIG_BROWSER, env.CHROME_PATH, ...candidates(env, platform)]) if (p && exists(p)) return p;
  return null;
}

// browserWarnings({ env, exists }) -> one line for each of JIG_BROWSER and CHROME_PATH that names a missing file.
// findBrowser then goes on to the next place, so without this line a typo in the variable goes unseen.
export function browserWarnings({ env = process.env, exists = existsSync } = {}) {
  return ["JIG_BROWSER", "CHROME_PATH"].filter((k) => env[k] && !exists(env[k]))
    .map((k) => `Warning: ${k} is "${env[k]}", but that file does not exist. jig looks for the browser in the next place.`);
}

// Profiles of earlier captures that a kill (Ctrl+C, a tool time-out) left in the temp folder: removed when they are
// more than 1 hour old. A capture takes 3 minutes at most, so a live one is never touched.
const PROFILE = /^jig-capture-[A-Za-z0-9]{6}$/, STALE = 3600000;
export function removeStaleProfiles({ dir = tmpdir(), now = Date.now() } = {}) {
  let names = [];
  try { names = readdirSync(dir); } catch { return; }
  for (const n of names) {
    if (!PROFILE.test(n)) continue;
    const p = join(dir, n);
    try { if (statSync(p).isDirectory() && now - statSync(p).mtimeMs > STALE) rmSync(p, { recursive: true, force: true, maxRetries: 2 }); } catch { /* in use: it stays */ }
  }
}

// The browser writes its port and browser path to DevToolsActivePort in the profile folder.
async function devtools(profile, child, timeout) {
  const file = join(profile, "DevToolsActivePort"), end = Date.now() + timeout;
  while (Date.now() < end) {
    if (child.exitCode !== null) throw new CaptureError(`The browser stopped before it opened (exit code ${child.exitCode}).`);
    try {
      const [port, path] = readFileSync(file, "utf8").split(/\r?\n/);
      if (/^\d+$/.test(port) && path) return `ws://127.0.0.1:${port}${path}`;
    } catch { /* not written yet */ }
    await sleep(50);
  }
  throw new CaptureError(`The browser did not open its DevTools port in ${Math.round(timeout / 1000)} s.`);
}

// A small DevTools protocol client: send(method, params, session) and event listeners.
function connect(url, timeout) {
  return new Promise((ok, fail) => {
    const ws = new WebSocket(url), pending = new Map(), listeners = new Set();
    let id = 0;
    ws.onmessage = (e) => {
      const m = JSON.parse(typeof e.data === "string" ? e.data : Buffer.from(e.data).toString("utf8"));
      if (m.id === undefined) return void listeners.forEach((l) => l(m));
      const p = pending.get(m.id);
      if (!p) return;
      pending.delete(m.id);
      clearTimeout(p.timer);
      if (m.error) p.fail(new CaptureError(`${p.method} failed: ${m.error.message}`));
      else p.ok(m.result ?? {});
    };
    ws.onclose = () => { for (const p of pending.values()) { clearTimeout(p.timer); p.fail(new CaptureError(`The browser closed during ${p.method}.`)); } pending.clear(); };
    ws.onerror = () => fail(new CaptureError("The DevTools connection failed."));
    ws.onopen = () => ok({
      send: (method, params = {}, sessionId) => new Promise((res, rej) => {
        const call = ++id, timer = setTimeout(() => { pending.delete(call); rej(new CaptureError(`The browser did not answer ${method} in ${Math.round(timeout / 1000)} s.`)); }, timeout);
        pending.set(call, { ok: res, fail: rej, method, timer });
        ws.send(JSON.stringify({ id: call, method, params, ...(sessionId ? { sessionId } : {}) }));
      }),
      on: (fn) => listeners.add(fn),
      close: () => { try { ws.close(); } catch { /* closed */ } },
    });
  });
}

// The page URL with ?capture (the viewer keeps its drawing buffer and holds the Plan view tour still), the tour time
// (?tour=<seconds>: the Plan view shows the tour at that time) and the hash to open.
export function captureUrl(url, hash, tour) {
  const u = new URL(url);
  if (!/(^|[?&])capture(=|&|$)/.test(u.search.slice(1))) u.search = u.search.length > 1 ? `${u.search}&capture` : "?capture";
  if (Number.isFinite(tour) && tour >= 0) u.searchParams.set("tour", String(Math.round(tour * 100) / 100));
  if (hash) u.hash = String(hash).replace(/^#/, "");
  return u.href;
}

const text = (args = []) => args.map((a) => (a.value !== undefined ? String(a.value) : a.description ?? a.unserializableValue ?? "")).join(" ").trim();
const cut = (s) => (s.length > 500 ? `${s.slice(0, 499)}…` : s);

// The folder of a file:// page, else null.
const pageDir = (url) => { try { return /^file:/i.test(url) ? dirname(fileURLToPath(url)) : null; } catch { return null; } };
const CASELESS = process.platform === "win32" || process.platform === "darwin";
const isLink = (d) => { try { return !!lstatSync(d, { throwIfNoEntry: false })?.isSymbolicLink(); } catch { return false; } };
// Two existing folders with one identity (device and inode). An inode of 0 (some network and FAT volumes) is no identity.
const sameId = (a, b) => {
  try {
    const x = statSync(a, { bigint: true, throwIfNoEntry: false }), y = statSync(b, { bigint: true, throwIfNoEntry: false });
    return !!x && !!y && x.ino !== 0n && x.dev === y.dev && x.ino === y.ino;
  } catch { return false; }
};
const isRootDir = (dir, root) => (CASELESS ? dir.toLowerCase() === root.toLowerCase() : dir === root) || (!isLink(dir) && sameId(dir, root));
// A folder on the way to the image that is a link (a symbolic link or a junction), going up to the first root that
// holds the image, in the order given (the folder of the page, else the current folder), as jig.mjs checks its outputs.
// The root is found by text or by folder identity (an 8.3 short name, a UNC share). -> the link folder, or null.
function linkedFolder(file, roots) {
  for (const root of roots.filter(Boolean)) {
    let link = null;
    for (let dir = dirname(file); ; dir = dirname(dir)) {
      if (isRootDir(dir, root)) return link;
      if (!link && isLink(dir)) link = dir;
      if (dirname(dir) === dir) break;
    }
  }
  return null;
}
// The current folder as the shell names it ($PWD) when that is another spelling of process.cwd() (Linux and macOS give
// the real path, so only $PWD shows a current folder inside a linked folder), else null. As jig.mjs shellCwd().
function shellCwd() {
  const pwd = process.env.PWD, here = process.cwd();
  if (process.platform === "win32" || !pwd || !isAbsolute(pwd) || resolve(pwd) === here) return null;
  return sameId(resolve(pwd), here) ? resolve(pwd) : null;
}

// browserArgs(profile) -> the command-line switches of the headless browser: a fresh profile, software WebGL, no
// throttling, and switches that ask for less background traffic of the browser itself (no variations seed, sync,
// pings, translation or optimization-guide model downloads). Chrome still sends its update, component, sign-in, time
// and device check-in requests. The page still loads what it names (three.js, fonts).
export function browserArgs(profile, { platform = process.platform, root = process.getuid?.() === 0 } = {}) {
  return [
    "--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check",
    "--disable-extensions", "--hide-scrollbars", "--mute-audio", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
    "--disable-background-timer-throttling", "--disable-renderer-backgrounding",
    "--disable-background-networking", "--disable-component-update", "--disable-sync", "--disable-default-apps", "--no-pings",
    "--metrics-recording-only", "--disable-features=OptimizationHints,OptimizationGuideModelDownloading,Translate,MediaRouter",
    ...(platform === "win32" ? ["--do-not-de-elevate"] : []), ...(root ? ["--no-sandbox"] : []), "about:blank",
  ];
}

// capture(url, opts) -> { out, url, consoleErrors: [text], sidewaysScroll: bool, route }.
// opts: out (.png or .webp, required), width, height, scale (device pixel ratio), theme (light | dark), select (a CSS
// selector to clip to; else the full page height), viewport (true: clip to the window, not the full page height), wait
// (ms after load), hash ("build/3"), tour (seconds: the Plan view tour at that time), reducedMotion, browser, timeout,
// tmp (the folder that holds the browser profile; default the system temp folder).
export async function capture(url, opts = {}) {
  const [one] = await captureMany(url, [{ hash: opts.hash, out: opts.out }], opts);
  return one;
}

// The review sheet page: the tiles in a grid, each with its route label in the top left corner.
const escHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
export function sheetHtml(tiles, { cols = 3, tile = 512 } = {}) {
  const cells = tiles.map((t) => `<figure><img src="${escHtml(t.file)}" alt=""><figcaption>${escHtml(t.label)}</figcaption></figure>`).join("");
  return `<!doctype html><meta charset="utf-8"><title>jig review sheet</title><style>
html,body{margin:0;background:#333}main{display:grid;grid-template-columns:repeat(${cols},${tile}px);gap:4px;padding:4px;width:max-content}
figure{position:relative;margin:0;background:#fff}img{display:block;width:${tile}px;height:auto}
figcaption{position:absolute;right:6px;top:6px;max-width:70%;padding:2px 8px;border-radius:4px;background:rgba(0,0,0,.72);color:#fff;font:600 15px/1.4 system-ui,sans-serif}
</style><main>${cells}</main>\n`;
}

// captureSheet(url, { out, hashes, labels, cols, ...captureMany opts }) -> { out, shots, consoleErrors, sideways }.
// The review loop in one image: each route (window size, not the full page) as a tile with its label, cols tiles to a
// row. The tiles live in a temporary folder that is removed after. sideways: the routes that scroll sideways.
export async function captureSheet(url, { out, hashes, labels, cols = 3, tmp = tmpdir(), ...opts } = {}) {
  if (!/\.(webp|png)$/i.test(out ?? "")) throw new CaptureError(`The output "${out ?? ""}" must end in .png or .webp.`);
  if (!Array.isArray(hashes) || !hashes.length) throw new CaptureError("No route for the sheet.");
  const dir = mkdtempSync(join(tmp, "jig-sheet-"));
  try {
    const shots = await captureMany(url, hashes.map((hash, i) => ({ hash, out: join(dir, `${String(i).padStart(3, "0")}.png`) })), { ...opts, viewport: true, tmp });
    const n = Math.max(1, Math.min(Number(cols) || 3, shots.length)), tile = 512;
    writeFileSync(join(dir, "sheet.html"), sheetHtml(shots.map((s, i) => ({ file: basename(s.out), label: labels?.[i] ?? `#${String(hashes[i]).replace(/^#/, "")}` })), { cols: n, tile }));
    const [sheet] = await captureMany(pathToFileURL(join(dir, "sheet.html")).href, [{ out }], { width: n * (tile + 4) + 4, height: 400, scale: 1, wait: 400, browser: opts.browser, timeout: opts.timeout, tmp });
    return { out: sheet.out, shots: shots.map((s, i) => ({ hash: hashes[i], route: s.route, sidewaysScroll: s.sidewaysScroll })),
      consoleErrors: shots.at(-1).consoleErrors, sideways: shots.filter((s) => s.sidewaysScroll).map((s) => s.route) };
  } finally {
    try { rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch { /* locked: the folder stays in the temp folder */ }
  }
}

// captureMany(url, shots, opts) -> one result for each shot { hash, out, tour? }, in one browser session. The first
// shot opens the page; each later one sets location.hash and waits opts.wait (default 2500 ms), or, with tour, steps the
// still Plan view tour to that time. opts.quality: the WebP quality, 0 to 100 (default 90). Every result carries the
// console errors of the whole session so far.
export async function captureMany(url, shots, { width = 1280, height = 900, scale = 1, theme, select, viewport = false, wait, tour, quality = 90, reducedMotion = false, browser, timeout = 60000, tmp = tmpdir() } = {}) {
  if (!Array.isArray(shots) || !shots.length) throw new CaptureError("No shot to capture.");
  for (const s of shots) if (!/\.(webp|png)$/i.test(s.out ?? "")) throw new CaptureError(`The output "${s.out ?? ""}" must end in .png or .webp.`);
  const exe = browser ?? findBrowser();
  if (!exe) throw new CaptureError("No Chrome, Chromium or Edge found. Install one, or set JIG_BROWSER to the browser program.");
  const page = captureUrl(url, shots[0].hash, tour), consoleErrors = [], results = [];
  removeStaleProfiles({ dir: tmp });
  const profile = mkdtempSync(join(tmp, "jig-capture-"));
  const args = browserArgs(profile);
  let child = null, cdp = null;
  // Ctrl+C or a kill while the browser runs: stop the browser and remove the profile (it holds the page's storage),
  // then exit as the signal asks (130 for SIGINT, 143 for SIGTERM).
  const EXIT = { SIGINT: 130, SIGTERM: 143, SIGHUP: 129, SIGBREAK: 149 }, handlers = {};
  for (const [sig, code] of Object.entries(EXIT)) {
    handlers[sig] = () => {
      try { child?.kill(); } catch { /* gone */ }
      try { rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); } catch { /* locked: the next capture removes it */ }
      process.exit(code);
    };
    try { process.once(sig, handlers[sig]); } catch { /* the signal does not exist on this platform */ }
  }
  try {
    try { child = spawn(exe, args, { stdio: "ignore", windowsHide: true }); } catch (e) { throw new CaptureError(`The browser "${exe}" cannot start: ${e.message}`, e); }
    const started = new Promise((ok, fail) => { child.once("error", (e) => fail(new CaptureError(`The browser "${exe}" cannot start: ${e.message}`, e))); child.once("spawn", ok); });
    await started;
    child.on("error", () => {}); // a later error (a failed kill) must not crash Node
    cdp = await connect(await devtools(profile, child, timeout), timeout);
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    const send = (method, params) => cdp.send(method, params, sessionId);
    let loaded = () => {};
    cdp.on((m) => {
      if (m.sessionId !== sessionId) return;
      const p = m.params ?? {};
      if (m.method === "Page.loadEventFired") loaded();
      else if (m.method === "Runtime.consoleAPICalled" && (p.type === "error" || p.type === "assert")) consoleErrors.push(cut(`console.${p.type}: ${text(p.args)}`));
      else if (m.method === "Runtime.exceptionThrown") consoleErrors.push(cut(`exception: ${p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text ?? "unknown"}`));
      else if (m.method === "Log.entryAdded" && p.entry?.level === "error" && p.entry.source !== "network") consoleErrors.push(cut(`${p.entry.source}: ${p.entry.text}`));
    });
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Log.enable");
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: scale, mobile: width < 600 });
    await send("Emulation.setEmulatedMedia", { media: "screen", features: [
      { name: "prefers-color-scheme", value: theme === "dark" ? "dark" : "light" },
      { name: "prefers-reduced-motion", value: reducedMotion ? "reduce" : "no-preference" },
    ] });
    const load = new Promise((ok) => { loaded = ok; });
    const nav = await send("Page.navigate", { url: page });
    if (nav.errorText) throw new CaptureError(`The page "${url}" cannot open: ${nav.errorText}.`);
    await Promise.race([load, later(Math.min(timeout, 30000))]);
    await sleep(wait ?? 4000);
    const evaluate = async (expression) => {
      const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new CaptureError(`The page script failed: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
      return r.result?.value;
    };
    for (let n = 0; n < shots.length; n++) {
      const { hash, out } = shots[n], format = /\.webp$/i.test(out) ? "webp" : "png", file = resolve(out);
      if (n > 0 && shots[n].tour === undefined) {
        await evaluate(`location.hash = ${JSON.stringify(String(hash ?? "").replace(/^#/, ""))}`);
        await sleep(wait ?? 2500);
      }
      // a shot with tour: the Plan view tour steps to that time (the page holds it still), and the frame is drawn at once
      if (Number.isFinite(shots[n].tour)) {
        await evaluate(`dispatchEvent(new CustomEvent("jig:tour", { detail: ${Number(shots[n].tour)} }))`);
        await sleep(60);
      }
      const sidewaysScroll = await evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth + 1");
      const route = await evaluate("location.hash"); // a jig page rewrites a step or tab that it does not have
      // Clip: the selected element (scrolled into view; centred when it fits, so a sticky bar at the top does not cover
      // it), or the full page height at the window width.
      const box = await evaluate(select
        ? `(() => { const el = document.querySelector(${JSON.stringify(select)}); if (!el) return null;
            el.scrollIntoView({ block: el.getBoundingClientRect().height < innerHeight * 0.8 ? "center" : "start" });
            const r = el.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height }; })()`
        : `(() => { scrollTo(0, 0); const d = document.documentElement; return { x: 0, y: 0, width: d.clientWidth || innerWidth,
            height: ${viewport ? "innerHeight" : "Math.max(d.scrollHeight, document.body ? document.body.scrollHeight : 0, innerHeight)"} }; })()`);
      if (!box) throw new CaptureError(`No element matches --select "${select}".`);
      if (!(box.width > 0 && box.height > 0)) throw new CaptureError(`The element "${select}" has no size on the page.`);
      if (select) await sleep(150);
      const clip = { x: Math.max(0, box.x), y: Math.max(0, box.y), width: box.width, height: Math.min(box.height, Math.floor(16000 / scale)), scale: 1 };
      const shot = await send("Page.captureScreenshot", { format, ...(format === "webp" ? { quality } : {}), clip, captureBeyondViewport: true });
      // Never write through a link: a linked folder, a symbolic link, or a hard link (a file with more than one name).
      const shell = shellCwd(), rel = shell && relative(process.cwd(), file);
      const linked = linkedFolder(file, [pageDir(url), process.cwd()])
        ?? (shell && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel) ? linkedFolder(join(shell, rel), [pageDir(url), shell]) : null);
      if (linked) throw new CaptureError(`The folder "${linked}" is a link to another folder. jig does not write through links. Remove the link, or give --out another path.`);
      let st;
      try { st = lstatSync(file, { throwIfNoEntry: false }); } catch { st = undefined; }
      if (st && (st.isSymbolicLink() || (st.isFile() && st.nlink > 1)))
        throw new CaptureError(`The file "${out}" is a link to another file. jig does not write through links. Remove the link, or give --out another path.`);
      try {
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, Buffer.from(shot.data, "base64"));
      } catch (e) { throw new CaptureError(`The image "${out}" cannot be written (${e.code ?? e.message}).`, e); }
      results.push({ out: file, url: n ? captureUrl(url, hash, tour) : page, consoleErrors: [...consoleErrors], sidewaysScroll: sidewaysScroll === true, route: typeof route === "string" ? route : "" });
    }
    return results;
  } finally {
    if (cdp) { await Promise.race([cdp.send("Browser.close").catch(() => {}), later(2000)]); cdp.close(); }
    if (child?.pid && child.exitCode === null && child.signalCode === null) {
      const gone = new Promise((ok) => child.once("exit", ok));
      child.kill();
      await Promise.race([gone, later(3000)]);
    }
    // Helper processes of the browser can hold the profile for a moment after it exits (Windows), or write into it again
    // just after it is removed (Linux): try again until the folder is gone, for up to about 5 s. A folder that stays is
    // removed by a later capture (removeStaleProfiles).
    for (let k = 0; k < 10; k++) {
      try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch { /* locked: try again */ }
      if (!existsSync(profile)) break;
      await sleep(250);
    }
    for (const [sig, h] of Object.entries(handlers)) process.removeListener(sig, h);
  }
}
