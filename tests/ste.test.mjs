// ste.mjs: each rule fires on bad sentences and stays quiet on good ones (including the v0.1 audit cases),
// sentence splitting, names and verbs options, finding shape.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { lint, sentences, LIMITS, REPLACE, VERBS } from "../engine/lib/ste.mjs";

const codes = (text, kind = "procedure", opts) => lint(text, kind, opts).map((f) => f.code);
// [kind, text] or a plain text (procedure). Every bad case must give the code; no good case may give it.
const item = (c) => (Array.isArray(c) ? c : ["procedure", c]);
function rule(code, bad, good) {
  assert.ok(bad.length >= 8 && good.length >= 8, `${code}: at least 8 bad and 8 good cases`);
  for (const c of bad) { const [kind, text] = item(c); assert.ok(codes(text, kind).includes(code), `${code} should fire on ${kind} ${JSON.stringify(text)}`); }
  for (const c of good) { const [kind, text] = item(c); assert.ok(!codes(text, kind).includes(code), `${code} should be quiet on ${kind} ${JSON.stringify(text)}: ${JSON.stringify(lint(text, kind))}`); }
}
// A sentence of n words that starts with `start`.
const long = (n, start = "Put") => [start, ...Array.from({ length: n - 1 }, (_, i) => ["the", "board", "on", "bench"][i % 4])].join(" ") + ".";

test("exports: limits, replacements, verbs", () => {
  assert.deepEqual(LIMITS, { procedure: 20, title: 10, warning: 20, description: 25 });
  assert.equal(REPLACE.ensure, "make sure");
  assert.equal(REPLACE.utilize, "use");
  // The trade verbs the v0.1 audit missed, and every v0.1 verb.
  for (const v of `rip crosscut plane rout chisel solder strip crimp insert repeat tighten loosen align square level countersink
pre-drill sand wipe brush apply clamp glue mark measure attach fasten screw nail drill cut hold lift put set turn push pull remove
install fit connect disconnect examine make adjust bend clean close do dry fill find get keep let lower move open paint read replace
slide stop use wait wear write cover fold lay start stand lock unlock plug unplug unscrew tape trim rotate pour mix stir spread press
release hang record compare count select prepare clear sweep tie twist hammer saw file load unload empty draw hook wrap drive`.split(/\s+/))
    assert.ok(VERBS.has(v) || !codes(`${v[0].toUpperCase()}${v.slice(1)} the board.`).includes("STE_VERB_FIRST"), v);
  for (const v of ["check", "inspect"]) assert.deepEqual(codes(`${v[0].toUpperCase()}${v.slice(1)} the board.`), ["STE_WORD"], v);
});

test("findings have code, msg and hint", () => {
  const f = lint("Ensure that the shelf is attached.", "procedure");
  assert.ok(f.length >= 2);
  for (const x of f) for (const k of ["code", "msg", "hint"]) assert.ok(typeof x[k] === "string" && x[k].length > 0, k);
  assert.deepEqual(lint("", "procedure"), []);
  assert.deepEqual(lint(undefined, "procedure"), []);
  assert.deepEqual(lint({ t: "Cut the board." }, "procedure"), []);
  assert.deepEqual(codes("Ensure the gap. Ensure the gap."), ["STE_WORD"], "one finding per word and text");
});

test("words that are Object.prototype keys are plain words", () => {
  for (const w of ["constructor", "toString", "valueOf", "hasOwnProperty", "__proto__", "isPrototypeOf"])
    assert.doesNotThrow(() => lint(`Attach the ${w} to the board. The ${w} is red.`, "procedure"), w);
  assert.deepEqual(codes("Attach the constructor bracket."), []);
});

test("STE_LENGTH", () => {
  rule("STE_LENGTH", [
    long(21),
    "Clamp the shelf. " + long(22),
    ["description", long(26, "The")],
    ["warning", long(21, "Wear")],
    ["warning", "Wear gloves. " + long(21, "The")],
    ["title", "Attach the top shelf to the two sides with glue and screws"],
    ["title", long(11, "Attach")],
    "Drill a 3 mm pilot hole through the side into the end of the shelf at each of the marks on the line.",
    ["description", "The back panel locks the frame square, and without it the shelf can lean to one side when you put heavy books on the top shelf."],
    ["note", long(26, "The")],
  ], [
    long(20),
    ["description", long(25, "The")],
    ["warning", `${long(20, "Wear")} ${long(20, "Keep")}`],
    ["title", "Attach the top shelf"],
    ["title", long(10, "Attach")],
    "Drill a 3 mm pilot hole at each mark.",
    "Use a 4.5 mm bit. Drill to a depth of 30 mm.",
    ["description", "A pilot hole gives the screw a path. Without it, the wood can split near an edge."],
    "Mark the shelf lines at 60, 330, 600 and 881 mm from the bottom end.",
    `${long(20)} ${long(20, "Sand")}`,
  ]);
  assert.match(lint(long(21), "procedure")[0].msg, /21 words.*limit .* 20/);
});

test("STE_WORD", () => {
  rule("STE_WORD", [
    "Ensure that the shelf is level.",
    "Verify the length of each part.",
    "Utilize a sharp blade.",
    "Apply approximately 5 ml of glue.",
    "Just drill the hole.",
    "Tighten the screws firmly.",
    "Use additional screws at the ends.",
    "Begin at the top of the board.",
    "Check the gap with a ruler.",
    "Place the shelf on the side.",
    "Wait 1 hour in order to let the glue dry.",
    ["description", "The glue requires 1 hour to dry."],
    ["description", "The finish ensures a hard surface."],
    "Remove the dust, the chips, etc.",
  ], [
    "Make sure that the shelf is level.",
    "Examine the joint for gaps.",
    "Do a final check of the frame.",
    "Put the shelf in place.",
    "Put the position marks on the board.",
    "Use about 5 ml of glue.",
    "Tighten the screws.",
    "Find the stud with a stud finder.",
    "Start at the top of the board.",
    ["description", "The check takes 1 minute."],
  ]);
  assert.deepEqual(codes("Use Just Nails glue on the joint.", "procedure", { names: new Set(["Just Nails"]) }), []);
  assert.deepEqual(codes("Use Just Nails glue on the joint."), ["STE_WORD"]);
  const f = lint("Ensure the gap.", "procedure")[0];
  assert.match(f.msg, /"Ensure"/);
  assert.equal(f.hint, 'Write "make sure".');
  assert.equal(lint("Just drill the hole.", "procedure")[0].hint, 'Remove "Just".');
  assert.equal(lint("Check the gap.", "procedure")[0].hint, 'Write "examine" or "make sure".');
});

test("STE_ING with noun allowlist and compounds", () => {
  rule("STE_ING", [
    "Using a square, mark the line.",
    "Keep the saw moving.",
    "Hold the board while cutting.",
    "Avoid touching the blade.",
    "Start by measuring the gap.",
    "Apply the finishing coat.",
    "Wipe the surface before sanding.",
    "Tighten the screws, checking the gap each time.",
    "Do the marking first.",
    ["description", "The glue needs drying time."],
  ], [
    "Use finishing nails for the trim.",
    "Set the marking gauge to 10 mm.",
    "Remove the string.",
    "Put the spring in the housing.",
    "Install the bearing in the opening.",
    "Apply a thin coating.",
    "Mark the ceiling.",
    "Do the same thing for the other side.",
    "Find the setting on the drawing.",
    "Hold the sanding block flat.",
    "Put the fittings and the wiring in the box.",
    "Drill the holes during the dry fit.",
    ["description", "A building has a ring of bolts in the fitting."],
    // The nouns "warning" (also "WARNING") and "landing".
    "Read the warning on the can.",
    "Fit the gate at the top of the stairs, on the landing.",
    ["description", "The warning keeps the drill away from the fuse box."],
    "Copy each WARNING of the kit maker into the step.",
  ]);
  assert.deepEqual(codes("Apply the edgebanding."), ["STE_ING"]);
  assert.deepEqual(codes("Apply the edgebanding.", "procedure", { names: ["edgebanding"] }), []);
  // DIY nouns: backing paper, masking tape, a hanging bracket. "spacing" stays a finding.
  for (const t of ["Remove the backing paper from each pad.", "Put masking tape on the line.", "Install the hanging bracket on the back."]) assert.deepEqual(codes(t), [], t);
  assert.ok(codes("Make sure that the spacing between the hooks is 6 in.").includes("STE_ING"));
});

test("STE_PASSIVE: be + participle, not adjectives", () => {
  rule("STE_PASSIVE", [
    ["description", "The shelf is attached to the side."],
    ["description", "The screws are driven into the side."],
    "Make sure that the holes are drilled.",
    ["description", "The parts were cut too short."],
    ["description", "The glue is applied with a brush."],
    ["description", "The board is held by the clamp."],
    ["description", "The back panel is not attached yet."],
    ["description", "The door is closed by the spring."],
    ["description", "Each part is then marked with a letter."],
    "Make sure that the screws are fully tightened.",
    ["warning", "Do not touch the blade. It can be sharpened to a fine edge."],
    ["description", "The cut is being made too fast."],
  ], [
    ["warning", "Keep the guard down. The blade is open and the guard is red."],
    "Make sure that the shelf is level.",
    ["description", "The board is flat and dry."],
    ["description", "The paint is wet."],
    "Make sure that the frame is square.",
    ["description", "The glue is ready after 1 hour."],
    ["description", "The edge is rough."],
    "If the board is warped, use a different board.",
    "If the nail is bent, remove it.",
    ["description", "The holes are 10 mm deep."],
    ["description", "The speed is correct."],
    ["description", "The glue makes the joint stiff."],
  ]);
  assert.ok(codes("Make sure that the screws are countersunk.").includes("STE_PASSIVE"));
  assert.ok(!codes("Make sure that the screws are countersunk.", "procedure", { names: ["countersunk"] }).includes("STE_PASSIVE"));
  assert.match(lint("Make sure that the holes are drilled.", "procedure")[0].msg, /"are drilled"/);
});

test("STE_VERB_FIRST on every sentence, after a leading condition, trade verbs", () => {
  rule("STE_VERB_FIRST", [
    "The shelf goes on the side.",
    "Then attach the side.",
    "Carefully cut the board.",
    "If the gap is wide sand the edge.",
    "When the glue is dry, the clamps come off.",
    "Shelf B goes on top.",
    "Next, sand the edges.",
    "You must wear gloves.",
    "Clamp the shelf. The side goes next.",
    ["warning", "The blade is sharp. Keep your hands away."],
    ["title", "Shelf assembly"],
    "Epoxy the joint.",
  ], [
    "Solder the red wire to pin 3.",
    "Strip 6 mm of insulation from the wire.",
    "Repeat the steps for the other side.",
    "Rip the board to 90 mm wide.",
    "Crosscut the board to 762 mm.",
    "Crimp the connector on the wire.",
    "If the gap is wide, sand the edge.",
    "When the glue is dry, remove the clamps.",
    "Before you cut, measure two times.",
    "To remove the blade, loosen the nut.",
    "Do not drill near the edge.",
    "Make sure that the shelf is level.",
    "If the board is long, heavy or wet, ask a helper.",
    "Pre-drill the holes.",
    "Re-tighten the screws after one week.",
    "Dry-fit the parts.",
    "Just drill the hole.",
    "Ensure that the shelf is level.",
    "1. Cut the board.",
    ["warning", "Wear safety glasses. A saw throws chips at high speed."],
    ["warning", "WARNING: Keep your hands 150 mm from the blade."],
    ["title", "Attach the top shelf"],
    ["description", "The shelf goes on the side."],
  ]);
  assert.deepEqual(codes("Epoxy the joint.", "procedure", { verbs: ["epoxy"] }), []);
  assert.match(lint("If the gap is wide sand the edge.")[0].msg, /no comma/);
});

test("STE_TWO_ACTIONS only when a new verb phrase follows", () => {
  rule("STE_TWO_ACTIONS", [
    "Apply glue and clamp the parts.",
    "Cut the board and sand the edges.",
    "Drill a hole and countersink it.",
    "Remove the clamps, sand the joint.",
    "Measure the gap, then cut the board.",
    "Clamp the shelf. Then attach the side and drill the holes.",
    ["title", "Mark and drill the sides"],
    "Push the frame and then measure the diagonals.",
    "Lift the shelf and pull out the nail.",
    "When the glue is dry, remove the clamps and sand the joint.",
    "Drill 4 holes and install 4 screws.",
    "Using a drill, drill holes and attach the shelf.",
    "Shelf A: attach the top and drill the hole.",
    "Put the stool on the floor and stand on it.",
    "For a square cut, clamp a guide and cut along it.",
    "Mark the line and saw along it.",
    "Hold the board and press on it.",
    "Put the base on the floor, then stand on it.",
    "Put the screws in the box and glue on it.",
    "Lay the board flat and stand on it.",
    "Hold the board and saw through it.",
    "Apply glue and clamp it.",
    "Fill the hole and sand over it.",
    "Fill the gap and paint over it.",
    "Put the chair on its side and hit the leg.",
  ], [
    "Use the square and level.",
    "Use the square and level to mark the line.",
    "Sand the faces and the edges.",
    "Put a scrap block between each clamp jaw and the wood.",
    "Support the long board so it does not fall and split.",
    "Make sure that you have two parts A, four parts B and one part C.",
    "Mark the shelf lines at 60, 330, 600 and 881 mm.",
    "Remove the nails and screws.",
    "Sand or plane the edge.",
    "If the board is long and heavy, ask a helper.",
    ["title", "Measure and mark"],
    ["description", "The glue makes the joint stiff and the screws hold it."],
    "Put the screws and glue on the bench.",
    "Using a drill, a saw and a clamp, attach the shelf.",
    "Next, sand the edges.",
    // A list of things that a "put" puts down, with a verb-like noun before "it": one instruction.
    "Put the screws, nails and glue in it.",
    "Put the glue and tape on it.",
    "Put the paint and brush in it.",
    "Put the screws and glue on it.",
    "Put the board and clamp on it.",
    "Put paper and tape on it.",
    "Put a cloth and paint on it.",
    // A label, then one command; a list after a colon.
    "Tip: put a scrap board under it.",
    "Top: drill 4 holes.",
    "Sides: sand the edges.",
    ["title", "Base: attach the legs"],
    "Get these items: glue, the clamps and a square.",
  ]);
  assert.match(lint("Apply glue and clamp the parts.")[0].msg, /"and clamp the"/);
  assert.match(lint("Put the stool on the floor and stand on it.")[0].msg, /"and stand on it"/);
  assert.deepEqual(codes("Tip: put a scrap board under it."), ["STE_VERB_FIRST"]);
  assert.deepEqual(codes("Top: drill 4 holes."), ["STE_VERB_FIRST"]);
  assert.deepEqual(codes("Base: attach the legs", "title"), ["STE_VERB_FIRST"]);
  assert.deepEqual(codes("Shelf A: attach the top and drill the hole."), ["STE_VERB_FIRST", "STE_TWO_ACTIONS"]);
  // The message quotes the real separator: a colon is a colon, not ", ".
  assert.match(lint("Do these steps: drill the holes, then sand the edges.").find((f) => f.code === "STE_TWO_ACTIONS").msg, /": drill the"/);
  assert.match(lint("Remove the clamps, sand the joint.")[0].msg, /", sand the"/);
});

test("STE_CONDITION_LAST", () => {
  rule("STE_CONDITION_LAST", [
    "Stop the saw if the blade binds.",
    "Remove the clamps when the glue is dry.",
    "Sand the edge if the gap is more than 2 mm.",
    ["warning", "Wear gloves when you apply the finish."],
    "Add a shim if necessary.",
    "Tighten the nut, when the bolt is in.",
    "Clamp the shelf. Drill the holes when the glue is dry.",
    "Unplug the saw when you change the blade.",
    "Do not use the drill unless the bit is tight.",
    ["title", "Drill the holes if necessary"],
    ["warning", "Wear gloves. Keep the window open when you apply the finish."],
  ], [
    "If the blade binds, stop the saw.",
    "When the glue is dry, remove the clamps.",
    "Find out if the wall is hollow.",
    "Measure each length two times before you cut.",
    "Wait until the glue is dry.",
    "Examine the board to see if it is dry.",
    "Make sure that you know when to stop.",
    "Drill the holes after the glue is dry.",
    ["description", "The saw stops when you release the trigger."],
    ["warning", "Wear gloves. The finish burns the skin when it is wet."],
  ]);
});

test("audit cases from v0.1", () => {
  assert.deepEqual(codes("Clamp the shelf. Then attach the side and drill the holes."), ["STE_VERB_FIRST", "STE_TWO_ACTIONS"]);
  for (const t of ["Solder the wire to pin 3.", "Strip 6 mm of the wire.", "Repeat the steps.", "Rip the board to 90 mm.", "Insert the plug."])
    assert.deepEqual(codes(t), [], t);
  assert.ok(!codes("The blade is open and the guard is red.", "description").includes("STE_PASSIVE"));
  assert.deepEqual(codes("Use the square and level to mark the line."), []);
  assert.deepEqual(codes("Square the frame and attach the back", "title"), ["STE_TWO_ACTIONS"]);
});

test("hints: a prohibition gets \"Do not\", an article or pronoun is no trade verb; one instruction after an -ing lead", () => {
  const using = codes("Using a drill, make the holes.");
  assert.ok(using.includes("STE_ING") && !using.includes("STE_TWO_ACTIONS"), using.join(" "));
  assert.ok(codes("Using a drill, make the holes, then clean the bit.").includes("STE_TWO_ACTIONS"));
  assert.ok(!codes("Next, sand the edges.").includes("STE_TWO_ACTIONS"));
  const never = lint("Never stand on the shelf.", "warning").find((f) => f.code === "STE_VERB_FIRST");
  assert.match(never.hint, /Do not/);
  assert.doesNotMatch(never.hint, /trade verb/);
  for (const [text, kind] of [["The saw is dangerous.", "warning"], ["You must wear gloves.", "procedure"], ["It goes on top.", "procedure"]]) {
    const f = lint(text, kind).find((x) => x.code === "STE_VERB_FIRST");
    assert.ok(f, text);
    assert.doesNotMatch(f.hint, /trade verb/, text);
  }
  assert.match(lint("Shelf B goes on top.").find((f) => f.code === "STE_VERB_FIRST").hint, /If "Shelf" is a trade verb, add it to verbs\./);
  assert.match(lint("When the glue is dry, the clamps come off.")[0].hint, /^Write the command after the comma[^.]*\.$/);
  const avoid = lint("Avoid the dust. Fine dust can hurt your lungs.", "warning");
  assert.deepEqual(avoid.map((f) => f.code), ["STE_WORD"]);
  assert.equal(avoid[0].hint, 'Write "do not".');
  // -ing forms, prepositions, adverbs and sequence words are never trade verbs.
  const hint = (t) => lint(t).find((f) => f.code === "STE_VERB_FIRST")?.hint;
  for (const t of ["Using a drill, make the holes.", "With a pencil, mark the center.", "Then attach the shelf.", "First, cut the board.", "Next, sand the edges.",
    "Carefully cut the board.", "Slowly push the saw.", "Always wear safety glasses.", "On the left side, drill a hole.", "For a tight fit, sand the edge.", "Finally, attach the back."]) {
    assert.ok(hint(t), t);
    assert.doesNotMatch(hint(t), /trade verb/, t);
  }
  assert.equal(hint("Then attach the shelf."), 'Remove "Then" and start with the verb, for example "Attach the shelf".');
  assert.match(hint("First, cut the board."), /^Remove "First"/);
  for (const t of ["Hinge the door.", "Bring the clamp.", "Supply power to the board.", "Shelf B goes on top."]) assert.match(hint(t), /trade verb/, t);
  // More starters that are no trade verb: adverbs, sequence words, prepositions, a word before a comma, a label.
  for (const t of ["Only drill the pilot hole.", "Afterwards, sand the joint.", "Meanwhile, mix the glue.", "Later, remove the clamps.", "Here you attach the back.",
    "Together, lift the frame.", "Underneath, add the feet.", "Beneath the shelf, drill a hole.", "Important: wear gloves.", "Tip: use a scrap board."]) {
    assert.ok(hint(t), t);
    assert.doesNotMatch(hint(t), /trade verb/, t);
  }
  assert.equal(hint("Tip: use a scrap board."), 'Remove the label "Tip:" and start with the verb, for example "Attach the shelf".');
  assert.match(hint("Afterwards, sand the joint."), /^Remove "Afterwards"/);
  // The passive scan keeps its adverb list: "only" between "is" and the participle.
  assert.deepEqual(codes("The glue is only used once.", "description"), ["STE_PASSIVE"]);
});

test("TOUCH and HIT are command verbs, and every verb of ste.md's General row is in VERBS", () => {
  for (const kind of ["procedure", "warning"])
    for (const t of ["Touch a metal tap before you hold the board.", "Hit the leg near the loose joint with the mallet."])
      assert.ok(!codes(t, kind).includes("STE_VERB_FIRST"), `${kind}: ${t}`);
  for (const t of ["Touch a metal tap before you hold the board.", "Hit the leg near the loose joint with the mallet."]) assert.deepEqual(codes(t), [], t);
  assert.deepEqual(codes("Put the chair on its side and hit the leg."), ["STE_TWO_ACTIONS"]);
  const doc = readFileSync(new URL("../engine/docs/ste.md", import.meta.url), "utf8");
  const row = doc.split("\n").find((l) => l.startsWith("| General |"));
  assert.ok(row, "ste.md section 6 has a General row");
  const general = row.split("|")[2].split(",").map((w) => w.trim()).filter(Boolean);
  assert.ok(general.length >= 10, row);
  assert.deepEqual(general.filter((w) => !VERBS.has(w)), [], "a verb in ste.md that the linter does not accept");
});

test("STE_WARN_NO_RISK: a warning gives a risk after its command", () => {
  const bad = ["When you drill, wear safety glasses.", "When you drive screws, wear safety glasses.", "Wear gloves. Open a window to let fresh air in.",
    "Keep three points of contact with the ladder. Do not stand on the top step.", "WARNING: Keep your hands 150 mm from the blade."];
  for (const t of bad) assert.ok(codes(t, "warning").includes("STE_WARN_NO_RISK"), t);
  const f = lint(bad[0], "warning").find((x) => x.code === "STE_WARN_NO_RISK");
  assert.equal(f.msg, "The warning gives no risk after its command.");
  assert.match(f.hint, /^Give the risk in a second sentence/);
  // A risk sentence: not a command, or a modal verb ("Oil", "Wet" are verbs too).
  for (const t of ["Wear safety glasses. The bit can throw chips into your eyes.", "Do not tighten the clamp too much. Too much force pushes out all the glue.",
    "Wear nitrile gloves. Oil on your skin can cause a rash.", "Wear nitrile gloves. Wet epoxy can cause a skin allergy.",
    "Keep the guard down. The blade is open and the guard is red.", "Do not touch the blade. It can be sharpened to a fine edge."])
    assert.ok(!codes(t, "warning").includes("STE_WARN_NO_RISK"), t);
  // Never on a procedure, a description or a title.
  for (const kind of ["procedure", "description", "title"]) assert.ok(!codes("When you drill, wear safety glasses.", kind).includes("STE_WARN_NO_RISK"), kind);
});

test("STE_WARN_NO_RISK: a risk in the present simple counts, also when its first word is a verb too ('Dust hurts your lungs.')", () => {
  for (const t of ["Wear a dust mask. Dust is bad for your lungs.", "Wear a dust mask. Dust from MDF is harmful.", "Wear gloves. Wet cement burns your skin.",
    "Wear gloves. Paint stripper burns your skin.", "Open a window. Paint fumes make you dizzy.", "Wear a respirator. Spray mist harms your lungs.",
    "Wear nitrile gloves. Stain marks your skin for days.", "Wear gloves. Glue on your skin is hard to remove.", "Wear gloves. Oil soaks into your skin.",
    "Wear a dust mask. Sand dust hurts your lungs.", "Wear gloves, because wet cement can burn your skin.", "Open a window. Paint fumes make you ill.",
    "Wear a dust mask. Dust hurts your lungs.", "Wear gloves. Stain marks your skin.", "Keep flames away. Oil rags catch fire.", "Wear gloves. Glue burns your skin.",
    "Wear ear protection. Saw noise hurts your ears.", "Wear gloves. Cut glass is sharp.", "Wear gloves. Cement burns your skin.", "Wear a dust mask. Fine dust hurts your lungs.",
    "Keep the guard on. Usually the disc breaks without a sound.", "Wear a mask. Only a mask stops the dust.",
    // Round 5: a "because" clause gives the risk, and a hazard noun with a plural and a risk verb is a statement.
    "Wear gloves. Hold the board, because the edge is sharp.", "Wear gloves. Cut slowly, because the blade is hot.", "Open a window. Solder fumes irritate your eyes."])
    assert.ok(!codes(t, "warning").includes("STE_WARN_NO_RISK"), t);
  // A second command is still no risk: after an adverb or a sequence word, a prohibition, a hazard verb with an object,
  // and a command that takes a clause.
  for (const t of ["Wear gloves. Never touch the blade.", "Wear gloves. Don't touch the blade.", "Wear gloves. Paint it outdoors.", "Wear gloves. Sand the edges.",
    "Wear gloves. Sand by hand.", "Wear gloves. Clamp the parts.", "Unplug the saw. Make sure that the blade is stopped.", "Wear a dust mask. Make sure that the mask fits.",
    "Wear gloves. Wash your hands after the work.", "Wear safety glasses. Clamp the boards to the bench.", "Wear gloves. Stain the boards on the bench.", "Wear gloves, or use a brush.",
    "Wear gloves. Then open a window.", "Wear gloves. Always open a window.", "Wear gloves. Also open a window.", "Open a window. Then wait.", "Wear a respirator. Spray outdoors.",
    "Wear gloves. Sand until the paint is off.",
    // Round 5: a "where", "while" or "once" clause with "is" after a second command, and a hazard verb with a bare object.
    "Wear ear protection. Use the saw where the floor is level.", "Wear a dust mask. Sand the board while it is dry.", "Wear gloves. Hold the board where it is flat.",
    "Wear gloves. Do the work outdoors, where the air is clean.", "Wear safety glasses. Cut the board where the mark is.", "Wear gloves. Apply the glue where the joint is.",
    "Wear safety glasses. Then cut where the line is.", "Wear gloves. Remove the clamp once the glue is dry.",
    "Wear a dust mask. Sand edges by hand.", "Wear gloves. Glue joints quickly.", "Wear a respirator. Spray thin coats.", "Wear gloves. Stain boards outdoors.",
    "Wear gloves. Dust surfaces first.", "Wear safety glasses. Saw straight.", "Wear gloves. Solder joints last.", "Wear a dust mask. Sand smooth.",
    "Wear gloves. Glue edges and clamp them."])
    assert.ok(codes(t, "warning").includes("STE_WARN_NO_RISK"), t);
  // "Never" in a later sentence is a prohibition: the "Do not" hint, as in a first sentence.
  const never = lint("Wear gloves. Never touch the blade.", "warning").find((f) => f.code === "STE_VERB_FIRST");
  assert.match(never?.hint ?? "", /Do not/);
  assert.ok(!codes("Avoid the dust. Fine dust can hurt your lungs.", "warning").includes("STE_VERB_FIRST"), "avoid is a verb (STE_WORD)");
});

test("STE_VERB_FIRST: a label with an id ('Step 2:', 'Part A:') gets the label hint, not 'add it to verbs'", () => {
  const hint = (t) => lint(t).find((f) => f.code === "STE_VERB_FIRST")?.hint;
  assert.equal(hint("Step 2: attach the shelf."), 'Remove the label "Step 2:" and start with the verb, for example "Attach the shelf".');
  assert.equal(hint("Part A: drill the hole."), 'Remove the label "Part A:" and start with the verb, for example "Attach the shelf".');
  assert.equal(hint("Stage 1: cut the boards."), 'Remove the label "Stage 1:" and start with the verb, for example "Attach the shelf".');
  assert.equal(hint("Shelf A, attach it."), 'Start with a command verb, for example "Attach the shelf".');
  assert.match(hint("Board 2 goes here."), /If "Board" is a trade verb, add it to verbs\./);
  assert.match(hint("Shelf attach."), /If "Shelf" is a trade verb, add it to verbs\./);
});

test("sentences: a long text with many dots stays fast", () => {
  const t = performance.now();
  assert.equal(sentences("a. b. ".repeat(40000)).length, 1);
  assert.ok(performance.now() - t < 3000, `${Math.round(performance.now() - t)} ms`);
});

test("sentences: decimals, abbreviations, units, paragraphs", () => {
  assert.deepEqual(sentences("Use a No. 8 screw. Drill approx. 3 mm deep."), ["Use a No. 8 screw.", "Drill approx. 3 mm deep."]);
  assert.deepEqual(sentences("Use a 4.5 mm bit. Drill 30 mm deep."), ["Use a 4.5 mm bit.", "Drill 30 mm deep."]);
  assert.deepEqual(sentences("Cut a 25 mm. wide strip."), ["Cut a 25 mm. wide strip."]);
  assert.deepEqual(sentences("Cut the board to 762 mm. Sand the ends."), ["Cut the board to 762 mm.", "Sand the ends."]);
  assert.deepEqual(sentences("Wait 1 h. Then sand."), ["Wait 1 h.", "Then sand."]);
  assert.deepEqual(sentences("Is it dry? No. Wait 1 hour!"), ["Is it dry?", "No.", "Wait 1 hour!"]);
  assert.deepEqual(sentences("Use hardwood, e.g. Oak or Ash."), ["Use hardwood, e.g. Oak or Ash."]);
  assert.deepEqual(sentences("Use a bit, i.e. 3 mm. Drill."), ["Use a bit, i.e. 3 mm.", "Drill."]);
  assert.deepEqual(sentences("Remove the screws, nails, etc. Then sand."), ["Remove the screws, nails, etc.", "Then sand."]);
  assert.deepEqual(sentences('Write "A" on it. "B" goes next.'), ['Write "A" on it.', '"B" goes next.']);
  assert.deepEqual(sentences("Cut the board\n  to length.\n\nSand the edge"), ["Cut the board to length.", "Sand the edge"]);
  assert.deepEqual(sentences("Stop the saw.   Wait."), ["Stop the saw.", "Wait."]);
  assert.deepEqual(sentences(""), []);
  assert.deepEqual(sentences(null), []);
  assert.equal(codes("Use a No. 8 screw. Drill approx. 3 mm deep.").filter((c) => c !== "STE_WORD").length, 0);
});
