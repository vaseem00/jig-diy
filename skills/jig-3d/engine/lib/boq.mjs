// Bill of quantities: one row for each board length, sheet size, pack and tool to get, with the exact need, the
// quantity to buy, rate and amount. Rows sort by group, then by the first step that needs them; codes count up
// inside each group (H01, H02), so a new timber row never renumbers the hardware. Then the totals.
// needQty is the exact need: mm of cut length (linear), m² of pieces (sheet), pieces (each), units (amount), tools.

import { amount, plural, groupBy, round, stableSort } from "./util.mjs";
import { fmtLen, fmtArea, roundMoney } from "./locale.mjs";

export const GROUPS = { "Timber and sheet": "T", Hardware: "H", Consumables: "C", Finish: "F", Safety: "S", Tools: "X" };
export const OTHER = "O"; // code letter of any other group name; those groups sort last
export const TOOL_KEY = "tool/"; // key prefix of tool rows ("/" is not allowed in ids, so keys never clash)
const NAMES = Object.keys(GROUPS), FT2 = 0.09290304;

const one = (unit) => plural(1, unit).replace(/^1 ?/, "");
const shown = (n) => round(n, n < 10 ? 2 : n < 100 ? 1 : 0);
const needN = (n) => (n > 0 && n < 0.01 ? amount(n) : shown(n)); // a need text: 0.0021 L, not 0 L
const finite = (v) => (Number.isFinite(v) ? v : null);
const pct = (r) => `${round(r * 100, 1)}%`;
const dims = (list, units) => `${list.map((v) => fmtLen(v, units).replace(/ (mm|in)$/, "")).join(" × ")} ${units}`;
const canon = (g) => NAMES.find((k) => k.toLowerCase() === g.trim().toLowerCase()) ?? g.trim(); // "hardware" -> "Hardware"
const rank = (g) => (Object.hasOwn(GROUPS, g) ? NAMES.indexOf(g) : NAMES.length);

// Default group from the kind and the use: each is Hardware as a part or fastener, else Consumables (sandpaper);
// amount is Finish when a finish uses it, else Consumables (glue).
function defaultGroup(m, n) {
  if (m.kind === "linear" || m.kind === "sheet") return "Timber and sheet";
  if (m.kind === "each") return n.part || n.fastener || m.len !== undefined || m.d !== undefined || m.head !== undefined ? "Hardware" : "Consumables";
  return n.finish?.length ? "Finish" : "Consumables";
}

// "3.98 m² × 2 coats ÷ 11 m² per L. ..." for an amount material used as a finish.
function finishNote(fin, m, units) {
  const au = units === "in" ? "ft²" : "m²", terms = fin.map((f) => `${fmtArea(f.area, units)} × ${plural(f.coats, "coat")}`).join(" + ");
  return `${terms} ÷ ${m.coverage} ${au} per ${one(m.unit)}. The area counts every face of each finished part, so it is an upper bound.`;
}

// buildBoq(ctx) -> { rows, totals }. ctx: { materials, tools, needs, cuts, area, units, currency, contingency, tax }.
// needs: { [materialId]: { first, count, amount, finish: [{ area (m²), coats }], part, fastener } } (pieces in count for
// each materials, units in amount for amount materials). tools: normalized tools with first (step index or null).
// cuts: model.cuts. area: finished area in m². tax: { rate, label, included } or null.
export function buildBoq({ materials = {}, tools = [], needs = {}, cuts = [], area = 0, units = "mm", currency = "USD", contingency = 0.1, tax = null } = {}) {
  const money = (n) => roundMoney(n, currency), rows = [];
  // rate is the price as given (a loose screw can cost 0.045). amount = qty x price, rounded to the minor unit, so a
  // price below the minor unit does not round before it is multiplied. amount is null when the rate is unknown, or
  // when absurd input makes it overflow (validate reports the input).
  const priced = (price, qty) => {
    const rate = typeof price === "number" && Number.isFinite(price) ? price : null;
    const amount = rate === null || !Number.isFinite(qty) ? null : money(qty * rate);
    return { rate, amount: Number.isFinite(amount) ? amount : null };
  };

  for (const [id, m] of Object.entries(materials ?? {})) {
    const n = needs && Object.hasOwn(needs, id) ? needs[id] : null;
    if (!n) continue;
    const base = { id, name: m.name, spec: m.spec ?? "", store: m.store ?? null, first: n.first ?? 0, note: m.note ?? "", group: canon(m.group ?? defaultGroup(m, n)), est: Boolean(m.est) };
    if (m.kind === "linear" || m.kind === "sheet") {
      const linear = m.kind === "linear", plan = (cuts ?? []).find((c) => c.material === id);
      for (const [k, same] of groupBy((linear ? plan?.boards : plan?.sheets) ?? [], (b) => (linear ? String(b.stock.length) : `${b.stock.w}x${b.stock.h}`))) {
        const s = same[0].stock, pieces = same.flatMap((b) => b.cuts);
        const total = linear ? pieces.reduce((a, c) => a + c.len, 0) : pieces.reduce((a, c) => a + c.w * c.h, 0) / 1e6;
        rows.push({
          ...base, key: `${id}:${k}`, get: "buy", spec: [m.spec, linear ? `${fmtLen(s.length, units)} long` : dims([s.w, s.h], units)].filter(Boolean).join(", "),
          need: `${plural(pieces.length, "piece")}, ${linear ? fmtLen(total, units) : fmtArea(total, units)}`, needQty: round(total, linear ? 1 : 3),
          qty: same.length, unit: linear ? "board" : "sheet", ...priced(s.price, same.length),
        });
      }
      continue;
    }
    const fin = m.kind === "amount" ? n.finish ?? [] : [];
    const finAmount = fin.reduce((a, f) => a + ((units === "in" ? f.area / FT2 : f.area) * f.coats) / m.coverage, 0);
    const exact = m.kind === "each" ? n.count : n.amount + finAmount;
    if (!(exact > 0)) continue;
    const word = m.unit ?? "piece", needWord = plural(needN(exact), word);
    const note = [m.note, fin.length ? finishNote(fin, m, units) : ""].filter(Boolean).join(" ");
    if (m.included) {
      rows.push({ ...base, key: id, get: "kit", need: `${needWord}, in the kit`, needQty: finite(round(exact, 3)), qty: finite(shown(exact)), unit: one(word), rate: 0, amount: 0, note });
      continue;
    }
    // Packs: ceil with a relative tolerance, so binary noise (50.000000001) and very large needs do not add a pack.
    const spare = m.spare ?? 0, pack = m.pack ?? 1, x = (exact * (1 + spare)) / pack;
    const packs = Math.ceil(x - 1e-9 * Math.max(1, Math.abs(x))), qty = Number.isFinite(packs) ? packs : null;
    const unit = m.packName ?? (pack === 1 ? one(word) : m.kind === "each" ? `pack of ${shown(pack)}` : `${shown(pack)} ${word} pack`);
    rows.push({ ...base, key: id, get: "buy", need: `${needWord}${spare ? ` + ${pct(spare)} spare` : ""}`, needQty: finite(round(exact, 3)), qty, unit, ...priced(m.price, qty), note });
  }

  for (const t of tools ?? []) {
    if (t.have) continue;
    const get = t.get ?? "buy", qty = t.qty ?? 1, days = t.days ?? 1, n = get === "rent" ? round(qty * days, 3) : qty;
    rows.push({
      id: t.id, key: `${TOOL_KEY}${t.id}`, get, name: t.name, spec: t.spec ?? "", store: get === "borrow" ? null : t.store ?? null,
      first: t.first ?? 0, note: "", group: t.ppe ? "Safety" : "Tools", est: Boolean(t.est),
      need: get === "rent" ? `rent ${qty} for ${plural(days, "day")}` : `${get} ${qty}`, needQty: qty, qty: n,
      unit: get === "rent" ? "day" : "each", ...(get === "borrow" ? { rate: 0, amount: 0 } : priced(t.price, n)),
    });
  }

  const sorted = stableSort(rows, (a, b) => rank(a.group) - rank(b.group)
    || (rank(a.group) === NAMES.length && a.group !== b.group ? (a.group < b.group ? -1 : 1) : 0) || a.first - b.first);
  const seq = {};
  const out = sorted.map((r) => {
    const L = Object.hasOwn(GROUPS, r.group) ? GROUPS[r.group] : OTHER;
    seq[L] = (seq[L] ?? 0) + 1;
    return {
      code: `${L}${String(seq[L]).padStart(2, "0")}`, group: r.group, key: r.key, id: r.id, name: r.name, spec: r.spec, need: r.need,
      needQty: r.needQty, qty: r.qty, unit: r.unit, rate: r.rate, amount: r.amount, est: r.est && r.rate !== null && r.rate > 0,
      store: r.store, first: r.first, note: r.note, get: r.get,
    };
  });

  // Contingency on the subtotal. Tax on subtotal + contingency: added to the total, or (included) taken out of it.
  const subtotal = money(out.reduce((a, r) => a + (r.amount ?? 0), 0)), rate = contingency ?? 0;
  const spareBudget = money(subtotal * rate), budget = money(subtotal + spareBudget);
  const taxRate = tax?.rate ?? 0, included = Boolean(tax && tax.included);
  const taxAmount = !taxRate ? 0 : included ? money(budget - budget / (1 + taxRate)) : money(budget * taxRate);
  const totals = {
    subtotal, contingencyRate: rate, contingency: spareBudget, taxRate, taxLabel: tax ? tax.label ?? "Tax" : null, taxIncluded: included,
    tax: taxAmount, total: included ? budget : money(budget + taxAmount), currency, area: round(area || 0, 3), areaDisplay: fmtArea(area || 0, units),
    unknownPrices: out.filter((r) => r.amount === null).length,
  };
  return { rows: out, totals };
}
