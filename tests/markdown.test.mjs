// markdown.mjs: the plan (warnings before the instructions, level filters), the BOQ table and CSV (RFC 4180), the
// cut list and its SVG, the shopping checklist, the report, the escaped <noscript> HTML, and no throw on odd models.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compute } from "../engine/lib/model.mjs";
import { planMd, boqMd, boqCsv, cutMd, cutSvg, buyMd, reportText, noscriptHtml } from "../engine/lib/markdown.mjs";
import { ENGINE_VERSION } from "../engine/lib/version.mjs";
import { fmtDuration, fmtMoney } from "../engine/lib/locale.mjs";
import { timeFor } from "../engine/lib/plan.mjs";

const load = (rel) => JSON.parse(readFileSync(new URL(rel, import.meta.url), "utf8"));
const shelf = () => load("../examples/pine-bookshelf/project.json");
const bench = () => load("./fixtures/inch-bench.json");
const M = compute(shelf(), { start: "2026-11-20" });
const includes = (text, ...parts) => { for (const p of parts) assert.ok(text.includes(p), `missing: ${p}`); };

// RFC 4180 rows: quoted fields may hold commas, doubled quotes and line breaks; every row ends with CRLF.
function parseCsv(s) {
  const rows = [], re = /("((?:[^"]|"")*)"|[^,"\r\n]*)(,|\r\n)/gy;
  let row = [], m;
  while (re.lastIndex < s.length && (m = re.exec(s))) {
    row.push(m[2] !== undefined ? m[2].replace(/""/g, '"') : m[1]);
    if (m[3] === "\r\n") { rows.push(row); row = []; }
  }
  assert.equal(re.lastIndex, s.length, "the whole text parses");
  return rows;
}

test("planMd: title, facts, tools and materials, numbered steps with the warnings first", () => {
  const md = planMd(M);
  assert.ok(md.startsWith("# Pine bookshelf\n\nA floor bookshelf"));
  includes(md, "Size: 800 × 900 × 241 mm (width × height × depth)", "Cost: $254.17, an estimate.", "Level: First time.",
    "### Safety gear\n\n- Safety glasses (buy)", "- Tape measure (you have it)", "- Circular saw, fine blade, 40 teeth or more (borrow)", "- Bar clamp, 600 mm × 2 (buy)",
    "- 2 × board: Pine board, 19 × 235 mm (1×10), 2440 mm long", "- Kit screw, in the anti-tip kit: in the kit", "- 1 × 237 ml bottle: Wood glue, PVA, interior",
    "- Fasteners: 3 × Wood screw (4 × 50 mm, countersunk)", "- Uses: 2 sheets of Sandpaper (120 grit), 2 sheets of Sandpaper (180 grit)",
    "- Parts: 1 × D Shelf bracket, 1 × E Wall bracket", "- Finish: Wipe-on polyurethane, 2 coats",
    "1. Put the boards on the two trestles.\n2. Mark each cut from the cut list.\n3. Measure each length two times before you cut.",
    "**Check:** Make sure that you have two parts A, four parts B and one part C.");
  M.steps.forEach((s, i) => includes(md, `### ${i + 1}. ${s.title}\n`));
  md.split(/\n### \d+\. /).slice(1).forEach((s, i) => {
    const w = s.indexOf("> **WARNING:**"), d = s.search(/\n1\. /);
    assert.ok(w >= 0 && d > w, `step ${i + 1}: the WARNING comes before the instructions`);
  });
  assert.ok(!/<[a-z/]/i.test(md), "no HTML in Markdown");
  assert.ok(md.endsWith("\n") && !md.endsWith("\n\n"));
});

test("planMd: levels filter first-time lines, why, tip and cards; safety never depends on the level", () => {
  const nw = planMd(M, { level: "new" }), some = planMd(M, { level: "some" }), pro = planMd(M, { level: "pro" });
  const line = "Measure each length two times before you cut.";
  assert.deepEqual([nw.includes(line), some.includes(line), pro.includes(line)], [true, false, false]);
  assert.deepEqual([nw.includes("**Why:**"), some.includes("**Why:**"), pro.includes("**Why:**")], [true, false, false]);
  assert.deepEqual([nw.includes("**Tip:**"), some.includes("**Tip:**"), pro.includes("**Tip:**")], [true, true, false]);
  includes(nw, "**Technique: Measure and mark**", "Why: The saw blade removes 3 mm of wood.", "Technique: Clamp two parts (see step 4).", "- Time: 1 h 10 min");
  includes(some, "Techniques: Measure and mark, Cut on the line.", "Level: Some experience.", "- Time: 55 min");
  includes(pro, "- Time: 45 min", "Level: Experienced.");
  for (const md of [nw, some, pro]) includes(md, "> **WARNING:** Wear safety glasses. The saw can throw chips into your eyes.", "> **WARNING:** Wear ear protection. A loud saw can hurt your ears.",
    "> **WARNING:** Keep your hands 150 mm from the blade. The blade can cut your fingers.", "> **CAUTION:** Do not sand across the grain.");
  assert.equal(planMd(M, { level: "expert" }), nw, "an unknown level falls back to the project level");
  const p = shelf();
  p.handoff = [{ topic: "mains", text: "A licensed electrician moves the outlet." }];
  // A topic id shows as the topic name; a free-text topic as written.
  includes(planMd(compute(p)), "## Hand-offs", "- **Mains electrical work**: A licensed electrician moves the outlet.");
  includes(noscriptHtml(compute(p)), "<li><strong>Mains electrical work</strong>: A licensed electrician moves the outlet.</li>");
  p.handoff = [{ topic: "Chimney sweep", text: "A sweep cleans the flue." }];
  includes(planMd(compute(p)), "- **Chimney sweep**: A sweep cleans the flue.");
});

test("boqMd: one row per BOQ row in group order, the totals and the notes", () => {
  const md = boqMd(M);
  for (const r of M.boq) includes(md, `| ${r.code} | `);
  includes(md, "Prices in USD, as of 2026-11-02. Example US prices (November 2026).", "| Code | Item | Need | Buy | Rate | Amount |", "| **Timber and sheet** | | | | | |",
    "| T01 | Pine board, 19 × 235 mm (1×10), 2440 mm long | 6 pieces, 4848 mm | 2 × board | $27.98 est | $55.96 |",
    "| H04 | Kit screw, in the anti-tip kit | 2 pieces, in the kit | in the kit | - | $0.00 |",
    "| X02 | Circular saw, fine blade, 40 teeth or more | borrow 1 | borrow | - | $0.00 |", "| S01 | Safety glasses | buy 1 | 1 | $6.97 est | $6.97 |",
    "| | **Subtotal** | | | | **$231.06** |", "| | Contingency (10%) | | | | $23.11 |", "| | **Total** | | | | **$254.17** |",
    "Finished area: 3.98 m². It counts every face of each finished part, so it is an upper bound.", "- F01: 3.98 m² × 2 coats ÷ 11 m² per L.");
  assert.ok(md.indexOf("**Timber and sheet**") < md.indexOf("**Hardware**") && md.indexOf("**Safety**") < md.indexOf("**Tools**"));
  const p = shelf();
  p.tax = { rate: 0.19, label: "VAT", included: true };
  delete p.tools[2].price;
  p.tools[2].name = "Speed | square";
  const md2 = boqMd(compute(p));
  includes(md2, "| | VAT (19%, included in the prices) | | | | includes $", "| X01 | Speed \\| square | buy 1 | 1 | price? | price? |", "1 row has no price (price?). The total does not include it.");
  const q = shelf();
  q.tax = { rate: 0.08, label: "Sales tax" };
  includes(boqMd(compute(q)), "| | Sales tax (8%) | | | | $20.33 |", "| | **Total** | | | | **$274.50** |");
});

test("boqCsv: RFC 4180 quoting, CRLF lines, one line per row and the totals", () => {
  const csv = boqCsv(M), rows = parseCsv(csv);
  assert.ok(csv.endsWith("\r\n"));
  assert.deepEqual(rows[0], ["code", "group", "item", "spec", "need", "need_qty", "qty", "unit", "rate", "amount", "currency", "est", "get", "store", "first_step", "note"]);
  assert.equal(rows.length, 1 + M.boq.length + 3);
  assert.ok(rows.every((r) => r.length === 16));
  assert.equal(csv.split("\r\n")[1], 'T01,Timber and sheet,Pine board,"19 × 235 mm (1×10), 2440 mm long","6 pieces, 4848 mm",4848,2,board,27.98,55.96,USD,true,buy,Timber yard,1,');
  assert.deepEqual(rows.slice(-3).map((r) => [r[2], r[9]]), [["Subtotal", "231.06"], ["Contingency", "23.11"], ["Total", "254.17"]]);
  assert.deepEqual(rows.find((r) => r[0] === "X02").slice(12, 15), ["borrow", "", "1"]);
  const p = shelf();
  p.materials.glue.name = 'Glue "Titebond", interior';
  p.materials.glue.note = "Line one\nline two";
  p.materials.glue.spec = "=HYPERLINK(1)";
  p.tax = { rate: 0.19, label: "VAT", included: true };
  const csv2 = boqCsv(compute(p)), glue = parseCsv(csv2).find((r) => r[0] === "C03");
  includes(csv2, '"Glue ""Titebond"", interior"', '"Line one\nline two"');
  assert.deepEqual([glue[2], glue[3], glue[15]], ['Glue "Titebond", interior', "'=HYPERLINK(1)", "Line one\nline two"]);
  assert.deepEqual(parseCsv(csv2).at(-2).slice(2, 3), ["VAT (included)"]);
});

test("cutMd: the parts, then each board and sheet with its cuts and waste, in project units", () => {
  includes(cutMd(M), "Kerf: 3 mm.", "| A | Side | 2 | 900 × 235 × 19 mm | Pine board |", "| D | Shelf bracket | 1 | not cut | Anti-tip furniture kit |",
    "## Pine board\n\n2 boards, $55.96.", "### Board 1 of 2: 2440 mm, $27.98", "| 2 | B (B1) | 762 mm | 903 mm |", "Waste: 10 mm.",
    "### Sheet 1 of 1: 1220 × 1220 mm, $24.00", "| 1 | C (C1) | 900 × 800 mm | 0 mm, 0 mm | no |", "Waste: 0.77 m².");
  includes(cutMd(compute(bench())), "Kerf: 1/8 in.", "| A | Leg | 4 | 16 × 3 1/2 × 1 1/2 in | Stud |", "| 2 | B (R2) | 29 in | 29 1/8 in |", "Waste: 5 5/8 in.", "Waste: 5.00 ft².");
  const p = shelf();
  p.trim = 10;
  includes(cutMd(compute(p)), "Trim: 10 mm from the start of each board.", "| 1 | A (A1) | 900 mm | 10 mm |");
  includes(cutMd(compute({ id: "x", title: "X", materials: {}, parts: [] })), "Nothing to cut.");
});

test("cutSvg: a standalone, to-scale SVG with labels and hatched waste; null for no cut plan", () => {
  const svg = cutSvg(M, "pine-1x10");
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 1000 [\d.]+" width="1000" height="[\d.]+" role="img"/);
  includes(svg, '<title id="jig-pine-1x10-title">Cut plan: Pine board</title>', '<pattern id="jig-pine-1x10-waste"', '<rect width="100%" height="100%" fill="#ffffff"/>',
    ">Pine board: 2 boards</text>", ">Board 1: 2440 mm, waste 10 mm</text>", ">762 mm</text>", "<title>B (B1): 762 mm</title>");
  assert.equal(svg.match(/fill="url\(#jig-pine-1x10-waste\)"/g).length, 2, "one hatched stock bar for each board");
  assert.equal(svg.match(/<title>[ABC] \(/g).length, 6, "one rect for each cut");
  assert.match(svg, /width="354\.1\d*" height="44" fill="#eedfca"/, "900 of 2440 mm at 960 units wide, a light tint of the material color");
  const lum = (hex) => [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
  for (const [, hex] of svg.matchAll(/<rect [^>]*fill="#([0-9a-f]{6})"/g)) assert.ok(lum(hex) > 180, `rect fill #${hex} is light`);
  for (const [, hex] of svg.matchAll(/<text [^>]*fill="#([0-9a-f]{6})"/g)) assert.ok(lum(hex) < 60, `text fill #${hex} is dark`);
  assert.ok(!/&(?!amp;|lt;|gt;|quot;|#39;)/.test(svg), "every & is an entity");
  includes(cutSvg(M, "ply-6"), ">Sheet 1: 1220 × 1220 mm, waste 0.77 m²</text>", 'height="960"', ">900 × 800 mm</text>");
  assert.equal(cutSvg(M, "screw-4x50"), null);
  assert.equal(cutSvg(M, "nothing"), null);
  const p = shelf();
  p.materials["pine-1x10"].name = 'Pine <b>"board"</b> & co';
  p.materials["pine-1x10"].color = "#000000";
  const odd = cutSvg(compute(p), "pine-1x10");
  includes(odd, "Cut plan: Pine &lt;b&gt;&quot;board&quot;&lt;/b&gt; &amp; co", 'fill="#8c8c8c"');
  assert.ok(!odd.includes("<b>"));
});

test("cutMd and cutSvg: two cut materials with one name add the material spec to the heading, as the page does", () => {
  const p = shelf();
  p.materials["ply-6"].name = "Pine board";
  const X = compute(p), md = cutMd(X);
  includes(md, "## Pine board, 19 × 235 mm (1×10)\n\n2 boards,", "## Pine board, 6 mm birch\n\n1 sheet,");
  assert.ok(!md.includes("2440 × 1220 mm\n"), "the heading uses the material spec, not the BOQ row spec with the stock size");
  includes(cutSvg(X, "ply-6"), "Cut plan: Pine board, 6 mm birch</title>", ">Pine board, 6 mm birch: 1 sheet</text>");
  includes(cutSvg(X, "pine-1x10"), "Cut plan: Pine board, 19 × 235 mm (1×10)</title>");
  // A unique name stays as it is.
  includes(cutMd(M), "## Pine board\n\n2 boards,", "## Plywood\n\n1 sheet,");
  assert.ok(!cutMd(M).includes("## Plywood, "));
});

test("buyMd: one checklist per trip, in order, with order-by dates", () => {
  const md = buyMd(M);
  M.purchase.forEach((t, i) => includes(md, `## ${i + 1}. ${t.name}\n`));
  assert.equal(md.match(/^- \[ \] /gm).length, M.purchase.reduce((a, t) => a + t.items.length, 0));
  includes(md, "Online order, delivery in 3 days. Order by 2026-11-17. Order 3 days before you start.",
    "- [ ] 1 × pack of 5: Sandpaper, 120 grit ($5.48 est, step 2)", "- [ ] 2 × Bar clamp, 600 mm ($25.94 est, step 1)",
    "- [ ] 2 × board: Pine board, 19 × 235 mm (1×10), 2440 mm long ($55.96 est, step 1)", "Get these by 2026-11-20. Pick straight boards.",
    "## 4. Borrow", "- [ ] Circular saw, fine blade, 40 teeth or more (step 1)", "Subtotal: $79.96.", "Total with contingency: $254.17.", "In the kit, not bought: Kit screw.");
  assert.ok(!buyMd(compute(shelf())).includes("Order by"), "no start date, no order-by date");
  assert.ok(!md.includes("Kit screw, in the anti-tip kit"), "kit rows are not on a trip");
});

test("reportText: engine, project, counts, cost and time, then the problems by level", () => {
  const r = reportText(M).split("\n");
  assert.deepEqual(r.slice(0, 6), [`jig ${ENGINE_VERSION}, guide mode`, "Project: Pine bookshelf (pine-bookshelf)", "Counts: 9 parts, 10 steps, 46 fasteners, 2 boards, 1 sheet",
    "Cost: $254.17 (subtotal $231.06, contingency $23.11), an estimate", "Time: 5 h 10 min of work and 4 h of waiting, for an experienced person",
    "Problems: 0 errors, 0 warnings, 0 STE, 1 info"]);
  includes(reportText(M), "Info (1)\n  project [estimate] I_ESTIMATE: The prices are estimates.\n    Replace them");
  const p = shelf();
  p.parts[2].size = [762, 25, 235];
  p.materials.hinge = { kind: "each", name: "Hinge", price: 2 };
  p.steps[0].do[0] = "Boards are put on the trestles.";
  p.tax = { rate: 0.2, label: "VAT" };
  const text = reportText(compute(p));
  const at = ["Errors (", "Warnings (", "STE findings (", "Info ("].map((h) => text.indexOf(`\n${h}`));
  assert.ok(at.every((x, i) => x > 0 && (i === 0 || x > at[i - 1])), "levels in order");
  includes(text, "  part B1 [parts[2].size] E_SECTION: Part B1 is 762 x 25 x 235 mm.", "\n    Make two sides of the part 235 mm and 19 mm", "  step 1, line 1 [steps[0].do[0]] STE_", ", VAT $");
  // A tax label inside the Cost line: capitalised words in lower case, words with more capitals as given.
  for (const [label, want] of [["Sales tax", "sales tax"], ["Sales Tax", "sales tax"], ["Tax", "tax"], ["VAT", "VAT"], ["MwSt", "MwSt"], ["GST/HST", "GST/HST"], ["TVA", "TVA"]]) {
    const s = shelf();
    s.tax = { rate: 0.08, label };
    includes(reportText(compute(s)), `, ${want} $`);
  }
  includes(reportText(compute(null)), "Project: (no title)", "Errors (");
});

test("cutSvg: control characters in project text never reach the XML", () => {
  const p = shelf();
  p.materials["pine-1x10"].name = "Pine board\f 19 mm";
  for (const x of p.parts.filter((q) => q.label === "A")) x.label = "A\u0001";
  const svg = cutSvg(compute(p, { mode: "estimate" }), "pine-1x10");
  assert.doesNotMatch(svg, /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/);
  includes(svg, "Cut plan: Pine board� 19 mm", ">Pine board� 19 mm: 2 boards</text>", "<title>A� (A1): 900 mm</title>");
});

test("planMd: a small step amount keeps its digits (0.004 L, not 0 L)", () => {
  const p = load("../engine/templates/starter.json");
  p.materials.glue = { kind: "amount", name: "Wood glue", unit: "L", pack: 0.25, price: 6 };
  p.steps[1].uses = { glue: 0.004 };
  includes(planMd(compute(p)), "- Uses: 0.004 L of Wood glue");
  p.steps[1].uses = { glue: 1.234 };
  includes(planMd(compute(p)), "- Uses: 1.23 L of Wood glue");
});

test("view.note: valid, linted and screened, and never in plan.md or the no-script copy (no picture there)", () => {
  const cube = load("../examples/plywood-storage-cube/project.json"), X = compute(cube);
  assert.ok(X.steps.some((s) => s.view?.note), "the cube carries view notes");
  for (const lv of ["new", "some", "pro"]) assert.doesNotMatch(planMd(X, { level: lv }), /picture/i, `plan.md at ${lv}`);
  assert.doesNotMatch(noscriptHtml(X), /picture/i);
  const p = shelf();
  p.steps[2].view = { note: "Turning the shelf, the picture shows it upright." };
  const bad = compute(p).problems.filter((x) => x.path === "steps[2].view.note");
  assert.ok(bad.some((x) => x.level === "ste"), JSON.stringify(bad));
  p.steps[2].view = { note: "x".repeat(121) };
  assert.ok(compute(p).problems.some((x) => x.code === "E_SCHEMA" && x.path === "steps[2].view.note"));
  p.steps[2].view = { note: "The picture shows the gas pipe behind the wall." };
  assert.ok(compute(p).problems.some((x) => x.code === "E_HANDOFF" && x.path === "steps[2].view.note"));
});

test("an each item with no pack reads as a count: Buy '5', '5 × Hook', not '5 × piece'", () => {
  const p = shelf();
  p.materials.hook = { kind: "each", name: "Hook", price: 3 };
  p.uses = { hook: 5 };
  const X = compute(p), row = X.boq.find((r) => r.id === "hook");
  assert.equal(row.unit, "piece", "the model keeps the unit");
  includes(boqMd(X), `| ${row.code} | Hook | 5 pieces | 5 | $3.00 est | $15.00 |`);
  includes(buyMd(X), "- [ ] 5 × Hook (");
  includes(noscriptHtml(X), "<li>5 × Hook, $15.00</li>");
  for (const out of [boqMd(X), buyMd(X), noscriptHtml(X)]) assert.ok(!out.includes("× piece"), out);
  includes(buyMd(X), "- [ ] 1 × pack of 5: Sandpaper, 120 grit");
});

test("planMd: a step's use of an item counted by the piece reads as a count, as the page pill: '5 × Hook'", () => {
  const p = shelf();
  p.materials.hook = { kind: "each", name: "Hook", price: 3 };
  p.materials.peg = { kind: "each", name: "Peg", unit: "each", spec: "oak", price: 1 };
  p.steps[2].uses = { ...(p.steps[2].uses ?? {}), hook: 5, peg: 2 };
  const md = planMd(compute(p));
  includes(md, "5 × Hook", "2 × Peg (oak)");
  assert.doesNotMatch(md, /pieces? of Hook|each(es)? of Peg/);
  // A unit that is not a piece keeps its words.
  includes(planMd(M), "2 sheets of Sandpaper (120 grit)");
});

test("planMd: a step that teaches find-stud and gives the same cable WARNING shows it once", () => {
  const p = shelf();
  const s = p.steps.find((x) => (x.teach ?? []).includes("find-stud"));
  assert.ok(s, "the bookshelf teaches find-stud");
  s.warn = [...(s.warn ?? []), { type: "warning", text: "Do not drill above, below or beside a socket or a switch. Cables run there." }];
  const md = planMd(compute(p));
  assert.equal(md.split("Do not drill above, below or beside a socket or a switch.").length - 1, 1, md);
});

test("noscriptHtml: plain HTML of the plan, shopping list and steps, every value escaped", () => {
  const h = noscriptHtml(M);
  // The times at the project level (new), as the page opens: 1.5 x the experienced time.
  includes(h, `Time: ${fmtDuration(timeFor(M.plan.active, "new"))} of work`, "<p>Level: First time.</p>");
  includes(h, "<h1>Pine bookshelf</h1>", "<h2>Plan</h2>", "<li>Prepare: steps 1, 2, 3, 3 h</li>", "<h2>Shopping list</h2>", "<h3>1. Online order</h3>",
    "<li>2 × board: Pine board, 19 × 235 mm (1×10), 2440 mm long, $55.96</li>", "<h2>Steps</h2>", "<li><h3>Cut the parts</h3>",
    "<li>Measure each length two times before you cut. (first time)</li>", "<p><strong>Check:</strong> Make sure that you have two parts A");
  const step1 = h.slice(h.indexOf("<li><h3>Cut the parts</h3>"));
  // The step's first WARNING (from the cut-straight card) comes before its first instruction. Both must be there.
  const warnAt = step1.indexOf("<p><strong>WARNING:</strong> Wear safety glasses. The saw can throw chips into your eyes.</p>"), doAt = step1.indexOf("<ol><li>Put the boards");
  assert.ok(warnAt >= 0 && doAt >= 0, "step 1 has the glasses WARNING and the first instruction");
  assert.ok(warnAt < doAt, "warnings first");
  assert.ok(!/<(script|style|noscript|img)/i.test(h));
  const p = shelf();
  p.title = 'Shelf <script>alert("x")</script>';
  p.steps[0].do[0] = "Put <b>boards</b> & 'trestles' down.";
  p.materials.glue.name = "<img src=x onerror=alert(1)>";
  p.stores.online.note = "<iframe>";
  const odd = noscriptHtml(compute(p));
  assert.ok(!/<(script|img|iframe|b>)/i.test(odd), "no markup from the project");
  includes(odd, "<h1>Shelf &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</h1>", "<li>Put &lt;b&gt;boards&lt;/b&gt; &amp; &#39;trestles&#39; down.</li>", "&lt;img src=x onerror=alert(1)&gt;", "<p>&lt;iframe&gt;</p>");
});

test("Markdown escapes: a backslash cannot undo the \\< escape, and no link or image can start", () => {
  const p = shelf();
  p.title = "x \\<img src=x onerror=alert(1)>";
  p.summary = "[a](javascript:alert(1)) ![t](https://e.x/p.png)";
  p.materials.glue.name = "Glue \\<b>bold\\</b> [x](javascript:1)";
  p.stores.online.note = "Bring a bag. \\<img src=x> [Get a coupon](javascript:alert(1))";
  const X = compute(p);
  for (const [name, md] of [["plan", planMd(X)], ["boq", boqMd(X)], ["buy", buyMd(X)], ["cut", cutMd(X)]]) {
    assert.doesNotMatch(md, /(^|[^\\])(\\\\)*</m, `${name}: a "<" that starts raw HTML`);
    assert.doesNotMatch(md, /(^|[^\\])(\\\\)*\[[^\]\n]*\]\(/m, `${name}: a link or an image`);
  }
  includes(planMd(X), "# x \\\\\\<img src=x onerror=alert(1)>", "\\[a](javascript:alert(1)) !\\[t](https://e.x/p.png)");
});

test("Markdown and the report carry no control characters from project text", () => {
  const p = shelf();
  p.title = "Shelf\u001b]0;OWNED\u0007\u001b[2J";
  p.materials.glue.name = "Glue\rCheck passed. 0 errors\u009b31m";
  const X = compute(p), bad = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/;
  for (const out of [planMd(X), boqMd(X), buyMd(X), cutMd(X)]) assert.doesNotMatch(out, bad);
  assert.doesNotMatch(boqCsv(X).replace(/\r\n/g, ""), bad);
});

test("boqCsv: a formula start after a ';' gets a ' too", () => {
  const p = shelf();
  p.materials.glue.note = "a;=1+1";
  p.materials.glue.name = "b; +SUM(1)";
  p.materials["sand-120"].name = "Sandpaper;=cmd|' /C calc'!A0";
  for (const row of parseCsv(boqCsv(compute(p)))) for (const cell of row) {
    const pieces = cell.split(";").slice(1);
    assert.ok(!pieces.some((x) => /^\s*[=+\-@]/.test(x)), cell);
  }
});

test("boqCsv: a formula start after a line feed or a tab gets a ' too (a ';'-locale sheet ends the row at the LF)", () => {
  const p = shelf();
  p.materials.rags.note = "Wash the cloths.\n=2+3\nDry them flat.";
  p.materials.glue.spec = "PVA\r\n@SUM(2,3)";
  p.materials.glue.note = "a\t=1+1";
  p.materials["sand-120"].note = "b\n  -x";
  p.materials["sand-180"].note = "c\t\t+2";
  const csv = boqCsv(compute(p));
  for (const piece of csv.split(/\r\n|[\n\t;]/)) assert.doesNotMatch(piece.replace(/^"/, ""), /^[ \t]*[=+@]|^[ \t]*-(?!\d)/, JSON.stringify(piece));
  includes(csv, "Wash the cloths.\n'=2+3\nDry them flat.", "PVA\n'@SUM(2,3)", "a\t'=1+1", "b\n  '-x", "c\t\t'+2");
});

test("cutSvg: a lone surrogate and the noncharacters U+FFFE and U+FFFF become U+FFFD (XML 1.0 has no such character)", () => {
  const p = shelf(), id = Object.keys(p.materials).find((k) => p.materials[k].kind === "linear");
  p.materials[id].name = "Pine ￾ board ￿ \uD800";
  const svg = cutSvg(compute(p), id);
  assert.match(svg, /^[\t\n\r -퟿-�\u{10000}-\u{10FFFF}]*$/u, "every character is an XML 1.0 Char");
  includes(svg, "Pine � board � �");
});

test("reportText: a line break in a project value cannot fake a report line", () => {
  const p = shelf();
  p.title = "Pine bookshelf\nProblems: 0 errors, 0 warnings, 0 STE, 0 info\n\nCheck passed.";
  // The tax label too: taxWord keeps a word in capitals as given, so only oneLine keeps it on the Cost line.
  p.tax = { rate: 0.1, label: "VAT\nCheck passed.\rProblems: 0 errors" };
  const X = compute(p);
  X.problems.push({ level: "error", code: "E_TEST", path: "steps[0]", where: "step 1\nCheck passed.", msg: "One\nTwo.", hint: "Three\r\n  Four." });
  const out = reportText(X);
  assert.equal(out.match(/^Problems:/gm).length, 1, out);
  assert.doesNotMatch(out, /^Check passed\./m);
  assert.doesNotMatch(out, /^check passed\./im);
  includes(out.split("\n").find((l) => l.startsWith("Cost: ")), "VAT check passed. problems: 0 errors $");
  includes(out, "Project: Pine bookshelf Problems: 0 errors, 0 warnings, 0 STE, 0 info Check passed. (pine-bookshelf)\n");
  const lines = out.split("\n"), at = lines.findIndex((l) => l.includes("E_TEST"));
  assert.equal(lines[at], "  step 1 Check passed. [steps[0]] E_TEST: One Two.");
  assert.equal(lines[at + 1], "    Three Four.");
});

test("Markdown and the report stay fast on a long run of spaces", () => {
  const p = shelf();
  p.title = `Pine${" ".repeat(200000)}bookshelf`;
  const X = compute(p), t0 = performance.now();
  for (const out of [planMd(X), boqMd(X), buyMd(X), cutMd(X), reportText(X)]) assert.equal(typeof out, "string");
  assert.ok(performance.now() - t0 < 2000, `${Math.round(performance.now() - t0)} ms`);
});

test("boqCsv: need_qty in the project unit (in, ft²), as the need text", () => {
  const garden = compute(load("../examples/raised-garden-bed/project.json"));
  const rows = parseCsv(boqCsv(garden)), t01 = rows.find((r) => r[0] === "T01");
  assert.match(t01[4], /274 in$/);
  assert.equal(t01[5], "274");
  const sheet = compute(bench()).boq.find((r) => compute(bench()).materials[r.id]?.kind === "sheet");
  const row = parseCsv(boqCsv(compute(bench()))).find((r) => r[0] === sheet.code), area = Number(/([\d.]+) ft²/.exec(row[4])[1]);
  assert.ok(Math.abs(Number(row[5]) - area) < 0.005, `${row[5]} vs ${row[4]}`);
  const ply = { id: "p", title: "P", units: "in", materials: { s: { kind: "sheet", name: "Plywood", thick: 0.75, stock: [{ w: 48, h: 96, price: 52.98 }] } },
    parts: [{ id: "A", name: "Panel", material: "s", size: [24, 0.75, 48] }] };
  assert.equal(parseCsv(boqCsv(compute(ply, { mode: "estimate" }))).find((r) => r[0] === "T01")[5], "8", "a 2 x 4 ft piece is 8 ft²");
  assert.equal(parseCsv(boqCsv(M)).find((r) => r[0] === "T01")[5], "4848", "mm projects stay in mm");
});

test("buyMd and noscriptHtml: a rented tool reads as its BOQ need", () => {
  const p = shelf();
  p.tools.push({ id: "tile", name: "Tile saw", get: "rent", qty: 2, days: 2.5, price: 39.99 });
  p.steps[0].tools.push("tile");
  const X = compute(p);
  for (const out of [buyMd(X), noscriptHtml(X)]) {
    includes(out, "Tile saw: rent 2 for 2.5 days");
    assert.ok(!out.includes("5 × day"));
  }
});

test("cutMd: the total of each material is its BOQ amount; the kerf shows to 1/64 in or in decimals", () => {
  const p = (extra, material, parts) => ({ id: "t", title: "T", ...extra, materials: { b: { kind: "linear", name: "Board", section: [89, 19], ...material } },
    parts: parts.map((L, i) => ({ id: `P${i + 1}`, name: "Part", material: "b", size: [L, 89, 19] })) });
  const usd = compute(p({}, { stock: [{ length: 2400, price: 12.345 }] }, [2000, 2000, 2000]), { mode: "estimate" });
  includes(cutMd(usd), `3 boards, ${fmtMoney(usd.boq[0].amount, "USD")}.`);
  includes(boqMd(usd), `| ${fmtMoney(usd.boq[0].amount, "USD")} |`, "| $12.345 est |");
  const yen = compute(p({ currency: "JPY" }, { perLength: { price: 1000, per: 3000, max: 3000, step: 1000 } }, [900, 900, 900]), { mode: "estimate" });
  includes(cutMd(yen), "3 boards, ¥999.");
  assert.equal(yen.totals.subtotal, 999);
  const fine = compute(p({ units: "in", kerf: 0.09375 }, { section: [3.5, 0.75], stock: [{ length: 96, price: 5 }] }, [24, 24]), { mode: "estimate" });
  includes(cutMd(fine), "Kerf: 3/32 in.");
  includes(cutMd(compute(p({ units: "in", kerf: 0.02 }, { section: [3.5, 0.75], stock: [{ length: 96, price: 5 }] }, [24]), { mode: "estimate" })), "Kerf: 0.02 in.");
});

test("boqMd: a rate below the minor unit shows as given; the amount is qty x price", () => {
  const p = shelf();
  p.materials.nail = { kind: "each", name: "Nail", pack: 1, unit: "nail", price: 0.045, spare: 0 };
  p.uses = { nail: 200 };
  const X = compute(p), row = X.boq.find((r) => r.id === "nail");
  assert.deepEqual([row.rate, row.amount], [0.045, 9]);
  includes(boqMd(X), "| 200 nails | 200 × nail | $0.045 est | $9.00 |");
});

test("a step that teaches two drill cards shows their shared WARNING once", () => {
  const p = shelf();
  const s = p.steps.find((x) => (x.teach ?? []).includes("pilot-hole") && (x.teach ?? []).includes("countersink"));
  assert.ok(s, "a bookshelf step teaches pilot-hole and countersink");
  s.warn = [];
  const md = planMd(compute(p)), i = p.steps.indexOf(s), part = md.split(/\n### \d+\. /)[i + 1];
  assert.equal(part.match(/Wear safety glasses/g).length, 1, part);
});

test("every output works on a fatal model, an estimate without steps, and odd projects", () => {
  const plain = shelf();
  delete plain.steps;
  const models = [compute(null), compute({ id: "x", title: "X", materials: {}, parts: [] }), compute(plain, { mode: "estimate" }), compute(bench(), { mode: "plan" })];
  const p = shelf();
  p.level = "pro";
  p.steps[1].do = [];
  delete p.steps[2].check;
  p.steps[3].fasteners.push({ material: "screw-4x50", count: 4 });
  models.push(compute(p));
  for (const X of models) {
    for (const out of [planMd(X), planMd(X, { level: "new" }), boqMd(X), boqCsv(X), cutMd(X), buyMd(X), reportText(X), noscriptHtml(X)]) assert.equal(typeof out, "string");
    for (const c of X.cuts) assert.match(cutSvg(X, c.material), /^<svg /);
  }
  includes(planMd(models[2]), "### Materials");
  assert.ok(!planMd(models[2]).includes("## Steps"));
  includes(boqMd(models[0]), "Nothing to buy.");
  includes(planMd(models[4]), "- Fasteners: 7 × Wood screw (4 × 50 mm, countersunk)");
});
