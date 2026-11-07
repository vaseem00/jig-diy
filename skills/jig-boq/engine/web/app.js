// The guide page: Plan, Shop, Cut list (or Print list, or Cut and print) and Build, rendered from the model in #jig-data. It needs no three.js: every
// tab renders first, then createViewer() (viewer.js, in the same module) loads the 3D. Reader state stays in this browser.
const root = document.getElementById("jig");
const D = JSON.parse(document.getElementById("jig-data").textContent);
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// h`...`: every interpolated value is escaped (numbers too), except h`...` output. null, false and true add nothing.
class Html { constructor(s) { this.s = s; } toString() { return this.s; } }
const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ESC[c]);
const val = (v) => (v == null || typeof v === "boolean" ? "" : v instanceof Html ? v.s : Array.isArray(v) ? v.map(val).join("") : esc(v));
const h = (strs, ...vals) => new Html(strs.reduce((o, s, i) => o + s + (i < vals.length ? val(vals[i]) : ""), ""));

// ---------- formats (the same rules as engine/lib/locale.mjs, which the browser cannot import)
const U = D.meta.units === "in" ? "in" : "mm", CUR = D.meta.currency || "USD";
const round = (n, d = 0) => { const f = 10 ** d, a = Math.abs(n) * f; return (Math.sign(n) * Math.round(Number.isInteger(a) || a >= 2 ** 49 ? a : a * (1 + 2 * Number.EPSILON))) / f || 0; };
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
// "762 mm", "19.1 mm"; "30 1/16 in" (nearest 1/16). unit false: the number only.
function len(mm, unit = true) {
  if (typeof mm !== "number" || !Number.isFinite(mm)) return "?";
  let t = String(round(mm, 1));
  if (U === "in") {
    const s = Math.round((Math.abs(mm) / 25.4) * 16), w = Math.floor(s / 16), f = s % 16, g = gcd(f, 16);
    t = `${mm < 0 && s ? "-" : ""}${[w || !f ? String(w) : "", f ? `${f / g}/${16 / g}` : ""].filter(Boolean).join(" ")}`;
  }
  return unit ? `${t} ${U}` : t;
}
// The kerf and the trim, as locale.fmtLen(mm, units, { den: 64 }): "3/32 in", or decimal inches off a 1/64 step ("0.02 in").
function fine(mm) {
  if (U !== "in" || typeof mm !== "number" || !Number.isFinite(mm)) return len(mm);
  const v = Math.abs(mm) / 25.4, s = Math.round(v * 64), w = Math.floor(s / 64), f = s % 64, g = gcd(f, 64);
  if (v > 0 && (!s || Math.abs(v - s / 64) > 0.0005)) return `${mm < 0 ? "-" : ""}${round(v, 3)} in`;
  return `${mm < 0 && s ? "-" : ""}${[w || !f ? String(w) : "", f ? `${f / g}/${64 / g}` : ""].filter(Boolean).join(" ")} in`;
}
// Money decimals come from the fixed table of locale.mjs minorUnits() (tests/page.test.mjs compares the two), not from
// the browser's ICU data, so the page shows the same amounts as plan.md and the CLI. Other codes give 2.
const DIGITS = Object.fromEntries([..."AFN ALL BIF CLP COP DJF GNF HUF IDR IQD IRR ISK JPY KMF KPW KRW LAK LBP MGA MMK PKR PYG RWF SLL SOS SYP UGX VND VUV XAF XOF XPF YER".split(" ").map((c) => [c, 0]), ..."BHD JOD KWD LYD OMR TND".split(" ").map((c) => [c, 3])]);
const DEC = Object.hasOwn(DIGITS, CUR) ? DIGITS[CUR] : 2;
const MF = (() => { try { return new Intl.NumberFormat("en-US", { style: "currency", currency: CUR, minimumFractionDigits: DEC, maximumFractionDigits: DEC }); } catch { return null; } })();
const money = (n) => (typeof n !== "number" || !Number.isFinite(n) ? "price?" : MF ? MF.format(round(n, DEC)) : `${CUR} ${round(n, DEC).toFixed(DEC)}`);
// A unit rate as given (the model does not round it), as locale.fmtRate: the minor unit at least, up to 4 decimals ("$0.045").
const RD = Math.max(DEC, 4), RF = (() => { try { return new Intl.NumberFormat("en-US", { style: "currency", currency: CUR, minimumFractionDigits: DEC, maximumFractionDigits: RD }); } catch { return null; } })();
const rate = (n) => (typeof n !== "number" || !Number.isFinite(n) ? "price?" : RF ? RF.format(round(n, RD)) : `${CUR} ${String(round(n, RD)).split(".")[1]?.length >= DEC ? round(n, RD) : round(n, RD).toFixed(DEC)}`);
// under 10 min to the minute, else to the nearest 5 min: "1 min", "7 min", "1 h 25 min"
function dur(minutes) {
  const m = typeof minutes === "number" && Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
  if (!m) return "0 min";
  const r = m < 1 ? 1 : m < 10 ? Math.round(m) : Math.round(m / 5) * 5, hh = Math.floor(r / 60), rest = r % 60;
  return hh ? `${hh} h${rest ? ` ${rest} min` : ""}` : `${r} min`;
}
const pct = (r) => `${round((r || 0) * 100, 2)}%`;
// A tax label inside a sentence, as markdown.mjs taxWord (tests/page.test.mjs compares the two): each capitalised word
// in lower case ("Sales Tax" reads "sales tax"); a word with more capitals stays ("VAT", "GST/HST", "MwSt"). No
// lookbehind: Safari before 16.4 cannot parse one, and the whole module would stop.
const taxWord = (s) => String(s).replace(/(^|[^\p{L}\p{N}])(\p{Lu}\p{Ll}+)(?![\p{L}\p{N}])/gu, (m, a, w) => a + w.toLowerCase());
// "foot" and "feet" keep the case of the word ("Foot" -> "Feet"), as util.mjs.
const many = (w) => (/foot$/i.test(w) ? w.slice(0, -3) + (w.slice(-3) === "OOT" ? "EET" : "eet") : /feet$/i.test(w) ? w : /(ss|x|z|ch|sh)$/i.test(w) ? `${w}es` : /s$/i.test(w) ? w : /[^aeiou]y$/i.test(w) ? `${w.slice(0, -1)}ies` : `${w}s`);
const one = (w) => (/feet$/i.test(w) ? w.slice(0, -3) + (w.slice(-3) === "EET" ? "OOT" : "oot") : /[^aeiou]ies$/i.test(w) ? `${w.slice(0, -3)}y` : /(ss|x|z|ch|sh)es$/i.test(w) ? w.slice(0, -2) : /(ss|us)$/i.test(w) ? w : /s$/i.test(w) ? w.slice(0, -1) : w);
// plural: the rule of engine/lib/util.mjs plural() (tests/page.test.mjs compares the two). A word of one or two letters
// ("L"), an abbreviation ("gal", "pcs.") or a word with no vowel ("qt", "m²") stays as it is. A unit of more words
// changes the noun before "of" ("2 pairs of gloves"), else its last word ("16 shelf pins", "3 board feet"), unless
// that word stays ("5.5 cu ft", "2 fl oz"). A note in brackets at the end stays as it is: "3 tins (small)".
const ABBREV = new Set("ea pc pcs in ft yd mi mm cm m km ml cl dl l g kg mg oz lb lbs gal qt pt fl cu sq tsp tbsp doz".split(" "));
const fixed = (x) => /^[a-z]{0,2}$/i.test(x) || /\.$/.test(x) || ABBREV.has(x.toLowerCase()) || !/[aeiouy]/i.test(x);
function plural(n, word = "") {
  const w = String(word ?? "").trim(), form = n === 1 ? one : many;
  const br = /^(.*?\S)(\s*\([^()]*\))$/.exec(w);
  if (br) return `${plural(n, br[1])}${br[2]}`;
  if (!/\s/.test(w)) return fixed(w) ? `${n} ${w}`.trim() : `${n} ${form(w)}`;
  const of = /^(\S+)( of .+)$/i.exec(w);
  if (of) return `${n} ${fixed(of[1]) ? of[1] : form(of[1])}${of[2]}`;
  const words = w.split(/\s+/), last = words[words.length - 1];
  return fixed(last) ? `${n} ${w}` : `${n} ${[...words.slice(0, -1), form(last)].join(" ")}`;
}
const group = (list, key) => { const m = new Map(); for (const x of list) { const k = key(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); } return [...m]; };
const isVec = (v) => Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === "number" && Number.isFinite(x));
const num = (v) => round(v, 2);
// An amount a step uses, as util.mjs amount(): 2 decimals, but a small positive amount keeps 2 significant digits (0.004 L).
const amount = (n) => (n > 0 && n < 0.01 ? Number(n.toPrecision(2)) : round(n, 2));
// A BOQ row bought by the piece ("each", or the default unit "piece") shows a plain count, as markdown.mjs: "5", "5 × Hook".
const byPiece = (r) => r.unit === "each" || r.unit === "piece";

// ---------- model lookups and reader state
const N = D.steps.length, T = D.totals;
const TOOL = new Map(D.tools.map((t) => [t.id, t])), ROW = new Map(D.boq.map((r) => [r.key, r]));
const KIT = new Set(D.boq.filter((r) => r.get === "kit").map((r) => r.id)); // materials that come in the kit (included)
const mat = (id) => (D.materials && Object.hasOwn(D.materials, id) ? D.materials[id] : { name: id, spec: "", unit: "" });
const FIRST = new Map(); // technique id -> first step that teaches it
D.steps.forEach((s, i) => (s.teach ?? []).forEach((id) => FIRST.has(id) || FIRST.set(id, i)));
const LEVELS = [["new", "First time"], ["some", "Some experience"], ["pro", "Experienced"]], LV = LEVELS.map((l) => l[0]);
// The cut tab is "Cut list", "Print list" (3D-printed parts only) or "Cut and print". A project with nothing to cut or
// print (a kit of bought parts) has no cut tab, as page.mjs tabsFor() gives it.
const CUTS = D.parts.some((p) => p.kind !== "each" && p.kind !== "printed"), PRINTS = D.parts.some((p) => p.kind === "printed");
const NAMES = { plan: "Plan", shop: "Shop", cut: PRINTS ? (CUTS ? "Cut and print" : "Print list") : "Cut list", build: "Build" };
let TABS = String(root.dataset.tabs || "").split(",").filter((t) => Object.hasOwn(NAMES, t));
if (!TABS.length) TABS = Object.keys(NAMES);
if (!CUTS && !PRINTS) { TABS = TABS.filter((t) => t !== "cut"); if (!TABS.length) TABS = ["plan"]; }
const KEY = `jig:${D.meta.id}`;
const dict = (v) => Object.assign(Object.create(null), v && typeof v === "object" && !Array.isArray(v) ? v : {});
const saved = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })();
const S = {
  level: LV.includes(saved.level) ? saved.level : LV.includes(D.meta.level) ? D.meta.level : "some",
  tab: TABS.includes(saved.tab) ? saved.tab : TABS[0], step: Number.isInteger(saved.step) ? saved.step : 0, done: dict(saved.done), bought: dict(saved.bought),
};
const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ level: S.level, tab: S.tab, step: S.step, done: S.done, bought: S.bought })); } catch {} };
const clamp = (i) => (Number.isInteger(i) && N ? Math.max(0, Math.min(N - 1, i)) : 0);
const work = (m) => round((m || 0) * (D.plan.levels?.[S.level] ?? 1), 2);
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)");

// Hash routes: #plan, #shop, #cut, #build/<n>. A bad step number falls back to step 1.
function route() {
  let t = "", n;
  try { [t = "", n] = decodeURIComponent(location.hash.slice(1)).split("/"); } catch {}
  return { tab: TABS.includes(t) ? t : null, step: t === "build" && n !== undefined ? (/^\d{1,6}$/.test(n) ? Number(n) - 1 : 0) : null };
}

// Overall size from the part boxes (rotated about their centres, x then y then z). Wall fixings (role anchor) are
// not part of the object's size unless every part is one. A repair with no placed part measures the object that is
// there: the props of the Plan view (hero), as the 3D view frames them.
function sizeOf() {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity], R = Math.PI / 180;
  const body = D.parts.filter((p) => p.role !== "anchor"), placed = (list) => list.filter((p) => isVec(p.at) && isVec(p.size));
  let list = placed(body.length ? body : D.parts);
  if (!list.length) list = placed(Object.values(D.props ?? {}).filter((p) => p && p.hero !== false));
  for (const p of list) {
    const hs = p.size.map((s) => s / 2), c = p.at.map((a, i) => a + hs[i]);
    let e = hs;
    if (isVec(p.rotate) && p.rotate.some((d) => d % 360)) {
      const [cx, sx, cy, sy, cz, sz] = [0, 0, 1, 1, 2, 2].map((a, i) => (i % 2 ? Math.sin : Math.cos)(p.rotate[a] * R));
      e = [[cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx], [sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx], [-sy, cy * sx, cy * cx]]
        .map((row) => row.reduce((a, r, j) => a + Math.abs(r) * hs[j], 0));
    }
    c.forEach((v, i) => { lo[i] = Math.min(lo[i], v - e[i]); hi[i] = Math.max(hi[i], v + e[i]); });
  }
  return lo[0] === Infinity ? null : hi.map((v, i) => v - lo[i]);
}

// ---------- shared pieces
const warnBox = (w) => h`<div class="alert ${w.type === "caution" ? "caution" : "warning"}" role="note"><b>${w.type === "caution" ? "CAUTION" : "WARNING"}</b>${w.text}</div>`;
// The WARNING and CAUTION blocks of a step: its own, then those of the cards it teaches (every level sees them).
function warningsOf(s) {
  const seen = new Set();
  return [...(s.warn ?? []), ...(s.teach ?? []).flatMap((id) => D.techniques[id]?.warn ?? [])].filter((w) => w?.text && !seen.has(w.type + w.text) && seen.add(w.type + w.text));
}
const est = (on) => on && h`<span class="est" title="Estimated price">est</span>`;
const stepChip = (i) => h`<button type="button" data-go="${i}" aria-label="Step ${i + 1}: ${D.steps[i].title}" title="${D.steps[i].title}">${i + 1}</button>`;
const fastCount = (s) => s.fasteners.reduce((a, f) => a + (f.count ?? 1), 0);
const viewerBox = (mode) => h`<div class="viewer" data-viewer="${mode}"><div data-canvas></div><div data-tags></div>
<p class="hint" aria-hidden="true"><span class="h-mouse">Drag to turn. Scroll to zoom.</span><span class="h-touch">Tap the view to turn it.</span><span class="h-on">Drag to turn. Tap outside to scroll.</span></p>
<div class="vbar"><div class="vtools">${mode === "hero" ? h`<button type="button" data-v="spin" aria-label="Pause the tour">Pause</button>`
  : h`<button type="button" data-v="replay">Replay</button><button type="button" data-v="explode" aria-pressed="false">Apart</button><button type="button" data-v="ghost" aria-pressed="false">Show finished</button><button type="button" data-v="xray" aria-pressed="false" aria-disabled="true" title="See through the parts built before">X-ray</button><button type="button" data-v="reset" aria-label="Reset view">Reset<span class="wide"> view</span></button>`}</div>${mode === "steps" && h`<div class="readout" data-readout aria-hidden="true"></div>`}</div></div>`;

// ---------- Plan
// The motions of the finished object: one slider each, and the value its parts show (a slide in the project unit, a
// turn in degrees). The Plan view tour moves the same sliders.
const MOTIONS = Array.isArray(D.motions) ? D.motions : [];
const motionValue = (m, k) => (m.kind === "turn" ? `${Math.round(Math.abs(m.travel) * k)}°` : len(Math.abs(m.travel) * k));
const tryIt = () => MOTIONS.length > 0 && h`<section class="try" aria-labelledby="try-h"><h3 id="try-h">Try it</h3>${MOTIONS.map((m) => h`<div class="motion">
<label for="m-${m.id}">${m.name}</label><input type="range" id="m-${m.id}" min="0" max="100" step="1" value="0" data-motion="${m.id}" aria-valuetext="${m.name}: ${motionValue(m, 0)}"><output for="m-${m.id}" data-mout="${m.id}">${motionValue(m, 0)}</output></div>`)}</section>`;
function planShell() {
  const size = sizeOf();
  return h`<div class="grid2"><div>${viewerBox("hero")}<p class="tourline" data-tourline aria-hidden="true"></p><div class="fig"><span>Fig 1 · ${D.meta.title}, finished</span>${size && h`<span>${size.map((v) => len(v, false)).join(" × ")} ${U} (W × H × D)</span>`}</div>${tryIt()}</div><div class="stack" data-fill="plan"></div></div>`;
}
function planText() {
  const ppe = D.tools.filter((t) => t.ppe), get = D.tools.filter((t) => !t.have && !t.ppe), have = D.tools.filter((t) => t.have && !t.ppe);
  const borrow = get.filter((t) => t.get === "borrow").length, cut = D.parts.filter((p) => p.kind !== "each" && p.kind !== "printed").length;
  const printed = D.parts.filter((p) => p.kind === "printed").length;
  const extra = [`${pct(T.contingencyRate)} spare`, T.taxRate > 0 && !T.taxIncluded && taxWord(T.taxLabel || "tax")].filter(Boolean).join(" and ");
  const build = TABS.includes("build") && N > 0, handoffs = D.safety?.handoffs ?? [], notes = D.safety?.notes ?? [];
  // a tool shows its count when it is more than 1 ("2 × Bar clamp"), as plan.md and the Shop tab
  const count = (t) => (t.qty > 1 ? `${t.qty} × ` : "");
  return h`
  <div class="stats">
    <div><b>${dur(work(D.plan.active))}</b><span>work time</span></div>
    <div><b>${dur(D.plan.wait)}</b><span>wait time (glue, finish${printed > 0 ? ", printer" : ""})</span></div>
    <div><b>${money(T.total).replace(/\s/g, " ")}</b><span>total with ${extra}${T.unknownPrices > 0 ? `, ${plural(T.unknownPrices, "price")} unknown` : ""}</span></div>
    ${printed > 0 ? h`<div><b>${cut > 0 ? `${cut} + ` : ""}${printed}</b><span>parts to ${cut > 0 ? "cut + print" : "print"}</span></div>` : h`<div><b>${cut}</b><span>parts to cut</span></div>`}
    <div><b>${N}</b><span>steps</span></div>
    <div><b>${get.length - borrow} + ${borrow}</b><span>tools to buy + borrow</span></div>
  </div>
  ${D.plan.phases.length > 0 && h`<div class="card"><h3>The plan</h3><div class="phases">${D.plan.phases.map((p) => h`<div class="phase" style="flex:${Math.max(p.minutes, 20)} 1 ${build ? p.steps.length * 32 - 4 : 0}px">
    <div class="bar"></div><div class="nm">${p.name}</div><div class="tm">${dur(work(p.minutes))}${p.wait > 0 ? ` + ${dur(p.wait)} wait` : ""}</div>
    ${build && h`<div class="chips">${p.steps.map(stepChip)}</div>`}</div>`)}</div></div>`}
  <div class="card">
    <h3>Before you start</h3>
    <ul class="plain">
      ${ppe.length > 0 && h`<li><span class="pill ppe">Safety</span><span>${ppe.map((t) => `${count(t)}${t.name}`).join(", ")}</span></li>`}
      ${get.length > 0 && h`<li><span class="pill">Get</span><span>${get.map((t) => `${count(t)}${t.name}${t.get === "borrow" ? " (borrow)" : t.get === "rent" ? " (rent)" : ""}`).join(", ")}</span></li>`}
      ${have.length > 0 && h`<li><span class="pill">Have</span><span>${have.map((t) => `${count(t)}${t.name}`).join(", ")}</span></li>`}
    </ul>
    ${notes.length > 0 && h`<ul class="notes">${notes.map((n) => h`<li>${n}</li>`)}</ul>`}
    ${handoffs.length > 0 && h`<div class="alert caution" role="note"><b>HAND-OFF</b>Get a professional for this work:<ul class="notes">${handoffs.map((x) => h`<li><strong>${x.name ?? x.topic}</strong>: ${x.text}</li>`)}</ul></div>`}
    <div class="nav">${TABS.includes("shop") && h`<button type="button" data-tab-go="shop">What to buy</button>`}${build && h`<button type="button" class="primary" data-go="0">Start step 1 →</button>`}</div>
  </div>`;
}

// ---------- Shop: trips first, then the full bill of quantities
function shopText() {
  const anyEst = D.boq.some((r) => r.est), steps = N > 0;
  const lede = [`Buy in this order. The step number shows when you need each item.`, `Prices in ${CUR}${D.meta.pricesAsOf ? ` as of ${D.meta.pricesAsOf}` : ""}.`,
    D.meta.priceNote, anyEst && "A rate marked est is an estimate."].filter(Boolean).join(" ");
  const trips = D.purchase.map((t, ti) => {
    const borrow = t.store === "_borrow", site = (() => { try { return /^https?:\/\//i.test(t.url ?? "") ? new URL(t.url).hostname : ""; } catch { return ""; } })();
    const when = t.orderBy && (t.online ? `Order by ${t.orderBy}.` : `Get these by ${t.orderBy}.`);
    const items = t.items.map((k) => ROW.get(k)).filter(Boolean).map((r) => {
      // a borrowed tool shows its count when it is more than 1 ("2 × Bar clamp"); a rented one shows it in the small line
      const rent = r.get === "rent", lead = rent ? "" : borrow ? (r.qty > 1 ? `${r.qty} × ` : "") : `${r.qty ?? "?"} × `;
      const small = [rent ? r.need : "", r.spec, borrow || rent || byPiece(r) ? "" : r.unit].filter(Boolean).join(" · ");
      return h`<label><input type="checkbox" data-buy="${r.key}"${S.bought[r.key] ? h` checked` : ""}>
        <span class="it">${lead}${r.name}${small && h`<small>${small}</small>`}</span>
        <span class="n">${!borrow && h`${money(r.amount)}${est(r.est)}<br>`}${steps && h`<span class="pill">step ${r.first + 1}</span>`}</span></label>`;
    });
    return h`<div class="card trip">
      <h3><span>${ti + 1}. ${t.name}</span><span class="eyebrow">${borrow ? "ask" : t.online ? (t.lead > 0 ? `delivery in ${plural(t.lead, "day")}` : "online") : "trip"}</span></h3>
      ${(when || t.note) && h`<p class="note">${[when, t.note].filter(Boolean).join(" ")}</p>`}
      ${site && h`<p class="note"><a href="${t.url}" target="_blank" rel="noopener noreferrer">${site}</a></p>`}
      ${items}
      ${!borrow && h`<div class="sum"><span>Subtotal</span><span>${money(t.subtotal)}</span></div>`}
    </div>`;
  });
  let grp = null;
  const body = D.boq.map((r) => {
    const head = r.group !== grp && h`<tr class="grp"><td colspan="6">${(grp = r.group)}</td></tr>`;
    const kit = r.get === "kit", borrow = r.get === "borrow";
    const buy = kit ? "in the kit" : borrow ? "borrow" : byPiece(r) ? `${r.qty ?? "?"}` : `${r.qty ?? "?"} × ${r.unit}`;
    // data-long: a word of 20 letters or more, which may break in print (page.css); on screen fitBoq() decides
    const long = /\S{20,}/.test(`${r.name} ${r.spec ?? ""}`);
    return h`${head}<tr><td><code class="c">${r.code}</code></td><td${long ? h` data-long` : ""}>${r.name}${r.spec && h`<br><small>${r.spec}</small>`}</td><td data-l="Need">${r.need}</td><td class="n" data-l="Buy">${buy}</td>
      <td class="n">${kit || borrow ? "-" : h`${rate(r.rate)}${est(r.est)}`}</td><td class="n">${kit ? "included" : borrow ? "-" : money(r.amount)}</td></tr>`;
  });
  const kit = D.boq.filter((r) => r.get === "kit").map((r) => r.name), notes = D.boq.filter((r) => r.note);
  const unknown = T.unknownPrices > 0 && `${plural(T.unknownPrices, "row")} ${T.unknownPrices === 1 ? "has" : "have"} no price (price?). The total does not include ${T.unknownPrices === 1 ? "it" : "them"}.`;
  // tax that the prices include is not added again, so its amount reads "includes £76.84" (as boqMd), not as a sum. That
  // cell may wrap after "includes", so it does not make the Amount column wider than the amounts.
  const tax = T.taxRate > 0 && h`<tr><td colspan="5">${T.taxLabel || "Tax"} (${pct(T.taxRate)}${T.taxIncluded ? ", included in the prices" : ""})</td>${T.taxIncluded ? h`<td class="n inc">includes ${money(T.tax)}</td>` : h`<td class="n">${money(T.tax)}</td>`}</tr>`;
  return h`<div class="stack">
    <div><div class="eyebrow">Purchase plan · in order</div><p class="lede">${lede}</p></div>
    ${D.purchase.length ? h`<div class="trips">${trips}</div>` : h`<p class="empty">Nothing to buy.</p>`}
    ${D.boq.length > 0 && h`<div class="card">
      <h2>Bill of quantities</h2>
      <p class="lede sm">The guide calculates each quantity from the parts, the fasteners in the steps${T.area > 0 ? ` and the finished area (${T.areaDisplay}, an upper bound)` : ""}. It rounds each quantity up to full packs.</p>
      <div class="scroll"><table class="boq">
        <thead><tr><th>Code</th><th>Item</th><th>Need</th><th class="n">Buy</th><th class="n">Rate</th><th class="n">Amount</th></tr></thead>
        <tbody>${body}</tbody>
        <tfoot><tr><td colspan="5">Subtotal</td><td class="n">${money(T.subtotal)}</td></tr>
        <tr><td colspan="5">Contingency for price changes and errors (${pct(T.contingencyRate)})</td><td class="n">${money(T.contingency)}</td></tr>
        ${tax}<tr class="total"><td colspan="5">Total budget</td><td class="n">${money(T.total)}</td></tr></tfoot>
      </table></div>
      ${(unknown || kit.length > 0 || notes.length > 0) && h`<ul class="notes">${unknown && h`<li>${unknown}</li>`}${kit.length > 0 && h`<li>In the kit, not bought: ${kit.join(", ")}.</li>`}${notes.map((r) => h`<li>${r.code}: ${r.note}</li>`)}</ul>`}
    </div>`}
  </div>`;
}

// ---------- Cut list: each board and sheet to scale, filled with a light tint of the material colour
const tint = (hex) => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex ?? "") ?? [null, "d9b88a"], v = parseInt(m[1], 16);
  return `#${[16, 8, 0].map((s) => Math.round(((v >> s) & 255) * 0.45 + 255 * 0.55).toString(16).padStart(2, "0")).join("")}`;
};
// A piece with no letter in its drawing is named in one line under the board or sheet: "Too small to show a letter:
// 2 × F (964 × 70 mm)." So the tab names every piece, on a phone too.
const unlettered = (list) => list.length > 0 && h`<p class="note">Too small to show a letter: ${group(list, (x) => `${x.label}\n${x.size}`)
  .map(([, g]) => `${g.length > 1 ? `${g.length} × ` : ""}${g[0].label} (${g[0].size})`).join(", ")}.</p>`;
function cutText() {
  const W = 1000, kerf = D.meta.kerf, trim = D.meta.trim;
  // two materials with one name ("Birch plywood", 18 mm and 6 mm): the heading adds the spec, so each drawing has its own
  const heading = (c) => { const spec = D.cuts.filter((x) => x.name === c.name).length > 1 ? mat(c.material).spec : ""; return h`<h3>${c.name}${spec ? `, ${spec}` : ""}</h3>`; };
  const drawings = D.cuts.map((c) => {
    const fill = tint(c.color);
    // A board is an HTML bar, so its labels keep their size on a phone. A label shows only when it fits at 330 px.
    if (c.kind === "linear") return h`${heading(c)}${c.boards.map((b, bi) => {
      const L = b.stock.length, fits = (f, s) => f * 330 >= String(s).length * 7.5 + 6, at = (v) => `${round((v / L) * 100, 3)}%`, small = [];
      const segs = b.cuts.map((x) => {
        const f = x.len / L, label = len(x.len, false);
        if (!fits(f, x.label)) small.push({ label: x.label, size: len(x.len) });
        return h`<span class="seg" style="left:${at(x.at)};width:${at(x.len)};background:${fill}" title="${x.label} (${x.id}): ${len(x.len)}">${fits(f, x.label) && h`<b>${x.label}</b>`}${fits(f, label) && h`<small>${label}</small>`}</span>`;
      });
      return h`<div class="board"><div class="t"><span>Board ${bi + 1} of ${c.boards.length} · buy ${len(L)} · ${money(b.stock.price)}</span><span>waste ${len(b.waste)}</span></div>
        <div class="bar" role="img" aria-label="Board ${bi + 1}: ${b.cuts.map((x) => `${x.label} ${len(x.len)}`).join(", ")}">${segs}</div>${unlettered(small)}</div>`;
    })}`;
    return h`${heading(c)}${c.sheets.map((s, si) => {
      const k = W / s.stock.w, H = num(s.stock.h * k), small = [];
      const segs = s.cuts.map((x) => {
        const label = `${len(x.w, false)} × ${len(x.h, false)}`, cw = x.w * k, ch = x.h * k, cx = x.x * k + cw / 2, cy = x.y * k + ch / 2;
        // the letter fits the piece (52 units at most, 26 at least): across it, or up a tall piece when that gives a
        // larger letter. With room for the size too, the letter stands above the size.
        const fit = (a, b) => Math.min(52, 0.8 * b, (a - 6) / (0.62 * String(x.label).length)), flat = fit(cw, ch), up = fit(ch, cw);
        const turn = ch > cw && up > flat, fs = turn ? up : flat, dim = !turn && fs >= 52 && cw >= label.length * 24 + 10 && ch >= 110;
        if (fs < 26) small.push({ label: x.label, size: `${len(x.w, false)} × ${len(x.h)}` });
        const letter = dim ? h`<text x="${num(cx)}" y="${num(cy)}" text-anchor="middle">${x.label}</text>`
          : fs >= 26 && h`<text x="${num(cx)}" y="${num(cy)}" text-anchor="middle" dominant-baseline="central" style="font-size:${num(fs)}px"${turn ? h` transform="rotate(-90 ${num(cx)} ${num(cy)})"` : ""}>${x.label}</text>`;
        return h`<rect class="wood" fill="${fill}" x="${num(x.x * k)}" y="${num(x.y * k)}" width="${num(cw)}" height="${num(ch)}"><title>${x.label} (${x.id}): ${len(x.w, false)} × ${len(x.h)}</title></rect>${letter}${dim && h`<text class="dim" x="${num(cx)}" y="${num(cy + 46)}" text-anchor="middle">${label}</text>`}`;
      });
      return h`<div class="board"><div class="t"><span>Sheet ${si + 1} of ${c.sheets.length} · buy ${len(s.stock.w, false)} × ${len(s.stock.h, false)} ${U} · ${money(s.stock.price)}</span></div>
        <svg class="sheet" viewBox="-1 -1 ${W + 2} ${num(H + 2)}" role="img" aria-label="Sheet ${si + 1}: ${s.cuts.map((x) => `${x.label} ${len(x.w, false)} × ${len(x.h)}`).join(", ")}"><rect class="waste" width="${W}" height="${H}"/><rect class="stock" width="${W}" height="${H}"/>${segs}</svg>${unlettered(small)}</div>`;
    })}`;
  });
  // A cut size wraps only after a "×" on a phone: a mixed fraction ("35 5/16") keeps a no-break space.
  const size = (p) => (p.cut ? (p.cut.length !== undefined ? [p.cut.length, p.cut.width, p.cut.thick] : [p.cut.a, p.cut.b, p.cut.thick]).map((v) => len(v, false).replace(/ /g, "\u00a0")).join("\u00a0× ")
    : p.kind === "each" ? (KIT.has(p.material) ? "in the kit" : "bought") : "?");
  // printed parts have their own table (printList), so the Parts table holds the cut and the bought parts
  const others = D.parts.filter((p) => p.kind !== "printed");
  const rows = group(others, (p) => p.label).map(([label, list]) => h`<tr><td><span class="pill part"><b>${label}</b></span></td><td>${list[0].name}<small class="pm">${list[0].materialName}</small></td><td class="n">${list.length}</td><td class="n">${size(list[0])}</td><td class="pmat">${list[0].materialName}</td></tr>`);
  const plan = h`<div class="card cutplan"><h2>Cut plan</h2>
    <p class="lede sm">Each saw cut removes ${fine(kerf)}. The plan includes it.${trim > 0 ? ` Cut ${fine(trim)} from the start of each board to square the end.` : ""} Cut the longest parts first.</p>
    ${D.cuts.length ? drawings : h`<p class="empty">Nothing to cut.</p>`}</div>`;
  const parts = others.length > 0 && h`<div class="card"><h2>Parts</h2><div class="scroll"><table class="parts"><thead><tr><th>Part</th><th>Name</th><th class="n">Qty</th><th class="n">Cut size (${U})</th><th class="pmat">Material</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  const defs = h`<svg class="defs" aria-hidden="true" focusable="false"><defs><pattern id="jig-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--faint)"/><line x1="0" y1="0" x2="0" y2="6" stroke="var(--line)" stroke-width="2"/></pattern></defs></svg>`;
  if (!PRINTS) return h`${defs}
  <div class="grid2">${plan}
    ${parts}</div>`;
  // Cut and print: the cut plan and the parts side by side, the print list under them. Print list only: the print list
  // beside the bought parts, or alone.
  return CUTS ? h`${defs}<div class="stack"><div class="grid2">${plan}${parts}</div>${printList()}</div>` : parts ? h`<div class="grid2">${printList()}${parts}</div>` : printList();
}

// The printed parts by material, as markdown.mjs printList: grams and hours for one part (est: an estimate from the
// part size), and for each material the totals and the spools to buy (its BOQ row).
function printList() {
  const mark = (on) => on && h` <span class="est" title="An estimate from the part size">est</span>`;
  const mats = group(D.parts.filter((p) => p.kind === "printed" && p.print), (p) => p.material);
  const rows = mats.flatMap(([, list]) => group(list, (p) => p.label).map(([label, same]) => {
    const p = same[0], q = p.print;
    // data-l: the column name, shown before the value when a narrow screen stacks the row (page.css)
    return h`<tr><td><span class="pill part"><b>${label}</b></span></td><td>${p.name}</td><td class="n" data-l="Qty">${same.length}</td><td class="n" data-l="Grams each">${q.grams} g${mark(q.est?.grams)}</td>
      <td class="n" data-l="Hours each">${q.hours} h${mark(q.est?.hours)}</td><td data-l="Material">${p.materialName}</td><td class="set" data-l="Settings">${q.settings || "-"}</td></tr>`;
  }));
  const sums = mats.map(([id, list]) => {
    const r = ROW.get(id), g = round(list.reduce((a, p) => a + p.print.grams, 0), 1), hr = round(list.reduce((a, p) => a + p.print.hours, 0), 1);
    return h`<li>${list[0].materialName}: ${plural(list.length, "part")}, ${g} g of filament, ${hr} h of printer time.${r && r.qty != null ? ` Buy ${r.qty} × ${r.unit}.` : ""}</li>`;
  });
  return h`<div class="card printlist"><h2>Print list</h2>
    <p class="lede sm">Print these parts on a 3D printer. Grams and hours are for one part. The printer time is waiting time in the step that prints the parts.</p>
    <div class="scroll"><table class="prints"><thead><tr><th>Part</th><th>Name</th><th class="n">Qty</th><th class="n">Grams each</th><th class="n">Hours each</th><th>Material</th><th>Settings</th></tr></thead><tbody>${rows}</tbody></table></div>
    <ul class="notes">${sums}</ul></div>`;
}

// ---------- Build: one step card (also used for the printed list)
function stepCard(i, { print = false } = {}) {
  const s = D.steps[i];
  const parts = group(D.parts.filter((p) => p.step === i), (p) => p.label);
  const fast = group(s.fasteners, (f) => f.material);
  const uses = Object.entries(s.uses ?? {});
  // a prints step: the parts the printer makes here and the printer time (inside the wait), as plan.md "Prints:"
  const printing = group(D.parts.filter((p) => p.print && p.print.step === i), (p) => p.label);
  const time = (s.minutes > 0 || s.wait > 0) && `${s.minutes > 0 ? dur(work(s.minutes)) : ""}${s.wait > 0 ? `${s.minutes > 0 ? " + " : ""}${dur(s.wait)} wait` : ""}`;
  const tools = (s.tools ?? []).map((id) => TOOL.get(id) ?? { name: id });
  const cards = (s.teach ?? []).filter((id) => D.techniques && Object.hasOwn(D.techniques, id)).map((id) => {
    const c = D.techniques[id], first = FIRST.get(id) === i, open = first && (print || S.level === "new");
    return h`<details class="tech"${open ? h` open` : ""}><summary>${c.name}${!first && h`<span class="see">see step ${FIRST.get(id) + 1}</span>`}</summary><div class="in">
      <ol>${c.do.map((d) => h`<li>${d}</li>`)}</ol>${c.tools?.length > 0 && h`<p class="tl">Tools: ${c.tools.join(", ")}</p>`}${c.why && h`<p class="why"><b>Why</b>${c.why}</p>`}</div></details>`;
  });
  return h`
    <div class="eyebrow">Step ${i + 1} of ${N} · ${s.phase || "Build"}</div>
    ${print ? h`<h2>${i + 1}. ${s.title}</h2>` : h`<h2 id="jig-step-title" tabindex="-1">${s.title}</h2>`}
    <div class="meta">${time && h`<span class="pill">${time}</span>`}
      ${printing.length > 0 && h`<span class="pill">Print: ${printing.map(([label, list]) => `${list.length} × ${label} ${list[0].name}`).join(", ")} · ${dur(s.printMinutes)} printer time</span>`}
      ${parts.map(([label, list]) => h`<span class="pill part"><b>${label}</b> ${list.length > 1 ? `${list.length} × ` : ""}${list[0].name}</span>`)}
      ${fast.map(([id, list]) => h`<span class="pill">${list.reduce((a, f) => a + (f.count ?? 1), 0)} × ${mat(id).name}${mat(id).spec ? `, ${mat(id).spec}` : ""}</span>`)}
      ${uses.map(([id, q]) => h`<span class="pill">${mat(id).unit && !byPiece(mat(id)) ? plural(amount(q), mat(id).unit) : `${amount(q)} ×`} ${mat(id).name}${mat(id).spec ? `, ${mat(id).spec}` : ""}</span>`)}
      ${s.finish && h`<span class="pill">Finish: ${mat(s.finish.material).name}${s.finish.coats > 0 ? `, ${plural(s.finish.coats, "coat")}` : ""}</span>`}</div>
    ${tools.length > 0 && h`<div class="meta">${tools.map((t) => h`<span class="pill${t.ppe ? " ppe" : ""}">${t.name}</span>`)}</div>`}
    ${warningsOf(s).map(warnBox)}
    ${(s.do ?? []).length > 0 && h`<ol class="do">${s.do.map((d) => (typeof d === "string" ? h`<li>${d}</li>` : h`<li${d.new ? h` class="new only-new"` : ""}>${d.new && h`<span class="sr-only">First time: </span>`}${d.t}</li>`))}</ol>`}
    ${cards}
    ${s.check && h`<label class="check"><input type="checkbox"${print ? "" : h` data-done="${s.id}"`}${!print && S.done[s.id] ? h` checked` : ""}><span><b>Check.</b> ${s.check}</span></label>`}
    ${s.why && h`<p class="why only-new"><b>Why</b>${s.why}</p>`}
    ${s.tip && h`<p class="tip not-pro"><b>Tip</b>${s.tip}</p>`}`;
}
function buildShell() {
  if (!N) return h`<p class="empty">This guide has no steps.</p>`;
  let phase = null;
  const rail = D.steps.map((s, i) => { const sep = i > 0 && s.phase !== phase; phase = s.phase; return h`${sep && h`<span class="sep" aria-hidden="true"></span>`}${stepChip(i)}`; });
  return h`<nav class="rail" aria-label="Steps">${rail}</nav>
  <div class="build"><div class="stage">${viewerBox("steps")}<p class="vnote" data-vnote aria-hidden="true" hidden></p></div><article class="card step" aria-labelledby="jig-step-title" data-step></article></div>
  <section class="print-only" data-print></section>`;
}
const readout = (i) => {
  const s = D.steps[i], k = D.parts.filter((p) => p.step === i).length, n = fastCount(s), coat = s.finish?.parts?.length ?? 0;
  if (s.pose === "kit") return "parts on the floor";
  if (!k && !n && coat) return `finish on ${plural(coat, "part")}`;
  // a step that only shows props (the wall, the ground): name them, not "0 parts · 0 fasteners". A label that comes
  // more than once shows its count ("2 × Front leg"), and after 3 labels the line gives only the count of the rest.
  if (!k && !n) {
    const c = new Map();
    for (const id of s.props ?? []) { const l = (D.props && Object.hasOwn(D.props, id) && D.props[id].label) || id; c.set(l, (c.get(l) ?? 0) + 1); }
    const names = [...c].map(([l, m]) => (m > 1 ? `${m} × ${l}` : l));
    const list = names.length > 3 ? `${names.slice(0, 2).join(", ")} and ${names.length - 2} more` : names.join(", ");
    return list ? `no new parts · ${list}` : "no new parts";
  }
  return `${plural(k, "part")} · ${plural(n, "fastener")}`;
};
const KEYS = "Use the arrow keys to turn it. Use + and - to zoom.";
// step view.note: a note on the 3D view only ("The picture shows the cube upright."), at every level. It is under the
// view and in the canvas label, never in the step card, so print, the no-script copy and plan.md do not show it. The
// line under the view has aria-hidden, so a screen reader reads the note one time, in the label.
const viewNote = (i) => (typeof D.steps[i].view?.note === "string" ? D.steps[i].view.note.trim() : "");
const stepLabel = (i) => `3D view of step ${i + 1} of ${N}: ${D.steps[i].title}. ${D.steps[i].pose === "kit" ? "The cut parts lie on the floor." : `${readout(i).replace(" · ", ", ").replace(/^./, (c) => c.toUpperCase())}.`} ${viewNote(i) ? `${viewNote(i)} ` : ""}${KEYS}`;

// ---------- mount
const single = TABS.length === 1, levels = TABS.includes("plan") || TABS.includes("build");
const SHELL = { plan: planShell, shop: () => h`<div data-fill="shop"></div>`, cut: () => h`<div data-fill="cut"></div>`, build: buildShell };
root.toggleAttribute("data-single", single);
root.innerHTML = String(h`
<header class="top"><div><div class="eyebrow">DIY guide · ${plural(D.parts.length, "part")} · ${plural(N, "step")}</div><h1>${D.meta.title}</h1>${D.meta.summary && h`<p class="lede">${D.meta.summary}</p>`}</div>
${levels && h`<div class="level" role="group" aria-label="Your experience"><span class="eyebrow" aria-hidden="true">Your experience</span>${LEVELS.map(([k, n]) => h`<button type="button" data-level="${k}" aria-pressed="false">${n}</button>`)}</div>`}</header>
${!single && h`<div class="tabs" role="tablist" aria-label="Guide sections">${TABS.map((t) => h`<button type="button" role="tab" id="jig-tab-${t}" aria-controls="jig-panel-${t}" aria-selected="false" tabindex="-1" data-tab="${t}">${NAMES[t]}</button>`)}</div>`}
${TABS.map((t) => h`<section id="jig-panel-${t}" data-panel="${t}" ${single ? h`aria-label="${NAMES[t]}"` : h`role="tabpanel" aria-labelledby="jig-tab-${t}" tabindex="0"`} hidden>${SHELL[t]()}</section>`)}
<p class="sr-only" role="status" aria-live="polite" data-live></p>`);
const fill = (name, html) => { const el = $(`[data-fill="${name}"]`); if (el) el.innerHTML = String(html); };

let current = null, heroView = null, stepsView = null, fitWidth = 0, boqWidth = 0;
function renderLevel() {
  root.dataset.level = S.level;
  $$("[data-level]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.level === S.level)));
  fill("plan", planText());
  const pr = $("[data-print]");
  if (pr) pr.innerHTML = String(h`<h2>Steps</h2>${D.steps.map((_, i) => h`<div class="card">${stepCard(i, { print: true })}</div>`)}`);
  if (N && $("[data-step]")) showStep(S.step, false);
}
const setHash = () => { try { history.replaceState(null, "", current === "build" && N ? `#build/${S.step + 1}` : `#${current}`); } catch {} };
function markRail() {
  $$(".rail [data-go]").forEach((b) => {
    const k = Number(b.dataset.go), done = Boolean(S.done[D.steps[k].id]);
    b.toggleAttribute("data-done", done);
    b.setAttribute("aria-label", `Step ${k + 1}: ${D.steps[k].title}${done ? " (done)" : ""}`);
    if (k === S.step) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
  });
}
// Keep the current chip inside the rail (it scrolls sideways on narrow screens).
function railScroll() {
  const rail = $(".rail"), chip = $(`.rail [data-go="${S.step}"]`);
  if (!rail || !chip || !rail.clientWidth) return;
  const a = rail.getBoundingClientRect(), b = chip.getBoundingClientRect();
  if (b.left < a.left || b.right > a.right) rail.scrollLeft += b.left - a.left - a.width / 2 + b.width / 2;
}
function showStep(i, fly = true) {
  S.step = clamp(i);
  save();
  const s = D.steps[S.step], last = S.step === N - 1;
  $("[data-step]").innerHTML = String(h`${stepCard(S.step)}<div class="nav"><button type="button" data-prev${S.step === 0 ? h` disabled` : ""}>← Back</button><button type="button" class="primary" data-next>${last ? "Finish ✓" : "Next step →"}</button></div>`);
  markRail();
  railScroll();
  const ro = $("[data-readout]"), vn = $("[data-vnote]");
  // the readout has aria-hidden (the canvas label says the same); the title shows the full text if the line ends in "…"
  if (ro) ro.title = ro.textContent = `${String(S.step + 1).padStart(2, "0")} / ${N} · ${readout(S.step)}`;
  if (vn) { vn.textContent = viewNote(S.step); vn.hidden = !vn.textContent; }
  stepsView?.label(stepLabel(S.step));
  stepsView?.go(S.step, fly);
  if (current === "build") setHash();
  return s;
}
// The Parts table fits its card. Cut sizes stay on one line and the material has its own column until the table would
// scroll sideways. Then, one stage at a time while it still would (data-fit): the material goes under the name
// ("stack"), the sizes wrap after a "×" ("wrap"), the Parts card takes the full width of the tab ("wide"), a long
// material name breaks inside a word ("mat"), and last a long part name breaks too ("break"). So a wide font (the
// page text is the system font) never breaks a short name while there is room to give. It fits again only when the
// width of the tab changes, so its own change of size cannot loop.
function fitParts(force = false) {
  const t = $("table.parts"), s = t?.parentElement, w = t?.closest(".grid2")?.clientWidth ?? 0;
  if (!t || (w === fitWidth && !force)) return;
  fitWidth = w;
  if (!w) return; // a hidden tab: fit when it shows
  const over = () => s.scrollWidth > s.clientWidth + 1;
  t.removeAttribute("data-fit");
  for (const f of ["stack", "stack wrap", "wide", "wide stack", "wide stack wrap", "wide stack wrap mat", "wide stack wrap mat break"]) { if (!over()) break; t.dataset.fit = f; }
}
// The BOQ fits its card, one stage at a time while the table would scroll sideways. First a word of 20 letters or
// more (data-long) breaks inside the word (data-break), in one item cell at a time, the cell with the widest word
// first; so "Sandpaper" stays whole next to a 40-letter material name. Then the Buy and Rate cells wrap at a space
// (data-fit "wrap"), and last each row stacks as on a phone ("wrap stack"). A short word never breaks, whatever the
// width of the system font. Under 601 px each row is a grid and page.css breaks a word only when it is longer than
// the line. Same width memo rule.
function fitBoq(force = false) {
  const t = $("[data-panel=shop] table.boq"), s = t?.closest(".scroll"), w = s?.clientWidth ?? 0;
  if (!t || (w === boqWidth && !force)) return;
  boqWidth = w;
  if (!w) return;
  const over = () => s.scrollWidth > s.clientWidth + 1, cells = $$("tbody td:nth-child(2)", t);
  t.removeAttribute("data-fit");
  cells.forEach((td) => td.removeAttribute("data-break"));
  if (!over()) return;
  const rg = document.createRange(), widest = (td) => {
    let m = 0;
    for (let tw = document.createTreeWalker(td, NodeFilter.SHOW_TEXT), n = tw.nextNode(); n; n = tw.nextNode()) for (const x of n.data.matchAll(/\S+/g)) {
      rg.setStart(n, x.index);
      rg.setEnd(n, x.index + x[0].length);
      m = Math.max(m, rg.getBoundingClientRect().width);
    }
    return m;
  };
  for (const [td] of cells.filter((td) => td.hasAttribute("data-long")).map((td) => [td, widest(td)]).sort((a, b) => b[1] - a[1])) { td.dataset.break = ""; if (!over()) return; }
  for (const f of ["wrap", "wrap stack"]) { t.dataset.fit = f; if (!over()) return; }
}
function tab(name, { focus = false, hash = true } = {}) {
  current = name;
  S.tab = name;
  save();
  $$("[data-tab]").forEach((b) => { const on = b.dataset.tab === name; b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; });
  $$("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== name));
  if (name === "cut") fitParts();
  if (name === "shop") fitBoq();
  if (name === "build") railScroll();
  if (focus) $(`[data-tab="${name}"]`)?.focus();
  if (hash) setHash();
}
const live = $("[data-live]");
const announce = (msg) => { live.textContent = ""; setTimeout(() => (live.textContent = msg), 60); };
// After a step change: announce it, focus the step heading, and bring the view (narrow screens) or the heading into sight.
function go(i, { force = false } = {}) {
  if (!TABS.includes("build") || !N) return;
  const k = clamp(i), away = current !== "build";
  if (k === S.step && !away && !force) return;
  if (away) tab("build", { hash: false });
  const s = showStep(k, true);
  announce(`Step ${k + 1} of ${N}: ${s.title}`);
  const hd = $("#jig-step-title");
  if (!hd) return;
  hd.focus({ preventScroll: true });
  // scroll when the target is above the screen, under the sticky tab bar, or low on the screen
  const target = matchMedia("(max-width: 860px)").matches ? $(".build .stage") : hd, r = target.getBoundingClientRect();
  if (away || r.top < ($(".tabs")?.getBoundingClientRect().bottom ?? 0) || r.top > innerHeight * 0.7) target.scrollIntoView({ block: "start", behavior: REDUCED.matches ? "auto" : "smooth" });
}

document.addEventListener("click", (e) => {
  const t = e.target.closest?.("button");
  if (!t || !root.contains(t)) return;
  const d = t.dataset;
  if (d.level) { S.level = d.level; save(); renderLevel(); }
  else if (d.tab) tab(d.tab);
  else if (d.tabGo) tab(d.tabGo, { focus: true });
  else if (d.go !== undefined) go(Number(d.go), { force: current !== "build" });
  else if (t.matches("[data-prev]")) go(S.step - 1);
  else if (t.matches("[data-next]")) {
    // Next marks a step done only when it has no Check box: the reader ticks the check, so the box and the rail agree
    const cur = D.steps[S.step];
    if (!cur.check) S.done[cur.id] = true;
    save();
    markRail();
    if (S.step < N - 1) go(S.step + 1);
    else announce("You finished the last step.");
  } else if (d.v === "spin") heroView?.spin(!heroView.spinning);
  else if (d.v === "replay") stepsView?.replay();
  else if (d.v === "reset") stepsView?.reset();
  else if ((d.v === "explode" || d.v === "ghost" || d.v === "xray") && t.getAttribute("aria-disabled") !== "true") { const on = t.getAttribute("aria-pressed") !== "true"; t.setAttribute("aria-pressed", String(on)); stepsView?.[d.v](on); }
});
// a motion slider: the reader drives the part, and the tour stops
const showMotion = (m, k) => {
  const v = motionValue(m, k), input = $(`[data-motion="${CSS.escape(m.id)}"]`), out = $(`[data-mout="${CSS.escape(m.id)}"]`);
  if (input && document.activeElement !== input) input.value = String(Math.round(k * 100));
  input?.setAttribute("aria-valuetext", `${m.name}: ${v}`);
  if (out) out.textContent = v;
};
document.addEventListener("input", (e) => {
  const t = e.target, m = t.dataset?.motion !== undefined && MOTIONS.find((x) => x.id === t.dataset.motion);
  if (!m) return;
  const k = Number(t.value) / 100;
  showMotion(m, k);
  heroView?.motion(m.id, k);
});
document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.dataset?.buy) { S.bought[t.dataset.buy] = t.checked; save(); }
  if (t.dataset?.done) { S.done[t.dataset.done] = t.checked; save(); markRail(); }
});
// Tabs: arrow keys, Home and End move between tabs (automatic activation, roving tabindex).
$(".tabs")?.addEventListener("keydown", (e) => {
  const k = TABS.indexOf(current), n = TABS.length;
  const to = { ArrowRight: (k + 1) % n, ArrowLeft: (k - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
  if (to === undefined) return;
  e.preventDefault();
  tab(TABS[to], { focus: true });
});
// Left and right arrows change the step only when focus is in the step card or the step viewer (the focused canvas
// takes the arrows for orbit).
document.addEventListener("keydown", (e) => {
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
  const t = e.target;
  if (current !== "build" || !t.closest?.("article.step, [data-viewer='steps']") || t.closest("input, textarea, select, canvas")) return;
  e.preventDefault();
  go(S.step + (e.key === "ArrowRight" ? 1 : -1));
});
// A typed or linked hash goes through go(), as a click does (announce, focus, scroll); then the URL shows the real step.
// A hash the page does not have (no such tab) changes nothing, and the URL goes back to what the page shows, as on load.
addEventListener("hashchange", () => {
  const r = route();
  if (!r.tab) { setHash(); return; }
  if (r.tab === "build" && r.step !== null && N) go(r.step);
  else if (r.tab !== current) tab(r.tab, { hash: false });
  setHash();
});

// ---------- start: text first, then the 3D
const start = route();
if (start.step !== null) S.step = start.step;
S.step = clamp(S.step);
fill("shop", shopText());
fill("cut", cutText());
renderLevel();
tab(start.tab ?? S.tab, { hash: Boolean(location.hash) });
// fit the Parts table and the BOQ again after a resize (in the next frame, so the observer never sees its own change)
// and when the web fonts arrive
const fitBoxes = [$("table.parts")?.parentElement, $("[data-panel=shop] table.boq")?.closest(".scroll")].filter(Boolean);
if (fitBoxes.length && typeof ResizeObserver === "function") { const ro = new ResizeObserver(() => requestAnimationFrame(() => { fitParts(); fitBoq(); })); fitBoxes.forEach((b) => ro.observe(b)); }
document.fonts?.ready.then(() => { fitParts(true); fitBoq(true); });
const onSpin = (on) => { const b = $('[data-v="spin"]'); if (b) { b.textContent = on ? "Pause" : "Play"; b.setAttribute("aria-label", on ? "Pause the tour" : "Play the tour"); } };
// the tour line under the Plan view: the step that goes in, or the motion and the value its parts show
const onTour = (c) => {
  const line = $("[data-tourline]"), m = c.kind === "motion" ? MOTIONS.find((x) => x.id === c.id) : null;
  // the tour moves one motion at a time and holds every other motion at rest
  if (c.kind !== "off") MOTIONS.forEach((x) => showMotion(x, x === m ? c.k : 0));
  if (line) line.textContent = c.kind === "step" ? `Step ${c.step + 1} · ${c.text}` : m ? `${m.name} · ${motionValue(m, c.k)}${c.text ? ` · ${c.text}` : ""}` : "";
};
const heroHost = $('[data-viewer="hero"]'), stepsHost = $('[data-viewer="steps"]');
if (heroHost) createViewer(heroHost, D, { mode: "hero", onSpin, onTour, label: `3D model of the ${D.meta.title}, finished. ${KEYS}` }).then((v) => { heroView = v; });
if (stepsHost) createViewer(stepsHost, D, { mode: "steps", label: stepLabel(S.step) }).then((v) => { stepsView = v; v?.go(S.step, false); });
