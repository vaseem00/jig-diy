// STE-style linter: checks reader text against the ASD-STE100 writing rules that a script can test.
// It does not hold the STE dictionary; REPLACE lists common words that STE replaces. The standard is the authority.

export const LIMITS = { procedure: 20, title: 10, warning: 20, description: 25 };

// Words (and a few phrases) that STE writers replace, with the usual replacement. "(...)" is an action, not a word.
// No prototype: "constructor" or "toString" in a text is a word, not an entry.
export const REPLACE = Object.assign(Object.create(null), {
  ensure: "make sure", verify: "make sure", check: "examine / make sure", inspect: "examine", utilize: "use", utilise: "use",
  commence: "start", begin: "start", initiate: "start", terminate: "stop", approximately: "about", approx: "about",
  prior: "before", subsequent: "after", subsequently: "then", sufficient: "enough", additional: "more",
  assist: "help", obtain: "get", perform: "do", locate: "find", attempt: "try", adjacent: "near / next to",
  require: "is necessary", required: "necessary", requires: "is necessary", allow: "let", avoid: "do not",
  place: "put", position: "put", fix: "attach", secure: "attach / tighten",
  should: "(write a command)", could: "can", might: "can", would: "(remove)", please: "(remove)",
  basically: "(remove)", simply: "(remove)", just: "(remove)", easily: "(remove)", very: "(remove)", really: "(remove)", quite: "(remove)",
  gently: "carefully / slowly", properly: "correctly", securely: "tightly", firmly: "tightly",
  etc: "(write the list)", "e.g": "(write the item)", eg: "(write the item)", "i.e": "(write it out)",
  "in order to": "to", "as well as": "and", "make use of": "use", "be able to": "can", "a lot of": "much / many",
});
// Also nouns or adjectives ("a final check", "in place"): flagged only as the command verb.
const VERB_ONLY = new Set(["check", "fix", "place", "position", "secure"]);
// REPLACE words that are verbs: accepted as the command (STE_WORD already reports them).
const REPLACE_VERBS = new Set(`ensure verify check inspect utilize utilise commence begin initiate terminate assist obtain perform
locate attempt allow place position fix secure avoid`.split(/\s+/));
const PHRASES = Object.keys(REPLACE).filter((k) => k.includes(" "));

// Command verbs a procedural sentence may start with: general, woodwork, metal, finishing, electronics.
// A project adds its own trade verbs with `verbs`. Prefixes re-, pre- and un- are accepted on any of them.
export const VERBS = new Set(`add adjust align angle apply arrange ask assemble attach bend bevel bolt bond bore brace break
brush buff butt buy calibrate call cap carry carve caulk center centre chamfer charge chisel choose clamp clean clear close coil collect
compare connect contact continue copy count counterbore countersink cover crimp crosscut cure cut dado deburr desolder detach
disassemble disconnect divide do dowel drain draw drill drive dry dust ease empty engage examine extend fasten feed file fill find
finger-tighten fit flatten flip fold get give glue go grease grind groove grout halve hammer hand-tighten hang heat hit hold hone hook
increase insert install join joint keep knock label lay lean leave let level lift load lock look loosen lower lubricate make mark mask
measure miter mitre mix mortise mount move nail notch number offset oil open order overlap pack paint pare pass patch peel pick pin
plane plug plumb polish pour pre-drill prepare press prime protect pull punch push put rabbet raise read ream rebate record reduce
release remove renew repair repeat replace reset rest return reverse rinse rip rivet roll rotate round rout route rub run sand saw
scrape screw scribe scrub seal seat see select separate set shake sharpen shim shrink sight sink slide smooth soak solder space split
spray spread square stack stain stand staple start stir stop store straighten strip support sweep switch tack take taper tap tape
test thread tie tighten tile tilt tin torque touch trace transfer trim try turn twist unclamp unload unlock unpack unplug unscrew unwrap use
vacuum varnish wait wash wax wear weld wet wipe wire wrap write zero`.split(/\s+/));

// -ing words that are nouns, and -ing words that are nouns only before certain words ("finishing nails").
const ING_OK = new Set(`anything awning bearing bedding bracing bring building bushing casing ceiling cladding cling clothing
coating coupling decking drawing during edging evening everything fencing fitting fixing flashing fling flooring footing framing housing
kindling landing lighting lining matting molding morning moulding netting nothing opening padding paving piping plumbing railing reading
roofing setting sheathing shelving siding skirting sling something spring sting string swing thing tubing warning wiring wring`.split(/\s+/));
const ING_BEFORE = Object.assign(Object.create(null), Object.fromEntries(Object.entries({
  finishing: "nail nails sander", marking: "gauge gauges knife", sanding: "block blocks sponge sealer disc discs pad pads sheet sheets belt belts",
  cutting: "board edge guide list mat oil disc wheel", measuring: "tape jug cup stick", drilling: "guide jig", mixing: "stick bucket cup paddle",
  mounting: "bracket brackets plate plates screw screws tape hole holes", soldering: "iron station wire flux", stripping: "tool knife",
  crimping: "tool pliers", folding: "rule table", sliding: "bevel door doors", locking: "pliers nut nuts washer washers", filling: "knife",
  sharpening: "stone guide", hanging: "kit wire hook hooks strip strips rail bracket brackets hardware plate plates",
  masking: "tape film paper", backing: "paper board plate tape",
}).map(([k, v]) => [k, new Set(v.split(" "))])));

// Passive voice: a form of "be", up to two adverbs, then a past participle.
const BE = new Set("am is are was were be been being".split(" "));
const ADVERB = new Set("not then also always never now still all both often".split(" "));
const PARTICIPLES = new Set(`beaten bitten blown bought bound brought built caught chosen countersunk cut dealt done drawn driven dug
eaten fed forgotten given grown held hung kept known laid lent made meant met paid proven put rebuilt redone ridden sawn seen sent
set sewn shaken shown slid sold sought sown spent spread spun struck strung sunk swept taken taught thrown told understood undone
withdrawn woven wound written`.split(/\s+/));
// Adjectives and states after "be" that are not passive (unless "by" follows: "is closed by the spring").
const ADJECTIVES = new Set(`open red flat level square dry wet ready shed bed aged crooked jagged ragged rugged naked hundred closed
damaged cracked curved rounded warped bowed cupped twisted chipped bent broken stuck torn worn frozen hidden lost`.split(/\s+/));

const LEAD = new Set("if when before after until while unless once to".split(" ")); // a leading clause, then a comma and the command
const LATE = new Set(["if", "when", "unless"]); // a condition after the command
const WHETHER = new Set("out see know examine check ask test find look tell learn decide".split(" ")); // "find out if" = whether
const DET = new Set(`the a an it them this that these those each every all both one two three four five six seven eight nine ten
your its their another any some`.split(/\s+/));
const PARTICLE = new Set("up down out off back away".split(" "));
// A preposition that takes "it" or "them" as the object of a second instruction: "and stand on it".
const PREP_OBJ = new Set("on in into onto to over under against with from off through along across around".split(" "));
// Words that are verbs and also things that a "put" puts down: "Put the screws and glue on it." is one instruction.
const NOUN_VERB = new Set(`glue tape clamp brush paint sand screw screws nail nails stain oil wax filler primer varnish putty dowel pin
pins bolt staple tile label plug plugs wire hook cap shim brace`.split(/\s+/));
// Verbs that put a list of things somewhere: their "and glue on it" is one more item, not a second instruction.
const PLACE = new Set("put lay set keep get leave store stack pack carry collect bring".split(" "));
// First words that are never a command verb (articles, pronouns, forms of be, prepositions, adverbs, -ing forms):
// the hint does not offer "add it to verbs". A prohibition gets "Do not"; a sequence word ("Then", "First") is removed,
// and so is a label ("Tip:").
const NOT_VERB = new Set([...DET, ...BE, ..."i you we they he she there my our his her".split(" ")]);
const PROHIBIT = new Set(["never", "don't", "don’t", "dont", "avoid"]);
const SEQUENCE = new Set("then next first finally now again also afterwards afterward meanwhile later lastly".split(" "));
const PREP = new Set(`with on in for at by from under over into onto through along across between behind below above inside outside near
without underneath beneath beside besides around past beyond within toward towards`.split(/\s+/));
// Adverbs that can start a sentence ("Only drill ...", "Here you ..."); the passive scan keeps ADVERB.
const START_ADVERB = new Set("only just even here together already soon".split(" "));
const adverbStart = (w) => ADVERB.has(w) || START_ADVERB.has(w) || (/^[a-z]{3,}ly$/.test(w) && !/ply$/.test(w));
const ingForm = (w) => /^[a-z]{2,}ing$/.test(w) && !ING_OK.has(w);
// after: the text between the first word and the next word (": " after a label, ", " after "Together").
const startHint = (w, raw, example, after = "") => (PROHIBIT.has(w) ? 'Write "Do not" for a prohibition: "Do not stand on the shelf."'
  : SEQUENCE.has(w) ? `Remove "${raw}" and start with the verb, for example "Attach the shelf".`
  : /^\s*:/.test(after) ? `Remove the label "${raw}:" and start with the verb, for example "Attach the shelf".`
  : NOT_VERB.has(w) || PREP.has(w) || adverbStart(w) || ingForm(w) || /^\p{N}/u.test(w) || /^\s*,/.test(after) ? `${example}.`
  : `${example}. If "${raw}" is a trade verb, add it to verbs.`);
// A modal verb: a warning sentence with one gives a risk ("The bit can throw chips"), also when it starts with a word
// that is a verb too ("Oil on your skin can cause a rash.").
const MODAL = new Set("can could may might will would".split(" "));
// A hazard that is also a verb, as the first word of a later warning sentence: with no object, adverb or preposition
// after it, it is the subject of a risk ("Oil rags catch fire.", "Dust hurts your lungs."), not a command ("Sand the
// edges.", "Spray outdoors.", "Paint it.").
const HAZARD_NOUN = new Set([...NOUN_VERB, "dust", "spray", "solder", "saw", "cut", "heat"]);
const commandNext = (w) => DET.has(w) || PARTICLE.has(w) || PREP.has(w) || PREP_OBJ.has(w) || LEAD.has(w) || adverbStart(w) || /^\p{N}/u.test(w)
  || ["outdoors", "indoors", "and", "or"].includes(w);
// A statement in the present simple, though its first word is also a verb ("Dust is bad for your lungs.", "Wet cement
// burns your skin.", "Paint fumes make you dizzy."): a form of be, or a verb with -s after a noun (not after "the") and
// before "you", "your", a determiner or a preposition. Not in a command that takes a clause ("Make sure the guard is on").
const CLAUSE_CMD = new Set("make check ensure see confirm verify test".split(" "));
// A clause after the command: its "is" does not make the sentence a statement ("Hold the board where it is flat.",
// "Sand the board while it is dry."). Not "because", "since", "as" or "which": their clause can give the risk.
const CLAUSE_LINK = new Set("that if when until whether before after so where while once unless".split(" "));
const AFTER_VERB = new Set("you your the a an into onto through in on to".split(" "));
const RISK_VERB = new Set("burn hurt harm cause make give damage irritate mark soak sting cut catch throw pull".split(" "));
const statement = (W) => {
  if (CLAUSE_CMD.has(W[0])) return false;
  for (let j = 1; j < W.length; j++) {
    if (CLAUSE_LINK.has(W[j])) return false;
    const prev = W[j - 1], next = W[j + 1];
    if (BE.has(W[j]) && !["be", "been", "being"].includes(W[j])) return true;
    if (DET.has(prev) || !next || !AFTER_VERB.has(next)) continue;
    const stems = [W[j].replace(/(?:es|s)$/, ""), W[j].replace(/s$/, "")];
    if (/s$/.test(W[j]) && stems.some((x) => VERBS.has(x) || RISK_VERB.has(x))) return true;
    if (/s$/.test(prev) && RISK_VERB.has(W[j]) && (next === "you" || next === "your")) return true;
  }
  return false;
};
const KIND_WORD = { procedure: "an instruction", title: "a title", warning: "a warning sentence", description: "a descriptive sentence" };

// ---- sentences

const NO_END = new Set(["approx", "e.g", "i.e", "cf", "vs", "fig", "figs", "incl", "ca"]); // never end a sentence
const BEFORE_NUMBER = new Set(["no", "nos", "nr", "dia", "ref", "max", "min", "art", "p", "pp"]); // "No. 8", "max. 20 mm"

// Splits on . ! ? followed by a space (or the end) and a capital, digit or quote. Decimals ("4.5"), abbreviations
// ("approx.", "e.g.", "No. 8") and a unit before a lower-case word ("3 mm. thick") stay in one sentence. A blank line always splits.
export function sentences(text) {
  const out = [];
  for (const para of String(text ?? "").split(/\n[ \t]*\n/)) {
    const s = para.replace(/\s+/g, " ").trim();
    let from = 0;
    for (const m of s.matchAll(/[.!?]+["'’”)\]]*(?= |$)/g)) {
      const end = m.index + m[0].length, next = s.slice(end + 1);
      if (next) {
        // The word before the dot. 16 characters are enough (the longest NO_END or BEFORE_NUMBER word has 6), and
        // the bound keeps a long text with many dots linear in time.
        const last = /[\p{L}\p{N}.]*$/u.exec(s.slice(Math.max(from, m.index - 16), m.index))[0].toLowerCase();
        if (m[0][0] === "." && (NO_END.has(last) || (BEFORE_NUMBER.has(last) && /^\p{N}/u.test(next)))) continue;
        if (!/^["'‘“(\[]?[\p{Lu}\p{N}]/u.test(next)) continue;
      }
      out.push(s.slice(from, end).trim());
      from = end + 1;
    }
    if (from < s.length) out.push(s.slice(from).trim());
  }
  return out.filter(Boolean);
}

// ---- lint

const TOKEN = /[\p{L}\p{N}]+(?:['’./-][\p{L}\p{N}]+)*/gu;
const tokens = (s) => [...s.matchAll(TOKEN)].map((m) => ({ w: m[0].toLowerCase(), raw: m[0], at: m.index, end: m.index + m[0].length }));
const quote = (T, from = 0, n = 6) => T.slice(from, from + n).map((t) => t.raw).join(" ") + (T.length - from > n ? "…" : "");
const lower = (v) => String(v).toLowerCase();
const removable = (w) => REPLACE[w]?.startsWith("(remove");

// "ensures" -> ensure, "verified" -> verify, "performed" -> perform. Only single-word, non-VERB_ONLY entries.
function replaced(w) {
  const forms = [w, w.replace(/s$/, ""), w.replace(/(es|ed)$/, ""), w.replace(/d$/, ""), w.replace(/ied$|ies$/, "y")];
  return forms.find((f) => f && REPLACE[f] && !VERB_ONLY.has(f) && !f.includes(" "));
}

function wordHint(w, raw) {
  const v = REPLACE[w];
  if (v.startsWith("(")) return v === "(remove)" ? `Remove "${raw}".` : `${v[1].toUpperCase()}${v.slice(2, -1)}.`;
  return `Write ${v.split(" / ").map((x) => `"${x}"`).join(" or ")}.`;
}

// lint(text, kind, { names, verbs }) -> [{ code, msg, hint }]. kind: "procedure" (a step line or check), "title",
// "warning" (WARNING / CAUTION text), "description" (why, tip, summary). names: technical names the linter accepts
// (words or phrases, any case). verbs: extra command verbs.
export function lint(text, kind = "procedure", { names = new Set(), verbs = [] } = {}) {
  if (typeof text !== "string" || !text.trim()) return [];
  const k = LIMITS[kind] ? kind : "description", limit = LIMITS[k];
  const ok = new Set();
  for (const n of names ?? []) for (const w of [lower(n), ...tokens(String(n)).map((t) => t.w)]) ok.add(w);
  const extra = new Set([...(verbs ?? [])].map(lower));
  const isVerb = (w) => {
    if (VERBS.has(w) || extra.has(w) || REPLACE_VERBS.has(w)) return true;
    const pre = /^(re|pre|un)-?(.{3,})$/.exec(w);
    if (pre && (VERBS.has(pre[2]) || extra.has(pre[2]))) return true;
    const dash = w.split("-");
    return dash.length > 1 && (VERBS.has(dash[0]) || extra.has(dash[0]));
  };
  const out = [], seen = new Set();
  const add = (code, msg, hint) => { if (!seen.has(code + msg)) { seen.add(code + msg); out.push({ code, msg, hint }); } };
  const body = text.replace(/^\s*(?:[-*+•]|\d+[.)])\s+/, "").replace(/^\s*(?:warning|caution|note)\s*[:–—-]\s*/i, "");
  // A warning: does a sentence after the first give the risk? It does when it is not a command, has a modal verb, or is a
  // statement in the present simple.
  let risk = false, said = 0;

  sentences(body).forEach((s, i) => {
    const T = tokens(s), W = T.map((t) => t.w);
    if (!T.length) return;
    said++;
    const commaBefore = (j) => j > 0 && s.slice(T[j - 1].end, T[j].at).includes(",");
    // The sentence starts with a command, as STE_VERB_FIRST reads it: after removable words, a sequence word or an
    // adverb ("Then open a window.", "Never touch the blade."), a verb, or a leading condition and a verb after its
    // comma. A hazard noun as the subject of a statement is not a command ("Oil rags catch fire.", "Dust hurts your
    // lungs."). A hazard verb with a bare object is ("Sand edges by hand.", "Glue joints quickly.").
    const command = () => {
      let a = 0;
      while (T[a] && (removable(T[a].w) || SEQUENCE.has(T[a].w) || adverbStart(T[a].w))) a++;
      if (!T[a]) return false;
      if (PROHIBIT.has(W[a]) && W[a + 1] && isVerb(W[a + 1])) return true;
      if (HAZARD_NOUN.has(W[a]) && W[a + 1] && !commandNext(W[a + 1])
        && (statement(W.slice(a)) || (/s$/.test(W[a + 1]) && RISK_VERB.has(W[a + 2] ?? "")))) return false;
      return LEAD.has(W[a]) ? T.some((_, j) => j > a && commaBefore(j) && isVerb(W[j])) : isVerb(W[a]);
    };
    // A later sentence gives the risk when it has a modal verb, is not a command, or is a statement in the present
    // simple. One sentence gives it with a modal after "because", "or" or "so" ("Wear gloves, because wet cement can burn
    // your skin.").
    if (k === "warning" && i > 0 && !risk) risk = W.some((w) => MODAL.has(w)) || !command() || statement(W);
    if (k === "warning" && i === 0 && !risk) {
      const b = W.findIndex((w) => w === "because" || w === "or" || w === "so");
      risk = b > 0 && W.slice(b + 1).some((w) => MODAL.has(w));
    }

    if (T.length > limit) add("STE_LENGTH", `The sentence "${quote(T)}" has ${T.length} words. The limit for ${KIND_WORD[k]} is ${limit}.`,
      k === "title" ? "Use a shorter title: a command and its object." : "Split it into two or more sentences.");

    T.forEach((t, j) => {
      if (ok.has(t.w)) return;
      const r = replaced(t.w);
      if (r) add("STE_WORD", `STE replaces "${t.raw}".`, wordHint(r, t.raw));
      if (/^[a-z]{2,}ing$/.test(t.w) && !ING_OK.has(t.w) && !ING_BEFORE[t.w]?.has(W[j + 1]))
        add("STE_ING", `"${t.raw}" is an -ing form.`, `Write a command or a noun ("Use a square", not "Using a square"). If "${t.raw}" is a technical name, add it to terms.`);
    });
    const joined = ` ${W.join(" ")} `;
    for (const p of PHRASES) if (joined.includes(` ${p} `)) add("STE_WORD", `STE replaces "${p}".`, wordHint(p, p));

    // Passive: be + (adverbs) + participle. An adjective counts when "by" follows.
    T.forEach((t, j) => {
      if (!BE.has(t.w)) return;
      let n = j + 1;
      while (n < j + 3 && W[n] && (ADVERB.has(W[n]) || /ly$/.test(W[n]))) n++;
      const p = W[n];
      if (!p || ok.has(p)) return;
      const participle = PARTICIPLES.has(p) || (/^[a-z]{2,}ed$/.test(p) && !/eed$/.test(p) && !ADJECTIVES.has(p));
      if (participle || (ADJECTIVES.has(p) && W[n + 1] === "by"))
        add("STE_PASSIVE", `"${T.slice(j, n + 1).map((x) => x.raw).join(" ")}" is passive.`, 'Use the active voice: say who does the action, for example "Attach the shelf".');
    });

    // The rest applies to commands: every sentence of a procedure or title, the first sentence of a warning
    // (later warning sentences give the risk, and are checked only when they start with a command).
    if (k === "description") return;
    let at = 0;
    while (T[at] && removable(T[at].w)) at++;
    if (!T[at]) return;
    let problem = null;
    if (LEAD.has(T[at].w)) {
      const after = T.map((_, j) => j).filter((j) => j > at && commaBefore(j));
      const verb = after.find((j) => isVerb(W[j]));
      if (!after.length) problem = [`The condition "${quote(T, at)}" has no comma after it.`, 'Put a comma after the condition, then write the command: "If the gap is wide, sand the edge."'];
      else if (verb !== undefined) at = verb;
      else {
        at = after[0];
        problem = [`After the condition, the sentence goes on with "${T[at].raw}", not a command verb.`,
          startHint(W[at], T[at].raw, 'Write the command after the comma, for example "When the glue is dry, remove the clamps"', s.slice(T[at].end, T[at + 1]?.at ?? s.length))];
      }
    } else if (!isVerb(W[at])) {
      // A label with an id ("Step 2:", "Part A,"): the hint quotes the two words.
      const id = T[at + 1] && /^(?:\p{N}+|\p{L})$/u.test(T[at + 1].raw) && /^\s*[:,]/.test(s.slice(T[at + 1].end, T[at + 2]?.at ?? s.length));
      const raw = id ? `${T[at].raw} ${T[at + 1].raw}` : T[at].raw, last = id ? at + 1 : at;
      problem = [`The sentence starts with "${T[at].raw}", not a command verb.`,
        startHint(W[at], raw, 'Start with a command verb, for example "Attach the shelf"', s.slice(T[last].end, T[last + 1]?.at ?? s.length))];
    }
    const commandLine = k !== "warning" || i === 0;
    if (problem && commandLine) add("STE_VERB_FIRST", ...problem);
    // A later warning sentence that starts with "Never" or "Don't" is a prohibition too: write "Do not".
    if (k === "warning" && i > 0 && PROHIBIT.has(W[at]) && !isVerb(W[at]))
      add("STE_VERB_FIRST", `The sentence starts with "${T[at].raw}", not a command verb.`, startHint(W[at], T[at].raw, ""));
    if (problem && !commandLine) return;
    if (!problem && VERB_ONLY.has(W[at]) && !ok.has(W[at])) add("STE_WORD", `STE replaces "${T[at].raw}" as a verb.`, wordHint(W[at], T[at].raw));

    // Two instructions: "and <verb> the", "then <verb> it", ", <verb> the", "and <verb> on it". When the sentence does
    // not start with a command ("Using a drill, make the holes.", "Shelf A: attach the top"), the first verb after a
    // comma or a colon is its one instruction, with or without an object. A verb right after the first word, with no
    // comma or colon, is the instruction ("Then attach the side and drill ..."). A verb with a comma right after it is
    // an item of a list ("Get these items: glue, the clamps"), and "Put the screws and glue on it." puts two things.
    if (k === "procedure" || k === "title") {
      const sepBefore = (j) => j > 0 && /[,:]/.test(s.slice(T[j - 1].end, T[j].at));
      // last: the word of the one instruction so far, or -1.
      let last = isVerb(W[at]) ? at : W[at + 1] !== undefined && isVerb(W[at + 1]) && !sepBefore(at + 1) ? at + 1 : -1, one = last >= 0;
      // The words from the instruction verb to the "and" are a list of things: no preposition or particle in them.
      const list = (from, to) => from >= 0 && to > from + 1 && W.slice(from + 1, to).every((w) => !PREP_OBJ.has(w) && !PREP.has(w) && !PARTICLE.has(w));
      for (let j = at + 1; j < T.length; j++) {
        const link = W[j] === "and" || W[j] === "then";
        const v = link ? (W[j + 1] === "then" ? j + 2 : j + 1) : sepBefore(j) ? j : -1;
        if (v < 0 || !W[v] || !isVerb(W[v])) continue;
        if (/^\s*[,;]/.test(s.slice(T[v].end))) continue;
        if (!one && !link) { one = true; last = v; continue; }
        const n = PARTICLE.has(W[v + 1]) ? v + 2 : v + 1;
        // The object: a determiner or a number ("the", "4"), or a preposition and a pronoun ("on it"). A thing after
        // "and" in a list that a "put" puts down is not a verb ("Put the screws and glue on it.").
        const thing = W[j] === "and" && NOUN_VERB.has(W[v]) && PLACE.has(W[last]) && list(last, j);
        const pron = PREP_OBJ.has(W[n]) && (W[n + 1] === "it" || W[n + 1] === "them") && !thing;
        const e = !W[n] ? -1 : DET.has(W[n]) || /^\p{N}/u.test(W[n]) ? n : pron ? n + 1 : -1;
        if (e < 0) continue;
        if (!one) { one = true; last = v; j = e; continue; }
        add("STE_TWO_ACTIONS", `The sentence has two instructions: "${link ? "" : `${s.slice(T[j - 1].end, T[j].at).trim()} `}${s.slice(T[j].at, T[e].end)}".`, "Write one instruction in each sentence.");
        break;
      }
    }
    // Condition after the command: "Stop the saw if the blade binds."
    const late = T.findIndex((t, j) => j > at && LATE.has(t.w) && !WHETHER.has(W[j - 1]) && W[j + 1] && W[j + 1] !== "to");
    if (late > 0) add("STE_CONDITION_LAST", `The condition "${quote(T, late)}" comes after the command.`,
      'Write the condition first, then the command: "If the blade binds, stop the saw."');
  });
  // A WARNING or CAUTION gives its command first, then the risk (safety.md section 2): "When you drill, wear safety
  // glasses." alone, or a second command ("Open a window."), names no risk.
  if (k === "warning" && !risk && said)
    add("STE_WARN_NO_RISK", "The warning gives no risk after its command.", 'Give the risk in a second sentence, for example "Wear safety glasses. The bit can throw chips into your eyes."');
  return out;
}
