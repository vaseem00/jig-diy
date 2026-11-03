// Small pure helpers shared by every engine module: rounding, plurals, grouping, HTML escape, words, did-you-mean.

// Round half away from zero to d decimals. The tiny relative bump absorbs binary noise (1.005 -> 1.01). A whole
// number, or a value from 2^49 up, gets no bump: there the bump can reach half a unit and add one (round(1e6, 9)).
export function round(n, d = 0) {
  if (typeof n !== "number" || !Number.isFinite(n)) return n;
  const f = 10 ** d, a = Math.abs(n) * f, r = (Math.sign(n) * Math.round(Number.isInteger(a) || a >= 2 ** 49 ? a : a * (1 + 2 * Number.EPSILON))) / f;
  return r || 0;
}

// An amount to show: 2 decimals, but a small positive amount keeps 2 significant digits (0.004 L, not 0 L).
export const amount = (n, d = 2) => (n > 0 && n < 0.01 ? Number(n.toPrecision(2)) : round(n, d));

// Unit abbreviations that never take an s ("2 gal", "5.5 cu ft").
const ABBREV = new Set("ea pc pcs in ft yd mi mm cm m km ml cl dl l g kg mg oz lb lbs gal qt pt fl cu sq tsp tbsp doz".split(" "));

// "1 board", "3 boards", "2 boxes", "1 battery", "2 pairs of gloves", "16 shelf pins", "3 board feet". Words of one or
// two letters ("L", "ml"), abbreviations ("gal", "pcs.") and words with no vowel ("qt") stay as they are. A unit of
// more words changes its last word, unless that word stays ("5.5 cu ft", "2 fl oz"). A note in brackets at the end
// stays as it is: "3 tins (small)", "2 bags (25 kg)".
export function plural(n, word) {
  const w = String(word ?? "").trim(), form = n === 1 ? singular : many;
  const br = /^(.*?\S)(\s*\([^()]*\))$/.exec(w);
  if (br) return `${plural(n, br[1])}${br[2]}`;
  const fixed = (x) => /^[a-z]{0,2}$/i.test(x) || /\.$/.test(x) || ABBREV.has(x.toLowerCase()) || !/[aeiouy]/i.test(x);
  if (!/\s/.test(w)) return fixed(w) ? `${n} ${w}`.trim() : `${n} ${form(w)}`;
  const of = /^(\S+)( of .+)$/i.exec(w); // "pair of gloves": the head noun changes
  if (of) return `${n} ${fixed(of[1]) ? of[1] : form(of[1])}${of[2]}`;
  const parts = w.split(/\s+/), last = parts.at(-1);
  return fixed(last) ? `${n} ${w}` : `${n} ${[...parts.slice(0, -1), form(last)].join(" ")}`;
}
// "foot" and "feet" keep the case of the word ("Foot" -> "Feet").
const singular = (w) =>
  /feet$/i.test(w) ? w.slice(0, -3) + (w.slice(-3) === "EET" ? "OOT" : "oot")
    : /[^aeiou]ies$/i.test(w) ? w.slice(0, -3) + "y" : /(ss|x|z|ch|sh)es$/i.test(w) ? w.slice(0, -2) : /(ss|us)$/i.test(w) ? w : /s$/i.test(w) ? w.slice(0, -1) : w;
const many = (w) =>
  /foot$/i.test(w) ? w.slice(0, -3) + (w.slice(-3) === "OOT" ? "EET" : "eet") : /feet$/i.test(w) ? w
    : /(ss|x|z|ch|sh)$/i.test(w) ? w + "es" : /s$/i.test(w) ? w : /[^aeiou]y$/i.test(w) ? w.slice(0, -1) + "ies" : w + "s";

// [[key, items], ...] in first-seen order. key is a function or a property name.
export function groupBy(list, key) {
  const get = typeof key === "function" ? key : (x) => x?.[key];
  const map = new Map();
  for (const item of list ?? []) {
    const k = get(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(item);
  }
  return [...map.entries()];
}

const HTML = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => HTML[c]);

// Text for a terminal or a text file: control characters (ESC, CR, BEL, C1 codes ...) become U+FFFD, so project text
// cannot move the cursor or set the window title. Tab and line feed stay: a project value inside a report line goes
// through oneLine as well, so it cannot fake a line ("Check passed.").
export const term = (s) => String(s ?? "").replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, "�");

// Text on one line: each run of white space that holds a line break (LF or CR) becomes one space; other runs stay.
// One pass over each run, so a long run of spaces stays linear in time (a pattern such as /\s*\n\s*/ is not).
export const oneLine = (s) => String(s ?? "").replace(/\s+/g, (w) => (/[\r\n]/.test(w) ? " " : w));

// Lower-case word tokens. "4.5", "1/16" and "don't" stay one token each.
export function words(s) {
  return String(s ?? "").toLowerCase().match(/[\p{L}\p{N}]+(?:['’./-][\p{L}\p{N}]+)*/gu) ?? [];
}

// Levenshtein distance (insert, delete, replace) that also counts a swap of two neighbours as one edit ("dri" -> "dir").
function distance(a, b) {
  let pp = [], prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) row[j] = Math.min(row[j], pp[j - 2] + 1);
    }
    (pp = prev), (prev = row);
  }
  return prev[b.length];
}

// The closest option (case-insensitive): edit distance <= 2 (and at most half the input length),
// or one is a prefix of the other (3 letters or more). Returns the option as written, or null.
export function didYouMean(s, options) {
  if (typeof s !== "string" || !s) return null;
  const a = s.toLowerCase();
  let best = null, bestD = Infinity;
  for (const o of options ?? []) {
    if (typeof o !== "string" || !o) continue;
    const b = o.toLowerCase(), d = distance(a, b);
    const prefix = Math.min(a.length, b.length) >= 3 && (b.startsWith(a) || a.startsWith(b));
    if (((d <= 2 && d * 2 <= a.length) || prefix) && d < bestD) (best = o), (bestD = d);
  }
  return best;
}

// A sorted copy; equal items keep their order.
export function stableSort(list, cmp) {
  return [...(list ?? [])].map((x, i) => [x, i]).sort((a, b) => cmp(a[0], b[0]) || a[1] - b[1]).map((p) => p[0]);
}
