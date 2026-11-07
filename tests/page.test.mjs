// page.mjs and engine/web: the escaped model JSON, the import map with sha384 integrity, one module with no static
// import, tab subsets, the Artifact fragment, offline data: URLs, determinism, WCAG contrast of the page.css tokens,
// page rules read from app.js and page.css, and (when Chrome, Chromium or Edge is installed) live checks of the page.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import vm from "node:vm";
import { compute } from "../engine/lib/model.mjs";
import { renderPage, tabList, tabsFor, webFiles, TABS } from "../engine/lib/page.mjs";
import { THREE_FILES, THREE_BASE, loadThree } from "../engine/lib/offline.mjs";
import { noscriptHtml } from "../engine/lib/markdown.mjs";
import { plural as utilPlural, amount as utilAmount, round as utilRound } from "../engine/lib/util.mjs";
import { fmtLen, fmtMoney, fmtRate, minorUnits } from "../engine/lib/locale.mjs";
import { capture, findBrowser } from "../engine/lib/capture.mjs";

const load = (rel) => JSON.parse(readFileSync(new URL(rel, import.meta.url), "utf8"));
const M = compute(load("../examples/pine-bookshelf/project.json"));
const B = compute(load("./fixtures/inch-bench.json"));
const between = (html, open, close = "</script>") => { const i = html.indexOf(open); assert.ok(i >= 0, `missing ${open}`); return html.slice(i + open.length, html.indexOf(close, i)); };
const json = (html) => between(html, '<script type="application/json" id="jig-data">');
const importMap = (html) => JSON.parse(between(html, '<script type="importmap">'));
const moduleCode = (html) => between(html, '<script type="module">\n');
const FAKE = { three: "export const REVISION = '160';\n", "three/addons/controls/OrbitControls.js": "import { REVISION } from 'three';\nexport class OrbitControls {}\n" };
// The model as the page carries it: without safety.cleared (the overrides of the hand-off screen are for the reviewer).
const onPage = (model) => { const { cleared, ...safety } = model.safety; return { ...model, safety }; };

test("the model JSON is escaped: no < in the data block, and it parses back to the model", () => {
  const evil = structuredClone(M);
  evil.meta.title = "</script><script>alert(1)</script> <!-- x";
  evil.steps[0].title = "a < b";
  const html = renderPage(evil), data = json(html);
  assert.ok(!data.includes("<"), "a raw < in the JSON block");
  assert.ok(data.includes("\\u003c/script>"));
  assert.deepEqual(JSON.parse(data), onPage(evil));
  assert.equal(html.split("</script>").length - 1, html.split("<script").length - 1, "every script closes once");
});

test("the page leaves out safety.cleared and shows no cleared entry; the key order of the model stays", () => {
  const p = load("../examples/pine-bookshelf/project.json"), why = "The weed burner runs on a small propane tank. The guide makes no gas connection.";
  p.steps[1].do.push("Keep the propane tank of the weed burner away from the shelf.");
  p.safety = { ...p.safety, cleared: [{ topic: "gas", why }] };
  const C = compute(p), html = renderPage(C), data = JSON.parse(json(html));
  assert.equal(C.safety.cleared.length, 1, "the model keeps the cleared hit");
  assert.ok(!("cleared" in data.safety), "the page data has no safety.cleared");
  assert.deepEqual(Object.keys(data), Object.keys(C));
  assert.deepEqual(Object.keys(data.safety), Object.keys(C.safety).filter((k) => k !== "cleared"));
  assert.ok(!html.replace(/<script type="application\/json" id="jig-data">[\s\S]*?<\/script>/, "").includes(why), "no page text shows the reason");
});

test("online import map: three and three/addons/ on jsDelivr 0.160.0, sha384 integrity for each exact file", () => {
  const map = importMap(renderPage(M));
  assert.equal(map.imports.three, THREE_FILES[0].url);
  assert.equal(map.imports["three/addons/"], `${THREE_BASE}/examples/jsm/`);
  assert.equal(map.imports["three/addons/"] + "controls/OrbitControls.js", THREE_FILES[1].url);
  assert.deepEqual(Object.keys(map.integrity).sort(), THREE_FILES.map((f) => f.url).sort());
  for (const f of THREE_FILES) {
    assert.match(f.url, /^https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.160\.0\//);
    assert.equal(map.integrity[f.url], `sha384-${f.sha384}`);
    assert.match(map.integrity[f.url], /^sha384-[A-Za-z0-9+/]{64}$/);
  }
});

test("one module, no static import or export, viewer scoped, valid syntax, nothing that ends the script early", () => {
  const html = renderPage(M), code = moduleCode(html);
  assert.equal(html.split('<script type="module">').length, 2, "exactly one module script");
  assert.doesNotMatch(code, /^\s*import[\s{*"']/m);
  assert.doesNotMatch(code, /^\s*export\s/m);
  assert.ok(code.startsWith("const { createViewer } = (() => {\n"));
  assert.ok(code.includes('import("three")') && code.includes('import("three/addons/controls/OrbitControls.js")'), "three is a dynamic import");
  assert.ok(!/<!--|-->|<script|<\/script/i.test(code));
  assert.doesNotThrow(() => new Function(code), "the module code parses");
  // the app renders before the viewer: app.js itself never names three
  assert.doesNotMatch(webFiles()["app.js"], /["']three/);
  assert.ok(html.indexOf('<script type="importmap">') < html.indexOf('<script type="module">'), "the import map comes first");
});

test("full page: doctype, lang, viewport-fit, title, fonts, CSS inline, noscript copy, main#jig", () => {
  const html = renderPage(M);
  assert.ok(html.startsWith("<!doctype html>\n<html lang=\"en\">"));
  assert.ok(html.includes('<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'));
  assert.ok(html.includes("<title>Pine bookshelf guide</title>"));
  assert.ok(html.includes('href="https://fonts.gstatic.com" crossorigin'));
  assert.ok(html.includes("fonts.googleapis.com/css2?family=Archivo"));
  assert.ok(html.includes(`<style>\n${webFiles()["page.css"].trimEnd()}\n</style>`));
  assert.ok(html.includes(`<noscript><div class="noscript">${noscriptHtml(M)}</div></noscript>`));
  assert.ok(html.includes('<main class="jig" id="jig" data-tabs="plan,shop,cut,build"></main>'));
  assert.ok(html.includes("MIT License"), "the three.js notice");
  assert.ok(html.endsWith("</body>\n</html>\n"));
  assert.ok(Buffer.byteLength(html) < 256 * 1024, "under the 256 KiB file limit");
});

test("tabs: any subset in page order; one tab, a list string or bad names", () => {
  assert.deepEqual(tabList(), [...TABS]);
  assert.deepEqual(tabList(["build", "plan"]), ["plan", "build"]);
  assert.deepEqual(tabList("build, Shop"), ["shop", "build"]);
  assert.ok(renderPage(M, { tabs: ["build"] }).includes('data-tabs="build"'));
  assert.ok(renderPage(M, { tabs: "cut,plan" }).includes('data-tabs="plan,cut"'));
  assert.throws(() => tabList(["plan", "bild"]), /Unknown tab "bild"/);
  assert.throws(() => tabList([]), /No tab/);
  assert.throws(() => renderPage(M, { tabs: "" }), /No tab/);
});

test("artifact: a body fragment with title, the claude:viewport-fit-sides meta, fonts, style and body, still self-contained", () => {
  const html = renderPage(M, { artifact: true });
  assert.ok(html.startsWith('<title>Pine bookshelf guide</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n<link rel="preconnect"'));
  // the Artifact host adds the standard viewport meta (engine/docs/cli.md, --artifact)
  assert.doesNotMatch(html, /<meta name="viewport"/);
  assert.ok(!/<!doctype|<(html|head|body)[\s>]|<\/(html|head|body)>/i.test(html), "no document skeleton");
  assert.ok(html.includes("<style>\n") && html.includes('<main class="jig" id="jig"'));
  assert.ok(html.indexOf("<style>") < html.indexOf("<main"));
  assert.deepEqual(JSON.parse(json(html)), onPage(M));
  assert.equal(moduleCode(html), moduleCode(renderPage(M)));
  assert.ok(!renderPage(M, { artifact: true, offline: true, three: FAKE }).includes("fonts.googleapis"));
});

test("offline: data: URLs that hold the given sources, no integrity map, no Google Fonts; missing sources throw", () => {
  const html = renderPage(M, { offline: true, three: FAKE }), map = importMap(html);
  assert.deepEqual(Object.keys(map), ["imports"]);
  for (const f of THREE_FILES) {
    const url = map.imports[f.specifier];
    assert.match(url, /^data:text\/javascript;base64,[A-Za-z0-9+/=]+$/);
    assert.equal(Buffer.from(url.split(",")[1], "base64").toString("utf8"), FAKE[f.specifier]);
  }
  assert.ok(!html.includes("fonts.googleapis") && !html.includes("cdn.jsdelivr.net/npm/three@0.160.0/build"));
  assert.throws(() => renderPage(M, { offline: true }), /needs the source of "three"/);
  assert.throws(() => renderPage(M, { offline: true, three: { three: "x" } }), /OrbitControls/);
});

test("deterministic, units carried in the model, CRLF web files build the same bytes", () => {
  assert.equal(renderPage(M), renderPage(M));
  assert.equal(renderPage(B), renderPage(compute(load("./fixtures/inch-bench.json"))));
  assert.equal(JSON.parse(json(renderPage(B))).meta.units, "in");
  const web = webFiles(), crlf = Object.fromEntries(Object.entries(web).map(([k, v]) => [k, `﻿${v.replace(/\n/g, "\r\n")}`]));
  assert.ok(!Object.values(web).some((v) => v.includes("\r")), "web files are read with LF ends");
  assert.equal(renderPage(M, { web: crlf }), renderPage(M));
  assert.throws(() => renderPage(M, { web: { ...web, "app.js": "x = '</script>'" } }), /closing script/);
  assert.throws(() => renderPage(null), /computed model/);
});

test("engine/web: no static import in app.js or viewer.js, one export (createViewer), escaped interpolation", () => {
  const { "app.js": app, "viewer.js": viewer } = webFiles();
  assert.doesNotMatch(app, /^\s*(import|export)\s/m);
  assert.deepEqual(viewer.match(/^export .*/gm), ["export async function createViewer(host, data, opts = {}) {"]);
  assert.doesNotMatch(viewer, /^\s*import[\s{*"']/m);
  // the 3 failure reasons the viewer slot tells apart
  for (const s of ["3D needs a network connection", "3D needs WebGL", "3D error: "]) assert.ok(viewer.includes(s), s);
  assert.ok(viewer.includes("preserveDrawingBuffer: CAPTURE") && /\[\?&\]capture/.test(viewer), "drawing buffer only for captures");
  assert.ok(/innerHTML = String\(h`/.test(app) && !/innerHTML = `/.test(app), "HTML goes through the escaping h`` tag");
});

// ---------- contrast of the page.css tokens (WCAG 2 relative luminance)
const css = webFiles()["page.css"];
const block = (re) => { const m = re.exec(css); assert.ok(m, `missing block ${re}`); return Object.fromEntries([...m[1].matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\b/gi)].map((x) => [x[1], x[2].toLowerCase()])); };
const LIGHT = block(/^:root\{([^}]*)\}/m);
const DARK = block(/^:root\[data-theme="dark"\]\{([^}]*)\}/m);
const AUTO = block(/@media \(prefers-color-scheme:dark\)\{:root:not\(\[data-theme="light"\]\)\{([^}]*)\}\}/);
const lum = (hex) => [16, 8, 0].map((s) => ((parseInt(hex.slice(1), 16) >> s) & 255) / 255)
  .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)).reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0);
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
// [foreground, background] token pairs the page draws text with, and the control borders and marks.
const TEXT = [["ink", "page"], ["ink", "card"], ["text", "page"], ["text", "card"], ["text", "faint"], ["muted", "page"], ["muted", "card"], ["muted", "faint"],
  ["accent", "page"], ["accent", "card"], ["accent-ink", "accent"], ["card", "ink"], ["warn", "warn-bg"], ["ink", "warn-bg"], ["caution", "caution-bg"], ["ink", "caution-bg"], ["caution", "card"]];
const CONTROL = [["control", "card"], ["control", "page"], ["accent", "page"], ["accent", "card"], ["ok", "card"], ["ok", "page"]];

test("contrast: text pairs >= 4.5:1 and control borders >= 3:1 in both themes", () => {
  for (const [name, T] of [["light", LIGHT], ["dark", { ...LIGHT, ...DARK }]]) {
    for (const [f, b] of TEXT) assert.ok(ratio(T[f], T[b]) >= 4.5, `${name}: --${f} on --${b} is ${ratio(T[f], T[b]).toFixed(2)}:1`);
    for (const [f, b] of CONTROL) assert.ok(ratio(T[f], T[b]) >= 3, `${name}: --${f} against --${b} is ${ratio(T[f], T[b]).toFixed(2)}:1`);
  }
});

test("contrast: the dark tokens match in both dark blocks; buttons use --control; wood labels read on any tint", () => {
  assert.deepEqual(AUTO, DARK);
  assert.match(css, /\nbutton\{[^}]*border:1px solid var\(--control\)/);
  assert.match(css, /html,body\{background:var\(--page\)\}/);
  // app.js fills cut drawings with 45% material colour + 55% white; --wood-ink must read on the darkest tint
  const darkest = `#${Math.round(255 * 0.55).toString(16).repeat(3)}`;
  assert.ok(ratio(LIGHT["wood-ink"], darkest) >= 4.5, `wood label ${ratio(LIGHT["wood-ink"], darkest).toFixed(2)}:1`);
  assert.equal(DARK["wood-ink"], undefined, "the wood label colour is the same in both themes");
});

// ---------- page rules read from app.js and page.css
const app = webFiles()["app.js"];
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// The declarations of the rule whose selector is exactly sel (at the top level of src or inside a block).
const rule = (sel, src = css) => { const m = new RegExp(`(?:^|[{}\\n])${reEsc(sel)}\\{([^}]*)\\}`).exec(src); assert.ok(m, `page.css has a rule for ${sel}`); return m[1]; };
const decl = (decls, prop) => { const m = new RegExp(`(?:^|;)${reEsc(prop)}:([^;]+)`).exec(decls); assert.ok(m, `${prop} in {${decls}}`); return m[1].trim(); };
// The body of @media <query>{...}
function media(query) {
  const head = `@media ${query}{`, i = css.indexOf(head);
  assert.ok(i >= 0, `page.css has ${head}`);
  let depth = 1, k = i + head.length;
  for (; k < css.length && depth; k++) depth += css[k] === "{" ? 1 : css[k] === "}" ? -1 : 0;
  return css.slice(i + head.length, k - 1);
}
const box4 = (v) => { const p = v.split(/\s+/).map(parseFloat); return { top: p[0], right: p[1] ?? p[0], bottom: p[2] ?? p[0], left: p[3] ?? p[1] ?? p[0] }; };

test("the Plan view turn button: each accessible name starts with the visible text (WCAG 2.5.3 Label in Name)", () => {
  const m = /b\.textContent = on \? "([^"]+)" : "([^"]+)"; b\.setAttribute\("aria-label", on \? "([^"]+)" : "([^"]+)"\)/.exec(app);
  assert.ok(m, "onSpin sets the text and the label of the button");
  const first = /data-v="spin" aria-label="([^"]+)">([^<]+)</.exec(app);
  assert.ok(first, "the button has a label before the viewer loads");
  for (const [text, label] of [[m[1], m[3]], [m[2], m[4]], [first[2], first[1]]]) assert.ok(label.toLowerCase().startsWith(text.toLowerCase()), `"${label}" starts with "${text}"`);
});

test("a First-time line (+) takes no step number, so the list reads 1, 2, +, 3 (screen and print)", () => {
  assert.match(css, /ol\.do li\.new\{[^}]*counter-increment:none/);
  assert.match(css, /ol\.do li\.new::before\{content:"\+"/);
});

test("the sticky tab bar never covers focus or a step the page scrolls to: html scroll-padding-top clears it (WCAG 2.4.11)", () => {
  const tabs = box4(decl(rule(".tabs"), "padding")), bar = tabs.top + tabs.bottom + parseFloat(decl(rule("button"), "min-height")) + 1;
  assert.ok(parseFloat(decl(rule("html"), "scroll-padding-top")) >= Math.max(64, bar), "scroll-padding-top clears the tab bar");
  assert.equal(decl(rule("html:has(.jig[data-single])"), "scroll-padding-top"), "0", "a single tab has no tab bar");
  // scroll-margin adds to scroll-padding: the one-column view lands just below the bar, the heading a little lower
  const narrow = media("(max-width:860px)");
  assert.equal(decl(rule(".build .stage", narrow), "scroll-margin-top"), "0");
  assert.equal(decl(rule(".jig[data-single] .build .stage", narrow), "scroll-margin-top"), "16px");
  assert.ok(parseFloat(decl(rule("h2[tabindex]"), "scroll-margin-top")) <= 16, "the step heading needs only a small margin");
  // go() scrolls also when the heading is under the bar, not only above the screen
  assert.ok(app.includes('r.top < ($(".tabs")?.getBoundingClientRect().bottom ?? 0)'), "go() measures the tab bar");
});

test("keyboard focus rings fit inside the tab bar and the step rail, which scroll sideways and so clip", () => {
  const fv = rule(":focus-visible"), ring = parseFloat(/^outline:(\d+(?:\.\d+)?)px/.exec(fv)[1]) + parseFloat(decl(fv, "outline-offset"));
  assert.equal(ring, 4);
  for (const sel of [".tabs", ".rail"]) {
    const r = rule(sel), pad = box4(decl(r, "padding"));
    assert.equal(decl(r, "overflow-x"), "auto");
    for (const side of ["top", "left", "right", "bottom"]) assert.ok(pad[side] >= ring, `${sel} padding-${side} ${pad[side]}px < ${ring}px`);
  }
});

test("narrow screens: titles and long words break inside the word, phases keep room for a name, cut sizes wrap after a × only when they must", () => {
  assert.equal(decl(rule("h1,h2,h3"), "overflow-wrap"), "anywhere");
  assert.equal(decl(rule(".lede,.trip label .it"), "overflow-wrap"), "anywhere");
  // the BOQ item only where its row is a grid: in a table, anywhere shrinks the column and breaks short words too
  assert.equal(decl(rule(".boq tbody td:nth-child(2)", media("(max-width:600px)")), "overflow-wrap"), "anywhere");
  assert.doesNotMatch(css.replace(media("(max-width:600px)"), ""), /\.boq tbody td:nth-child\(2\)[^{]*\{[^}]*overflow-wrap/);
  const mw = /^min\((\d+(?:\.\d+)?)rem,100%\)$/.exec(decl(rule(".phase"), "min-width"));
  assert.ok(mw && Number(mw[1]) >= 5, "a phase is at least 5rem wide");
  // only when app.js finds that the table would scroll sideways: the material goes under the name, then sizes wrap,
  // then a material name breaks, and last a part name breaks
  assert.equal(decl(rule('.parts[data-fit~="stack"] .pmat'), "display"), "none");
  assert.equal(decl(rule('.parts[data-fit~="stack"] .pm'), "display"), "block");
  assert.equal(decl(rule('.parts[data-fit~="wrap"] th:nth-child(4),.parts[data-fit~="wrap"] td:nth-child(4)'), "white-space"), "normal");
  assert.equal(decl(rule('.parts[data-fit~="mat"] .pm,.parts[data-fit~="mat"] td.pmat'), "overflow-wrap"), "anywhere");
  assert.equal(decl(rule('.parts[data-fit~="break"] td:nth-child(2),.parts[data-fit~="break"] td.pmat'), "overflow-wrap"), "anywhere");
  assert.doesNotMatch(css, /\.parts (th|td):nth-child\(4\)[^{]*\{white-space:normal\}/, "no unconditional wrap of the sizes");
  // before a material name breaks, the Parts card takes the full width of the Cut tab (the page text is the system
  // font, so its width is not known when the page is built)
  assert.equal(decl(rule('.grid2:has(.parts[data-fit~="wide"])'), "grid-template-columns"), "minmax(0,1fr)");
  assert.ok(/^function fitParts\(/m.test(app) && app.includes('for (const f of ["stack", "stack wrap", "wide", "wide stack", "wide stack wrap", "wide stack wrap mat", "wide stack wrap mat break"]) { if (!over()) break; t.dataset.fit = f; }'), "app.js fits the Parts table");
  assert.ok(app.includes('len(v, false).replace(/ /g, "\\u00a0")).join("\\u00a0× ")'), "a mixed fraction keeps a no-break space");
  // a BOQ item breaks a long word at any width only where fitBoq() marks it; in print, an item with a word of 20 letters
  // or more may break (fitBoq() measures the screen, not the paper)
  assert.ok(/^function fitBoq\(/m.test(app) && app.includes('cells.filter((td) => td.hasAttribute("data-long"))') && app.includes('td.dataset.break = ""; if (!over()) return;'), "app.js breaks only a long word in the BOQ");
  // then, while the table would still scroll sideways, Buy and Rate wrap at a space, and last each row stacks as on a
  // phone: a short word never breaks
  assert.ok(app.includes('for (const f of ["wrap", "wrap stack"]) { t.dataset.fit = f; if (!over()) return; }'), "app.js wraps, then stacks the BOQ");
  assert.equal(decl(rule('.boq[data-fit~="wrap"] tbody td:nth-child(4),.boq[data-fit~="wrap"] tbody td:nth-child(5)'), "white-space"), "normal");
  assert.equal(decl(rule('.boq[data-fit~="stack"] tr'), "display"), "grid");
  assert.equal(decl(rule('.boq[data-fit~="stack"] thead'), "display"), "none");
  // the stacked rows are the phone rows: the same declarations as under 601 px
  for (const sel of ["tr", "td", "tbody td:nth-child(1)", "tbody td:nth-child(2)", "tbody td:nth-child(3)", "tbody td:nth-child(5)", "tbody td:nth-child(6)", "td[data-l]::before", "tr.grp", "tr.grp td", "tfoot tr", "tfoot tr.total td", "tfoot tr.total"])
    assert.equal(rule(`.boq[data-fit~="stack"] ${sel}`), rule(`.boq ${sel}`, media("(max-width:600px)")), `.boq[data-fit~="stack"] ${sel}`);
  assert.equal(decl(rule(".boq td[data-break]"), "overflow-wrap"), "anywhere");
  assert.equal(decl(rule(".boq td[data-long]", media("print")), "overflow-wrap"), "anywhere");
  assert.doesNotMatch(css.replace(media("print"), ""), /td\[data-long\]/, "data-long breaks a word only in print");
  // the included-tax amount ("includes £76.84") may wrap, so the Amount column stays as wide as the amounts
  assert.equal(decl(rule("tfoot td.inc"), "white-space"), "normal");
  // a long word in a step breaks inside the word; the Check text is a flex item, so it also needs min-width 0
  assert.equal(decl(rule("ol.do li,.check span,article.step .eyebrow,.why,.tip,.alert,details.tech"), "overflow-wrap"), "anywhere");
  assert.equal(decl(rule(".check span"), "min-width"), "0");
  // the Fig 1 caption under the Plan view (the title) is a flex item too
  assert.equal(decl(rule(".fig span"), "overflow-wrap"), "anywhere");
  assert.equal(decl(rule(".fig span"), "min-width"), "0");
});

test("the 3D toolbar: the buttons stay on one row, and a readout that does not fit beside them goes above them on one line", () => {
  const bar = rule(".vbar"), ro = rule(".readout");
  assert.equal(decl(bar, "flex-wrap"), "wrap-reverse", "a second line of the bar goes above the buttons");
  assert.equal(decl(bar, "align-items"), "end");
  for (const [prop, v] of [["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["min-width", "0"], ["max-width", "100%"], ["margin-left", "auto"]]) assert.equal(decl(ro, prop), v, `.readout ${prop}`);
  assert.ok(app.includes("if (ro) ro.title = ro.textContent = "), "the title of the readout holds its full text");
  assert.equal(decl(rule(".readout", media("(max-width:520px)")), "display"), "none", "a phone has no readout");
  // a phone: narrow buttons, so that the 5 buttons stay on one row from 360 px (the live test measures it); a viewer under 681 px wide (container query) shows Reset view as Reset
  assert.equal(decl(rule(".vtools", media("(max-width:520px)")), "gap"), "3px");
  assert.equal(decl(rule(".vtools button", media("(max-width:520px)")), "padding"), "6px 5px");
});

test("the focus ring of the step heading (width + offset) fits in the gap under the 'Step n of N' line", () => {
  const fv = rule("h2[tabindex]:focus-visible"), ring = parseFloat(/^outline:(\d+(?:\.\d+)?)px/.exec(fv)[1]) + parseFloat(decl(fv, "outline-offset"));
  assert.ok(ring > 0 && ring <= parseFloat(decl(rule("article.step .eyebrow+h2"), "margin-top")), `a ring of ${ring}px`);
});

test("step view.note: under the 3D view and in its label, at every level; never in the step card, so not in print", () => {
  // the line has aria-hidden: a screen reader reads the note one time, in the canvas label
  assert.ok(app.includes('<p class="vnote" data-vnote aria-hidden="true" hidden></p>'), "the note has a place under the steps view");
  assert.ok(/^const stepLabel = .*viewNote\(i\)/m.test(app), "the canvas label carries the note");
  const card = /^function stepCard\([\s\S]*?\n\}$/m.exec(app);
  assert.ok(card && !card[0].includes("note"), "stepCard (screen and print) never shows the note");
  assert.match(media("print"), /(^|,)\.vnote(,|\{)/, "print hides the note");
  assert.match(css, /\.viewer:not\(\[data-ready\]\)\+\.vnote\{display:none\}/, "no picture, no note");
  assert.doesNotMatch(rule(".vnote"), /display:none/);
});

test("viewer: a ghost casts no shadow, and the viewer owns 'Show finished' and 'Apart' while they have no effect", () => {
  const { "viewer.js": viewer } = webFiles();
  const paint = /^ {2}function paint\(p, state\) \{[\s\S]*?\n {2}\}$/m.exec(viewer);
  assert.ok(paint && /see = state === "ghost"/.test(paint[0]) && /p\.mesh\.castShadow = !see;/.test(paint[0]), "paint() sets castShadow from the state");
  // the auto ghost: "Show finished" pressed and disabled; the kit pose and a project with no parts (a repair): both
  // toggles not pressed and disabled
  assert.ok(viewer.includes("const none = parts.length === 0;"));
  assert.ok(viewer.includes('gb.setAttribute("aria-pressed", String(!kit && !none && (ghost || auto))); gb.setAttribute("aria-disabled", String(kit || none || auto));'));
  assert.ok(viewer.includes('eb.setAttribute("aria-pressed", String(!kit && !none && explode)); eb.setAttribute("aria-disabled", String(kit || none));'));
  assert.ok(app.includes('(d.v === "explode" || d.v === "ghost" || d.v === "xray") && t.getAttribute("aria-disabled") !== "true"'), "app.js skips a click on a disabled toggle");
  assert.match(css, /button:disabled,button\[aria-disabled="true"\]\{opacity:\.55/);
});

// app.js copies util.plural (the browser cannot import it). Both follow one rule; this table pins it.
const PLURALS = [[1, "board", "1 board"], [2, "board", "2 boards"], [2, "box", "2 boxes"], [1, "battery", "1 battery"], [2, "battery", "2 batteries"],
  [1, "glass", "1 glass"], [2, "glass", "2 glasses"], [250, "ml", "250 ml"], [2, "L", "2 L"], [1, "cu ft", "1 cu ft"], [5.5, "cu ft", "5.5 cu ft"],
  [2, "gal", "2 gal"], [3, "sq ft", "3 sq ft"], [2.5, "m²", "2.5 m²"], [2, "ft³", "2 ft³"], [2, "qt", "2 qt"], [3, "pcs.", "3 pcs."], [1, "bag", "1 bag"],
  [2.75, "bag", "2.75 bags"], [1, "coat", "1 coat"], [2, "coat", "2 coats"], [1, "sheets", "1 sheet"], [2, "sanding sheet", "2 sanding sheets"],
  [1, "sanding sheets", "1 sanding sheet"], [2, "pair of gloves", "2 pairs of gloves"], [1, "pair of gloves", "1 pair of gloves"],
  [16, "shelf pin", "16 shelf pins"], [2, "console error", "2 console errors"], [4, "shelf bracket", "4 shelf brackets"], [4, "door hinge", "4 door hinges"],
  [3, "board foot", "3 board feet"], [1, "board feet", "1 board foot"], [2, "cubic feet", "2 cubic feet"], [2, "fl oz", "2 fl oz"], [2, "Foot", "2 Feet"],
  [3, "tin (small)", "3 tins (small)"], [1, "tins (small)", "1 tin (small)"], [2, "bag (25 kg)", "2 bags (25 kg)"]];
// app.js definitions ("const name = ...;" on one line, or "function name(...) {" to the next "}" at the line start), run in node:vm
const defs = (...names) => names.map((name) => {
  const m = new RegExp(`^const ${name} = .*;$`, "m").exec(app) ?? new RegExp(`^function ${name}\\([^)]*\\) \\{\\n[\\s\\S]*?\\n\\}$`, "m").exec(app);
  assert.ok(m, `app.js defines ${name}`);
  return m[0];
}).join("\n");
const PLURAL = ["many", "one", "ABBREV", "fixed", "plural"];
const pagePlural = () => vm.runInNewContext(`${defs(...PLURAL)}\nplural`);

test("app.js plural: abbreviations and units of more words stay as written ('5.5 cu ft', not '5.5 cu fts')", () => {
  const plural = pagePlural();
  for (const [n, w, want] of PLURALS) assert.equal(plural(n, w), want, `plural(${n}, "${w}")`);
});

test("app.js plural gives the same words as util.plural", () => {
  const plural = pagePlural();
  const words = [...new Set([...PLURALS.map(([, w]) => w), "piece", "pieces", "brush", "pair", "litre", "can", "tube of glue", "roll", "fl oz", "cu yd",
    "set of bits", "bus", "day", "key", "Sheet", "sanding disc", "drill bit", "wood screws", "pack of 10", "", "pcs", "kg bag", "sq ft", "cu. ft.", "linear m", "FOOT", "feet", "tin (small)",
    "pair of gloves (L)", "sheet (A4)", "()"])];
  for (const w of words) for (const n of [0, 0.5, 1, 2, 2.75]) assert.equal(plural(n, w), utilPlural(n, w), `plural(${n}, "${w}")`);
});

// The step uses pill: app.js copies util.amount (a small amount keeps 2 significant digits: "0.004 L", not "0 L").
test("app.js amount and round give the numbers of util.mjs", () => {
  const { amount, round } = vm.runInNewContext(`${defs("round", "amount")}\n({ amount, round })`);
  for (const n of [0, 0.004, 0.0049, 0.00123, 0.01, 0.015, 1.234, 1.005, 5, 250, -0.004]) assert.equal(amount(n), utilAmount(n), `amount(${n})`);
  for (const [n, d] of [[1.005, 2], [2.675, 2], [1e6, 9], [1100000, 9], [999999999999999, 0], [1e13, 2], [-1e6, 9], [1000000.5, 9], [0.125, 2], [-2.5, 0]]) assert.equal(round(n, d), utilRound(n, d), `round(${n}, ${d})`);
});

// app.js copies locale.fmtRate (the BOQ Rate column: the model rate is not rounded) and fmtLen(mm, units, { den: 64 })
// (the kerf and the trim on the Cut list). The browser keeps Intl's no-break spaces; locale.mjs makes them plain.
const plain = (s) => s.replace(/[   ]/g, " ");
const pageFormats = (units, currency) => vm.runInNewContext(`${defs("U", "round", "gcd", "len", "fine", "DIGITS", "DEC", "MF", "money", "RD", "rate")}\n({ fine, rate, money, DIGITS })`, { D: { meta: { units, currency } } });

// The money decimals: app.js copies the fixed DIGITS table of locale.mjs (minorUnits), so no browser's ICU data
// (RSD: 0 decimals in Chrome 155, 2 in the table; UYI 0 and CLF 4 in ICU) changes an amount on the page.
test("app.js DIGITS is the table of locale.mjs minorUnits, and money() gives the text of locale.fmtMoney", () => {
  const lib = readFileSync(new URL("../engine/lib/locale.mjs", import.meta.url), "utf8");
  const m = /^const DIGITS = (Object\.fromEntries\(\[[\s\S]*?\]\));$/m.exec(lib);
  assert.ok(m, "locale.mjs defines DIGITS");
  const libDigits = vm.runInNewContext(`(${m[1]})`), { DIGITS } = pageFormats("mm", "USD");
  assert.deepEqual({ ...DIGITS }, { ...libDigits });
  for (const [c, d] of Object.entries(libDigits)) assert.equal(minorUnits(c), d, c);
  for (const cur of ["USD", "JPY", "BHD", "RSD", "UYI", "CLF", "EUR", "KWD", "XYZ"]) {
    const { money } = pageFormats("mm", cur);
    for (const n of [240.38, 12.5, 99.995, 0, 1234.5678]) assert.equal(plain(money(n)), fmtMoney(n, cur), `money(${n}) in ${cur}`);
    assert.equal(money(undefined), "price?");
  }
});

test("app.js rate and fine give the same text as locale.fmtRate and fmtLen with { den: 64 }", () => {
  const RATES = { USD: [0.045, 12.5, 7.333, 1234.5, 0.12345, 3, 0], EUR: [3.2, 0.0125], JPY: [12.5, 1000, 0.33333], BHD: [1.853, 0.1234, 2], GBP: [1.99],
    RSD: [2.49, 34.95, 0.125], UYI: [12.5, 3], CLF: [99.995, 0.12345] };
  for (const [cur, list] of Object.entries(RATES)) {
    const { rate } = pageFormats("mm", cur);
    for (const n of list) assert.equal(plain(rate(n)), fmtRate(n, cur), `rate(${n}) in ${cur}`);
    assert.equal(rate(undefined), "price?");
  }
  assert.equal(pageFormats("mm", "USD").rate(0.045), "$0.045");
  for (const units of ["in", "mm"]) {
    const { fine } = pageFormats(units, "USD");
    for (const mm of [3.175, 2.38125, 0.508, 1.5, 0, 31.75, 25.4 * 1.25, 3, 2.5, 4.7625, 10]) assert.equal(fine(mm), fmtLen(mm, units, { den: 64 }), `fine(${mm}) in ${units}`);
  }
  assert.equal(pageFormats("in", "USD").fine(2.38125), "3/32 in");
});

// The Plan tile "total with 10% spare and VAT": app.js copies markdown.mjs taxWord (a capitalised word in lower case).
test("app.js taxWord keeps 'VAT' and 'GST' and gives the words of markdown.mjs taxWord", () => {
  const md = /^const taxWord = .*;$/m.exec(readFileSync(new URL("../engine/lib/markdown.mjs", import.meta.url), "utf8"));
  assert.ok(md, "markdown.mjs defines taxWord on one line");
  const page = vm.runInNewContext(`${defs("taxWord")}\ntaxWord`), lib = vm.runInNewContext(`${md[0]}\ntaxWord`);
  const want = { VAT: "VAT", GST: "GST", "Sales tax": "sales tax", tax: "tax", "Sales Tax": "sales tax", "GST/HST": "GST/HST", MwSt: "MwSt", IVA: "IVA", "Moms (VAT)": "moms (VAT)", Umsatzsteuer: "umsatzsteuer", "Österreich USt": "österreich USt" };
  for (const [label, w] of Object.entries(want)) {
    assert.equal(page(label), w, `taxWord("${label}")`);
    assert.equal(page(label), lib(label), `taxWord("${label}") as markdown.mjs`);
  }
  assert.ok(app.includes('taxWord(T.taxLabel || "tax")'), "the Plan tile uses taxWord");
  assert.doesNotMatch(app, /\(\?<[=!]/, "no lookbehind in app.js (Safari before 16.4 cannot parse one)");
});

// The reader state that app.js save() keeps. If this list changes, update the docs that describe it: README.md
// "What it fetches and stores", docs/PUBLISHING.md step 12.5 (Retention) and docs/ARCHITECTURE.md section 9 (Storage).
test("app.js save() stores only level, tab, step, done and bought", () => {
  const m = /^const save = \(\) => \{ try \{ localStorage\.setItem\(KEY, JSON\.stringify\(\{([^}]*)\}\)\); \} catch \{\} \};$/m.exec(app);
  assert.ok(m, "app.js defines save() on one line");
  assert.deepEqual(m[1].split(",").map((kv) => kv.split(":")[0].trim()), ["level", "tab", "step", "done", "bought"]);
  assert.equal(app.match(/localStorage\.setItem\(/g).length, 1, "save() is the only write to localStorage");
});

// ---------- live checks in a browser (skipped without Chrome, Chromium or Edge). The page drives itself with a small
// module after app.js and reports with console.error("jig-test {...}"), which capture() collects.
const BROWSER = findBrowser();
const TMP = mkdtempSync(join(tmpdir(), "jig-page-test-"));
after(() => rmSync(TMP, { recursive: true, force: true }));
let REAL = null; // the real three.js for the 3D checks: the verified CLI cache, else one download
const realThree = () => (REAL ??= loadThree({ cacheDir: join(tmpdir(), "jig-three-cache") }).catch((e) => ({ error: e.message })));
const HARNESS = `const out = (o) => console.error("jig-test " + JSON.stringify(o));
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
const until = async (f, ms = 3000) => { for (const end = performance.now() + ms; performance.now() < end; await sleep(40)) { try { const v = f(); if (v) return v; } catch {} } return null; };
const $ = (s) => document.querySelector(s);
const eyebrow = () => $("[data-step] .eyebrow")?.textContent ?? "";
const ready3d = () => until(() => $("[data-viewer=steps][data-ready]") || $("[data-viewer=steps][data-state]"), 20000);
const tagsOf = (host) => { const v = host.getBoundingClientRect(); return [...host.querySelectorAll(".tag")].filter((t) => !t.hidden).map((t) => [t.textContent, getComputedStyle(t).visibility, Math.round(t.getBoundingClientRect().top - v.top)]); };
// words (split at spaces and hyphens) of the shown text in sel that run over two lines
const broken = (sel) => [...document.querySelectorAll(sel)].flatMap((el) => { const out = [], w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) for (const m of n.data.matchAll(/[^\\s\\u2010-\\u2014-]+/g)) {
    if (!n.parentElement.offsetParent) continue;
    const rg = document.createRange(); rg.setStart(n, m.index); rg.setEnd(n, m.index + m[0].length);
    if (new Set([...rg.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top))).size > 1) out.push(m[0]);
  } return out; });
// each shown tag of a viewer: its letter, visibility, whether it is inside the canvas, and the RGBA of the drawing
// under the point it stands on (the page keeps its drawing buffer for captures)
const tagPixels = (host) => {
  const c = host.querySelector("canvas"), cr = c.getBoundingClientRect(), k = c.width / cr.width, g = document.createElement("canvas");
  g.width = c.width; g.height = c.height;
  const ctx = g.getContext("2d");
  ctx.drawImage(c, 0, 0);
  return [...host.querySelectorAll(".tag")].filter((t) => !t.hidden).map((t) => { const r = t.getBoundingClientRect(), x = r.left + r.width / 2 - cr.left, y = r.bottom + 0.3 * r.height - cr.top;
    return { l: t.textContent, vis: getComputedStyle(t).visibility, inside: r.left >= cr.left && r.right <= cr.right && r.top >= cr.top && r.bottom <= cr.bottom, px: [...ctx.getImageData(Math.round(x * k), Math.round(y * k), 1, 1).data] }; });
};`;
async function live(name, html, script, { wait = 1500, ...opts } = {}) {
  const file = join(TMP, `${name}.html`);
  // capture() waits a fixed time (wait) after the load, then scrolls the page to the top for its picture. The checks
  // must end before that, or the scroll can land between two of their steps. "late": they ended after it.
  const run = async (ms) => {
    const end = `out({ done: true, late: performance.now() > (performance.getEntriesByType("navigation")[0]?.loadEventStart || Infinity) + ${ms} - 200 });`;
    writeFileSync(file, html.replace("\n</body>", `\n<script type="module">\n${HARNESS}\ntry {\n${script}\n} catch (e) { out({ failed: String(e?.stack ?? e).slice(0, 300) }); }\n${end}\n</script>\n</body>`));
    const r = await capture(pathToFileURL(file).href, { out: join(TMP, `${name}.png`), width: 1280, height: 900, reducedMotion: true, wait: ms, ...opts });
    const got = {}, other = [];
    for (const e of r.consoleErrors) { const m = /^console\.error: jig-test (.*)$/s.exec(e); if (m) Object.assign(got, JSON.parse(m[1])); else other.push(e); }
    return { r, got, other };
  };
  // A slow machine (software WebGL on a shared CI runner) may need more time: one more run with a longer wait, never a
  // weaker check.
  let { r, got, other } = await run(wait);
  if ((got.done !== true || got.late) && got.failed === undefined) ({ r, got, other } = await run(Math.max(3 * wait, 8000)));
  assert.deepEqual(other, [], `${name}: console errors`);
  assert.equal(got.failed, undefined, `${name}: ${got.failed}`);
  assert.equal(got.done, true, `${name}: the page checks did not finish in time: ${JSON.stringify(got)}`);
  assert.equal(got.late, false, `${name}: the page checks ended after capture() scrolled the page for its picture`);
  delete got.late;
  return { ...got, sidewaysScroll: r.sidewaysScroll };
}
// A page with three.js stubs: the 3D slot reports an error, every text tab works, and nothing comes from the network.
const textPage = (model, opts = {}) => renderPage(model, { offline: true, three: FAKE, ...opts });
const CUBE = compute(load("../examples/plywood-storage-cube/project.json"));
// The inch bench with a long cut size, a part that comes in the kit, and a step that shows only a prop, before any part.
const BENCH = (() => {
  const p = load("./fixtures/inch-bench.json");
  p.materials.pad = { kind: "each", name: "Felt pad", included: true };
  p.parts.push({ id: "P1", label: "D", name: "Pad", material: "pad", size: [1.5, 0.25, 1.5], at: [10, 16.75, 5] });
  for (const x of p.parts) if (x.label === "B") x.size = [28.9375, 3.5, 1.5];
  p.props = { wall: { size: [60, 40, 1], at: [-10, 0, -2], label: "Wall" } };
  p.steps.splice(1, 0, { id: "mark", phase: "Build", title: "Mark the place on the floor", minutes: 5, props: ["wall"], do: ["Mark the place of each leg."], check: "Make sure that you can see each mark." });
  p.steps.find((s) => s.id === "top").parts.push("P1");
  return compute(p);
})();
// A repair: the chair that is there is props, with no parts. The bench beside it is not in the Plan view (hero false).
const CHAIR_PROPS = {
  "leg-fl": { label: "Front leg", size: [35, 440, 35], at: [0, 0, 365], color: "#b5835a" },
  "leg-fr": { label: "Front leg", size: [35, 440, 35], at: [385, 0, 365], color: "#b5835a" },
  "leg-bl": { label: "Back leg", size: [35, 880, 35], at: [0, 0, 0], color: "#b5835a" },
  "leg-br": { label: "Back leg", size: [35, 880, 35], at: [385, 0, 0], color: "#b5835a" },
  seat: { label: "Seat", size: [420, 25, 400], at: [0, 440, 0], color: "#c08f63" },
  back: { label: "Backrest", size: [350, 80, 20], at: [35, 780, 7], color: "#c08f63" },
};
const CHAIR = compute({
  jig: 1, id: "chair-repair", title: "Chair repair", units: "mm",
  materials: { glue: { kind: "amount", name: "Wood glue", unit: "ml", pack: 250, price: 4.5 } },
  parts: [], props: { ...CHAIR_PROPS, bench: { label: "Bench", size: [1200, 700, 600], at: [900, 0, 0], color: "#8a8a8a", hero: false } },
  steps: [
    { id: "look", title: "Find the loose joints", props: Object.keys(CHAIR_PROPS), minutes: 5, check: "Make sure that you know which joints move." },
    { id: "glue", title: "Glue the joints", props: [...Object.keys(CHAIR_PROPS), "bench"], minutes: 5, uses: { glue: 15 }, check: "Make sure that each joint is tight." },
  ],
});

test("the 3D readout: a step that only shows props names them, not '0 parts · 0 fasteners'", () => {
  const fn = /^const readout = \(i\) => \{[\s\S]*?\n\};$/m.exec(app);
  assert.ok(fn, "app.js defines readout");
  const code = `${defs(...PLURAL, "fastCount")}\n${fn[0]}\nreadout`;
  const readout = vm.runInNewContext(code, { D: BENCH });
  assert.deepEqual(BENCH.steps.map((_, i) => readout(i)), ["parts on the floor", "no new parts · Wall", "6 parts · 4 fasteners", "2 parts · 4 fasteners", "finish on 7 parts"]);
  const bed = compute(load("../examples/raised-garden-bed/project.json"));
  assert.equal(vm.runInNewContext(code, { D: bed })(8), "no new parts · Level ground, Soil");
  // a label that comes more than once shows its count, and after 3 labels the line counts the rest
  const chair = vm.runInNewContext(code, { D: CHAIR });
  assert.equal(chair(0), "no new parts · 2 × Front leg, 2 × Back leg and 2 more");
  assert.equal(chair(1), "no new parts · 2 × Front leg, 2 × Back leg and 3 more");
});

test("app.js sizeOf: a repair with no parts measures the props of the Plan view; parts set the size when there are some", () => {
  const sizeOf = (model) => Array.from(vm.runInNewContext(`${defs("isVec", "sizeOf")}\nsizeOf()`, { D: model }) ?? []);
  assert.deepEqual(sizeOf(CHAIR), [420, 880, 400], "the chair, not the bench beside it");
  assert.deepEqual(sizeOf(BENCH), [914.4, 431.8, 304.8], "the parts, not the wall");
  assert.deepEqual(sizeOf(M), [800, 900, 241]);
  assert.deepEqual(sizeOf({ parts: [], props: {} }), []);
});

test("the cut tab: Cut list, Print list or Cut and print; a kit with nothing to cut or print has none (page.mjs and app.js agree)", () => {
  const HOOK = compute(load("./fixtures/printed-hook.json"));
  const printOnly = structuredClone(HOOK), kit = structuredClone(HOOK);
  printOnly.parts = printOnly.parts.filter((p) => p.kind === "printed");
  kit.parts = kit.parts.filter((p) => p.kind !== "printed").map((p) => ({ ...p, kind: "each", cut: null }));
  const repair = { ...M, parts: [] };
  // page.mjs: the data-tabs of each page; --tabs without the cut tab, and an error when no tab is left
  const tabsOf = (model, tabs) => /data-tabs="([^"]*)"/.exec(renderPage(model, { tabs }))[1];
  assert.deepEqual([tabsOf(M), tabsOf(HOOK), tabsOf(printOnly), tabsOf(kit), tabsOf(repair)],
    ["plan,shop,cut,build", "plan,shop,cut,build", "plan,shop,cut,build", "plan,shop,build", "plan,shop,build"]);
  assert.deepEqual(tabsFor(kit, "cut,build"), ["build"]);
  assert.deepEqual(tabsFor(HOOK, "cut"), ["cut"]);
  assert.throws(() => tabsFor(kit, "cut"), /nothing to cut and nothing to print/);
  assert.throws(() => renderPage(repair, { tabs: ["cut"] }), /no cut tab/);
  // app.js: the tab name from the parts, and the cut tab dropped for a kit, also from a data-tabs that names it
  const block = /^const CUTS = [\s\S]*?^if \(!CUTS && !PRINTS\) .*$/m.exec(app);
  assert.ok(block, "app.js sets CUTS, PRINTS, NAMES and TABS");
  const run = (model, tabs) => { const r = vm.runInNewContext(`${block[0]}\n({ name: NAMES.cut, tabs: TABS })`, { D: model, root: { dataset: { tabs } } }); return [r.name, r.tabs.join(",")]; };
  assert.deepEqual(run(M, "plan,shop,cut,build"), ["Cut list", "plan,shop,cut,build"]);
  assert.deepEqual(run(HOOK, "plan,shop,cut,build"), ["Cut and print", "plan,shop,cut,build"]);
  assert.deepEqual(run(printOnly, "cut"), ["Print list", "cut"]);
  assert.deepEqual(run(kit, "plan,shop,cut,build"), ["Cut list", "plan,shop,build"]);
  assert.deepEqual(run(kit, "cut"), ["Cut list", "plan"]);
  assert.deepEqual(run(repair, ""), ["Cut list", "plan,shop,build"]);
  // keyboard tab navigation and the hash routes read TABS, so they skip a tab that is not there
  assert.match(app, /const k = TABS\.indexOf\(current\), n = TABS\.length;/);
  assert.match(app, /return \{ tab: TABS\.includes\(t\) \? t : null/);
  // the Plan tiles: parts to cut counts cut parts only; parts to print when there are printed parts
  assert.match(app, /cut = D\.parts\.filter\(\(p\) => p\.kind !== "each" && p\.kind !== "printed"\)\.length/);
  assert.match(app, /<span>parts to \$\{cut > 0 \? "cut \+ print" : "print"\}<\/span>/);
  assert.match(app, /wait time \(glue, finish\$\{printed > 0 \? ", printer" : ""\}\)/);
  // the print list: one table of the printed parts, the settings cell may wrap
  assert.match(app, /<th class="n">Grams each<\/th><th class="n">Hours each<\/th><th>Material<\/th><th>Settings<\/th>/);
  assert.match(rule(".prints td.set"), /overflow-wrap:anywhere/);
});

test("live: Next and Back leave the Check box to the reader, on the last step too; a typed hash acts as a click", async (t) => {
  if (!BROWSER) return t.skip("no Chrome, Chromium or Edge on this machine");
  const r = await live("ticks", textPage(M), `
    const st = () => ({ box: $("[data-step] [data-done]").checked, rail: [...document.querySelectorAll(".rail [data-done]")].map((b) => +b.dataset.go + 1) });
    await until(() => $("[data-step] [data-done]"));
    $("[data-next]").click(); await sleep(80); $("[data-prev]").click(); await sleep(80);
    out({ back: { ...st(), step: eyebrow().slice(0, 12) } });
    location.hash = "#build/10"; await until(() => eyebrow().startsWith("Step 10 "));
    $("[data-next]").click(); await sleep(80);
    out({ finish: st() });
    $("[data-step] [data-done]").click(); await sleep(80);
    out({ ticked: st() });
    location.hash = "#build/1"; await until(() => eyebrow().startsWith("Step 1 ")); await sleep(120);
    $("[data-tab=build]").focus();
    $("[data-live]").textContent = "";
    location.hash = "#build/3"; await until(() => $("[data-live]").textContent);
    out({ typed: { active: document.activeElement.id, live: $("[data-live]").textContent.slice(0, 12), hash: location.hash } });
    location.hash = "#build/1"; await until(() => eyebrow().startsWith("Step 1 ")); await sleep(80);
    location.hash = "#build/0"; await sleep(250);
    out({ zero: location.hash });
    location.hash = "#build"; await sleep(250);
    out({ bare: location.hash });
    location.hash = "#nope"; await sleep(250);
    out({ unknown: location.hash, after: eyebrow().slice(0, 12) });`, { hash: "build/3", wait: 3000 });
  assert.deepEqual(r.back, { box: false, rail: [], step: "Step 3 of 10" }, "Next then Back does not tick step 3");
  assert.deepEqual(r.finish, { box: false, rail: [] }, "Finish does not mark step 10 done while its box is empty");
  assert.deepEqual(r.ticked, { box: true, rail: [10] }, "the reader's tick marks the rail");
  assert.deepEqual(r.typed, { active: "jig-step-title", live: "Step 3 of 10", hash: "#build/3" });
  assert.equal(r.zero, "#build/1", "#build/0 shows as the real step");
  assert.equal(r.bare, "#build/1");
  assert.equal(r.unknown, "#build/1", "a hash the page does not have goes back to the step it shows, as on load");
  assert.equal(r.after, "Step 1 of 10");
});

test("live: on a page with only some tabs, a typed hash for a missing tab goes back to the tab the page shows", async (t) => {
  if (!BROWSER) return t.skip("no Chrome, Chromium or Edge on this machine");
  const r = await live("hash-tabs", textPage(M, { tabs: "cut,shop" }), `
    await until(() => $("table.parts"));
    location.hash = "#build/3"; await sleep(250);
    out({ hash: location.hash, shown: document.querySelector("[data-panel]:not([hidden])").dataset.panel });`, { hash: "cut" });
  assert.deepEqual({ hash: r.hash, shown: r.shown }, { hash: "#cut", shown: "cut" });
});

test("live: a focused step chip is not under the sticky tab bar (WCAG 2.4.11), wide and on a phone", async (t) => {
  if (!BROWSER) return t.skip("no Chrome, Chromium or Edge on this machine");
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    const r = await live(`rail-focus-${width}`, textPage(M), `
      await until(() => $(".rail [data-go='0']"));
      $("#jig-panel-build").focus(); await sleep(80);
      $(".rail [data-go='0']").focus(); await sleep(80);
      out({ active: document.activeElement.dataset.go, chip: $(".rail [data-go='0']").getBoundingClientRect().top, tabs: $(".tabs").getBoundingClientRect().bottom });`,
    { hash: "build/1", width, height });
    assert.equal(r.active, "0");
    assert.ok(r.chip >= r.tabs, `${width} px: the chip top is ${r.chip}px, the tab bar ends at ${r.tabs}px`);
  }
});

test("live: on a phone, Next scrolls the 3D view to just below the sticky tab bar", async (t) => {
  if (!BROWSER) return t.skip("no Chrome, Chromium or Edge on this machine");
  const r = await live("phone-next", textPage(M), `
    await until(() => $("[data-next]"));
    $("[data-next]").scrollIntoView({ block: "center" }); await sleep(80);
    $("[data-next]").click(); await sleep(300);
    out({ step: eyebrow().slice(0, 12), tabs: $(".tabs").getBoundingClientRect().bottom, stage: $(".build .stage").getBoundingClientRect().top });`, { hash: "build/3", width: 390, height: 844 });
  assert.equal(r.step, "Step 4 of 10");
  assert.ok(r.stage >= r.tabs && r.stage < r.tabs + 40, `the view top ${r.stage}px, the tab bar bottom ${r.tabs}px`);
});

test("live: a title of one long word does not make the page scroll sideways at 390 px", async (t) => {
  if (!BROWSER) return t.skip("no Chrome, Chromium or Edge on this machine");
  const model = structuredClone(CUBE);
  model.meta.title = "Kinderzimmeraufbewahrungswürfel";
  const file = join(TMP, "long-title.html");
  writeFileSync(file, textPage(model));
  const r = await capture(pathToFileURL(file).href, { out: join(TMP, "long-title.png"), width: 390, height: 844, hash: "plan", wait: 300 });
  assert.equal(r.sidewaysScroll, false);
});

// The Parts rows of BENCH for a long inch size and a part that comes in the kit.
const KIT_ROWS = [["B", "28\u00a015/16\u00a0× 3\u00a01/2\u00a0× 1\u00a01/2"], ["D", "in the kit"]];
// The number of lines of each Cut size cell in the Parts table (a Range over the cell text).
const SIZE_LINES = `[...document.querySelectorAll("table.parts tbody tr")].map((tr) => { const rg = document.createRange(); rg.selectNodeContents(tr.cells[3]); return new Set([...rg.getClientRects()].map((x) => Math.round(x.top))).size; })`;

test("live: the Cut list parts table fits at 390 and 320 px (sizes wrap after a × when they must), and a kit part reads 'in the kit'", async (t) => {
  if (!BROWSER) return t.skip("no Chrome, Chromium or Edge on this machine");
  for (const width of [390, 320]) {
    const r = await live(`cut-phone-${width}`, textPage(BENCH), `
      await until(() => $("table.parts"));
      const rows = [...document.querySelectorAll("table.parts tbody tr")].map((tr) => [tr.cells[0].textContent.trim(), tr.cells[3].textContent]);
      out({ scroll: [...document.querySelectorAll("[data-panel=cut] .scroll")].map((s) => s.scrollWidth - s.clientWidth), rows: rows.filter(([l]) => l === "B" || l === "D") });`,
    { hash: "cut", width, height: 844 });
    assert.ok(r.scroll.length > 0 && r.scroll.every((d) => d <= 1), `${width} px: hidden overflow in the cut tab: ${r.scroll}`);
    assert.equal(r.sidewaysScroll, false);
    assert.deepEqual(r.rows, KIT_ROWS);
  }
  // the metric sizes of the bookshelf fit at 390 px: each stays on one line ("900 × 235 × 19", not "900 × 235 ×" / "19")
  const r = await live("cut-one-line", textPage(M), `
    await until(() => $("table.parts"));
    out({ fit: $("table.parts").dataset.fit ?? "", lines: ${SIZE_LINES}, scroll: $("[data-panel=cut] .scroll").scrollWidth - $("[data-panel=cut] .scroll").clientWidth });`,
  { hash: "cut", width: 390, height: 844 });
  assert.equal(r.fit, "", "the table fits without a wrap");
  assert.ok(r.lines.length > 0 && r.lines.every((n) => n === 1), `size cells on more than one line: ${r.lines}`);
  assert.ok(r.scroll <= 1);
});

test("live: printed parts: the Cut and print tab, the print list rows and totals, the Plan tiles; no sideways scroll at 390 px", async (t) => {
  if (!BROWSER) return t.skip("no Chrome, Chromium or Edge on this machine");
  const r = await live("print-list", textPage(compute(load("./fixtures/printed-hook.json"))), `
    await until(() => $("table.prints"));
    const cells = (tr) => [...tr.cells].map((c) => c.textContent.replace(/\\s+/g, " ").trim());
    out({ tabs: [...document.querySelectorAll("[data-tab]")].map((b) => b.textContent), parts: [...document.querySelectorAll("table.parts tbody tr")].map((tr) => cells(tr)[0]) });
    out({ rows: [...document.querySelectorAll("table.prints tbody tr")].map(cells) });
    out({ sum: $(".printlist .notes").textContent.trim(), scroll: [...document.querySelectorAll("[data-panel=cut] .scroll")].map((s) => s.scrollWidth - s.clientWidth) });
    out({ tiles: [...document.querySelectorAll(".stats div")].map((d) => d.textContent.replace(/\\s+/g, " ").trim()) });`,
  { hash: "cut", width: 390, height: 844 });
  assert.deepEqual(r.tabs, ["Plan", "Shop", "Cut and print", "Build"]);
  assert.deepEqual(r.rows, [["B", "Hook", "2", "18 g est", "1.5 h est", "PLA filament", "0.2 mm layers, 20% infill, no supports"], ["C", "Peg", "1", "7 g", "0.8 h", "PLA filament", "-"]]);
  assert.deepEqual(r.parts, ["A"], "the Parts table holds the cut parts");
  assert.equal(r.sum, "PLA filament: 3 parts, 43 g of filament, 3.8 h of printer time. Buy 1 × 1 kg spool.");
  assert.ok(r.tiles.includes("1 + 3parts to cut + print") && r.tiles.includes("4 h 20 minwait time (glue, finish, printer)"), r.tiles.join(" | "));
  assert.ok(r.scroll.length === 2 && r.scroll[1] <= 1, `the print list scrolls sideways: ${r.scroll}`);
  assert.equal(r.sidewaysScroll, false);
});

test("live: long words in the title (Fig 1), the summary, a material and a part name break inside the word at 390 and 320 px", async (t) => {
  if (!BROWSER) return t.skip("no Chrome, Chromium or Edge on this machine");
  const p = load("../examples/plywood-storage-cube/project.json"), word = "Birkensperrholzmultiplexplattenzuschnitt"; // 40 letters
  p.title = "Tray Supercalifragilisticexpialidociousplywoodpanel"; // a word of 46 letters
  p.summary = `Ein Aufbewahrungswuerfel aus ${word} fuer das Kinderzimmer.`;
  p.materials[Object.keys(p.materials)[0]].name = word;
  const label = p.parts[0].label;
  for (const x of p.parts) if (x.label === label) x.name = "Seitenwandverstaerkungsleistenpaar"; // 34 letters
  const html = textPage(compute(p));
  for (const width of [390, 320]) {
    const r = await live(`long-words-${width}`, html, `
      const right = (el) => { const rg = document.createRange(); rg.selectNodeContents(el); return Math.max(...[...rg.getClientRects()].map((x) => x.right)); };
      const scrolls = () => [...document.querySelectorAll("[data-panel]:not([hidden]) .scroll")].map((s) => s.scrollWidth - s.clientWidth);
      await until(() => $("table.parts"));
      const lede = right($(".top .lede")), vw = document.documentElement.clientWidth;
      const fig = [...document.querySelectorAll(".fig span")].map((s) => Math.round(s.getBoundingClientRect().right - vw)), plan = document.documentElement.scrollWidth - vw;
      location.hash = "#cut"; await sleep(200);
      const cut = scrolls(), fit = $("table.parts").dataset.fit ?? "";
      location.hash = "#shop"; await sleep(200);
      const shop = scrolls(), trips = [...document.querySelectorAll(".trip label")].map((l) => Math.round(right(l.querySelector(".it")) - l.querySelector(".n").getBoundingClientRect().left));
      out({ inner: innerWidth, lede, fig, plan, cut, fit, shop, trips: Math.max(...trips) });`, { hash: "plan", width, height: 844 });
    assert.equal(r.inner, width);
    assert.equal(r.sidewaysScroll, false);
    assert.ok(r.plan <= 0, `${width} px: the Plan tab scrolls ${r.plan}px sideways`);
    assert.ok(r.fig.length === 2 && r.fig.every((d) => d <= 0), `${width} px: the Fig 1 caption runs past the screen: ${r.fig}`);
    assert.ok(r.lede <= width - 15, `${width} px: the summary text ends at ${r.lede}px`);
    assert.ok(r.cut.length > 0 && r.cut.every((d) => d <= 1), `${width} px: hidden overflow in the cut tab: ${r.cut} (data-fit "${r.fit}")`);
    assert.ok(r.shop.length > 0 && r.shop.every((d) => d <= 1), `${width} px: hidden overflow in the shop tab: ${r.shop}`);
    assert.ok(r.trips <= 0, `${width} px: a trip item runs ${r.trips}px into its amount`);
  }
});

test("live: between the phone and the desktop (601 and 861 px) no short word breaks and the Parts table does not scroll", async (t) => {
  if (!BROWSER) return t.skip("no Chrome, Chromium or Edge on this machine");
  for (const width of [601, 861]) {
    const r = await live(`mid-width-${width}`, textPage(M), `
      // words that run over two lines in the BOQ item cells, the trip items and the Parts names
      await until(() => $("table.parts"));
      location.hash = "#shop"; await sleep(200);
      const shop = broken(".boq tbody td:nth-child(2), .trip label .it"), marks = document.querySelectorAll(".boq td[data-break]").length;
      location.hash = "#cut"; await sleep(200);
      out({ shop, marks, cut: broken("table.parts td"), scroll: $("[data-panel=cut] .scroll").scrollWidth - $("[data-panel=cut] .scroll").clientWidth });`, { hash: "plan", width, height: 900 });
    assert.deepEqual(r.shop, [], `${width} px: words broken in the Shop tab`);
    assert.equal(r.marks, 0, `${width} px: the BOQ fits, so no item cell may break a word`);
    assert.deepEqual(r.cut, [], `${width} px: words broken in the Parts table`);
    assert.ok(r.scroll <= 1, `${width} px: the Parts table scrolls ${r.scroll}px sideways`);
  }
});

test("live: between the phone and the desktop (601, 640, 720 px) a long BOQ word breaks in its own cell only, and the Amount column stays in the card", async (t) => {
  if (!BROWSER) return t.skip("no Chrome, Chromium or Edge on this machine");
  const p = load("../examples/plywood-storage-cube/project.json"), word = "Birkensperrholzmultiplexplattenzuschnitt"; // 40 letters
  p.materials[Object.keys(p.materials)[0]].name = word;
  const html = textPage(compute(p));
  for (const width of [601, 640, 720]) {
    const r = await live(`boq-word-${width}`, html, `
      await until(() => $(".boq tfoot"));
      out({ scroll: [...document.querySelectorAll("[data-panel=shop] .scroll")].map((s) => s.scrollWidth - s.clientWidth), broken: [...new Set(broken(".boq tbody td:nth-child(2)"))],
        total: $(".boq tfoot tr.total td:last-child").getBoundingClientRect().right - $(".boq").closest(".card").getBoundingClientRect().right });`, { hash: "shop", width, height: 900 });
    assert.ok(r.scroll.length > 0 && r.scroll.every((d) => d <= 1), `${width} px: the BOQ scrolls sideways: ${r.scroll}`);
    assert.deepEqual(r.broken, [word], `${width} px: only the long word breaks`);
    assert.ok(r.total <= 0, `${width} px: the total runs ${r.total}px past the card`);
  }
});

test("live: the Parts table puts the material under the name before a size wraps, and before a short name breaks", async (t) => {
  if (!BROWSER) return t.skip("no Chrome, Chromium or Edge on this machine");
  const fit = `await until(() => $("table.parts"));
    out({ fit: $("table.parts").dataset.fit ?? "", lines: ${SIZE_LINES}, broken: [...new Set(broken("table.parts td"))], scroll: $("[data-panel=cut] .scroll").scrollWidth - $("[data-panel=cut] .scroll").clientWidth });`;
  // the bookshelf in two columns: each size stays on one line ("900 × 235 × 19", not "900 ×" / "235 ×" / "19")
  for (const width of [861, 960]) {
    const r = await live(`parts-stack-${width}`, textPage(M), fit, { hash: "cut", width, height: 900 });
    assert.ok(width === 861 ? r.fit === "stack" : ["", "stack"].includes(r.fit), `${width} px: data-fit "${r.fit}"`);
    assert.ok(r.lines.length > 0 && r.lines.every((n) => n === 1), `${width} px: size cells on more than one line: ${r.lines}`);
    assert.ok(r.scroll <= 1);
  }
  // ordinary German compound names: no name breaks inside a word ("Querleist|e")
  const p = load("../examples/pine-bookshelf/project.json"), mats = ["Kiefernleimholzplatte", "Fichtenrahmenholzleiste", "Birkensperrholzplatte"], names = ["Seitenteil", "Querleiste", "Abdeckbrett", "Rueckwand", "Einlegeboden"];
  Object.values(p.materials).filter((m) => m.kind === "linear" || m.kind === "sheet").forEach((m, i) => (m.name = mats[i % mats.length]));
  [...new Set(p.parts.map((x) => x.label))].forEach((l, i) => p.parts.filter((x) => x.label === l).forEach((x) => (x.name = names[i % names.length])));
  const de = textPage(compute(p));
  for (const width of [861, 1024]) {
    const r = await live(`parts-de-${width}`, de, fit, { hash: "cut", width, height: 900 });
    assert.deepEqual(r.broken, [], `${width} px: words broken in the Parts table (data-fit "${r.fit}")`);
    assert.ok(r.scroll <= 1, `${width} px: the Parts table scrolls ${r.scroll}px sideways`);
  }
});

test("live: a long word in a step instruction, the Check, a note or the phase stays inside the step card at 320 px", async (t) => {
  if (!BROWSER) return t.skip("no Chrome, Chromium or Edge on this machine");
  const p = load("../examples/plywood-storage-cube/project.json"), s = p.steps[4], word = "Donaudampfschifffahrtsgesellschaftskapitaen"; // 43 letters
  Object.assign(s, { phase: `Phase${word}`, do: [`Push the ${word}.`], check: `Make sure that the ${word} is tight.`, tip: `Use the ${word}.`, why: `The ${word} holds the panel.` });
  s.warn = [...(s.warn ?? []), { type: "caution", text: `Do not drop the ${word}. It can break.` }];
  const model = compute(p);
  model.meta.level = "new"; // the reader sees the why and the tip too
  const r = await live("step-320", textPage(model), `
    await until(() => eyebrow().startsWith("Step 5 "));
    const card = $("article.step").getBoundingClientRect().right, right = (el) => { const rg = document.createRange(); rg.selectNodeContents(el); return Math.max(...[...rg.getClientRects()].map((x) => x.right)); };
    out({ over: [...document.querySelectorAll("ol.do li, .check span, article.step .eyebrow, .why, .tip, .alert")].map((el) => [el.className || el.tagName, Math.round(right(el) - card)]).filter(([, d]) => d > 0), why: Boolean($("article.step .why")?.offsetParent) });`,
  { hash: "build/5", width: 320, height: 844 });
  assert.equal(r.sidewaysScroll, false);
  assert.equal(r.why, true, "the why line shows");
  assert.deepEqual(r.over, [], "text past the right edge of the step card");
});

test("live: after Next, the focus ring of the step heading does not cross the 'Step n of N' line, wide and on a phone", async (t) => {
  if (!BROWSER) return t.skip("no Chrome, Chromium or Edge on this machine");
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    const r = await live(`ring-${width}`, textPage(M), `
      await until(() => $("[data-next]"));
      $("[data-next]").focus(); $("[data-next]").click(); await until(() => eyebrow().startsWith("Step 4 ")); await sleep(80);
      const hd = $("#jig-step-title"), cs = getComputedStyle(hd), rg = document.createRange();
      rg.selectNodeContents($("[data-step] .eyebrow"));
      out({ active: document.activeElement.id, fv: hd.matches(":focus-visible"), ring: hd.getBoundingClientRect().top - parseFloat(cs.outlineOffset) - parseFloat(cs.outlineWidth), eyebrow: Math.max(...[...rg.getClientRects()].map((x) => x.bottom)) });`,
    { hash: "build/3", width, height });
    assert.equal(r.active, "jig-step-title");
    if (!r.fv) return t.skip("the browser shows no focus ring after a scripted focus");
    assert.ok(r.ring >= r.eyebrow, `${width} px: the ring top ${r.ring}px, the eyebrow text ends at ${r.eyebrow}px`);
  }
});

test("live: the Borrow trip shows the count of a borrowed tool when it is more than 1 ('2 × Bar clamp')", async (t) => {
  if (!BROWSER) return t.skip("no Chrome, Chromium or Edge on this machine");
  const p = load("./fixtures/inch-bench.json"), clamps = p.tools.find((x) => x.id === "clamps");
  clamps.get = "borrow";
  delete clamps.price;
  delete clamps.store;
  p.tools.push({ id: "sander", name: "Orbital sander", get: "borrow" });
  p.steps.find((s) => s.id === "stain").tools.push("sander");
  const r = await live("borrow", textPage(compute(p)), `
    await until(() => $(".trip"));
    const trip = [...document.querySelectorAll(".trip")].find((c) => c.querySelector("h3 .eyebrow")?.textContent === "ask");
    const items = [...trip.querySelectorAll(".it")].map((s) => s.textContent.trim());
    location.hash = "#plan"; await until(() => !$("[data-panel=plan]").hidden);
    const lists = Object.fromEntries([...document.querySelectorAll("[data-panel=plan] ul.plain li")].map((li) => [li.querySelector(".pill").textContent, li.lastElementChild.textContent]));
    out({ items, lists });`, { hash: "shop" });
  assert.deepEqual(r.items, ["2 × Bar clamp", "Orbital sander"]);
  // the Plan tab "Before you start" lists count the tools too, as plan.md ("Bar clamp × 2 (borrow)")
  assert.ok(r.lists.Get.split(", ").includes("2 × Bar clamp (borrow)"), `Get: ${r.lists.Get}`);
  assert.ok(r.lists.Get.split(", ").includes("Orbital sander (borrow)"), `Get: ${r.lists.Get}`);
  assert.doesNotMatch(Object.values(r.lists).join(", "), /\b1 × /, "a tool of qty 1 shows no count");
});

test("live: the page reads like plan.md: 'spare and VAT', 'Mains electrical work', '0.004 L' of glue, and a hook bought by the piece reads '5'", async (t) => {
  if (!BROWSER) return t.skip("no Chrome, Chromium or Edge on this machine");
  const p = load("../examples/pine-bookshelf/project.json"), at = p.steps.findIndex((s) => s.uses?.glue);
  p.tax = { rate: 0.2, label: "VAT" };
  p.handoff = [{ topic: "mains", text: "A licensed electrician moves the outlet." }];
  p.materials.glue = { ...p.materials.glue, unit: "L", pack: 0.25, packName: "250 ml bottle" };
  p.materials.peg = { kind: "each", name: "Peg", unit: "each", spec: "oak", price: 1, store: "hardware" };
  p.steps[at].uses = { glue: 0.004, peg: 5 };
  p.materials.hook = { kind: "each", name: "Hook", price: 3 };
  p.uses = { hook: 5 };
  const model = compute(p), hook = model.boq.find((r) => r.id === "hook");
  assert.equal(hook.unit, "piece");
  const r = await live("plan-words", textPage(model), `
    await until(() => $(".stats"));
    const tile = $(".stats div:nth-child(3) span").textContent, handoff = [...document.querySelectorAll(".alert li strong")].map((s) => s.textContent);
    const get = [...document.querySelectorAll("[data-panel=plan] ul.plain li")].find((li) => li.querySelector(".pill").textContent === "Get")?.lastElementChild.textContent;
    location.hash = "#build/${at + 1}"; await until(() => eyebrow().includes("${at + 1}"));
    const pills = [...document.querySelectorAll("[data-step] .meta .pill")].map((s) => s.textContent.trim());
    location.hash = "#shop"; await until(() => $(".boq tbody"));
    const row = [...document.querySelectorAll(".boq tbody tr")].find((tr) => tr.cells[0]?.textContent === ${JSON.stringify(hook.code)});
    const item = [...document.querySelectorAll(".trip .it")].map((s) => s.textContent.trim()).find((s) => s.includes("Hook"));
    out({ tile, handoff, get, pills, buy: row?.cells[3].textContent, item, tax: $(".boq tfoot tr:nth-child(3) td:last-child").textContent });`, { hash: "plan" });
  assert.match(r.tile, /^total with 10% spare and VAT$/);
  assert.deepEqual(r.handoff, ["Mains electrical work"]);
  assert.ok(r.get.split(", ").includes("2 × Bar clamp"), `the Plan tab Get line: ${r.get}`);
  assert.ok(r.pills.includes("0.004 L Wood glue, PVA, interior"), JSON.stringify(r.pills));
  assert.ok(r.pills.includes("5 × Peg, oak"), `unit "each" reads as a count, as plan.md: ${JSON.stringify(r.pills)}`);
  assert.equal(r.buy, "5");
  assert.equal(r.item, "5 × Hook");
  // tax on top of the prices: the Amount column adds it to the total
  assert.equal(plain(r.tax), fmtMoney(model.totals.tax, model.meta.currency));
});

test("live: the page shows money with the decimals of locale.mjs, not of the browser's ICU (RSD: 2, not 0)", async (t) => {
  if (!BROWSER) return t.skip("no Chrome, Chromium or Edge on this machine");
  const p = load("../examples/plywood-storage-cube/project.json");
  p.currency = "RSD";
  const model = compute(p), T = model.totals;
  const r = await live("money-rsd", textPage(model), `
    await until(() => $(".boq tfoot"));
    out({ sub: $(".boq tfoot tr td:last-child").textContent, total: $(".boq tfoot tr.total td:last-child").textContent, trip: $(".trip .sum span:last-child").textContent,
      tax: $(".boq tfoot tr:nth-child(3) td:last-child").textContent });`, { hash: "shop" });
  assert.equal(plain(r.sub), fmtMoney(T.subtotal, "RSD"));
  assert.equal(plain(r.sub), "RSD 240.38");
  assert.equal(plain(r.total), fmtMoney(T.total, "RSD"));
  assert.equal(plain(r.trip), fmtMoney(model.purchase[0].subtotal, "RSD"));
  // the cube prices include VAT: its amount reads "includes ...", as boqMd, so the column is not a sum that is wrong
  assert.equal(T.taxIncluded, true);
  assert.equal(plain(r.tax), `includes ${fmtMoney(T.tax, "RSD")}`);
});

// The pine bookshelf with each price (materials and tools) multiplied by f, in the currency cur: a total with more digits.
const bigPrices = (f, cur) => {
  const p = load("../examples/pine-bookshelf/project.json");
  const scale = (v) => { if (Array.isArray(v)) v.forEach(scale); else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { if (k === "price" && typeof x === "number") v[k] = Math.round(x * f * 100) / 100; else scale(x); } };
  scale(p);
  p.currency = cur;
  return compute(p);
};

test("the Plan tile of the total can wrap: a plain space after the currency code, a digit that never hides, 2 tiles a row on a phone", () => {
  assert.ok(app.includes('<b>${money(T.total).replace(/\\s/g, " ")}</b>'), "the total tile has no no-break space");
  assert.equal(decl(rule(".stats b"), "overflow-wrap"), "anywhere");
  assert.equal(decl(rule(".stats", media("(max-width:520px)")), "grid-template-columns"), "repeat(2,minmax(0,1fr))");
  // the narrow Plan column of the 2-column layout (861 to 1100 px) has 2 tiles to a row too
  assert.equal(decl(rule(".stats", media("(min-width:861px) and (max-width:1100px)")), "grid-template-columns"), "repeat(2,minmax(0,1fr))");
});

test("live: on a phone (320, 360 and 390 px) and in the narrow Plan column (900, 1000 px) each tile shows its full text, and no amount breaks in a word", async (t) => {
  if (!BROWSER) return t.skip("no Chrome, Chromium or Edge on this machine");
  for (const [model, want] of [[bigPrices(100, "SEK"), "SEK 25,416.60"], [bigPrices(5, "USD"), "$1,270.83"]]) {
    assert.equal(fmtMoney(model.totals.total, model.meta.currency), want);
    const html = textPage(model);
    for (const width of [320, 360, 390, 900, 1000]) {
      const r = await live(`total-${model.meta.currency}-${width}`, html, `
        await until(() => $(".stats b"));
        const bs = [...document.querySelectorAll(".stats b")];
        out({ cut: bs.filter((b) => b.scrollWidth > b.clientWidth).map((b) => b.textContent), broken: broken(".stats b"), total: bs[2].textContent.replace(/\\s+/g, " ").trim(), label: bs[2].nextElementSibling.textContent });`, { hash: "plan", width, height: 900 });
      assert.deepEqual(r.cut, [], `${want} at ${width} px: a tile cuts its text`);
      assert.deepEqual(r.broken, [], `${want} at ${width} px: a tile breaks a word over two lines`);
      assert.equal(r.total, want, `${width} px`);
      assert.equal(r.label, "total with 10% spare", `${width} px`);
      assert.equal(r.sidewaysScroll, false, `${want} at ${width} px: the page scrolls sideways`);
    }
  }
});

// Two sheet materials with one name, and two thin strips (964 × 70 on a 2440 sheet) next to a wide side.
const SHEETS = compute({
  jig: 1, id: "two-sheets", title: "Two sheets", units: "mm", currency: "GBP",
  materials: {
    "ply-18": { kind: "sheet", name: "Birch plywood", spec: "18 mm", thick: 18, stock: [{ w: 2440, h: 1220, price: 89.95 }] },
    "ply-6": { kind: "sheet", name: "Birch plywood", spec: "6 mm", thick: 6, stock: [{ w: 2440, h: 1220, price: 34.95 }] },
  },
  parts: [
    { id: "A1", label: "A", name: "Side", material: "ply-18", size: [1800, 320, 18], at: [0, 0, 0] },
    { id: "F1", label: "F", name: "Plinth", material: "ply-18", size: [964, 70, 18], at: [0, 0, 100] },
    { id: "F2", label: "F", name: "Plinth", material: "ply-18", size: [964, 70, 18], at: [0, 0, 200] },
    { id: "G1", label: "G", name: "Back", material: "ply-6", size: [1800, 1000, 6], at: [0, 0, 300] },
  ],
  steps: [{ id: "cut", title: "Cut the parts", pose: "kit", cuts: true, minutes: 1, check: "Make sure that you have all the parts." },
    { id: "lay", title: "Put the parts on the floor", parts: ["A1", "F1", "F2", "G1"], minutes: 1, check: "Make sure that the parts are flat." }],
});

test("live: each piece of a sheet drawing has a title, and a piece too small for its letter is named under the sheet; two materials with one name have two headings", async (t) => {
  if (!BROWSER) return t.skip("no Chrome, Chromium or Edge on this machine");
  assert.equal(SHEETS.cuts.length, 2);
  const r = await live("sheet-labels", textPage(SHEETS), `
    await until(() => $(".cutplan svg.sheet"));
    const board = $(".cutplan .board:has(svg.sheet)"); // sheet 1 of the 18 mm plywood: A, F1 and F2
    out({ h3: [...document.querySelectorAll(".cutplan h3")].map((h) => h.textContent), titles: [...document.querySelectorAll(".cutplan svg.sheet rect.wood")].map((x) => x.querySelector("title")?.textContent ?? null),
      letters: [...board.querySelectorAll("svg text")].map((x) => x.textContent), note: board.querySelector(".note")?.textContent ?? "" });`, { hash: "cut", width: 390, height: 844 });
  assert.deepEqual(r.h3, ["Birch plywood, 18 mm", "Birch plywood, 6 mm"]);
  assert.ok(r.titles.length === 4 && r.titles.every(Boolean), `a piece with no title: ${JSON.stringify(r.titles)}`);
  assert.ok(r.titles.some((x) => x.startsWith("F (F1): 964 × 70")), JSON.stringify(r.titles));
  assert.ok(r.letters.includes("A"), "the side has its letter");
  assert.ok(r.letters.includes("F") || r.note.includes("F (964 × 70 mm)"), `no F on sheet 1: ${r.letters} / ${r.note}`);
  assert.equal(r.note, "Too small to show a letter: 2 × F (964 × 70 mm).");
});

test("live 3D: before the first part goes in, a step with only a prop shows the parts to come as a ghost", async (t) => {
  if (!BROWSER) return t.skip("no Chrome, Chromium or Edge on this machine");
  const three = await realThree();
  if (three.error) return t.skip(`three.js is not available: ${three.error}`);
  const r = await live("auto-ghost", renderPage(BENCH, { offline: true, three }), `
    const host = await ready3d();
    const btn = () => { const b = $("[data-v=ghost]"); return [b.getAttribute("aria-pressed"), b.getAttribute("aria-disabled")]; };
    out({ state: host.dataset.state ?? "ready", mark: host.hasAttribute("data-auto-ghost"), readout: $("[data-readout]")?.textContent, btn: btn() });
    $("[data-v=ghost]").click(); await sleep(80);
    out({ clicked: btn() });
    location.hash = "#build/3"; await until(() => eyebrow().startsWith("Step 3 ")); await sleep(80);
    out({ frame: host.hasAttribute("data-auto-ghost"), next: btn() });`, { hash: "build/2", wait: 4000 });
  if (r.state !== "ready") return t.skip(`the 3D view did not start (${r.state})`);
  assert.equal(r.mark, true, "step 2 (a prop, no part yet) ghosts the parts to come");
  assert.equal(r.readout, "02 / 5 · no new parts · Wall");
  // the ghost shows, so "Show finished" reads pressed, and it does nothing there
  assert.deepEqual(r.btn, ["true", "true"]);
  assert.deepEqual(r.clicked, ["true", "true"], "a click on the disabled toggle changes nothing");
  assert.equal(r.frame, false, "step 3 installs parts: no auto ghost");
  assert.deepEqual(r.next, ["false", "false"], "step 3 shows the reader's own choice again");
});

// Two boxes: P (blue, step 1) stands in front of the long box Q (white, step 2). From the default camera (front right,
// from above) P hides the centre top of Q, and the right end of Q is clear.
const TWO = compute({
  jig: 1, id: "two-boxes", title: "Two boxes", units: "mm",
  materials: { box: { kind: "each", name: "Box", price: 1 } },
  parts: [
    { id: "P", name: "Front box", material: "box", size: [370, 420, 50], at: [150, 0, 200], color: "#2050ff" },
    { id: "Q", name: "Back box", material: "box", size: [600, 300, 100], at: [0, 0, 0], color: "#ffffff" },
  ],
  steps: [
    { id: "front", title: "Put the front box on the floor", parts: ["P"], minutes: 1, check: "Make sure that the box is flat." },
    { id: "back", title: "Put the back box on the floor", parts: ["Q"], minutes: 1, check: "Make sure that the box is flat." },
  ],
});

test("live 3D: the tag of a part that is partly hidden stands on a part of it that can be seen, not on the part in front", async (t) => {
  if (!BROWSER) return t.skip("no Chrome, Chromium or Edge on this machine");
  const three = await realThree();
  if (three.error) return t.skip(`three.js is not available: ${three.error}`);
  const r = await live("tag-anchor", renderPage(TWO, { offline: true, three }), `
    const host = await ready3d();
    out({ state: host.dataset.state ?? "ready" });
    if (!host.dataset.state) {
      await sleep(600);
      // the pixel of the drawing under the point the tag of Q stands on (the page keeps its drawing buffer for captures)
      const c = $("[data-viewer=steps] canvas"), q = [...host.querySelectorAll(".tag")].find((x) => x.textContent === "Q" && !x.hidden);
      const cr = c.getBoundingClientRect(), tr = q.getBoundingClientRect(), k = c.width / cr.width;
      const g = document.createElement("canvas");
      g.width = c.width; g.height = c.height;
      const ctx = g.getContext("2d");
      ctx.drawImage(c, 0, 0);
      const at = (x, y) => [...ctx.getImageData(Math.round(x * k), Math.round(y * k), 1, 1).data.slice(0, 3)];
      const px = at(tr.left + tr.width / 2 - cr.left, tr.bottom + 0.3 * tr.height - cr.top);
      out({ vis: getComputedStyle(q).visibility, px, inside: tr.left >= cr.left && tr.right <= cr.right && tr.top >= cr.top });
    }`, { hash: "build/2", wait: 4000 });
  if (r.state !== "ready") return t.skip(`the 3D view did not start (${r.state})`);
  assert.equal(r.vis, "visible");
  assert.equal(r.inside, true);
  const [red, , blue] = r.px;
  assert.ok(blue - red < 60, `the tag of Q stands on the blue box P: rgb ${r.px}`);
});

test("live 3D: Apart on a wall step keeps the wall bracket out of the wall, so its tag and its 4 screws still show", async (t) => {
  if (!BROWSER) return t.skip("no Chrome, Chromium or Edge on this machine");
  const three = await realThree();
  if (three.error) return t.skip(`three.js is not available: ${three.error}`);
  const r = await live("apart-wall", renderPage(M, { offline: true, three }), `
    const host = await ready3d();
    out({ state: host.dataset.state ?? "ready" });
    if (!host.dataset.state) {
      const frame = () => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
      const look = () => ({ e: tagsOf(host).find(([l]) => l === "E")?.[1], pins: host.querySelectorAll(".pin:not([hidden])").length });
      $(".build .stage").scrollIntoView({ block: "start" }); await sleep(400); await frame();
      const before = look(), zoom = tagPixels(host).map((x) => [x.l, x.vis, x.inside]);
      $("[data-v=explode]").click(); await sleep(400); await frame();
      out({ before, zoom, after: look(), pressed: $("[data-v=explode]").getAttribute("aria-pressed") });
    }`, { hash: "build/10", wait: 4000 });
  if (r.state !== "ready") return t.skip(`the 3D view did not start (${r.state})`);
  // step 10 has view.zoom 5: the camera still comes close to the bracket and the rail
  assert.deepEqual(r.zoom, [["D", "visible", true], ["E", "visible", true]]);
  assert.deepEqual(r.before, { e: "visible", pins: 4 });
  assert.equal(r.pressed, "true");
  assert.deepEqual(r.after, { e: "visible", pins: 4 }, "bracket E slides up the wall face, not into the wall");
});

test("live 3D: a step's view note shows under the 3D view at Experienced too, and the canvas label carries it", async (t) => {
  if (!BROWSER) return t.skip("no Chrome, Chromium or Edge on this machine");
  const three = await realThree();
  if (three.error) return t.skip(`three.js is not available: ${three.error}`);
  const model = structuredClone(CUBE), note = "The picture shows the cube upright (view note).";
  model.meta.level = "pro";
  model.steps[6].view = { ...model.steps[6].view, note };
  // the cube's own notes: the steps after the back panel; a step with no note must hide the line
  const bare = model.steps.findIndex((s, i) => i !== 6 && !s.view?.note) + 1;
  assert.ok(bare > 0, "the cube has a step with no view note");
  const r = await live("view-note", renderPage(model, { offline: true, three }), `
    const host = await ready3d();
    out({ state: host.dataset.state ?? "ready" });
    if (!host.dataset.state) {
      await sleep(200);
      const n = $("[data-vnote]"), r = n.getBoundingClientRect();
      out({ level: $("#jig").dataset.level, text: n.textContent, shown: !n.hidden && getComputedStyle(n).display !== "none" && r.height > 0, aria: n.getAttribute("aria-hidden"),
        label: $("[data-viewer=steps] canvas").getAttribute("aria-label"), card: $("[data-step]").textContent.includes("(view note)"), print: $("[data-print]").textContent.includes("(view note)") });
      location.hash = "#build/${bare}"; await until(() => eyebrow().startsWith("Step ${bare} ")); await sleep(80);
      out({ next: n.hidden, nextLabel: $("[data-viewer=steps] canvas").getAttribute("aria-label").includes("(view note)") });
    }`, { hash: "build/7", wait: 4000 });
  if (r.state !== "ready") return t.skip(`the 3D view did not start (${r.state})`);
  assert.equal(r.level, "pro");
  assert.equal(r.text, note);
  assert.equal(r.shown, true, "the note shows at Experienced");
  assert.ok(r.label.includes(note), `the canvas label: ${r.label}`);
  assert.equal(r.aria, "true", "a screen reader reads the note one time, in the label, not again in the line");
  assert.equal(r.card, false, "the step card does not carry the note");
  assert.equal(r.print, false, "the print copy does not carry the note");
  assert.equal(r.next, true, "a step with no note hides it");
  assert.equal(r.nextLabel, false);
});

test("live 3D: the tag of a lit part that the object hides does not show (plywood cube, step 9, pad E3)", async (t) => {
  if (!BROWSER) return t.skip("no Chrome, Chromium or Edge on this machine");
  const three = await realThree();
  if (three.error) return t.skip(`three.js is not available: ${three.error}`);
  const r = await live("hidden-tag", renderPage(CUBE, { offline: true, three }), `
    const host = await ready3d();
    await sleep(600);
    out({ state: host.dataset.state ?? "ready", tags: tagsOf(host).filter(([l]) => l === "E").map(([, v]) => v) });`, { hash: "build/9", wait: 4000 });
  if (r.state !== "ready") return t.skip(`the 3D view did not start (${r.state})`);
  // tags of E1..E4 in part order: E1 and E2 at the front show, E3 at the back left sits under the cube
  assert.equal(r.tags.length, 4);
  assert.deepEqual([r.tags[0], r.tags[1], r.tags[2]], ["visible", "visible", "hidden"]);
});

test("live 3D: Apart moves the parts at once with reduced motion, and the camera keeps them clear of the hint", async (t) => {
  if (!BROWSER) return t.skip("no Chrome, Chromium or Edge on this machine");
  const three = await realThree();
  if (three.error) return t.skip(`three.js is not available: ${three.error}`);
  const r = await live("apart", renderPage(CUBE, { offline: true, three }), `
    const host = await ready3d();
    out({ state: host.dataset.state ?? "ready" });
    if (!host.dataset.state) {
      // a hash of the drawing (the page keeps its drawing buffer for captures)
      const drawn = () => { const s = $("[data-viewer=steps] canvas").toDataURL(); let k = 0; for (let i = 0; i < s.length; i += 3) k = (k * 31 + s.charCodeAt(i)) | 0; return k; };
      $(".build .stage").scrollIntoView({ block: "start" }); await sleep(500);
      const d0 = drawn();
      $("[data-v=explode]").click(); await sleep(400);
      const redrawn = drawn() !== d0, apart = tagsOf(host);
      $("[data-v=ghost]").click(); await sleep(400);
      const hint = $("[data-viewer=steps] .hint").getBoundingClientRect().bottom - host.getBoundingClientRect().top;
      out({ redrawn, apart, ghost: tagsOf(host), hint: Math.round(hint) });
    }`, { hash: "build/5", width: 390, height: 844, wait: 4000 });
  if (r.state !== "ready") return t.skip(`the 3D view did not start (${r.state})`);
  assert.equal(r.redrawn, true, "with reduced motion, Apart draws the parts apart at once");
  // the camera frames the parts apart, so the tag of the top (part C) stays below the hint, with "Show finished" too
  for (const k of ["apart", "ghost"]) {
    const c = r[k].find(([l]) => l === "C");
    assert.ok(c && c[1] === "visible", `${k}: the tag of part C: ${JSON.stringify(r[k])}`);
    assert.ok(c[2] >= Math.max(32, r.hint), `${k}: the tag top is ${c[2]}px, the hint ends at ${r.hint}px`);
  }
});

// Two brackets K far apart on a wall, in a step with view.zoom 2 (the zoom that placing.md gives for small hardware).
const WALL2 = compute({
  jig: 1, id: "wall-two", title: "Wall shelf", units: "mm",
  materials: { bracket: { kind: "each", name: "Shelf bracket", price: 1 }, shelf: { kind: "each", name: "Shelf", price: 1 } },
  props: { wall: { label: "Wall", size: [1600, 1400, 60], at: [-400, 0, -60], color: "#e8e3da" } },
  parts: [
    { id: "K1", label: "K", name: "Bracket", material: "bracket", size: [20, 150, 140], at: [100, 1000, 0], color: "#5a6068" },
    { id: "K2", label: "K", name: "Bracket", material: "bracket", size: [20, 150, 140], at: [680, 1000, 0], color: "#5a6068" },
    { id: "S1", label: "S", name: "Shelf", material: "shelf", size: [800, 19, 150], at: [0, 1150, 0], color: "#d9b88a" },
  ],
  steps: [
    { id: "mark", title: "Mark the wall", props: ["wall"], minutes: 1, check: "Make sure that the line is level." },
    { id: "brackets", title: "Attach the brackets", props: ["wall"], parts: ["K1", "K2"], minutes: 1, view: { zoom: 2 }, check: "Make sure that the brackets are level." },
    { id: "shelf", title: "Put the shelf on the brackets", props: ["wall"], parts: ["S1"], minutes: 1, check: "Make sure that the shelf is level." },
  ],
});

test("live 3D: a zoomed step keeps every lit part in the view (two brackets far apart), wide and on a phone", async (t) => {
  if (!BROWSER) return t.skip("no Chrome, Chromium or Edge on this machine");
  const three = await realThree();
  if (three.error) return t.skip(`three.js is not available: ${three.error}`);
  const html = renderPage(WALL2, { offline: true, three });
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    const r = await live(`zoom-${width}`, html, `
      const host = await ready3d();
      out({ state: host.dataset.state ?? "ready" });
      if (!host.dataset.state) { $(".build .stage").scrollIntoView({ block: "start" }); await sleep(600); out({ tags: tagPixels(host) }); }`,
    { hash: "build/2", width, height, wait: 4000 });
    if (r.state !== "ready") return t.skip(`the 3D view did not start (${r.state})`);
    assert.equal(r.tags.length, 2, JSON.stringify(r.tags));
    for (const x of r.tags) {
      assert.deepEqual([x.l, x.vis, x.inside], ["K", "visible", true], `${width} px: ${JSON.stringify(r.tags)}`);
      assert.equal(x.px[3], 255, `${width} px: no drawing under the tag of a bracket: ${JSON.stringify(r.tags)}`);
    }
  }
});

// A brace turned 45° about z (rotate [0, 0, 45]) behind panel C: the top centre of the brace's world box is behind C.
const BRACE = compute({
  jig: 1, id: "brace", title: "Brace", units: "mm",
  materials: { panel: { kind: "each", name: "Panel", price: 1 }, brace: { kind: "each", name: "Brace", price: 1 } },
  parts: [
    { id: "C", name: "Panel", material: "panel", size: [160, 120, 20], at: [220, 400, 160], color: "#ffffff" },
    { id: "G", name: "Brace", material: "brace", size: [400, 20, 140], at: [100, 300, 0], rotate: [0, 0, 45], color: "#2050ff" },
  ],
  steps: [
    { id: "panel", title: "Hold the panel", parts: ["C"], minutes: 1, check: "Make sure that the panel is level." },
    { id: "brace", title: "Hold the brace", parts: ["G"], minutes: 1, check: "Make sure that the brace is tight." },
  ],
});

test("live 3D: the tag of a turned part stands on the part (a brace at 45°), not on the part in front of its box top", async (t) => {
  if (!BROWSER) return t.skip("no Chrome, Chromium or Edge on this machine");
  const three = await realThree();
  if (three.error) return t.skip(`three.js is not available: ${three.error}`);
  const r = await live("brace-tag", renderPage(BRACE, { offline: true, three }), `
    const host = await ready3d();
    out({ state: host.dataset.state ?? "ready" });
    if (!host.dataset.state) { $(".build .stage").scrollIntoView({ block: "start" }); await sleep(600); out({ tags: tagPixels(host) }); }`, { hash: "build/2", wait: 4000 });
  if (r.state !== "ready") return t.skip(`the 3D view did not start (${r.state})`);
  const g = r.tags.find((x) => x.l === "G");
  assert.ok(g && g.vis === "visible", JSON.stringify(r.tags));
  const [, green, blue, alpha] = g.px;
  assert.equal(alpha, 255, `no drawing under the tag of G: ${g.px}`);
  assert.ok(blue - green > 40, `the tag of G stands on the white panel C, not on the lit blue brace: rgba ${g.px}`);
});

test("live 3D: in the kit pose 'Apart' and 'Show finished' read not pressed and do nothing; the next step takes clicks again", async (t) => {
  if (!BROWSER) return t.skip("no Chrome, Chromium or Edge on this machine");
  const three = await realThree();
  if (three.error) return t.skip(`three.js is not available: ${three.error}`);
  const r = await live("kit-toggles", renderPage(CUBE, { offline: true, three }), `
    const host = await ready3d();
    out({ state: host.dataset.state ?? "ready" });
    if (!host.dataset.state) {
      const btn = () => ["explode", "ghost"].map((v) => { const b = $("[data-v=" + v + "]"); return [b.getAttribute("aria-pressed"), b.getAttribute("aria-disabled")]; });
      const kit = btn();
      $("[data-v=explode]").click(); $("[data-v=ghost]").click(); await sleep(80);
      const clicked = btn();
      location.hash = "#build/4"; await until(() => eyebrow().startsWith("Step 4 ")); await sleep(80);
      const next = btn();
      $("[data-v=explode]").click(); await sleep(80);
      out({ kit, clicked, next, apart: btn() });
    }`, { hash: "build/1", wait: 4000 });
  if (r.state !== "ready") return t.skip(`the 3D view did not start (${r.state})`);
  // [aria-pressed, aria-disabled] of Apart, then of Show finished
  assert.deepEqual(r.kit, [["false", "true"], ["false", "true"]], "step 1 lays the parts on the floor");
  assert.deepEqual(r.clicked, [["false", "true"], ["false", "true"]], "a click in the kit pose changes nothing");
  assert.deepEqual(r.next, [["false", "false"], ["false", "false"]], "step 4 (no kit pose)");
  assert.deepEqual(r.apart, [["true", "false"], ["false", "false"]], "Apart works on step 4");
});

test("live 3D: in a repair with no parts 'Apart' and 'Show finished' read not pressed and do nothing, on each step", async (t) => {
  if (!BROWSER) return t.skip("no Chrome, Chromium or Edge on this machine");
  const three = await realThree();
  if (three.error) return t.skip(`three.js is not available: ${three.error}`);
  const r = await live("repair-toggles", renderPage(CHAIR, { offline: true, three }), `
    const host = await ready3d();
    out({ state: host.dataset.state ?? "ready" });
    if (!host.dataset.state) {
      const btn = () => ["explode", "ghost"].map((v) => { const b = $("[data-v=" + v + "]"); return [b.getAttribute("aria-pressed"), b.getAttribute("aria-disabled")]; });
      const seen = [];
      for (const n of [1, 2]) {
        location.hash = "#build/" + n; await until(() => eyebrow().startsWith("Step " + n + " ")); await sleep(80);
        const before = btn();
        $("[data-v=explode]").click(); await sleep(80);
        $("[data-v=ghost]").click(); await sleep(80);
        seen.push({ before, after: btn(), auto: host.hasAttribute("data-auto-ghost") });
      }
      out({ seen });
    }`, { hash: "build/1", wait: 4000 });
  if (r.state !== "ready") return t.skip(`the 3D view did not start (${r.state})`);
  // [aria-pressed, aria-disabled] of Apart, then of Show finished
  const off = [["false", "true"], ["false", "true"]];
  assert.deepEqual(r.seen, [{ before: off, after: off, auto: false }, { before: off, after: off, auto: false }], "a click on a toggle with no parts changes nothing");
});

test("live 3D: the 3D toolbar keeps its buttons on one row at 1280, 900, 390 and 360 px; a long readout goes above them on one line", async (t) => {
  if (!BROWSER) return t.skip("no Chrome, Chromium or Edge on this machine");
  const three = await realThree();
  if (three.error) return t.skip(`three.js is not available: ${three.error}`);
  const html = renderPage(compute(load("../examples/raised-garden-bed/project.json")), { offline: true, three });
  // step 9 shows only props ("no new parts · Level ground, Soil"); step 3 has a short readout. A phone (520 px or
  // less) has no readout; from 360 px the buttons stay on one row, and at 320 px they can go on two rows that do not overlap.
  for (const [width, hash, place] of [[1280, "build/9", "above"], [900, "build/9", "above"], [1280, "build/3", "beside"], [390, "build/9", null], [360, "build/3", null], [320, "build/9", null]]) {
    const r = await live(`toolbar-${width}-${hash.replace("/", "-")}`, html, `
      const host = await ready3d();
      out({ state: host.dataset.state ?? "ready" });
      if (!host.dataset.state) {
        $(".build .stage").scrollIntoView({ block: "start" }); await sleep(200);
        const ro = $("[data-readout]"), rg = document.createRange(); rg.selectNodeContents(ro);
        const bs = [...host.querySelectorAll(".vtools button")].map((b) => b.getBoundingClientRect()), rr = ro.getBoundingClientRect(), bar = host.querySelector(".vbar").getBoundingClientRect();
        const overlap = bs.some((a, i) => bs.some((b, k) => k > i && Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5));
        out({ text: ro.textContent, title: ro.title, rows: new Set(bs.map((b) => Math.round(b.top))).size, lines: new Set([...rg.getClientRects()].map((x) => Math.round(x.top))).size, cut: ro.scrollWidth > ro.clientWidth,
          place: Math.round(rr.bottom) === Math.round(bs[0].bottom) ? "beside" : rr.bottom <= bs[0].top ? "above" : "other", inside: rr.left >= bar.left - 0.5 && rr.right <= bar.right + 0.5,
          shown: getComputedStyle(ro).display !== "none", overlap, inBar: bs.every((b) => b.left >= bar.left - 0.5 && b.right <= bar.right + 0.5) });
      }`, { hash, width, height: 900, wait: 4000 });
    if (r.state !== "ready") return t.skip(`the 3D view did not start (${r.state})`);
    const at = `${width} px, #${hash}`;
    assert.equal(r.overlap, false, `${at}: two buttons overlap`);
    assert.equal(r.inBar, true, `${at}: a button is out of the bar`);
    if (place === null) {
      assert.equal(r.shown, false, `${at}: a phone shows the readout`);
      if (width >= 360) assert.equal(r.rows, 1, `${at}: the buttons wrap to ${r.rows} rows`);
      continue;
    }
    assert.equal(r.rows, 1, `${at}: the buttons wrap to ${r.rows} rows`);
    assert.equal(r.lines, 1, `${at}: the readout "${r.text}" is on ${r.lines} lines`);
    assert.equal(r.cut, false, `${at}: the readout ends in "…"`);
    assert.equal(r.place, place, `${at}: the readout is not ${place} the buttons`);
    assert.equal(r.inside, true, `${at}: the readout is out of the bar`);
    assert.equal(r.title, r.text, `${at}: the title holds the full readout`);
  }
});

// The kit of a rack: two legs, a top T and 32 slats S of one size, which lie side by side on the floor.
const RACK = (() => {
  const p = {
    jig: 1, id: "rack", title: "Slat rack", units: "mm",
    materials: {
      ply: { kind: "sheet", name: "Plywood", thick: 19, stock: [{ w: 2440, h: 1220, price: 60 }] },
      board: { kind: "linear", name: "Board", section: [90, 19], stock: [{ length: 2400, price: 10 }] },
      slat: { kind: "linear", name: "Slat", section: [20, 19], stock: [{ length: 2400, price: 5 }] },
    },
    parts: [
      { id: "L1", label: "A", name: "Leg", material: "ply", size: [19, 700, 400], at: [0, 0, 0] },
      { id: "L2", label: "A", name: "Leg", material: "ply", size: [19, 700, 400], at: [619, 0, 0] },
      { id: "T1", label: "T", name: "Top", material: "board", size: [600, 19, 90], at: [19, 681, 155] },
    ],
    steps: [{ id: "cut", title: "Cut the parts", pose: "kit", cuts: true, minutes: 1, check: "Make sure that you have all the parts." }],
  };
  for (let k = 0; k < 32; k++) p.parts.push({ id: `S${k + 1}`, label: "S", name: "Slat", material: "slat", size: [600, 19, 20], at: [19, 20 + Math.floor(k / 2) * 40, 50 + (k % 2) * 250] });
  p.steps.push({ id: "legs", title: "Stand the legs", parts: ["L1", "L2", "T1"], minutes: 1, check: "Make sure that the legs stand." },
    { id: "slats", title: "Put in the slats", parts: p.parts.filter((x) => x.label === "S").map((x) => x.id), minutes: 1, check: "Make sure that the slats are level." });
  return compute(p);
})();
// the visible tags of the steps viewer, and the largest share of a tag's area that another visible tag covers
const KIT_TAGS = `(() => { const v = [...host.querySelectorAll(".tag")].filter((x) => !x.hidden && getComputedStyle(x).visibility === "visible").map((x) => ({ l: x.textContent, r: x.getBoundingClientRect() }));
  const ov = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  let worst = 0; for (const a of v) for (const b of v) if (a !== b) worst = Math.max(worst, ov(a.r, b.r) / (a.r.width * a.r.height));
  return { shown: [...host.querySelectorAll(".tag")].filter((x) => !x.hidden).length, visible: v.map((x) => x.l), worst }; })()`;

test("live 3D: in the kit pose a pile of small parts does not pile up its tags, and a normal kit keeps every tag", async (t) => {
  if (!BROWSER) return t.skip("no Chrome, Chromium or Edge on this machine");
  const three = await realThree();
  if (three.error) return t.skip(`three.js is not available: ${three.error}`);
  const html = renderPage(RACK, { offline: true, three });
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    const r = await live(`kit-pile-${width}`, html, `
      const host = await ready3d();
      out({ state: host.dataset.state ?? "ready" });
      if (!host.dataset.state) { $(".build .stage").scrollIntoView({ block: "start" }); await sleep(600); out(${KIT_TAGS}); }`, { hash: "build/1", width, height, wait: 4000 });
    if (r.state !== "ready") return t.skip(`the 3D view did not start (${r.state})`);
    assert.equal(r.shown, 35);
    assert.ok(r.worst <= 0.25, `${width} px: a visible tag covers ${Math.round(r.worst * 100)}% of another`);
    assert.ok(r.visible.includes("T") && r.visible.filter((l) => l === "A").length === 2, `${width} px: ${r.visible}`);
    assert.ok(r.visible.length < 35, `${width} px: every tag of the pile shows`);
  }
  const bed = compute(load("../examples/raised-garden-bed/project.json"));
  const r = await live("kit-bed", renderPage(bed, { offline: true, three }), `
    const host = await ready3d();
    out({ state: host.dataset.state ?? "ready" });
    if (!host.dataset.state) { $(".build .stage").scrollIntoView({ block: "start" }); await sleep(600); out(${KIT_TAGS}); }`, { hash: "build/1", wait: 4000 });
  if (r.state !== "ready") return t.skip(`the 3D view did not start (${r.state})`);
  assert.equal(r.shown, 12);
  assert.equal(r.visible.length, 12, `the garden bed kit: ${r.visible}`);
});

test("live 3D: a repair with no parts frames the object that is there (the props of the Plan view), not a 200 mm box", async (t) => {
  if (!BROWSER) return t.skip("no Chrome, Chromium or Edge on this machine");
  const three = await realThree();
  if (three.error) return t.skip(`three.js is not available: ${three.error}`);
  const r = await live("repair-plan", renderPage(CHAIR, { offline: true, three }), `
    const host = await until(() => $("[data-viewer=hero][data-ready]") || $("[data-viewer=hero][data-state]"), 20000);
    out({ state: host.dataset.state ?? "ready" });
    if (!host.dataset.state) {
      await sleep(600);
      // the middle row of the drawing: a solid pixel of a warm wood colour is a pixel of the chair
      const c = host.querySelector("canvas"), g = document.createElement("canvas");
      g.width = c.width; g.height = c.height;
      const ctx = g.getContext("2d");
      ctx.drawImage(c, 0, 0);
      const d = ctx.getImageData(0, Math.round(c.height / 2), c.width, 1).data, wood = [];
      for (let i = 0; i < c.width; i++) wood.push(d[i * 4 + 3] === 255 && d[i * 4] - d[i * 4 + 2] > 30);
      const band = Math.ceil(c.width * 0.03);
      out({ fig: $(".fig").textContent, wood: wood.filter(Boolean).length / c.width, left: wood.slice(0, band).some(Boolean), right: wood.slice(-band).some(Boolean) });
    }`, { hash: "plan", wait: 4000 });
  if (r.state !== "ready") return t.skip(`the 3D view did not start (${r.state})`);
  assert.ok(r.fig.includes("420 × 880 × 400 mm"), r.fig);
  assert.ok(r.wood > 0.05, `the chair fills ${Math.round(r.wood * 100)}% of the middle row`);
  assert.deepEqual([r.left, r.right], [false, false], "the chair is not cut off at the sides of the view");
});
