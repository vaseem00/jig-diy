// Units, money and time formats. Inside the engine every length is mm; these show values back in the project's units.

import { round } from "./util.mjs";

const PER = { mm: 1, in: 25.4 };
const FT2 = 0.09290304; // m² in one square foot
const factor = (units) => PER[units] ?? 1;

export const toMM = (v, units) => (typeof v === "number" ? round(v * factor(units), 6) : v);
export const fromMM = (mm, units) => (typeof mm === "number" ? round(mm / factor(units), 6) : mm);

const gcd = (a, b) => (b ? gcd(b, a % b) : a);

// "762 mm", "19.1 mm"; "30 1/16 in", "96 in", "3/4 in" (nearest 1/16). den: a finer fraction for small values such
// as the kerf and the trim ({ den: 64 } gives "3/32 in"). With a finer den, an inch value that is not within
// 0.0005 in of a 1/den step, or that rounds to 0 but is not 0, shows as decimal inches ("0.02 in").
export function fmtLen(mm, units = "mm", { den = 16 } = {}) {
  if (typeof mm !== "number" || !Number.isFinite(mm)) return "?";
  if (units !== "in") return `${round(mm, 1) || 0} mm`;
  const D = Number.isInteger(den) && den >= 16 && den <= 1024 ? den : 16, v = Math.abs(mm) / 25.4;
  const s = Math.round(v * D), whole = Math.floor(s / D), f = s % D, g = gcd(f, D);
  if (D > 16 && v > 0 && (!s || Math.abs(v - s / D) > 0.0005)) return `${mm < 0 ? "-" : ""}${round(v, 3)} in`;
  const text = [whole || !f ? String(whole) : "", f ? `${f / g}/${D / g}` : ""].filter(Boolean).join(" ");
  return `${mm < 0 && s ? "-" : ""}${text} in`;
}

// "3.98 m²" or "42.84 ft²".
export function fmtArea(m2, units = "mm") {
  if (typeof m2 !== "number" || !Number.isFinite(m2)) return "?";
  return units === "in" ? `${round(m2 / FT2, 2).toFixed(2)} ft²` : `${round(m2, 2).toFixed(2)} m²`;
}

const minor = new Map(), money = new Map();

// The decimals that prices use in the currencies with no 2-decimal minor unit (the CLDR digits that Intl used in
// jig 1.0). A fixed table, so the result does not depend on the ICU data of the Node build. Other codes give 2.
const DIGITS = Object.fromEntries([
  ..."AFN ALL BIF CLP COP DJF GNF HUF IDR IQD IRR ISK JPY KMF KPW KRW LAK LBP MGA MMK PKR PYG RWF SLL SOS SYP UGX VND VUV XAF XOF XPF YER"
    .split(" ").map((c) => [c, 0]),
  ..."BHD JOD KWD LYD OMR TND".split(" ").map((c) => [c, 3]),
]);

// Decimals of the currency's minor unit (USD 2, JPY 0, KWD 3). Unknown codes give 2.
export function minorUnits(currency) {
  return Object.hasOwn(DIGITS, currency) ? DIGITS[currency] : 2;
}

export const roundMoney = (n, currency) => round(n, minorUnits(currency));

// Intl output with the ICU spaces (U+00A0, U+202F, U+2009) as plain spaces, so the text is the same on every Node.
const plain = (s) => s.replace(/[   ]/g, " ");

// One cached en-US currency format with min to max decimals, or null for a code that Intl does not know.
function moneyFormat(currency, min, max) {
  const key = `${currency}:${min}:${max}`;
  if (!money.has(key)) {
    let f = null;
    try { f = new Intl.NumberFormat("en-US", { style: "currency", currency, currencyDisplay: "symbol", minimumFractionDigits: min, maximumFractionDigits: max }); } catch {}
    money.set(key, f);
  }
  return money.get(key);
}

// "$1,234.50", "€12.50", "¥1,250", "BHD 1.235". A missing price shows "price?".
export function fmtMoney(n, currency = "USD") {
  if (typeof n !== "number" || !Number.isFinite(n)) return "price?";
  const d = minorUnits(currency), f = moneyFormat(currency, d, d), v = round(n, d) || 0;
  return f ? plain(f.format(v)) : `${currency} ${v.toFixed(d)}`;
}

// A unit rate as given, with at least the minor unit and up to 4 decimals: "$0.045", "$12.50", "¥12.5".
export function fmtRate(n, currency = "USD") {
  if (typeof n !== "number" || !Number.isFinite(n)) return "price?";
  const d = minorUnits(currency), max = Math.max(d, 4), f = moneyFormat(currency, d, max), v = round(n, max) || 0;
  if (f) return plain(f.format(v));
  const s = v.toFixed(max).replace(/\.?0+$/, "");
  return `${currency} ${(s.split(".")[1]?.length ?? 0) >= d ? s : v.toFixed(d)}`;
}

// Under 10 min to the minute, else to the nearest 5 min: "0 min", "1 min", "7 min", "1 h 25 min", "2 h".
export function fmtDuration(minutes) {
  const m = typeof minutes === "number" && Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
  if (!m) return "0 min";
  const r = m < 1 ? 1 : m < 10 ? Math.round(m) : Math.round(m / 5) * 5;
  const h = Math.floor(r / 60), rest = r % 60;
  return h ? `${h} h${rest ? ` ${rest} min` : ""}` : `${r} min`;
}
