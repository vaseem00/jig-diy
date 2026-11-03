// Cut plans in mm: boards at the lowest total cost, sheets by guillotine packing with kerf and grain.
// Pure and deterministic. Inside, lengths are integer micrometres and money integer millionths, so sums stay exact.
// A length that is not a whole micrometre (1/16 in is 1587.5 µm) rounds toward "fits": a piece, kerf or trim down,
// a stock length or sheet side up. Each value is then off by less than 1 µm, and an exact fit stays a fit.

const UM = 1000, MU = 1e6, EXACT_MAX = 14, NODE_CAP = 1.5e6, TOL = 1e-3, SPREAD = 16;
const dn = (v) => Math.floor(v * UM + 1e-6), up = (v) => Math.ceil(v * UM - 1e-6);
const mm = (u) => u / UM, r3 = (v) => Math.round(v * 1e3) / 1e3;
const fmtMM = (v) => `${Math.round(v * 10) / 10} mm`;

// Natural order for ids and labels: "B2" before "B10".
function nat(a, b) {
  const x = String(a ?? ""), y = String(b ?? "");
  if (x === y) return 0;
  const xs = x.match(/\d+|\D+/g) ?? [], ys = y.match(/\d+|\D+/g) ?? [];
  for (let i = 0; i < xs.length && i < ys.length; i++) {
    const p = xs[i], q = ys[i];
    if (p === q) continue;
    if (/^\d/.test(p) && /^\d/.test(q)) return Number(p) - Number(q) || p.length - q.length || (p < q ? -1 : 1);
    return p < q ? -1 : 1;
  }
  return xs.length - ys.length || (x < y ? -1 : 1);
}

// Plan order: lower cost, then fewer boards or sheets, then less bought stock (less waste).
const better = (a, b) => !b || a.cost < b.cost || (a.cost === b.cost && (a.count < b.count || (a.count === b.count && a.size < b.size)));

// ---- boards

// Stock lengths for cut-to-size timber: step, 2 x step ... up to max, priced pro rata to digits decimals (the minor
// unit of the currency: 2 for USD, 0 for JPY, 3 for BHD).
export function expandPerLength({ price, per, max, step = per }, digits = 2) {
  const out = [], f = 10 ** (Number.isInteger(digits) && digits >= 0 && digits <= 6 ? digits : 2);
  if (!(per > 0 && step > 0)) return out;
  for (let k = 1; k * step <= max + 1e-9; k++) {
    const length = Math.round(k * step * 1e6) / 1e6;
    out.push({ length, price: Math.round((length / per) * price * f + 1e-7) / f });
  }
  return out;
}

// search: "exact" (branch and bound, up to 14 pieces; optimal is false only when it hit its node cap) or "fast" (the
// heuristic, more than 14 pieces; optimal only when the plan meets the lower bound).
export function packLinear(pieces, stock, { kerf = 3, trim = 0, fmt = fmtMM } = {}) {
  const K = dn(kerf), T = dn(trim), S = linearStock(stock, K, T), problems = [], P = [];
  const max = S.n ? S.L[S.n - 1] - T : 0;
  for (const p of pieces) {
    const L = dn(p.len);
    if (S.n && L <= max) P.push({ id: p.id, label: p.label, L, w: L + K });
    else problems.push(tooLong(p, mm(L), S.n ? mm(max) : stock.length ? 0 : null, trim, fmt));
  }
  if (!P.length) return { boards: [], cost: 0, problems, optimal: true, search: "exact" };
  P.sort(pieceCmp);
  let best = heuristic(P, S), optimal;
  const search = P.length <= EXACT_MAX ? "exact" : "fast";
  if (search === "exact") ({ best, optimal } = exact(P, S, best));
  else optimal = best.cost <= Math.max(S.price[0], S.ppm * P.reduce((a, p) => a + p.L, 0)) + TOL; // proven only at the bound
  return { boards: boardsOut(best.bins, P, S, K, T), cost: best.cost / MU, problems, optimal, search };
}

const pieceCmp = (x, y) => y.L - x.L || nat(x.label, y.label) || nat(x.id, y.id);
const cutCmp = (x, y) => y.len - x.len || nat(x.label, y.label) || nat(x.id, y.id);

// max is null when the material has no stock length at all, and 0 when no stock length is longer than the trim.
function tooLong(p, len, max, trim, fmt) {
  if (max === 0 && trim) return {
    level: "error", code: "E_TOO_LONG", id: p.id, where: `part ${p.id}`, len, max,
    msg: `Part ${p.id} is ${fmt(len)} long. No stock length of the material is longer than the ${fmt(trim)} trim.`,
    hint: `Make the trim shorter, or add a stock length of ${fmt(len + trim)} or more to the material.`,
  };
  return {
    level: "error", code: "E_TOO_LONG", id: p.id, where: `part ${p.id}`, len, max: max ?? 0,
    msg: max === null ? `Part ${p.id} is ${fmt(len)} long. The material has no stock length.`
      : `Part ${p.id} is ${fmt(len)} long. The longest stock board holds ${fmt(max)}${trim ? ` after the ${fmt(trim)} trim` : ""}.`,
    hint: `Add a stock length of ${fmt(len + trim)} or more to the material.`,
  };
}

// Usable stock, shortest first. A length that a longer, cheaper one beats is dropped, so price never falls as length grows
// and the cheapest board that holds a load is the shortest one that holds it. A board holds pieces when
// sum(len + kerf) <= length - trim + kerf (its capacity).
function linearStock(stock, K, T) {
  const all = stock.map((s, i) => ({ src: s, L: up(s.length), P: Math.round(s.price * MU), i }))
    .filter((s) => s.L > T).sort((a, b) => a.L - b.L || a.P - b.P || a.i - b.i)
    .filter((s, k, a) => k === 0 || s.L !== a[k - 1].L);
  const list = [];
  for (let k = all.length - 1, minP = Infinity; k >= 0; k--) if (all[k].P <= minP) { list.push(all[k]); minP = all[k].P; }
  list.reverse(); // pushed longest first; unshift is slow on 100,000 per-length stock lengths
  const cap = list.map((s) => s.L - T + K), price = list.map((s) => s.P), L = list.map((s) => s.L);
  // Cheapest price per µm of stock, per µm of capacity, and per µm of capacity when a board steps up in length;
  // least stock length per µm of capacity.
  let ppm = Infinity, ppc = Infinity, mr = Infinity, rho = 1;
  list.forEach((s, k) => {
    ppm = Math.min(ppm, s.P / s.L); ppc = Math.min(ppc, s.P / cap[k]); rho = Math.min(rho, s.L / cap[k]);
    if (k) mr = Math.min(mr, (s.P - price[k - 1]) / (cap[k] - cap[k - 1]));
  });
  // The shortest board that holds a load: direct for evenly spaced lengths (per-length stock), else binary search.
  const d = cap[1] - cap[0], last = cap.length - 1, even = last > 1 && cap.every((c, k) => !k || c - cap[k - 1] === d);
  const fit = even ? (load) => (load <= cap[0] ? 0 : Math.min(last, Math.ceil((load - cap[0]) / d)))
    : (load) => { let lo = 0, hi = last; while (lo < hi) { const m = (lo + hi) >> 1; if (cap[m] >= load) hi = m; else lo = m + 1; } return lo; };
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  // A plan's cost is a sum of prices and its stock length a sum of lengths, so bounds round up to their gcd.
  return { n: list.length, list, cap, price, L, Cmax: cap[cap.length - 1] ?? 0, ppm, ppc, mr, rho, fit, gP: price.reduce(gcd, 0) || 1, gL: L.reduce(gcd, 0) || 1 };
}

function evaluate(bins, P, S) {
  let cost = 0, size = 0;
  for (const b of bins) { const k = S.fit(b.reduce((a, i) => a + P[i].w, 0)); cost += S.price[k]; size += S.L[k]; }
  return { cost, count: bins.length, size, bins };
}

// Greedy plans from every stock capacity (spread over at most 16), then local moves on each plan
// (on the best three only above 40 pieces, where moves get slow). The first plan is the v0.1 plan
// (first fit into the longest stock, then the cheapest length per board), so the result is never worse than v0.1.
function heuristic(P, S) {
  const caps = S.n <= SPREAD ? S.cap : [...new Set(Array.from({ length: SPREAD }, (_, k) => S.cap[Math.round((k * (S.n - 1)) / (SPREAD - 1))]))];
  const plans = [evaluate(greedy(P, S, S.Cmax, false), P, S)];
  for (const C of caps) for (const bestFit of [true, false]) plans.push(evaluate(greedy(P, S, C, bestFit), P, S));
  plans.sort((a, b) => (better(a, b) ? -1 : better(b, a) ? 1 : 0)); // stable: ties keep their order
  let best = plans[0];
  for (const p of P.length > 40 ? plans.slice(0, 3) : plans) { const e = evaluate(improve(p.bins, P, S), P, S); if (better(e, best)) best = e; }
  return best;
}

// First fit (or best fit) decreasing into boards of capacity C. A piece longer than C opens the shortest board that holds it.
function greedy(P, S, C, bestFit) {
  const bins = [], loads = [], caps = [];
  P.forEach((p, i) => {
    let pick = -1;
    for (let j = 0; j < bins.length; j++) {
      if (loads[j] + p.w > caps[j]) continue;
      if (!bestFit) { pick = j; break; }
      if (pick < 0 || caps[j] - loads[j] < caps[pick] - loads[pick]) pick = j;
    }
    if (pick < 0) { pick = bins.length; bins.push([]); loads.push(0); caps.push(p.w <= C ? C : S.cap[S.fit(p.w)]); }
    bins[pick].push(i);
    loads[pick] += p.w;
  });
  return bins;
}

// Local moves: move one piece (to another board or a new one) or swap two pieces, so a board drops to a cheaper length.
// Each round applies the move that lowers (cost, boards, stock length) the most; stop when no move helps.
function improve(start, P, S) {
  let bins = start.map((b) => b.slice());
  const c = (l) => (l ? S.price[S.fit(l)] : 0), ln = (l) => (l ? S.L[S.fit(l)] : 0);
  for (let round = 0; round < 1000; round++) {
    const loads = bins.map((b) => b.reduce((a, i) => a + P[i].w, 0));
    let best = null;
    const offer = (dc, db, dl, act) => {
      if (!(dc < 0 || (dc === 0 && (db < 0 || (db === 0 && dl < 0))))) return;
      if (!best || dc < best.dc || (dc === best.dc && (db < best.db || (db === best.db && dl < best.dl)))) best = { dc, db, dl, act };
    };
    for (let a = 0; a < bins.length; a++) {
      const la = loads[a], ca = c(la), lna = ln(la);
      for (let x = 0; x < bins[a].length; x++) {
        const w = P[bins[a][x]].w, na = la - w, cna = c(na), lnna = ln(na);
        if (na) offer(cna + c(w) - ca, 1, lnna + ln(w) - lna, [a, x, -1, -1]);
        for (let b = 0; b < bins.length; b++) {
          if (b === a) continue;
          const lb = loads[b], cb = c(lb), lnb = ln(lb);
          if (lb + w <= S.Cmax) offer(cna + c(lb + w) - ca - cb, na ? 0 : -1, lnna + ln(lb + w) - lna - lnb, [a, x, b, -1]);
          if (b < a) continue;
          for (let y = 0; y < bins[b].length; y++) {
            const v = P[bins[b][y]].w, a2 = la - w + v, b2 = lb - v + w;
            if (v === w || a2 > S.Cmax || b2 > S.Cmax) continue;
            offer(c(a2) + c(b2) - ca - cb, 0, ln(a2) + ln(b2) - lna - lnb, [a, x, b, y]);
          }
        }
      }
    }
    if (!best) break;
    const [a, x, b, y] = best.act;
    if (y >= 0) [bins[a][x], bins[b][y]] = [bins[b][y], bins[a][x]];
    else { const [i] = bins[a].splice(x, 1); if (b < 0) bins.push([i]); else bins[b].push(i); }
    bins = bins.filter((q) => q.length);
  }
  return bins;
}

// Exact minimum by branch and bound over piece-to-board assignments, longest piece first. Symmetry: pieces of equal
// length fill boards in order, and boards with equal loads are tried once. Price bound, in capacity units (len + kerf):
// the remaining pieces fill free room under each bought length at 0, then room up to the longest stock at the cheapest
// step-up rate, then new boards at the cheapest price per unit. A board that the shortest piece does not fit is closed
// and gives no room. Board count and stock length have bounds of their own.
// Over NODE_CAP nodes it returns the best plan found (optimal: false).
function exact(P, S, init) {
  const n = P.length, zeros = (k) => Array(k).fill(0), W = P.map((p) => p.w), Ln = P.map((p) => p.L), fW = W.map(S.fit);
  const remW = zeros(n + 1), remL = zeros(n + 1);
  for (let i = n - 1; i >= 0; i--) { remW[i] = remW[i + 1] + W[i]; remL[i] = remL[i + 1] + Ln[i]; }
  const { cap, price, L, Cmax, ppm, ppc, mr, rho, gP, gL, fit } = S, wMin = W[n - 1];
  const loads = zeros(n), at = zeros(n), caps = zeros(n), assign = zeros(n), seen = Array.from({ length: n }, () => zeros(n));
  let best = init, bc = best.cost, bn = best.count, bs = best.size, cost = 0, size = 0, nb = 0, nodes = 0, done = true;
  const go = (i) => {
    if (++nodes > NODE_CAP) { done = false; return; }
    if (i === n) {
      if (cost < bc || (cost === bc && (nb < bn || (nb === bn && size < bs)))) {
        best = { cost, count: nb, size, bins: Array.from({ length: nb }, (_, j) => [...assign.keys()].filter((p) => assign[p] === j)) };
        bc = cost; bn = nb; bs = size;
      }
      return;
    }
    let free = 0, grow = 0, room = 0, total = 0;
    for (let j = 0; j < nb; j++) {
      const l = loads[j], r = Cmax - l;
      if (r < wMin) continue;
      free += caps[j] - l; grow += Cmax - caps[j]; total += r;
      if (r > room) room = r;
    }
    const wi = W[i], open = wi > room, k0 = fW[i], j0 = open ? i + 1 : i;
    let lb = cost;
    if (open) { free += cap[k0] - wi; grow += Cmax - cap[k0]; lb += price[k0]; }
    // Load (len + kerf) and plain length past the free room, each filled at the cheapest rates:
    // step-up room first when it is cheaper than new boards.
    const rw = remW[j0] - free, rl = remL[j0] - free, g = mr < ppc || mr < ppm ? grow : 0;
    let fw = 0, fl = 0;
    if (rw > 0) fw = mr < ppc ? Math.min(rw, g) * mr + Math.max(0, rw - g) * ppc : rw * ppc;
    if (rl > 0) fl = mr < ppm ? Math.min(rl, g) * mr + Math.max(0, rl - g) * ppm : rl * ppm;
    lb += (fw > fl ? fw : fl) - TOL;
    // Costs are multiples of gP and lengths of gL: a bound above best - g rounds up to best.
    if (lb > bc) return;
    if (lb > bc - gP) {
      const lbCount = nb + Math.max(open ? 1 : 0, Math.ceil((remW[i] - total) / Cmax));
      if (lbCount > bn) return;
      if (lbCount === bn && size + (open ? L[k0] : 0) + Math.max(0, rl, rho * rw) - TOL > bs - gL) return;
    }
    const tried = seen[i];
    let nt = 0;
    for (let j = i && Ln[i] === Ln[i - 1] ? assign[i - 1] : 0; j < nb; j++) {
      const l = loads[j], nl = l + wi;
      if (nl > Cmax) continue;
      let t = 0;
      while (t < nt && tried[t] !== l) t++;
      if (t < nt) continue;
      tried[nt++] = l;
      const o = at[j], k = nl > caps[j] ? fit(nl) : o, dc = price[k] - price[o], ds = L[k] - L[o];
      cost += dc; size += ds; loads[j] = nl; at[j] = k; caps[j] = cap[k]; assign[i] = j;
      go(i + 1);
      cost -= dc; size -= ds; loads[j] = l; at[j] = o; caps[j] = cap[o];
      if (!done) return;
    }
    loads[nb] = wi; at[nb] = k0; caps[nb] = cap[k0]; assign[i] = nb; nb++; cost += price[k0]; size += L[k0];
    go(i + 1);
    nb--; cost -= price[k0]; size -= L[k0];
  };
  go(0);
  return { best, optimal: done };
}

// Boards out: cuts longest first from the trim end, each board at the cheapest stock that holds it.
function boardsOut(bins, P, S, K, T) {
  return bins.map((b) => {
    const ps = b.map((i) => P[i]).sort(pieceCmp), s = S.list[S.fit(ps.reduce((a, p) => a + p.w, 0))];
    let x = T;
    const cuts = ps.map((p) => { const c = { id: p.id, label: p.label, len: mm(p.L), at: mm(x) }; x += p.L + K; return c; });
    return { stock: { length: s.src.length, price: s.src.price }, cuts, used: mm(x - K), waste: mm(s.L - x + K) };
  }).sort((p, q) => q.stock.length - p.stock.length || cutsCmp(p.cuts, q.cuts));
}

function cutsCmp(a, b) {
  for (let i = 0; i < a.length && i < b.length; i++) { const d = cutCmp(a[i], b[i]); if (d) return d; }
  return b.length - a.length;
}

// ---- sheets

const ORDERS = [
  (x, y) => y.A * y.B - x.A * x.B || y.A - x.A || y.B - x.B || x.n - y.n, // area
  (x, y) => y.A - x.A || y.B - x.B || x.n - y.n, // long side
  (x, y) => y.B - x.B || y.A - x.A || x.n - y.n, // short side
];

// Allowed placements [w along x, h along y, rotated]. Rotated means the long side a runs along y (across the grain).
function orients(A, B, g) {
  if (A === B) return [[A, B, g === "across"]];
  if (g === "along") return [[A, B, false]];
  if (g === "across") return [[B, A, true]];
  return [[A, B, false], [B, A, true]];
}

export function packSheets(pieces, stock, { kerf = 3, grain = false, fmt = fmtMM } = {}) {
  const K = dn(kerf), problems = [], items = [];
  const sizes = stock.map((s, i) => {
    const w = Math.max(s.w, s.h), h = Math.min(s.w, s.h);
    return { W: up(w), H: up(h), P: Math.round(s.price * MU), i, src: { w, h, price: s.price } };
  }).sort((a, b) => a.P - b.P || a.W * a.H - b.W * b.H || a.i - b.i); // cheapest first
  pieces.forEach((p, n) => {
    const A = dn(Math.max(p.a, p.b)), B = dn(Math.min(p.a, p.b)), g = grain ? p.grain ?? "along" : "any", or = orients(A, B, g);
    if (sizes.some((z) => or.some(([w, h]) => w <= z.W && h <= z.H))) items.push({ id: p.id, label: p.label, A, B, or, n });
    else problems.push(sheetFit(p, A, B, g, sizes, fmt));
  });
  if (!items.length) return { sheets: [], cost: 0, problems };
  const ctx = { sizes, K, grain, memo: new Map() };
  const layouts = sizes.filter((z, k) => sizes.findIndex((y) => y.W === z.W && y.H === z.H) === k)
    .sort((a, b) => b.W * b.H - a.W * a.H || b.W - a.W || a.i - b.i);
  let best = null;
  const offer = (layout) => { const r = finish(layout, ctx); if (better(r, best)) best = r; };
  for (const z of layouts) {
    offer(shelf(items, z, ctx));
    for (const ord of ORDERS) {
      const list = [...items].sort(ord);
      for (const fit of [0, 1]) for (const split of [0, 1]) offer(guillotine(list, z, ctx, fit, split, false));
    }
  }
  const sheets = best.sheets.map(sheetOut).sort((p, q) => q.stock.w * q.stock.h - p.stock.w * p.stock.h);
  return { sheets, cost: best.cost / MU, problems };
}

function sheetFit(p, A, B, g, sizes, fmt) {
  const dims = `${fmt(mm(A))} × ${fmt(mm(B))}`;
  const turn = g !== "any" && sizes.some((z) => (A <= z.W && B <= z.H) || (B <= z.W && A <= z.H));
  return {
    level: "error", code: "E_SHEET_FIT", id: p.id, where: `part ${p.id}`, a: mm(A), b: mm(B),
    msg: turn ? `Part ${p.id} (${dims}) fits a sheet only with its grain turned 90 degrees. Its grain setting does not allow this.`
      : `Part ${p.id} (${dims}) is larger than each stock sheet.`,
    hint: turn ? `If the grain direction is not important, set grain to "any" on the part.` : `Add a sheet of ${dims} or larger to the material.`,
  };
}

// The sheet size for a new sheet: the layout size when the piece fits it, else the cheapest size that holds the piece.
const holder = (it, pref, ctx) => [pref, ...ctx.sizes].find((z) => it.or.some(([w, h]) => w <= z.W && h <= z.H));

// The v0.1 shelf plan: rows along x, first fit, short side first. It is a floor that the guillotine plans must beat.
function shelf(items, pref, ctx) {
  const sheets = [], K = ctx.K;
  for (const it of [...items].sort((x, y) => y.B - x.B || y.A - x.A)) {
    let done = false;
    for (const s of sheets) {
      const o = it.or.find(([w, h]) => w <= s.W && h <= s.H);
      if (!o) continue;
      const [w, h, rot] = o, row = s.rows.find((r) => h <= r.h && r.x + w <= s.W);
      if (row) { s.cuts.push({ it, x: row.x, y: row.y, w, h, rot }); row.x += w + K; done = true; break; }
      const y = s.rows.reduce((a, r) => a + r.h + K, 0);
      if (y + h <= s.H) { s.rows.push({ y, h, x: w + K }); s.cuts.push({ it, x: 0, y, w, h, rot }); done = true; break; }
    }
    if (done) continue;
    const z = holder(it, pref, ctx), [w, h, rot] = it.or.find(([a, b]) => a <= z.W && b <= z.H);
    sheets.push({ W: z.W, H: z.H, rows: [{ y: 0, h, x: w + K }], cuts: [{ it, x: 0, y: 0, w, h, rot }] });
  }
  return sheets;
}

// Guillotine packing: each piece goes to the free rectangle over all open sheets that fits it best
// (fit 0: best short side, fit 1: best area). The piece splits its rectangle in two along the shorter (split 0)
// or longer (split 1) leftover axis, with a kerf strip between the piece and each new rectangle.
// With one = true it packs onto a single sheet of size pref, or returns null.
function guillotine(list, pref, ctx, fit, split, one) {
  const sheets = [], K = ctx.K;
  for (const it of list) {
    let best = null;
    const scan = (s) => {
      for (let f = 0; f < s.free.length; f++) {
        const F = s.free[f];
        for (const o of it.or) {
          if (o[0] > F.w || o[1] > F.h) continue;
          const dw = F.w - o[0], dh = F.h - o[1];
          const a = fit ? F.w * F.h - o[0] * o[1] : Math.min(dw, dh), b = fit ? Math.min(dw, dh) : Math.max(dw, dh);
          if (!best || a < best.a || (a === best.a && b < best.b)) best = { s, f, o, a, b };
        }
      }
    };
    sheets.forEach(scan);
    if (!best) {
      if (one && sheets.length) return null;
      const z = one ? pref : holder(it, pref, ctx);
      const s = { W: z.W, H: z.H, free: [{ x: 0, y: 0, w: z.W, h: z.H }], cuts: [] };
      sheets.push(s);
      scan(s);
      if (!best) return null;
    }
    const { s, f, o: [w, h, rot] } = best, F = s.free[f];
    s.free.splice(f, 1);
    s.cuts.push({ it, x: F.x, y: F.y, w, h, rot });
    const dw = F.w - w, dh = F.h - h, full = split ? dw > dh : dw <= dh; // full: the cut runs across the full width of F
    const R = { x: F.x + w + K, y: F.y, w: dw - K, h: full ? h : F.h }, T = { x: F.x, y: F.y + h + K, w: full ? F.w : w, h: dh - K };
    for (const r of [R, T]) if (r.w > 0 && r.h > 0) s.free.push(r);
  }
  return sheets;
}

// Buy each layout sheet at the cheapest stock that holds its used box, or at a cheaper stock when its pieces
// repack onto one sheet of that size.
function finish(layout, ctx) {
  let cost = 0, size = 0;
  const sheets = layout.map((s) => {
    let b = buy(s.cuts, ctx);
    for (const z of ctx.sizes) {
      if (z.P >= b.z.P) break;
      const one = repack(s.cuts.map((c) => c.it), z, ctx);
      if (one) { b = buy(one.cuts, ctx); break; }
    }
    cost += b.z.P;
    size += b.z.W * b.z.H;
    return b;
  });
  return { cost, count: sheets.length, size, sheets };
}

// The cheapest stock that holds the used box of a layout. Without grain the layout may turn 90 degrees.
function buy(cuts, ctx) {
  const bx = Math.max(...cuts.map((c) => c.x + c.w)), by = Math.max(...cuts.map((c) => c.y + c.h));
  for (const z of ctx.sizes) {
    if (bx <= z.W && by <= z.H) return { z, cuts };
    if (!ctx.grain && by <= z.W && bx <= z.H) return { z, cuts: cuts.map(turn) };
  }
}

const turn = (c) => ({ ...c, x: c.y, y: c.x, w: c.h, h: c.w, rot: c.it.A === c.it.B ? c.rot : !c.rot });

// Pack a set of pieces onto one sheet of size z, or null. Results are kept per (size, pieces).
function repack(list, z, ctx) {
  const key = `${z.i}:${list.map((it) => it.n).sort((a, b) => a - b).join(",")}`;
  if (ctx.memo.has(key)) return ctx.memo.get(key);
  let out = null;
  if (list.reduce((a, it) => a + it.A * it.B, 0) <= z.W * z.H && list.every((it) => it.or.some(([w, h]) => w <= z.W && h <= z.H))) {
    search: for (const ord of ORDERS) {
      const sorted = [...list].sort(ord);
      for (const fit of [0, 1]) for (const split of [0, 1]) {
        const g = guillotine(sorted, z, ctx, fit, split, true);
        if (g) { out = g[0]; break search; }
      }
    }
  }
  ctx.memo.set(key, out);
  return out;
}

function sheetOut({ z, cuts }) {
  const used = cuts.reduce((a, c) => a + c.it.A * c.it.B, 0) / 1e6;
  return {
    stock: { ...z.src },
    cuts: [...cuts].sort((p, q) => p.y - q.y || p.x - q.x)
      .map((c) => ({ id: c.it.id, label: c.it.label, x: mm(c.x), y: mm(c.y), w: mm(c.w), h: mm(c.h), rotated: c.rot })),
    usedArea: r3(used), waste: r3((z.W * z.H) / 1e6 - used),
  };
}
