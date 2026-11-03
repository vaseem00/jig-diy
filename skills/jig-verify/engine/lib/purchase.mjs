// Purchase plan: the BOQ rows as shopping trips. Online orders come first (longest lead first), then one trip per
// store by the step that first needs it, then "Any store", and a final "Borrow" trip. Kit rows are not bought.

import { roundMoney } from "./locale.mjs";
import { stableSort } from "./util.mjs";

// Trip ids of the two built-in trips. Store ids start with a letter or a digit, so these never clash.
export const ANY_STORE = "_any", BORROW = "_borrow";
const DAY = 86400000;
const BUILT_IN = {
  [ANY_STORE]: { name: "Any store", note: "Buy these items at any store." },
  [BORROW]: { name: "Borrow", note: "Ask a friend, a neighbour or a tool library." },
};

// The date lead days before start, as YYYY-MM-DD. null when start is not a real YYYY-MM-DD date.
export function orderBy(start, lead = 0) {
  const m = typeof start === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(start) : null;
  if (!m) return null;
  const [y, mo, d] = m.slice(1).map(Number), t = Date.UTC(y, mo - 1, d), date = new Date(t);
  if (y < 1000 || date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  const days = typeof lead === "number" && Number.isFinite(lead) && lead > 0 ? Math.ceil(lead) : 0;
  return new Date(t - days * DAY).toISOString().slice(0, 10);
}

// buildPurchase(rows, stores, { start, currency }) -> [{ store, name, online, lead, note, url, orderBy, items, subtotal }].
// rows: BOQ rows (key, store, first, amount, get). stores: normalized stores. start: YYYY-MM-DD or null.
export function buildPurchase(rows = [], stores = {}, { start = null, currency = "USD" } = {}) {
  const groups = new Map();
  for (const r of rows ?? []) {
    if (r.get === "kit") continue;
    const id = r.get === "borrow" ? BORROW : typeof r.store === "string" && Object.hasOwn(stores ?? {}, r.store) ? r.store : ANY_STORE;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(r);
  }
  const trips = [...groups].map(([id, list]) => {
    const s = Object.hasOwn(BUILT_IN, id) ? BUILT_IN[id] : stores[id], items = stableSort(list, (a, b) => a.first - b.first);
    const lead = typeof s.lead === "number" && s.lead > 0 ? s.lead : 0;
    return {
      store: id, name: s.name, online: s.online === true, lead, note: s.note ?? "", url: s.url ?? null,
      orderBy: start ? orderBy(start, lead) : null, items: items.map((r) => r.key),
      subtotal: roundMoney(items.reduce((a, r) => a + (r.amount ?? 0), 0), currency), first: items[0]?.first ?? 0,
    };
  });
  const cmp = (a, b) => (a.store === BORROW) - (b.store === BORROW) || b.online - a.online || b.lead - a.lead || a.first - b.first
    || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0) || (a.store < b.store ? -1 : 1);
  return trips.sort(cmp).map(({ first, ...t }) => t);
}
