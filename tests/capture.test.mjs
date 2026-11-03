// capture.mjs: browser search order, the capture URL, and (when Chrome, Chromium or Edge is installed) a real capture of
// a tiny local page: the PNG and WebP signatures, a console.error and an exception, sideways scroll, --select, and the
// capture command's exit code and report. Without a browser the live tests skip.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync, linkSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmdirSync, rmSync, symlinkSync, unlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { browserArgs, browserWarnings, capture, captureUrl, findBrowser, removeStaleProfiles, CaptureError } from "../engine/lib/capture.mjs";

const JIG = fileURLToPath(new URL("../engine/jig.mjs", import.meta.url));
const TMP = mkdtempSync(join(tmpdir(), "jig-capture-test-"));
after(() => rmSync(TMP, { recursive: true, force: true }));
const BROWSER = findBrowser();
const page = (name, body) => { const p = join(TMP, name); writeFileSync(p, `<!doctype html><meta charset="utf-8"><title>t</title><body style="margin:0">${body}</body>`); return p; };
const PNG = "89504e470d0a1a0a";

test("findBrowser: JIG_BROWSER, then CHROME_PATH, then the standard places; null when none exists", () => {
  const files = new Set(["/x/jig", "/x/chrome", "C:\\PF\\Google\\Chrome\\Application\\chrome.exe", "C:\\PF\\Microsoft\\Edge\\Application\\msedge.exe", "/usr/bin/chromium"]);
  const exists = (p) => files.has(p);
  assert.equal(findBrowser({ env: { JIG_BROWSER: "/x/jig", CHROME_PATH: "/x/chrome" }, platform: "linux", exists }), "/x/jig");
  assert.equal(findBrowser({ env: { JIG_BROWSER: "/x/missing", CHROME_PATH: "/x/chrome" }, platform: "linux", exists }), "/x/chrome");
  assert.equal(findBrowser({ env: { PROGRAMFILES: "C:\\PF" }, platform: "win32", exists: (p) => files.has(p.replace(/\//g, "\\")) })?.replace(/\//g, "\\"), "C:\\PF\\Google\\Chrome\\Application\\chrome.exe");
  assert.equal(findBrowser({ env: { PATH: "/usr/bin" }, platform: "linux", exists: (p) => files.has(p.replace(/\\/g, "/")) })?.replace(/\\/g, "/"), "/usr/bin/chromium");
  assert.equal(findBrowser({ env: {}, platform: "darwin", exists: () => false }), null);
});

test("browserWarnings: a JIG_BROWSER or CHROME_PATH that names a missing file", () => {
  assert.deepEqual(browserWarnings({ env: { JIG_BROWSER: "/x/missing", CHROME_PATH: "/x/chrome" }, exists: (p) => p === "/x/chrome" }),
    ['Warning: JIG_BROWSER is "/x/missing", but that file does not exist. jig looks for the browser in the next place.']);
  assert.equal(browserWarnings({ env: { CHROME_PATH: "/x/none" }, exists: () => false }).length, 1);
  assert.deepEqual(browserWarnings({ env: {}, exists: () => false }), []);
});

test("browserArgs: headless, a fresh profile, software WebGL, and the switches against background network traffic", () => {
  const a = browserArgs("P", { platform: "linux", root: false });
  for (const s of ["--headless=new", "--user-data-dir=P", "--use-angle=swiftshader", "--disable-background-networking", "--disable-component-update",
    "--disable-sync", "--disable-default-apps", "--no-pings", "--metrics-recording-only"]) assert.ok(a.includes(s), s);
  const features = a.find((s) => s.startsWith("--disable-features="))?.slice(19).split(",") ?? [];
  for (const f of ["OptimizationHints", "OptimizationGuideModelDownloading", "Translate", "MediaRouter"]) assert.ok(features.includes(f), f);
  assert.equal(a.at(-1), "about:blank");
  assert.ok(!a.includes("--do-not-de-elevate") && !a.includes("--no-sandbox"));
  assert.ok(browserArgs("P", { platform: "win32" }).includes("--do-not-de-elevate"));
  assert.ok(browserArgs("P", { platform: "linux", root: true }).includes("--no-sandbox"));
});

test("removeStaleProfiles: only capture profiles older than 1 hour go", () => {
  const dir = mkdtempSync(join(TMP, "stale-")), hours = (h) => new Date(Date.now() - h * 3600000);
  const mk = (name, h) => { const p = join(dir, name); mkdirSync(p); writeFileSync(join(p, "Local State"), "{}"); utimesSync(p, hours(h), hours(h)); return p; };
  const old = mk("jig-capture-old123", 2), fresh = mk("jig-capture-new123", 0), other = mk("jig-capture-test-x", 2);
  removeStaleProfiles({ dir });
  assert.deepEqual([existsSync(old), existsSync(fresh), existsSync(other)], [false, true, true]);
});

test("captureUrl adds ?capture once, keeps the query and sets the hash", () => {
  assert.equal(captureUrl("file:///C:/a/b.html", "build/3"), "file:///C:/a/b.html?capture#build/3");
  assert.equal(captureUrl("https://x.test/p?a=1#plan"), "https://x.test/p?a=1&capture#plan");
  assert.equal(captureUrl("https://x.test/p?capture#plan", "#shop"), "https://x.test/p?capture#shop");
});

test("capture refuses an output that is not .png or .webp", async () => {
  await assert.rejects(capture("file:///x.html", { out: join(TMP, "x.jpg"), browser: process.execPath }), CaptureError);
});

test("a live capture: PNG, console errors, an exception, no sideways scroll", async (t) => {
  if (!BROWSER) return t.skip("no Chrome, Chromium or Edge on this machine");
  const p = page("errors.html", '<p id="msg">Hello</p><script>console.error("boom", 42); console.log("fine"); setTimeout(() => { throw new Error("late"); }, 10);</script>');
  const r = await capture(pathToFileURL(p).href, { out: join(TMP, "shots", "errors.png"), wait: 300, width: 640, height: 480, hash: "build/2" });
  assert.equal(readFileSync(r.out).subarray(0, 8).toString("hex"), PNG);
  assert.ok(r.consoleErrors.some((e) => /^console\.error: boom 42$/.test(e)), r.consoleErrors.join("\n"));
  assert.ok(r.consoleErrors.some((e) => /^exception: Error: late/.test(e)), r.consoleErrors.join("\n"));
  assert.ok(!r.consoleErrors.some((e) => /fine/.test(e)));
  assert.equal(r.sidewaysScroll, false);
  assert.match(r.url, /\?capture#build\/2$/);
  assert.equal(r.route, "#build/2", "a page that keeps its hash");
});

test("a live capture removes a stale profile and its own profile, and never writes through a link", async (t) => {
  if (!BROWSER) return t.skip("no Chrome, Chromium or Edge on this machine");
  // The profiles go in a folder of this test only (opts.tmp), so captures of other tests cannot interfere.
  const root = mkdtempSync(join(TMP, "profiles-"));
  const profiles = () => readdirSync(root).filter((n) => /^jig-capture-[A-Za-z0-9]{6}$/.test(n));
  const stale = join(root, "jig-capture-zzOLD1"), then = new Date(Date.now() - 2 * 3600000);
  mkdirSync(stale);
  utimesSync(stale, then, then);
  const p = page("plain.html", "<p>Hi</p>");
  await capture(pathToFileURL(p).href, { out: join(TMP, "plain.png"), wait: 0, tmp: root });
  assert.equal(existsSync(stale), false, "the stale profile is gone");
  // Windows lists a folder that is pending delete until the last handle closes: wait up to 5 s.
  for (let k = 0; k < 50 && profiles().length; k++) await new Promise((ok) => setTimeout(ok, 100));
  assert.deepEqual(profiles(), [], "the run's own profile is gone");
  const victim = join(TMP, "victim.txt");
  writeFileSync(victim, "DATA");
  linkSync(victim, join(TMP, "linked.png"));
  await assert.rejects(capture(pathToFileURL(p).href, { out: join(TMP, "linked.png"), wait: 0, tmp: root }), /is a link to another file/);
  assert.equal(readFileSync(victim, "utf8"), "DATA");
  // A linked folder below the page folder: a junction on Windows (no privilege needed), else a symbolic link.
  const away = mkdtempSync(join(TMP, "away-")), lnk = join(TMP, "lnk");
  symlinkSync(away, lnk, process.platform === "win32" ? "junction" : "dir");
  await assert.rejects(capture(pathToFileURL(p).href, { out: join(lnk, "x.png"), wait: 0, tmp: root }), /The folder ".*lnk" is a link to another folder/);
  assert.deepEqual(readdirSync(away), [], "nothing written through the link");
  // The same kind of link, with the page folder spelled through an alias of the folder above it: the guard finds the
  // page folder by its identity, not by its text.
  const site = join(TMP, "site"), alias = join(TMP, "alias");
  mkdirSync(site, { recursive: true });
  const q = join(site, "plain.html");
  writeFileSync(q, readFileSync(p));
  symlinkSync(away, join(site, "lnk"), process.platform === "win32" ? "junction" : "dir");
  symlinkSync(TMP, alias, process.platform === "win32" ? "junction" : "dir");
  try {
    await assert.rejects(capture(pathToFileURL(q).href, { out: join(alias, "site", "lnk", "y.png"), wait: 0, tmp: root }), /The folder ".*lnk" is a link to another folder/);
    assert.deepEqual(readdirSync(away), [], "nothing written through the link");
  } finally { if (process.platform === "win32") rmdirSync(alias); else unlinkSync(alias); } // a junction goes with rmdir, a symbolic link with unlink
});

test("the capture command: a route that the page changes (#build/99) exits 1 and the report says so", { skip: !BROWSER && "no Chrome, Chromium or Edge on this machine" }, async () => {
  const jig = (args) => new Promise((ok) => execFile(process.execPath, [JIG, ...args], { encoding: "utf8", timeout: 120000 }, (err, stdout, stderr) => ok({ code: err ? err.code : 0, stdout, stderr })));
  const html = join(TMP, "shelf.html");
  assert.equal((await jig(["build", fileURLToPath(new URL("../examples/pine-bookshelf/project.json", import.meta.url)), "--out", html, "-q"])).code, 0);
  const far = await jig(["capture", html, "--hash", "build/99", "--out", join(TMP, "b99.png"), "--wait", "500", "--report", "json"]);
  assert.equal(far.code, 1, far.stderr);
  const rep = JSON.parse(far.stdout);
  assert.deepEqual([rep.ok, rep.capture.route, rep.capture.routeMismatch], [false, "#build/10", true]);
  assert.match(far.stderr, /Route: #build\/10 \(asked for #build\/99\)/);
  const near = JSON.parse((await jig(["capture", html, "--hash", "build/1", "--out", join(TMP, "b1.png"), "--wait", "500", "--report", "json"])).stdout);
  assert.deepEqual([near.capture.route, near.capture.routeMismatch, near.ok], ["#build/1", false, near.capture.consoleErrors.length === 0]);
  // "build" with no step opens step 1 and the page writes #build/1: the view asked for, so no mismatch
  const tabOnly = JSON.parse((await jig(["capture", html, "--hash", "build", "--out", join(TMP, "b.png"), "--wait", "500", "--report", "json"])).stdout);
  assert.deepEqual([tabOnly.capture.route, tabOnly.capture.routeMismatch], ["#build/1", false]);
});

test("a live capture: WebP, --select clips to the element, a wide page scrolls sideways", async (t) => {
  if (!BROWSER) return t.skip("no Chrome, Chromium or Edge on this machine");
  const p = page("wide.html", '<div id="box" style="width:200px;height:100px;background:#c33"></div><div style="width:3000px;height:10px"></div>');
  const r = await capture(pathToFileURL(p).href, { out: join(TMP, "wide.webp"), wait: 100, select: "#box", theme: "dark", reducedMotion: true });
  const b = readFileSync(r.out);
  assert.equal(b.subarray(0, 4).toString("latin1"), "RIFF");
  assert.equal(b.subarray(8, 12).toString("latin1"), "WEBP");
  assert.equal(b.readUInt32LE(4) + 8, b.length);
  assert.deepEqual(r.consoleErrors, []);
  assert.equal(r.sidewaysScroll, true);
  await assert.rejects(capture(pathToFileURL(p).href, { out: join(TMP, "none.png"), wait: 0, select: "#missing" }), /No element matches --select "#missing"/);
});

test("the capture command from a current folder inside a linked folder of the page folder: refused (exit 3)", async (t) => {
  if (!BROWSER) return t.skip("no Chrome, Chromium or Edge on this machine");
  const site = mkdtempSync(join(TMP, "site-")), away = mkdtempSync(join(TMP, "away-")), shots = join(site, "shots");
  const p = join(site, "here.html");
  writeFileSync(p, readFileSync(page("here.html", "<p>Hi</p>")));
  symlinkSync(away, shots, process.platform === "win32" ? "junction" : "dir");
  // As a shell after "cd site/shots": Linux and macOS give the real path as the current folder, $PWD the linked one.
  const r = await new Promise((ok) => execFile(process.execPath, [JIG, "capture", p, "--out", "x.png", "--wait", "0", "-q"], { cwd: shots, env: { ...process.env, PWD: shots }, encoding: "utf8", timeout: 120000 },
    (err, stdout, stderr) => ok({ code: err ? err.code : 0, stdout, stderr })));
  assert.equal(r.code, 3, r.stderr);
  assert.match(r.stderr, /The folder ".*shots" is a link to another folder/);
  assert.deepEqual(readdirSync(away), [], "nothing written through the link");
});

test("the capture command: exit 1 on console errors, the report carries them", async (t) => {
  if (!BROWSER) return t.skip("no Chrome, Chromium or Edge on this machine");
  const p = page("cmd.html", '<script>console.error("from the page");</script>');
  const out = join(TMP, "cmd.png");
  const r = await new Promise((ok) => execFile(process.execPath, [JIG, "capture", p, "--out", out, "--wait", "100", "--report", "json"], { encoding: "utf8", timeout: 120000 },
    (err, stdout, stderr) => ok({ code: err ? err.code : 0, stdout, stderr })));
  assert.equal(r.code, 1, r.stderr);
  const rep = JSON.parse(r.stdout);
  assert.equal(rep.ok, false);
  assert.deepEqual(rep.outputs, [out]);
  assert.deepEqual(rep.capture.consoleErrors, ["console.error: from the page"]);
  assert.match(r.stderr, /Console errors: 1\n {2}console\.error: from the page\nSideways scroll: no/);
  assert.equal(readFileSync(out).subarray(0, 8).toString("hex"), PNG);
});
