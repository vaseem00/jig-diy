// Built-in technique cards. A step lists the ids it uses in `teach`; the page opens a card the first time a
// "First time" reader meets it. A project card with the same id replaces a built-in card. Every line passes ste.mjs
// (tests/techniques.test.mjs). Text may use {kerf} (the project kerf) and {mm value|inch value}, such as
// {150 mm|6 in}: fillTechnique puts in the value for the project unit.
// The cards name no grit size and no awl. Where a card needs a support it says "a bench or a sawhorse"; the project
// names its own (trestles, a workbench). The drill cards share one WARNING text, so a step that teaches two of them
// shows it once.

import { fmtLen } from "./locale.mjs";

const DRILL_WARNING = { type: "warning", text: "Wear safety glasses. The drill bit can throw chips into your eyes." };

export const TECHNIQUES = {
  "measure-mark": {
    name: "Measure and mark",
    do: [
      "Hook the tape on the square end of the board.",
      "Read the tape at eye level.",
      "Make a small V mark with a sharp pencil.",
      "Put the square against the edge of the board.",
      "Draw a line through the V along the square.",
      "Write an X on the waste side of the line.",
    ],
    why: "The saw blade removes {kerf} of wood. The X tells you which side of the line to cut on.",
    tools: ["Tape measure", "Pencil", "Square"],
  },
  "cut-straight": {
    name: "Cut on the line",
    // One WARNING for each hazard: the command, then the risk (safety.md sections 2 and 4). The card is for a circular
    // saw: a hand on the offcut is at the blade exit, a long offcut that sags or a board that sags between two far
    // supports closes the cut and makes the saw jump back, and the lower guard covers the blade after the cut (the saw
    // makers' kickback rules). A jigsaw or hand-saw project gives its own card with the same id.
    warn: [
      { type: "warning", text: "Wear safety glasses. The saw can throw chips into your eyes." },
      { type: "warning", text: "Wear ear protection. A loud saw can hurt your ears." },
      { type: "warning", text: "Keep your hands {150 mm|6 in} from the blade. The blade can cut your fingers." },
      { type: "warning", text: "Stand to the side of the saw line. A saw that jumps back can hit you." },
      { type: "warning", text: "Support the board so that the cut stays open. A cut that closes on the blade makes the saw jump back toward you." },
      { type: "warning", text: "Do not lock or remove the lower blade guard. The guard covers the blade after the cut." },
    ],
    do: [
      "Clamp the board to a bench or a sawhorse, with the line near the support.",
      "Put a second support under a long waste piece, near the line.",
      "Do not cut between two supports that are far apart.",
      "Align the blade with the waste side of the line.",
      "Let the saw reach full speed before it touches the wood.",
      "Push the saw slowly along the line.",
      "Let a short waste piece fall. Do not hold it.",
      "Before you lift the saw, let the blade stop.",
    ],
    why: "The blade removes {kerf} of wood. A cut on the waste side keeps the part at its full length.",
    tools: ["Saw", "Clamp"],
  },
  "pilot-hole": {
    name: "Drill a pilot hole",
    warn: [{ ...DRILL_WARNING }],
    do: [
      "Select a drill bit that is a little smaller than the screw shaft.",
      "Mark the hole position with a pencil.",
      "Clamp small parts before you drill.",
      "Hold the drill at 90° to the face.",
      "Drill to the depth of the screw.",
    ],
    why: "A pilot hole gives the screw a path. Without it, the wood can split near an edge.",
    tools: ["Drill", "Drill bit"],
  },
  countersink: {
    name: "Countersink the hole",
    warn: [{ ...DRILL_WARNING }],
    do: [
      "Put the countersink bit in the pilot hole.",
      "Drill until the cone is as wide as the screw head.",
      "Remove the dust from the hole.",
    ],
    why: "The cone lets the screw head sit flush with the face.",
    tools: ["Drill", "Countersink bit"],
  },
  "glue-joint": {
    name: "Glue a joint",
    do: [
      "Apply a thin line of glue to one face.",
      "Spread the glue with your finger or a scrap.",
      "Put the parts together in 10 minutes or less.",
      "Wipe off the extra glue with a wet cloth.",
    ],
    why: "Too much glue makes a weak, wet joint. Dry glue stains do not take the finish.",
    tools: ["Wet cloth"],
  },
  clamp: {
    name: "Clamp two parts",
    warn: [{ type: "caution", text: "Do not tighten the clamp too much. Too much force pushes out all the glue." }],
    do: [
      "Put a scrap block between each clamp jaw and the wood.",
      "Tighten the clamp until the joint closes.",
      "When a thin line of glue comes out, stop.",
    ],
    why: "The scrap blocks prevent dents in the face.",
    tools: ["Clamps", "Scrap blocks"],
  },
  "square-diagonals": {
    name: "Square a frame",
    do: [
      "Measure the frame from corner to corner.",
      "Measure the other diagonal.",
      "If the two lengths are not equal, push the long diagonal corners together.",
      "Measure again until the two lengths are equal within {2 mm|1/16 in}.",
    ],
    why: "A square frame has two equal diagonals. Shelves and doors then fit.",
    tools: ["Tape measure"],
  },
  sand: {
    name: "Sand a face",
    warn: [
      { type: "warning", text: "Wear a dust mask. Fine dust can hurt your lungs." },
      { type: "caution", text: "Do not sand across the grain. Cross scratches show through the finish." },
    ],
    do: [
      "Wrap the sandpaper around a flat block.",
      "Sand along the grain with a medium grit.",
      "Remove the dust with a dry cloth.",
      "Sand again with a finer grit.",
    ],
    why: "Each finer grit removes the scratches of the grit before it.",
    tools: ["Sanding block", "Sandpaper", "Dust mask"],
  },
  "finish-wipe": {
    name: "Apply a wipe-on finish",
    // One hazard in each WARNING. The rag text is the one of safety.md section 5 (and of the safety summary).
    warn: [
      { type: "warning", text: "Wear nitrile gloves. The finish can hurt your skin." },
      { type: "warning", text: "Open a window. Finish fumes can make you ill." },
      { type: "warning", text: "Put used rags flat outdoors to dry, or in a closed metal can of water. Oily rags can catch fire." },
    ],
    do: [
      "Stir the can for 1 minute.",
      "Apply a thin coat with a lint-free cloth.",
      "Wait for the time on the can.",
      "Sand lightly with fine sandpaper between coats.",
    ],
    why: "Thin coats dry hard and even. A thick coat stays soft and runs.",
    tools: ["Lint-free cloth", "Gloves"],
  },
  "find-stud": {
    name: "Find a stud in the wall",
    // The cable WARNING is the text of safety.md section 6, so a step that also gives it shows it once.
    warn: [
      { type: "warning", text: "Do not drill above, below or beside a socket or a switch. Cables run there." },
      { type: "warning", text: "Use a cable and pipe detector before you drill. A drill can hit a cable or a pipe." },
    ],
    do: [
      "Move a cable and pipe detector over the area.",
      "Mark each cable and pipe that the detector finds.",
      "Do not drill within {150 mm|6 in} of a ceiling or a corner.",
      "Move a stud finder slowly along the wall.",
      "Mark the two edges of the stud.",
      "Drill a {2 mm|1/16 in} test hole between the marks.",
      "If the bit goes into wood, use that position.",
    ],
    why: "A screw in a stud holds the load. A screw in plasterboard (drywall) alone can pull out.",
    tools: ["Cable and pipe detector", "Stud finder", "Drill"],
  },
  "drill-straight": {
    name: "Drill a straight hole",
    warn: [
      { ...DRILL_WARNING },
      { type: "caution", text: "Put a scrap block under the part. The bit can split the back face when it comes out." },
    ],
    do: [
      "Mark the center of the hole with a pencil.",
      "Clamp the part to a bench or a sawhorse.",
      "Put the tip of the bit on the mark.",
      "Hold the drill at 90° to the face.",
      "Examine the drill from the front and from the side.",
      "Start the drill at low speed.",
      "When the bit is in the wood, increase the speed.",
      "Pull out the bit often to remove the chips.",
    ],
    why: "A hole at 90° keeps the screw or dowel straight. A small square next to the bit shows the angle.",
    tools: ["Drill", "Square"],
  },
  "level-check": {
    name: "Level a part",
    do: [
      "Put the spirit level on the part.",
      "Read the position of the bubble.",
      "Turn the level end to end on the same spot.",
      "Read the bubble again.",
      "If the bubble is not between the lines, adjust the low end of the part.",
      "Do the check again.",
    ],
    why: "A level part does not rock, and items on it do not slide. A good level shows the same reading in the two directions.",
    tools: ["Spirit level"],
  },
};

// A deep copy of the card with {kerf} filled ("3 mm", "1/8 in", "3/32 in"; kerf in mm, default 3 mm or 1/8 in) and
// each {mm value|inch value} replaced by the value for the project unit.
export function fillTechnique(card, { kerf, units = "mm" } = {}) {
  const k = fmtLen(typeof kerf === "number" && Number.isFinite(kerf) ? kerf : units === "in" ? 3.175 : 3, units, { den: 64 });
  const fill = (v) =>
    typeof v === "string" ? v.replaceAll("{kerf}", k).replace(/\{([^{}|]+)\|([^{}|]+)\}/g, (_, a, b) => (units === "in" ? b : a).trim())
      : Array.isArray(v) ? v.map(fill)
      : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([key, x]) => [key, fill(x)]))
      : v;
  return fill(card);
}
