// The guide page (ARCHITECTURE.md section 9): one self-contained HTML file from a computed model. Inline CSS, the
// model as JSON, and one module (viewer + app) with no static import; three.js comes through an import map, from
// jsDelivr with sha384 integrity or, offline, from inlined data: URLs. The page runtime is read from ../web once.
import { readFileSync } from "node:fs";
import { noscriptHtml } from "./markdown.mjs";
import { esc } from "./util.mjs";
import { THREE_BASE, THREE_FILES, THREE_LICENSE, THREE_NOTICE } from "./offline.mjs";

export const TABS = Object.freeze(["plan", "shop", "cut", "build"]);
const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
  + '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700&amp;family=JetBrains+Mono:wght@400;500;700&amp;display=swap">';
const lf = (s) => String(s ?? "").replace(/^﻿/, "").replace(/\r\n?/g, "\n"); // a CRLF checkout builds the same bytes
// Text as written in an HTML comment. "--", "<" and ">" could end the comment or open a tag, so they are refused.
function comment(text) {
  if (/--|[<>]/.test(text)) throw new Error("A notice for the page holds -- or an angle bracket.");
  return `<!--\n${text}\n-->`;
}
let WEB = null;

// app.js, viewer.js and page.css from ../web, read once, with LF line ends.
export function webFiles() {
  return (WEB ??= Object.fromEntries(["app.js", "viewer.js", "page.css"].map((f) => [f, lf(readFileSync(new URL(`../web/${f}`, import.meta.url), "utf8"))])));
}

// Tab ids in page order from an array or "plan,build". Throws on an unknown or empty list.
export function tabList(tabs = TABS) {
  const list = (Array.isArray(tabs) ? tabs : String(tabs ?? "").split(",")).map((t) => String(t).trim().toLowerCase()).filter(Boolean);
  const bad = list.find((t) => !TABS.includes(t));
  if (bad !== undefined) throw new Error(`Unknown tab "${bad}". Use plan, shop, cut or build.`);
  const out = TABS.filter((t) => list.includes(t));
  if (!out.length) throw new Error("No tab given. Use one or more of plan, shop, cut and build.");
  return out;
}

// The import map. Online: jsDelivr with an integrity entry per exact file URL. Offline: each specifier as a data: URL.
function importMap(offline, three) {
  if (!offline) return { imports: { three: THREE_FILES[0].url, "three/addons/": `${THREE_BASE}/examples/jsm/` }, integrity: Object.fromEntries(THREE_FILES.map((f) => [f.url, `sha384-${f.sha384}`])) };
  const missing = THREE_FILES.find((f) => typeof three?.[f.specifier] !== "string" || !three[f.specifier]);
  if (missing) throw new Error(`An offline page needs the source of "${missing.specifier}". Get the sources with loadThree() and pass them as three.`);
  return { imports: Object.fromEntries(THREE_FILES.map((f) => [f.specifier, `data:text/javascript;base64,${Buffer.from(three[f.specifier], "utf8").toString("base64")}`])) };
}

// renderPage(model, { artifact, offline, tabs, three, web }) -> HTML string. artifact: a body fragment for the Artifact
// tool (title, the claude:viewport-fit-sides meta, fonts, style, body; the host adds the standard viewport meta). offline: three = { [specifier]: source } from loadThree(), the
// three.js MIT licence text in a comment, no Google Fonts. tabs: subset of plan, shop, cut, build. web: { "app.js",
// "viewer.js", "page.css" } to override the files.
export function renderPage(model, { artifact = false, offline = false, tabs = TABS, three = null, web = null } = {}) {
  if (!model || typeof model !== "object" || !model.meta) throw new Error("renderPage needs a computed model: call compute(project) first.");
  const list = tabList(tabs), files = web ?? webFiles();
  const app = lf(files["app.js"]), viewer = lf(files["viewer.js"]), css = lf(files["page.css"]);
  if (/<\/script/i.test(app + viewer) || /<\/style/i.test(css)) throw new Error("The page runtime holds a closing script or style tag.");
  // The page leaves out safety.cleared: the overrides of the hand-off screen are for the reviewer (the safety review),
  // not for the reader.
  const { cleared: _, ...safety } = model.safety ?? {};
  const json = JSON.stringify(model.safety ? { ...model, safety } : model).replace(/</g, "\\u003c");
  const map = JSON.stringify(importMap(offline, three)).replace(/</g, "\\u003c");
  // viewer.js in its own scope: only createViewer reaches app.js
  const code = `const { createViewer } = (() => {\n${viewer.replace(/^export /gm, "").trimEnd()}\nreturn { createViewer };\n})();\n${app.trimEnd()}`;
  const title = esc(`${model.meta.title || "jig"} guide`), fonts = offline ? "" : `${FONTS}\n`;
  const body = `<main class="jig" id="jig" data-tabs="${esc(list.join(","))}"></main>
<noscript><div class="noscript">${noscriptHtml(model)}</div></noscript>
<script type="application/json" id="jig-data">${json}</script>
<!-- ${esc(THREE_NOTICE)} -->
${offline ? `${comment(THREE_LICENSE)}\n` : ""}<script type="importmap">${map}</script>
<script type="module">
${code}
</script>`;
  if (artifact) return `<title>${title}</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n${fonts}<style>\n${css.trimEnd()}\n</style>\n${body}\n`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<title>${title}</title>
${model.meta.summary ? `<meta name="description" content="${esc(model.meta.summary)}">\n` : ""}<meta name="generator" content="jig ${esc(model.engine ?? "")}">
${fonts}<style>
${css.trimEnd()}
</style>
</head>
<body>
${body}
</body>
</html>
`;
}
