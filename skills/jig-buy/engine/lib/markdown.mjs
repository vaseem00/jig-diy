// Text outputs of a computed model: the plan, the BOQ (Markdown and CSV), the cut list (Markdown and to-scale SVG),
// the shopping list, the CLI report and the <noscript> HTML. Pure: a model in, a string out. Lengths show in the
// project units. Markdown has no HTML; noscriptHtml escapes every project value.

import { fmtLen, fmtArea, fmtMoney, fmtRate, fmtDuration, fromMM } from "./locale.mjs";
import { amount, esc, plural, groupBy, round, term, oneLine } from "./util.mjs";
import { bounds } from "./geometry.mjs";
import { timeFor } from "./plan.mjs";
import { TOOL_KEY } from "./boq.mjs";
import { ANY_STORE, BORROW } from "./purchase.mjs";

const LEVELS = { new: "First time", some: "Some experience", pro: "Experienced" };
const FT2 = 0.09290304; // m² in one square foot
// Markdown text on one line, with no control characters. A backslash, "<" and "[" get a backslash, so project text
// cannot start raw HTML, a link or an image (a "\" before "<" cannot undo the escape).
const t = (s) => term(oneLine(s)).replace(/\\/g, "\\\\").replace(/</g, "\\<").replace(/\[/g, "\\[");
const cell = (s) => t(s).replace(/\|/g, "\\|");
const line = (d) => (typeof d === "string" ? d : d?.t ?? "");
const money = (M, n) => fmtMoney(n, M.meta.currency);
const dims = (list, u) => `${list.map((v) => fmtLen(v, u).replace(/ (mm|in)$/, "")).join(" × ")} ${u}`;
const isTool = (r) => r.key.startsWith(TOOL_KEY);
const levelOf = (M, level) => (Object.hasOwn(LEVELS, level ?? "") ? level : Object.hasOwn(LEVELS, M.meta.level ?? "") ? M.meta.level : "some");
const and = (list) => (list.length > 1 ? `${list.slice(0, -1).join(", ")} and ${list.at(-1)}` : list[0] ?? "");
const est = (M) => M.boq.some((r) => r.est);

// Size, time and cost of the object at a reader level. Wall fixings (role anchor) are not part of the size.
function facts(M, level) {
  const placed = M.parts.filter((p) => p.at), body = placed.filter((p) => p.role !== "anchor");
  const u = M.meta.units, b = bounds(body.length ? body : placed), T = M.totals;
  return [
    b && `Size: ${dims(b.size, u)} (width × height × depth)`,
    `Time: ${fmtDuration(timeFor(M.plan.active, level))} of work${M.plan.wait ? ` and ${fmtDuration(M.plan.wait)} of waiting` : ""}`,
    `Cost: ${money(M, T.total)}${est(M) ? ", an estimate" : ""}${T.unknownPrices ? ` (${plural(T.unknownPrices, "price")} unknown)` : ""}`,
  ].filter(Boolean);
}

// The WARNING and CAUTION blocks of a step: its own, then those of the cards it teaches (every level sees them).
function warningsOf(M, s) {
  const seen = new Set();
  return [...(s.warn ?? []), ...(s.teach ?? []).flatMap((id) => M.techniques[id]?.warn ?? [])]
    .filter((w) => !seen.has(w.type + w.text) && seen.add(w.type + w.text));
}

// What a step installs and uses: "1 × A Side", "3 × Wood screw (4 × 50 mm)", "5 ml of Wood glue", and a use of an item
// counted by the piece as a count, like the page: "5 × Hook", not "5 pieces of Hook".
function stepFacts(M, s, i) {
  const mat = (id) => (Object.hasOwn(M.materials, id) ? M.materials[id] : { name: id, spec: "", unit: "" });
  const parts = groupBy(M.parts.filter((p) => p.step === i), "label").map(([label, list]) => `${list.length} × ${label} ${list[0].name}`);
  const fasteners = groupBy(s.fasteners, "material").map(([id, list]) => {
    const m = mat(id);
    return `${list.reduce((a, f) => a + (f.count ?? 1), 0)} × ${m.name}${m.spec ? ` (${m.spec})` : ""}`;
  });
  const uses = Object.entries(s.uses ?? {}).map(([id, q]) => {
    const m = mat(id), spec = m.spec ? ` (${m.spec})` : "";
    return !m.unit || single(m) ? `${amount(q)} × ${m.name}${spec}` : `${plural(amount(q), m.unit)} of ${m.name}${spec}`;
  });
  return { parts, fasteners, uses, finish: s.finish ? `${mat(s.finish.material).name}${s.finish.coats ? `, ${plural(s.finish.coats, "coat")}` : ""}` : null };
}

const toolStatus = (x) => (x.have ? "you have it" : x.get === "borrow" ? "borrow" : x.get === "rent" ? `rent for ${plural(x.days ?? 1, "day")}` : "buy");
const toolLine = (x) => `${x.name}${x.spec ? `, ${x.spec}` : ""}${x.qty > 1 ? ` × ${x.qty}` : ""} (${toolStatus(x)})`;
// A row bought by the piece ("each", or the default unit "piece") shows a plain count: "5 × Double coat hook", not
// "5 × piece: Double coat hook".
const single = (r) => r.unit === "each" || r.unit === "piece";
const matLine = (r) => (r.get === "rent" ? `${r.name}${r.spec ? `, ${r.spec}` : ""}: ${r.need}`
  : `${r.get === "kit" ? "" : single(r) ? `${r.qty} × ` : `${r.qty} × ${r.unit}: `}${r.name}${r.spec ? `, ${r.spec}` : ""}${r.get === "kit" ? ": in the kit" : ""}`);

// planMd(model, { level }) -> the printable plan. level: new | some | pro (default: the project level).
export function planMd(M, { level } = {}) {
  const lv = levelOf(M, level), L = [`# ${t(M.meta.title)}`, ""];
  if (M.meta.summary) L.push(t(M.meta.summary), "");
  L.push(`${facts(M, lv).map(t).join(" · ")}.`, "", `Level: ${LEVELS[lv]}.`, "");
  if (M.safety.handoffs.length)
    L.push("## Hand-offs", "", "This guide does not do this work. A professional does it:", "", ...M.safety.handoffs.map((h) => `- **${t(h.name ?? h.topic)}**: ${t(h.text)}`), "");
  L.push("## Tools and materials", "");
  const ppe = M.tools.filter((x) => x.ppe), other = M.tools.filter((x) => !x.ppe), mats = M.boq.filter((r) => !isTool(r));
  if (ppe.length) L.push("### Safety gear", "", ...ppe.map((x) => `- ${t(toolLine(x))}`), "");
  if (other.length) L.push("### Tools", "", ...other.map((x) => `- ${t(toolLine(x))}`), "");
  if (mats.length) L.push("### Materials", "", ...mats.map((r) => `- ${t(matLine(r))}`), "");
  if (M.steps.length) L.push("## Steps", "");
  const taughtAt = new Map();
  M.steps.forEach((s, i) => {
    const f = stepFacts(M, s, i), tools = (s.tools ?? []).map((id) => M.tools.find((x) => x.id === id)?.name ?? id);
    L.push(`### ${i + 1}. ${t(s.title)}`, "");
    L.push(...[
      `Phase: ${s.phase ?? "Build"}`, `Time: ${fmtDuration(timeFor(s.minutes, lv))}${s.wait ? `, then wait ${fmtDuration(s.wait)}` : ""}`,
      f.parts.length && `Parts: ${f.parts.join(", ")}`, f.fasteners.length && `Fasteners: ${f.fasteners.join(", ")}`,
      f.uses.length && `Uses: ${f.uses.join(", ")}`, f.finish && `Finish: ${f.finish}`, tools.length && `Tools: ${tools.join(", ")}`,
    ].filter(Boolean).map((x) => `- ${t(x)}`), "");
    for (const w of warningsOf(M, s)) L.push(`> **${w.type === "caution" ? "CAUTION" : "WARNING"}:** ${t(w.text)}`, "");
    const lines = (s.do ?? []).filter((d) => typeof d === "string" || !d.new || lv === "new").map(line);
    if (lines.length) L.push(...lines.map((d, k) => `${k + 1}. ${t(d)}`), "");
    const cards = (s.teach ?? []).filter((id) => M.techniques[id]);
    if (lv === "new") for (const id of cards) {
      const c = M.techniques[id];
      if (taughtAt.has(id)) { L.push(`Technique: ${t(c.name)} (see step ${taughtAt.get(id) + 1}).`, ""); continue; }
      taughtAt.set(id, i);
      L.push(`**Technique: ${t(c.name)}**`, "", ...c.do.map((d, k) => `${k + 1}. ${t(d)}`), "");
      if (c.why) L.push(`Why: ${t(c.why)}`, "");
    }
    else if (cards.length) L.push(`Techniques: ${t(cards.map((id) => M.techniques[id].name).join(", "))}.`, "");
    if (s.check) L.push(`**Check:** ${t(s.check)}`, "");
    if (s.why && lv === "new") L.push(`**Why:** ${t(s.why)}`, "");
    if (s.tip && lv !== "pro") L.push(`**Tip:** ${t(s.tip)}`, "");
  });
  return `${L.join("\n").trimEnd()}\n`;
}

// Totals lines: [label, amount text].
function totalLines(M) {
  const T = M.totals, rate = (r) => `${round(r * 100, 2)}%`, out = [["Subtotal", money(M, T.subtotal)], [`Contingency (${rate(T.contingencyRate)})`, money(M, T.contingency)]];
  if (T.taxRate) out.push(T.taxIncluded ? [`${T.taxLabel} (${rate(T.taxRate)}, included in the prices)`, `includes ${money(M, T.tax)}`] : [`${T.taxLabel} (${rate(T.taxRate)})`, money(M, T.tax)]);
  out.push(["Total", money(M, T.total)]);
  return out;
}
const priceLine = (M) => [`Prices in ${M.meta.currency}${M.meta.pricesAsOf ? `, as of ${M.meta.pricesAsOf}` : ""}.`, M.meta.priceNote, est(M) && "A rate marked est is an estimate."].filter(Boolean).join(" ");
const buyCell = (r) => (r.get === "kit" ? "in the kit" : r.get === "borrow" ? "borrow" : single(r) ? String(r.qty) : `${r.qty} × ${cell(r.unit)}`);

// boqMd(model) -> the bill of quantities as a Markdown table, with totals and notes.
export function boqMd(M) {
  const L = [`# Bill of quantities: ${t(M.meta.title)}`, "", t(priceLine(M)), "", "| Code | Item | Need | Buy | Rate | Amount |", "|---|---|---|---|---|---|"];
  let group = null;
  for (const r of M.boq) {
    if (r.group !== group) L.push(`| **${cell((group = r.group))}** | | | | | |`);
    const rate = r.get === "kit" || r.get === "borrow" ? "-" : `${fmtRate(r.rate, M.meta.currency)}${r.est ? " est" : ""}`;
    L.push(`| ${r.code} | ${cell(r.name)}${r.spec ? `, ${cell(r.spec)}` : ""} | ${cell(r.need)} | ${buyCell(r)} | ${rate} | ${money(M, r.amount)} |`);
  }
  for (const [label, v] of totalLines(M)) L.push(label === "Subtotal" || label === "Total" ? `| | **${label}** | | | | **${v}** |` : `| | ${cell(label)} | | | | ${v} |`);
  L.push("");
  if (!M.boq.length) L.push("Nothing to buy.", "");
  if (M.totals.unknownPrices) L.push(`${plural(M.totals.unknownPrices, "row")} ${M.totals.unknownPrices === 1 ? "has" : "have"} no price (price?). The total does not include ${M.totals.unknownPrices === 1 ? "it" : "them"}.`, "");
  if (M.totals.area > 0) L.push(`Finished area: ${M.totals.areaDisplay}. It counts every face of each finished part, so it is an upper bound.`, "");
  const notes = M.boq.filter((r) => r.note);
  if (notes.length) L.push("Notes:", "", ...notes.map((r) => `- ${r.code}: ${t(r.note)}`), "");
  return `${L.join("\n").trimEnd()}\n`;
}

// One RFC 4180 field: quoted when it holds a comma, a quote or a line break. A text field that starts with = + - @
// gets a leading ' so that a spreadsheet does not run it as a formula; so does a formula start after a ";" (the
// field separator of a spreadsheet in many locales), a line feed (a ";"-locale spreadsheet does not see the comma
// quotes, so it ends the row there) or a tab (a paste splits the cell there). The ' goes right before the = + - or @.
function csvField(v, text = true) {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (text) s = term(s.replace(/\r\n?/g, "\n")); // line breaks as LF; no other control character reaches a terminal
  if (text && /^[=+\-@\t\r\n]/.test(s)) s = `'${s}`;
  if (text) s = s.replace(/([;\n\t][ \t]*)(?=[=+\-@])/g, "$1'");
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// need_qty in the project unit: cut length in mm or in (boards), area in m² or ft² (sheets); other rows as they are.
// Boards and sheets add up their cuts again (the row keeps only a rounded mm or m² value).
function needQtyOf(M, r) {
  if (r.needQty === null || r.needQty === undefined || r.key.startsWith(TOOL_KEY)) return r.needQty;
  const kind = Object.hasOwn(M.materials, r.id) ? M.materials[r.id].kind : null, u = M.meta.units;
  if (kind !== "linear" && kind !== "sheet") return r.needQty;
  const plan = M.cuts.find((c) => c.material === r.id), size = r.key.slice(r.id.length + 1);
  if (kind === "linear") {
    const boards = (plan?.boards ?? []).filter((b) => String(b.stock.length) === size);
    return boards.length ? round(fromMM(boards.flatMap((b) => b.cuts).reduce((a, c) => a + c.len, 0), u), 3) : round(fromMM(r.needQty, u), 3);
  }
  if (u !== "in") return r.needQty;
  const sheets = (plan?.sheets ?? []).filter((s) => `${s.stock.w}x${s.stock.h}` === size);
  return round((sheets.length ? sheets.flatMap((s) => s.cuts).reduce((a, c) => a + c.w * c.h, 0) / 1e6 : r.needQty) / FT2, 3);
}

// boqCsv(model) -> CSV with a header row, one row per BOQ row, then the totals. Lines end with CRLF.
export function boqCsv(M) {
  const store = new Map(M.purchase.filter((p) => p.store !== ANY_STORE && p.store !== BORROW).map((p) => [p.store, p.name]));
  const head = ["code", "group", "item", "spec", "need", "need_qty", "qty", "unit", "rate", "amount", "currency", "est", "get", "store", "first_step", "note"];
  const rows = M.boq.map((r) => [
    csvField(r.code), csvField(r.group), csvField(r.name), csvField(r.spec), csvField(r.need), csvField(needQtyOf(M, r), false), csvField(r.qty, false), csvField(r.unit),
    csvField(r.rate, false), csvField(r.amount, false), M.meta.currency, String(r.est), r.get, csvField(r.store ? store.get(r.store) ?? r.store : ""),
    M.steps.length ? String(r.first + 1) : "", csvField(r.note),
  ]);
  const T = M.totals, tax = T.taxRate ? [[T.taxIncluded ? `${T.taxLabel} (included)` : T.taxLabel, T.tax]] : [];
  for (const [label, v] of [["Subtotal", T.subtotal], ["Contingency", T.contingency], ...tax, ["Total", T.total]])
    rows.push(["", "Totals", csvField(label), "", "", "", "", "", "", csvField(v, false), M.meta.currency, "", "", "", "", ""]);
  return `${[head, ...rows].map((r) => r.join(",")).join("\r\n")}\r\n`;
}

// The "Plan:" line of a board material: proven lowest cost; or not proven, because the exact search stopped at its
// limit, or because the material has more than 14 pieces and a fast search made the plan.
const planLine = (c) => (c.optimal ? "Plan: proven lowest cost."
  : `Plan: the best plan found, not proven lowest cost. ${c.search === "fast" ? "The material has more than 14 pieces, so a fast search made the plan." : "The search stopped early."}`);

// The heading of a cut material. Two materials with one name ("Birch plywood", 18 mm and 6 mm) add the material spec,
// as the page does. The BOQ row spec also carries the stock size, so it is not used here.
const cutName = (M, c) => {
  const spec = M.cuts.filter((x) => x.name === c.name).length > 1 && Object.hasOwn(M.materials, c.material) ? M.materials[c.material].spec : "";
  return spec ? `${c.name}, ${spec}` : c.name;
};

// cutMd(model) -> the parts list, then each board and sheet with its cuts and waste.
export function cutMd(M) {
  const u = M.meta.units, fine = { den: 64 };
  const L = [`# Cut list: ${t(M.meta.title)}`, "", `Kerf: ${fmtLen(M.meta.kerf, u, fine)}. Each saw cut removes this much, and the plan includes it.${M.meta.trim ? ` Trim: ${fmtLen(M.meta.trim, u, fine)} from the start of each board.` : ""}`, ""];
  // The cost of a material is the sum of its BOQ rows, so the cut list and the BOQ always agree.
  const costOf = (c) => {
    const rows = M.boq.filter((r) => r.key.startsWith(`${c.material}:`));
    return rows.some((r) => r.amount === null) ? null : round(rows.reduce((a, r) => a + r.amount, 0), 6);
  };
  const size = (p) => (!p.cut ? (p.kind === "each" ? "not cut" : "size?") : p.cut.length !== undefined ? dims([p.cut.length, p.cut.width, p.cut.thick], u) : dims([p.cut.a, p.cut.b, p.cut.thick], u));
  if (M.parts.length) {
    L.push("## Parts", "", "| Part | Name | Qty | Cut size | Material |", "|---|---|---|---|---|");
    for (const [label, list] of groupBy(M.parts, "label")) L.push(`| ${cell(label)} | ${cell(list[0].name)} | ${list.length} | ${size(list[0])} | ${cell(list[0].materialName)} |`);
    L.push("");
  }
  for (const c of M.cuts) {
    const list = c.kind === "linear" ? c.boards : c.sheets;
    L.push(`## ${t(cutName(M, c))}`, "", `${plural(list.length, c.kind === "linear" ? "board" : "sheet")}, ${money(M, costOf(c))}.`, "");
    if (c.kind === "linear" && typeof c.optimal === "boolean") L.push(planLine(c), "");
    list.forEach((b, i) => {
      if (c.kind === "linear") {
        L.push(`### Board ${i + 1} of ${list.length}: ${fmtLen(b.stock.length, u)}, ${money(M, b.stock.price)}`, "", "| Cut | Part | Length | Starts at |", "|---|---|---|---|");
        b.cuts.forEach((x, k) => L.push(`| ${k + 1} | ${cell(x.label)} (${cell(x.id)}) | ${fmtLen(x.len, u)} | ${fmtLen(x.at, u)} |`));
        L.push("", `Waste: ${fmtLen(b.waste, u)}.`, "");
      } else {
        L.push(`### Sheet ${i + 1} of ${list.length}: ${dims([b.stock.w, b.stock.h], u)}, ${money(M, b.stock.price)}`, "", "| Cut | Part | Size | At (x, y) | Turned 90° |", "|---|---|---|---|---|");
        b.cuts.forEach((x, k) => L.push(`| ${k + 1} | ${cell(x.label)} (${cell(x.id)}) | ${dims([x.w, x.h], u)} | ${fmtLen(x.x, u)}, ${fmtLen(x.y, u)} | ${x.rotated ? "yes" : "no"} |`));
        L.push("", `Waste: ${fmtArea(b.waste, u)}.`, "");
      }
    });
  }
  if (!M.cuts.length) L.push("Nothing to cut.", "");
  return `${L.join("\n").trimEnd()}\n`;
}

// A light tint of a material colour (mixed with white), so dark text stays readable on it.
function tint(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex ?? "") ?? [null, "d9b88a"], v = parseInt(m[1], 16);
  return `#${[16, 8, 0].map((s) => Math.round(((v >> s) & 255) * 0.45 + 255 * 0.55).toString(16).padStart(2, "0")).join("")}`;
}

// cutSvg(model, materialId) -> a standalone, to-scale SVG of the boards or sheets of one material, or null.
export function cutSvg(M, material) {
  const c = M.cuts.find((x) => x.material === material);
  if (!c) return null;
  // Every text goes through term(): XML 1.0 has no C0 control characters, and one stray form feed stops the drawing.
  // Nor does XML 1.0 allow a lone surrogate or the noncharacters U+FFFE and U+FFFF: each becomes U+FFFD.
  const u = M.meta.units, W = 960, X = 20, n = (v) => round(v, 2), fill = tint(c.color), id = `jig-${String(material).replace(/[^A-Za-z0-9_-]/g, "_")}`;
  const xml = (s) => esc(term(s).toWellFormed().replace(/[￾￿]/g, "�"));
  const text = (x, y, s, size, weight = 400, anchor = "start") =>
    `<text x="${n(x)}" y="${n(y)}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" fill="#1f1f1f">${xml(s)}</text>`;
  const linear = c.kind === "linear", list = linear ? c.boards : c.sheets, body = [], name = cutName(M, c);
  let y = 20;
  body.push(text(X, y + 16, `${name}: ${plural(list.length, linear ? "board" : "sheet")}`, 18, 600));
  y += 34;
  const k = W / Math.max(1, ...list.map((b) => (linear ? b.stock.length : b.stock.w)));
  list.forEach((b, i) => {
    const bw = (linear ? b.stock.length : b.stock.w) * k, bh = linear ? 44 : b.stock.h * k;
    const head = linear ? `Board ${i + 1}: ${fmtLen(b.stock.length, u)}, waste ${fmtLen(b.waste, u)}` : `Sheet ${i + 1}: ${dims([b.stock.w, b.stock.h], u)}, waste ${fmtArea(b.waste, u)}`;
    body.push(text(X, y + 14, head, 13));
    y += 22;
    body.push(`<rect x="${X}" y="${n(y)}" width="${n(bw)}" height="${n(bh)}" fill="url(#${id}-waste)" stroke="#5c5c5c" stroke-width="1"/>`);
    for (const x of b.cuts) {
      const [cx, cy, cw, ch] = linear ? [X + x.at * k, y, x.len * k, bh] : [X + x.x * k, y + x.y * k, x.w * k, x.h * k];
      const label = linear ? fmtLen(x.len, u) : dims([x.w, x.h], u);
      body.push(`<rect x="${n(cx)}" y="${n(cy)}" width="${n(cw)}" height="${n(ch)}" fill="${fill}" stroke="#6b5636" stroke-width="1"><title>${xml(`${x.label} (${x.id}): ${label}`)}</title></rect>`);
      const ty = cy + (linear ? 20 : Math.max(20, ch / 2 - 4));
      if (cw >= 16 && ch >= 18) body.push(text(cx + cw / 2, ty, x.label, 14, 600, "middle"));
      if (cw >= 8 * label.length && ch >= 38) body.push(text(cx + cw / 2, ty + 16, label, 11, 400, "middle"));
    }
    y += bh + 18;
  });
  const H = n(y + 2), title = `Cut plan: ${name}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W + 2 * X} ${H}" width="${W + 2 * X}" height="${H}" role="img" aria-labelledby="${id}-title" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif">
<title id="${id}-title">${xml(title)}</title>
<defs><pattern id="${id}-waste" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="#f2f2f2"/><line x1="0" y1="0" x2="0" y2="8" stroke="#b8b8b8" stroke-width="3"/></pattern></defs>
<rect width="100%" height="100%" fill="#ffffff"/>
${body.join("\n")}
</svg>
`;
}

// buyMd(model) -> the shopping list: one checklist per trip, in order.
export function buyMd(M) {
  const rows = new Map(M.boq.map((r) => [r.key, r]));
  const L = [`# Shopping list: ${t(M.meta.title)}`, "", t(`Buy in this order. The step number shows when you need each item. ${priceLine(M)}`), ""];
  M.purchase.forEach((p, i) => {
    L.push(`## ${i + 1}. ${t(p.name)}`, "");
    const facts = [p.online && `Online order${p.lead ? `, delivery in ${plural(p.lead, "day")}` : ""}.`, p.orderBy && `${p.online ? "Order" : "Get these"} by ${p.orderBy}.`, p.note, p.url].filter(Boolean);
    if (facts.length) L.push(t(facts.join(" ")), "");
    for (const key of p.items) {
      const r = rows.get(key);
      if (!r) continue;
      const step = M.steps.length ? `step ${r.first + 1}` : "";
      const item = p.store === BORROW ? `${r.name}${r.spec ? `, ${r.spec}` : ""}${r.qty > 1 ? ` × ${r.qty}` : ""}` : matLine(r);
      const extra = [p.store === BORROW ? "" : `${money(M, r.amount)}${r.est ? " est" : ""}`, step].filter(Boolean).join(", ");
      L.push(`- [ ] ${t(item)}${extra ? ` (${t(extra)})` : ""}`);
    }
    L.push("", ...(p.store === BORROW ? [] : [`Subtotal: ${money(M, p.subtotal)}.`, ""]));
  });
  if (!M.purchase.length) L.push("Nothing to buy.", "");
  L.push(`Total with contingency${M.totals.taxRate ? " and tax" : ""}: ${money(M, M.totals.total)}.`, "");
  const kit = M.boq.filter((r) => r.get === "kit");
  if (kit.length) L.push(`In the kit, not bought: ${t(and(kit.map((r) => r.name)))}.`, "");
  return `${L.join("\n").trimEnd()}\n`;
}

// A tax label inside a sentence: each capitalised word in lower case ("Sales Tax" and "Sales tax" read "sales tax");
// a word with more capitals stays as given ("VAT", "GST/HST", "MwSt").
const taxWord = (s) => (s == null ? s : String(s).replace(/(?<![\p{L}\p{N}])\p{Lu}\p{Ll}+(?![\p{L}\p{N}])/gu, (w) => w.toLowerCase()));

// reportText(model) -> the human report of a check: engine, project, counts, cost, time, then the problems by level.
// Each project value stays on its line (oneLine), so a title with a line break cannot fake a report line.
export function reportText(M) {
  const c = M.counts, T = M.totals;
  const fasteners = M.steps.reduce((a, s) => a + s.fasteners.reduce((b, f) => b + (f.count ?? 1), 0), 0);
  const boards = M.cuts.reduce((a, x) => a + (x.boards?.length ?? 0), 0), sheets = M.cuts.reduce((a, x) => a + (x.sheets?.length ?? 0), 0);
  const tax = T.taxRate ? `, ${oneLine(taxWord(T.taxLabel))} ${T.taxIncluded ? "included " : ""}${money(M, T.tax)}` : "";
  const L = [
    `jig ${M.engine}, ${M.mode} mode`,
    `Project: ${oneLine(M.meta.title) || "(no title)"}${M.meta.id ? ` (${oneLine(M.meta.id)})` : ""}`,
    `Counts: ${[plural(M.parts.length, "part"), plural(M.steps.length, "step"), plural(fasteners, "fastener"), plural(boards, "board"), plural(sheets, "sheet")].join(", ")}`,
    `Cost: ${money(M, T.total)} (subtotal ${money(M, T.subtotal)}, contingency ${money(M, T.contingency)}${tax})${est(M) ? ", an estimate" : ""}${T.unknownPrices ? `, ${plural(T.unknownPrices, "price")} unknown` : ""}`,
    `Time: ${fmtDuration(M.plan.active)} of work and ${fmtDuration(M.plan.wait)} of waiting, for an experienced person`,
    `Problems: ${plural(c.error, "error")}, ${plural(c.warn, "warning")}, ${c.ste} STE, ${c.info} info`,
  ];
  for (const [level, name] of [["error", "Errors"], ["warn", "Warnings"], ["ste", "STE findings"], ["info", "Info"]]) {
    const list = M.problems.filter((p) => p.level === level);
    if (!list.length) continue;
    L.push("", `${name} (${list.length})`);
    for (const p of list) L.push(`  ${oneLine(p.where)}${p.path ? ` [${oneLine(p.path)}]` : ""} ${p.code}: ${oneLine(p.msg)}`, ...(p.hint ? [`    ${oneLine(p.hint)}`] : []));
  }
  return `${L.join("\n")}\n`;
}

// noscriptHtml(model) -> plain HTML for <noscript>: the plan, the shopping list and every step. Every value is escaped.
export function noscriptHtml(M) {
  const e = esc, rows = new Map(M.boq.map((r) => [r.key, r])), H = [], lv = levelOf(M);
  H.push(`<h1>${e(M.meta.title)}</h1>`);
  if (M.meta.summary) H.push(`<p>${e(M.meta.summary)}</p>`);
  // The times at the level the page opens at, as the page shows them; waiting times do not depend on the level.
  H.push(`<p>${e(facts(M, lv).join(". "))}.</p>`, `<p>Level: ${e(LEVELS[lv])}.</p>`, "<p>Turn on JavaScript to see the 3D view, the level switch and the tick boxes.</p>");
  H.push("<h2>Plan</h2>", `<ol>${M.plan.phases.map((p) => `<li>${e(p.name)}: steps ${p.steps.map((i) => i + 1).join(", ")}, ${e(fmtDuration(timeFor(p.minutes, lv)))}${p.wait ? ` + ${e(fmtDuration(p.wait))} wait` : ""}</li>`).join("")}</ol>`);
  if (M.safety.handoffs.length) H.push("<h3>Hand-offs</h3>", `<ul>${M.safety.handoffs.map((h) => `<li><strong>${e(h.name ?? h.topic)}</strong>: ${e(h.text)}</li>`).join("")}</ul>`);
  if (M.tools.length) H.push("<h3>Tools</h3>", `<ul>${M.tools.map((x) => `<li>${e(toolLine(x))}</li>`).join("")}</ul>`);
  H.push("<h2>Shopping list</h2>");
  M.purchase.forEach((p, i) => {
    H.push(`<h3>${i + 1}. ${e(p.name)}</h3>`);
    if (p.note) H.push(`<p>${e(p.note)}</p>`);
    H.push(`<ul>${p.items.map((k) => rows.get(k)).filter(Boolean).map((r) => `<li>${e(p.store === BORROW ? r.name : matLine(r))}${p.store === BORROW ? "" : `, ${e(money(M, r.amount))}`}</li>`).join("")}</ul>`);
  });
  H.push(`<p>Total: ${e(money(M, M.totals.total))}, with ${e(`${round(M.totals.contingencyRate * 100, 2)}%`)} contingency.</p>`);
  if (M.steps.length) {
    H.push("<h2>Steps</h2>", "<ol>");
    for (const s of M.steps) {
      const lines = (s.do ?? []).map((d) => `<li>${e(line(d))}${typeof d === "object" && d.new ? " (first time)" : ""}</li>`).join("");
      H.push(`<li><h3>${e(s.title)}</h3>`, ...warningsOf(M, s).map((w) => `<p><strong>${w.type === "caution" ? "CAUTION" : "WARNING"}:</strong> ${e(w.text)}</p>`),
        lines ? `<ol>${lines}</ol>` : "", s.check ? `<p><strong>Check:</strong> ${e(s.check)}</p>` : "", s.why ? `<p><strong>Why:</strong> ${e(s.why)}</p>` : "",
        s.tip ? `<p><strong>Tip:</strong> ${e(s.tip)}</p>` : "", "</li>");
    }
    H.push("</ol>");
  }
  return H.filter(Boolean).join("\n");
}
