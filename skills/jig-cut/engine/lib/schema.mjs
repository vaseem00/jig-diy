// JSON Schema (draft 2020-12) of the project format, ARCHITECTURE.md section 4. validate.mjs interprets it;
// engine/schema/project.schema.json is JSON.stringify(SCHEMA, null, 2) + "\n" (tests/schema.test.mjs checks).

const ID = "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$";
// Upper bounds keep every value finite after the unit conversion (1e308 in x 25.4 is Infinity).
const MAX = 1e6, MAX_PRICE = 1e9;
const ref = (name, description) => ({ $ref: `#/$defs/${name}`, ...(description ? { description } : {}) });
const str = (description, more) => ({ type: "string", description, ...more });
const text = (description) => str(description, { minLength: 1 });
const num = (description, more) => ({ type: "number", description, ...more });
const int = (description, more) => ({ type: "integer", description, ...more });
const bool = (description, more) => ({ type: "boolean", description, ...more });
const list = (items, description, more) => ({ type: "array", description, items, ...more });
const obj = (description, required, properties) => ({ type: "object", description, ...(required.length ? { required } : {}), properties, additionalProperties: false });
const map = (value, description) => ({ type: "object", description, propertyNames: ref("id"), additionalProperties: value });
const len = (description, more) => num(description, { minimum: 0, maximum: MAX, ...more });
const pos = (description, more) => num(description, { exclusiveMinimum: 0, maximum: MAX, ...more });
const price = (description) => num(description, { minimum: 0, maximum: MAX_PRICE });
const ids = (description) => list(ref("id"), description);

// Fields every material kind shares; each kind adds its own (kind-specific keys elsewhere are unknown keys).
const common = (kind, description) => ({
  name: text("Name in the BOQ and the shopping list, for example \"Pine board\"."),
  kind: { const: kind, description },
  spec: str("Size or grade as the store writes it, for example \"19 x 235 mm (1x10)\"."),
  store: ref("id", "Id of the store in stores where you buy it."),
  color: ref("color", "Color in the 3D view and the cut drawings."),
  group: text("BOQ group name. Default: from the kind (Timber and sheet, Hardware, Consumables, Finish)."),
  est: bool("Set false when the price is a real quote. Default: the project estimate value."),
  note: str("Note shown next to the item in the shopping list."),
  role: { enum: ["anchor"], description: "anchor: wall fixings. A tall object needs one to pass the tip-over check." },
});
const packed = (pack) => ({
  pack,
  packName: text("Name of one pack, for example \"237 ml bottle\"."),
  price: price("Price of one pack in the project currency."),
});

export const SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "jig project",
  description: "A DIY build: materials, tools, parts and steps. Lengths use the project units (mm or in).",
  type: "object",
  required: ["id", "title", "materials", "parts"],
  properties: {
    $schema: str("Path or URL of this schema, for editor help. The engine ignores it."),
    jig: int("Format version. This engine reads format 1.", { enum: [1], default: 1 }),
    id: str("Output file name and browser storage key. Lower-case letters, digits and single hyphens.", { pattern: "^[a-z0-9]+(-[a-z0-9]+)*$", minLength: 1, maxLength: 64 }),
    title: text("The object, for example \"Pine bookshelf\"."),
    summary: str("One or two STE descriptive sentences about the object.", { default: "" }),
    level: { enum: ["new", "some", "pro"], default: "some", description: "Level the page opens at: new (first time), some (some experience) or pro." },
    units: { enum: ["mm", "in"], default: "mm", description: "Unit of every length in this file: sizes, positions, stock, kerf, trim, fasteners." },
    currency: str("ISO 4217 currency code, for example USD, EUR, INR.", { pattern: "^[A-Z]{3}$", default: "USD" }),
    tax: obj("Sales tax or VAT.", ["rate"], {
      rate: num("Tax rate as a share from 0 to 1: 7% is 0.07, 20% is 0.2.", { minimum: 0, maximum: 1 }),
      label: str("Name of the tax, for example \"VAT\".", { minLength: 1, default: "Tax" }),
      included: bool("true: prices include the tax. false: the tax is added to the total.", { default: false }),
    }),
    priceNote: str("Where the prices come from.", { default: "" }),
    pricesAsOf: str("Date of the prices, YYYY-MM-DD.", { pattern: "^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])$" }),
    estimate: bool("true: rates show an est badge unless a material or tool sets est to false.", { default: true }),
    kerf: len("Saw cut width, at most 10 mm. Default: 3 mm, or 1/8 in when units is in.", { maximum: 10 }),
    trim: len("Waste cut from the start of each board to square the factory end. The first piece starts at trim.", { default: 0 }),
    contingency: num("Spare budget as a share from 0 to 0.5: 10% is 0.1.", { minimum: 0, maximum: 0.5, default: 0.1 }),
    terms: list(text("A technical name."), "Technical names the STE linter accepts.", { default: [] }),
    verbs: list(text("A command verb."), "Extra command verbs the STE linter accepts (trade verbs).", { default: [] }),
    stores: map(ref("store"), "Where to buy. Key: store id."),
    materials: map(ref("material"), "What is bought and used. Key: material id."),
    tools: list(ref("tool"), "Tools the steps use."),
    parts: list(ref("part"), "What is cut, made or installed."),
    props: map(ref("prop"), "Context boxes (wall, bench, floor). Shown in 3D, never bought. Key: prop id."),
    techniques: map(ref("technique"), "Extra technique cards, or cards that replace a built-in card. Key: technique id."),
    steps: list(ref("step"), "The build sequence. The plan, check and build commands need it."),
    uses: ref("uses", "Project-wide consumables not tied to a step: { materialId: amount }."),
    finish: list(ref("finish"), "Project-wide finishes not tied to a step."),
    handoff: list(obj("Work this guide leaves to a professional.", ["topic", "text"], {
      topic: text("The hand-off topic id: gas, mains, structural, height, permit, asbestos or lead-paint, for example \"mains\". Common names such as \"mains wiring\" also match."),
      text: text("What the professional does, in STE descriptive sentences."),
    }), "Work this guide leaves to a professional."),
    safety: obj("Safety settings.", [], {
      tipRatio: pos("Height-to-depth ratio above which an object 600 mm (24 in) tall or more needs an anchor step. A smaller object gets the warning W_TIP_SMALL.", { default: 2 }),
      cleared: list(obj("A hit of the hand-off screen that is not hand-off work.", ["topic", "why"], {
        topic: text("The hand-off topic id of the hit: gas, mains, structural, height, permit, asbestos or lead-paint. Common names such as \"mains wiring\" also match."),
        why: str("Why the hit is not that work, in STE descriptive sentences, 10 to 240 characters. For lead-paint, give the age of the paint.", { minLength: 10, maxLength: 240 }),
      }), "Hits of the hand-off screen that are not hand-off work. An entry turns the E_HANDOFF of its topic into the info I_HANDOFF_CLEARED, and the safety review lists each hit. Never use it for real hand-off work."),
    }),
  },
  additionalProperties: false,
  $defs: {
    id: str("An id: letters, digits, '.', '_' or '-', 64 characters or fewer.", { pattern: ID }),
    color: str("Hex color #rrggbb.", { pattern: "^#[0-9a-fA-F]{6}$" }),
    vec3: list(num("A value.", { minimum: -MAX, maximum: MAX }), "[x, y, z].", { minItems: 3, maxItems: 3 }),
    size3: list(pos("A length more than 0."), "Box size [x, y, z] in project units.", { minItems: 3, maxItems: 3 }),
    uses: map(pos("Amount in the material's unit (pieces for each materials)."), "Consumables: { materialId: amount }."),
    warn: obj("A WARNING (risk of injury) or CAUTION (risk of damage), shown before the instructions.", ["type", "text"], {
      type: { enum: ["warning", "caution"], description: "warning: risk of injury. caution: risk of damage." },
      text: text("The warning in STE: the command first, then the risk."),
    }),
    store: obj("A store.", ["name"], {
      name: text("Store name, for example \"Timber yard\"."),
      online: bool("true: an online order, put first in the purchase plan.", { default: false }),
      lead: len("Delivery time in days."),
      note: str("Note for this trip."),
      url: str("Store web address.", { pattern: "^https?://\\S+$" }),
    }),
    material: { description: "A material. kind sets the other fields: linear, sheet, each or amount.", anyOf: [ref("linear"), ref("sheet"), ref("each"), ref("amount")] },
    linear: {
      ...obj("A material sold by length (boards, battens, rods). Give stock (board lengths) or perLength (cut-to-size price).", ["name", "kind", "section"], {
        ...common("linear", "linear: sold by length (boards, battens, rods)."),
        section: list(pos("A length more than 0."), "Section [width, thickness] in project units.", { minItems: 2, maxItems: 2 }),
        profile: { enum: ["rect", "round"], default: "rect", description: "Section shape: rect or round (dowel, rod, pipe)." },
        stock: list(obj("A stock length.", ["length", "price"], { length: pos("Board length in project units."), price: price("Price of one board.") }), "Stock lengths the store sells.", { minItems: 1 }),
        perLength: obj("Cut-to-size pricing: price per length, boards up to max.", ["price", "per", "max"], {
          price: price("Price for each per length."),
          per: pos("Length the price is for, in project units."),
          max: pos("Longest board the store cuts, in project units."),
          step: pos("Lengths are sold in steps of this size. Default: per."),
        }),
      }),
      anyOf: [{ required: ["stock"] }, { required: ["perLength"] }],
    },
    sheet: obj("A material sold as sheets: plywood, MDF, board.", ["name", "kind", "thick", "stock"], {
      ...common("sheet", "sheet: sold as sheets (plywood, MDF)."),
      thick: pos("Sheet thickness in project units."),
      stock: list(obj("A sheet size.", ["w", "h", "price"], { w: pos("Sheet width."), h: pos("Sheet height."), price: price("Price of one sheet.") }), "Sheet sizes the store sells.", { minItems: 1 }),
      grain: bool("true: pieces keep their long side along the sheet's long side.", { default: false }),
    }),
    each: obj("A material counted in pieces: screws, hinges, brackets.", ["name", "kind"], {
      ...common("each", "each: counted in pieces (screws, hinges, brackets)."),
      ...packed(pos("Pieces in one pack.", { default: 1 })),
      unit: str("Word for one piece, for example \"piece\" or \"sheet\".", { minLength: 1, default: "piece" }),
      spare: num("Spare share from 0 to 1. Default: 0.1 for fasteners, else 0.", { minimum: 0, maximum: 1 }),
      len: pos("Fastener length in project units."),
      d: pos("Fastener diameter in project units."),
      head: { enum: ["flat", "pan", "hex"], description: "Fastener head: flat (countersunk), pan or hex." },
      included: bool("true: comes in a kit, listed as \"in the kit\" and not bought.", { default: false }),
    }),
    amount: obj("A material measured by amount: glue, finish, sandpaper by the sheet.", ["name", "kind", "unit"], {
      ...common("amount", "amount: measured in a unit (L, ml, kg, g, m, roll)."),
      ...packed(pos("Amount in one pack, in unit.", { default: 1 })),
      unit: text("Unit of the amount: L, ml, kg, g, sheet, m, roll."),
      coverage: pos("Area one unit covers: m² for mm projects, ft² for in projects. Required for a finish."),
      coats: int("Coats to apply.", { minimum: 1, default: 1 }),
      spare: num("Spare share from 0 to 1. Default: 0.1 for finishes, else 0.", { minimum: 0, maximum: 1 }),
    }),
    tool: obj("A tool a step uses.", ["id", "name"], {
      id: ref("id", "Tool id, used in steps[].tools."),
      name: text("Tool name, for example \"Circular saw\"."),
      spec: str("Size or type, for example \"fine blade, 40 teeth\"."),
      have: bool("true: you have it. It shows in the plan only.", { default: false }),
      get: { enum: ["buy", "rent", "borrow"], default: "buy", description: "How to get it when you do not have it." },
      price: price("Price to buy, or price for one day to rent."),
      days: pos("Rental days.", { default: 1 }),
      qty: int("How many.", { minimum: 1, default: 1 }),
      store: ref("id", "Id of the store in stores."),
      power: bool("true: a power tool. Each step that uses it needs a WARNING.", { default: false }),
      ppe: bool("true: protective equipment, listed in the Safety group.", { default: false }),
      est: bool("Set false when the price is a real quote."),
    }),
    part: obj("A part: one piece that is cut, made or installed.", ["id", "name", "material", "size"], {
      id: ref("id", "Unique part id, for example \"A1\"."),
      label: str("Letter the reader sees, shared by identical parts. Default: the id.", { minLength: 1, maxLength: 16 }),
      name: text("One word used for the part everywhere, for example \"Side\"."),
      material: ref("id", "Id of its material in materials."),
      size: ref("size3", "Box size [x, y, z] in project units, before rotation."),
      at: ref("vec3", "Minimum corner [x, y, z] of the box before rotation. The guide needs it."),
      shape: { enum: ["box", "cylinder"], default: "box", description: "box, or cylinder (two equal sides are the diameter)." },
      rotate: ref("vec3", "Rotation in degrees about the box centre, x then y then z."),
      color: ref("color", "Color in 3D. Default: the material color."),
      rip: bool("true: the part may be narrower than the board width (a rip cut)."),
      grain: { enum: ["along", "across", "any"], description: "Grain on a sheet with grain: along (default), across or any." },
      role: { enum: ["anchor"], description: "anchor: a wall fixing for the tip-over check." },
      finish: bool("false: leave the part out of the finished area."),
      joins: ids("Parts this part may overlap on purpose (a shelf in a dado)."),
    }),
    prop: obj("A context box (wall, bench, floor). Never bought.", ["size"], {
      size: ref("size3", "Box size [x, y, z] in project units."),
      at: ref("vec3", "Minimum corner [x, y, z]. The guide needs it."),
      color: ref("color", "Color in 3D."),
      shape: { enum: ["box", "cylinder"], default: "box", description: "box or cylinder." },
      rotate: ref("vec3", "Rotation in degrees, x then y then z."),
      hero: bool("true: shown in the Plan view.", { default: true }),
      label: text("Name shown in 3D."),
    }),
    technique: obj("A technique card.", ["name", "do"], {
      name: text("Card title, for example \"Cut on the line\"."),
      why: str("Why the technique works, in STE descriptive sentences."),
      warn: list(ref("warn"), "Warnings shown on the card."),
      do: list(text("One instruction. Text may use {kerf}."), "Instructions in STE.", { minItems: 1 }),
      tools: list(text("A tool name."), "Tools the technique needs."),
    }),
    fastener: {
      description: "A fastener: positional { material, at, dir } (drawn in 3D) or counted { material, count } (not drawn).",
      anyOf: [
        obj("A positional fastener, drawn in 3D.", ["material", "at", "dir"], {
          material: ref("id", "Id of an each material."),
          at: ref("vec3", "Head position [x, y, z]."),
          dir: ref("vec3", "Direction the fastener travels [dx, dy, dz]."),
          len: pos("Length. Default: the material len."),
          d: pos("Diameter. Default: the material d."),
          repeat: obj("Repeat the fastener: count copies, each moved by step.", ["count", "step"], {
            count: int("Number of fasteners, the first one included.", { minimum: 1, maximum: 500 }),
            step: ref("vec3", "Offset [dx, dy, dz] from one fastener to the next."),
          }),
        }),
        obj("A counted fastener, not drawn.", ["material", "count"], {
          material: ref("id", "Id of an each material."),
          count: int("Number of fasteners.", { minimum: 1, maximum: MAX }),
        }),
      ],
    },
    finish: obj("A finish: coats of an amount material on parts.", ["material"], {
      material: ref("id", "Id of an amount material with coverage."),
      coats: int("Coats. Default: the material coats.", { minimum: 1 }),
      parts: ids("Parts to finish. Default: every part not made of an each material, except finish: false."),
    }),
    step: obj("One build step: one visible change.", ["id", "title"], {
      id: ref("id", "Unique step id."),
      title: text("A command, for example \"Attach the top shelf\"."),
      phase: text("Phase name. Consecutive steps with one name form a phase."),
      minutes: len("Work time for an experienced person, in minutes."),
      wait: len("Waiting time (glue, finish), in minutes."),
      parts: ids("Parts installed in this step. Each part is installed in exactly one step."),
      fasteners: list(ref("fastener"), "Fasteners installed in this step."),
      uses: ref("uses", "Consumables used in this step: { materialId: amount }."),
      finish: ref("finish", "Finish applied in this step."),
      cuts: { type: ["boolean", "array"], items: ref("id"), description: "true, or material ids: stock is cut in this step." },
      tools: ids("Tool ids."),
      teach: ids("Technique card ids."),
      warn: list(ref("warn"), "Warnings shown before the instructions."),
      do: list({
        type: ["string", "object"], minLength: 1, required: ["t"], additionalProperties: false,
        description: "An instruction, or { t, new: true } for a line shown only at First time.",
        properties: { t: text("The instruction."), new: bool("true: show the line only at First time.") },
      }, "Instructions in STE, one action each."),
      check: text("The inspection that ends the step."),
      why: str("Why, in STE descriptive sentences. Shown at First time."),
      tip: str("A tip. Shown at First time and Some experience."),
      pose: { enum: ["kit"], description: "kit: lay the cut parts flat on the floor." },
      focus: ids("Parts lit in the kit pose."),
      from: ref("vec3", "Path [dx, dy, dz] the new parts arrive along."),
      view: obj("Camera.", [], {
        az: num("Azimuth in degrees: 0 front, 90 right side, 180 back.", { minimum: -360, maximum: 360 }),
        el: num("Elevation in degrees.", { minimum: -90, maximum: 90 }),
        zoom: pos("Zoom. More than 1 is closer."),
        note: str("A short note under the 3D view, shown at every level; never in print, plan.md or the no-script copy. For example \"The picture shows the cube upright.\"", { minLength: 1, maxLength: 120 }),
      }),
      props: ids("Prop ids shown in this step."),
    }),
  },
};
