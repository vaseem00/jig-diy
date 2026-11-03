// Safety checks on a normalized project (lengths in mm): a WARNING on every power-tool step, the tip-over rule,
// the hand-off screen for work a non-professional must not do, and the safety summary (PPE, power tools, notes).

import { TECHNIQUES } from "./techniques.mjs";
import { tipCheck } from "./geometry.mjs";
import { fmtLen } from "./locale.mjs";

// Hand-off topics. Each pattern is matched with word boundaries; a pattern with groups n and u (a number and a unit)
// counts only for a height of 2 m (6 ft) or more, or 2.5 m (8 ft) for a step ladder (group st). aliases: other topic
// names accepted in project.handoff. skip: phrases that are not the work ("plug the saw into the mains"); a pattern
// match that lies fully inside a skip match does not count. The screen reads each text with its white space runs as
// one space. Each optional dash is written "\s*(?:-\s*)?", and each window has a bound, so a pattern stays fast.
const UNIT = "(?<u>mm|cm|m|metres?|meters?|ft|feet|foot|in|inch(?:es)?|'|′)(?![\\p{L}])";
const NUM = "(?<n>\\d+(?:\\.\\d+)?)";
const re = (s) => new RegExp(s, "giu");
// A mains voltage, 100 to 250 V: "230 V", "120-volt", "240 VAC". Not 12 V or 24 V.
const V = "(?:1\\d\\d|2[0-4]\\d|250)\\s*(?:-\\s*)?v(?:olts?|ac)?";
// A low voltage, 1 to 49 V: "12 V", "3 V", "4.5 V" (not the "30 V" of "230 V").
const LOWV = "(?<![\\d.])(?:[1-9]|[1-4]\\d)(?:\\.\\d+)?\\s*(?:-\\s*)?v(?:olts?|dc)?\\b";
// Words of low-voltage work: "the USB light", "the plug of the battery box", "the dolls house lights".
const LV = "(?:usb|battery|batteries|solar|bike|bicycle|guitar|toy|dc|dolls?|doll['’]s|model|train|play)";
// The rest of the sentence names low-voltage work: a 1 to 49 V voltage, a battery, crocodile clips, a doorbell or a
// chime, a board, an LED strip or USB. A battery charger or a USB charger plugs into the mains, so it does not count.
const NOT_LV = `(?![^.!?]{0,60}\\b(?:${LOWV}|batter(?:y|ies)\\b(?!\\s+chargers?\\b)|crocodile\\s+clips?\\b|doorbells?\\b|chimes?\\b|gnd\\b|pcb\\b|circuit\\s+boards?\\b|led\\s+strips?\\b|usb\\b(?!\\s+chargers?\\b)))`;
// A fixed mains item (an outlet, a light switch, a ceiling fan) is mains work also with a USB or battery word after it
// ("Replace the outlet with a USB outlet"). Only a low-voltage item that holds it stops the hit: "the light switch of
// the battery box", "the switch to the 3 V battery box of the doll's house".
const ON_LV = `(?!\\s+(?:of|on|onto|to|in|into)\\s+(?:the|a|an|your)\\s+(?:[\\p{L}\\p{N}.'’-]+\\s+){0,2}?(?:${LOWV}|batter(?:y|ies)\\b(?!\\s+chargers?\\b)|(?:toy|dolls?|doll['’]s|model|bike|bicycle|guitar|solar|dc)\\b|led\\s+strips?\\b))`;
// A lamp holder, with an optional cap ("an E27 lamp holder", "a batten holder"). Not an E10 holder: the cap of a torch
// bulb and of a school battery circuit.
const HOLDER = "(?:(?:(?!e10\\b)[eb]\\d\\d|batten)\\s+)?(?:lamp|bulb)\\s*(?:-\\s*)?holders?";
// The work verbs on a switch, an outlet or a light, and up to two words before the item ("a new GFCI outlet").
const FIT = "(?:wire|install|replace|add|move|fit|swap|relocate|reposition)";
const MOD = `(?:(?:new|old|existing|extra|replacement|double|twin|single|gfci|gfi|afci|rcd|usb|dimmer|fused|switched|outdoor|wall|power|duplex|kitchen|bathroom|garage|weatherproof|shaver|floor|smart|\\d+|two|three|four|five|six|eight|${V})\\s+){0,2}`;
// Small things with a wall, a roof or a door: not a building ("the back wall of the cabinet", "the roof of the hutch").
const SMALL = "(?:bird\\s*(?:house|box|table)|nest\\s*box|dog\\s*house|kennel|hutch|coop|run|doll(?:s|['’]s|s['’])?\\s*house|play\\s*house|wendy\\s+house|hen\\s*house|bat\\s+(?:box|house)|hedgehog\\s+house|bee\\s+house|insect\\s+hotel|bug\\s+hotel|cat\\s+house|chicken\\s+house|duck\\s+house|toy\\s+\\p{L}+|fairy\\s+house|cabinet|cupboard|drawer|box|crate|planter|enclosure|case|model|log\\s+store|bin\\s+store)";
const NOT_SMALL_OF = `(?!\\s+(?:of|in|on)\\s+(?:the|a|an|this|that|your)\\s+(?:[\\p{L}'’-]+\\s+){0,2}?${SMALL}\\b)`;
// Furniture and garden builds with a wall or a door, for the wall, opening and lintel rules only: a person can stand
// on the roof of a shed or a tree house, so the roof rules keep SMALL. Not a unit ("the wall of the unit next door") or
// a bare oven ("a new lintel over the opening for the oven").
const WALL_SMALL = `(?:${SMALL}|wardrobes?|bookcases?|dressers?|chests?|vivari(?:ums?|a)|terrariums?|aquariums?|raised\\s+beds?|compost\\s+bins?|sandpits?|(?:pizza|bread|cob|clay)\\s+ovens?|bbqs?|barbecues?|sheds?|greenhouses?|summer\\s*houses?|tree\\s*houses?)`;
const NOT_WALL_SMALL_OF = `(?!\\s+(?:of|in|on)\\s+(?:the|a|an|this|that|your)\\s+(?:[\\p{L}'’-]+\\s+){0,2}?${WALL_SMALL}\\b)`;
// A ladder that is stored, not used: "a rack for the extension ladder", "hang the 3 m ladder on two hooks".
const STORED = "(?<!\\b(?:for|hang|store|stow)\\s+(?:the|an?|your)\\s+(?:[\\p{L}\\p{N}.-]+\\s+){0,3})";
export const HANDOFF_TOPICS = {
  gas: {
    name: "gas work", aliases: ["gas work", "gas fitting"],
    text: "A licensed gas engineer does all work on gas lines and gas appliances.",
    patterns: [
      // A gas line or appliance. Not a toy cooker, or the gas cylinder of an office chair ("the gas strut of the lid").
      re("(?<!\\b(?:toy|pretend|play|chair)\\s+)\\bgas\\s+(?:lines?|pipes?|piping|pipework|supply|supplies|appliances?|meters?|valves?|boilers?|cookers?|stoves?|hobs?|ovens?|ranges?|dryers?|fireplaces?|fires?|fire\\s+pits?|fire\\s+tables?|burners?|heaters?|furnaces?|water\\s+heaters?|leaks?|mains?|connections?|fittings?|hoses?|regulators?|bottles?|cylinders?|tanks?)\\b(?!\\s+(?:of|in|for|from)\\s+(?:the|an?|your)\\s+(?:[\\p{L}-]+\\s+)?(?:chairs?|stools?|seats?|lids?|struts?)\\b)"),
      re("\\b(?:natural|mains)\\s+gas\\b"),
      re("\\bgas[- ](?:fired|powered)\\b"),
      // Bottled gas: "the propane tank", "the LPG cylinder". Not a propane torch, weed burner or cartridge, or butane to
      // refill a lighter or a soldering iron ("Fill the soldering iron with butane").
      re("\\b(?:propane|lpg)\\b(?!\\s*(?:-\\s*)?(?:torch(?:es)?|blowtorch(?:es)?|lighters?|soldering|weed\\s+burners?|cartridges?|canisters?)\\b)"),
      re("(?<!\\b(?:irons?|lighters?|torch(?:es)?|blowtorch(?:es)?)\\b[^.!?]{0,40})\\bbutane\\b(?!\\s*(?:-\\s*)?(?:torch(?:es)?|blowtorch(?:es)?|lighters?|soldering|weed\\s+burners?|cartridges?|canisters?)\\b)(?![^.!?]{0,40}\\b(?:soldering|irons?|lighters?|torch(?:es)?|blowtorch(?:es)?)\\b)"),
      // A boiler (not a boiler cupboard, cabinet, box, surround, shelf or door), a cooker or a hob to the gas, and the
      // regulator of a bottle.
      re("\\b(?:move|install|replace|fit|relocate|remove|connect)\\s+(?:the|a|an)\\s+(?:(?:new|old|combi|existing)\\s+){0,2}boilers?\\b(?!\\s*(?:-\\s*)?(?:cupboards?|cabinets?|box(?:es)?|surrounds?|shel(?:f|ves)|doors?)\\b)|\\bboiler\\s+flues?\\b"),
      re("\\b(?:hook\\s+up|connect|attach)\\b[^.!?]{0,30}?\\bto\\s+the\\s+gas\\b(?!\\s*(?:-\\s*)?(?:struts?|springs?|lifts?|pistons?)\\b)"),
      re("\\bregulators?\\b(?=[^.!?]{0,40}\\b(?:patio\\s+heaters?|bbq|barbecues?|bottles?|cylinders?)\\b)"),
    ],
    // A distance from an appliance, a meter or a pipe is not gas work: "Keep the finish away from a gas heater.", "750 mm
    // above the gas hob", "clear of the gas hob", "a cupboard around the gas boiler", "1 m from the gas pipe". Nor the dig
    // advice of safety.md section 9: "Buried cables and gas pipes", "where the gas pipes run".
    skip: [
      re("\\b(?:clear\\s+of|over|beside|next\\s+to|around|near|on\\s+(?:each|either|both)\\s+sides?\\s+of)\\s+(?:the\\s+|a\\s+|an\\s+)?(?:open\\s+)?gas\\s+(?:hobs?|cookers?|stoves?|boilers?|heaters?|fires?|fire\\s+pits?|fireplaces?|burners?|appliances?|meters?)\\b"),
      re("\\bbetween\\s+the\\s+gas\\s+(?:hob|cooker|stove|boiler|heater|meter)\\s+and\\s+the\\b"),
      re("\\b(?:away|far)\\s+from\\s+(?:an?\\s+|the\\s+|any\\s+)?(?:open\\s+)?gas\\s+(?:heaters?|fires?|fireplaces?|cookers?|stoves?|hobs?|boilers?|burners?|appliances?|meters?|pipes?|lines?)\\b"),
      re("\\b\\d+(?:\\.\\d+)?\\s*(?:mm|cm|m|in|ft)\\s+(?:or\\s+more\\s+)?(?:from|above|below|away\\s+from)\\s+(?:an?\\s+|the\\s+)?(?:open\\s+)?gas\\s+(?:heaters?|fires?|fire\\s+pits?|fireplaces?|hobs?|cookers?|stoves?|boilers?|burners?|appliances?|meters?|pipes?|lines?)\\b"),
      re("\\b(?:buried|underground)\\s+(?:cables?|wires?|services)\\s+(?:and|or)\\s+gas\\s+(?:pipes?|lines?)\\b"),
      re("\\bwhere\\s+(?:the\\s+)?(?:buried\\s+|underground\\s+)?(?:(?:cables?|wires?)\\s+(?:and|or)\\s+)?gas\\s+(?:pipes?|lines?)\\s+(?:run|runs|are|go|goes|lie|lies)\\b"),
    ],
  },
  mains: {
    name: "mains electrical work", aliases: ["mains wiring", "mains electrical", "electrical", "electrical wiring", "wiring"],
    text: "A licensed electrician does all work on mains wiring, outlets, switches and the breaker panel.",
    patterns: [
      re("\\bmains\\b(?!\\s*(?:-\\s*)?(?:water|gas|powered|operated|adapters?|adaptors?|plugs?|leads?|chargers?)\\b)"),
      re("\\bhard[- ]?wir(?:e|ed|ing)\\b"),
      // A panel, box or board of the supply. Not a 12 V fuse box in a van, or a junction box for low-voltage cables.
      re(`(?<!${LOWV}\\s+)\\b(?:breaker|fuse|electrical|electric|service|distribution)\\s+(?:panel|box|board)(?:es|s)?\\b`),
      re("\\bconsumer\\s+units?\\b"),
      // A hard-wired appliance with no plug: a heater, a hot tub, a spa or underfloor heating to its supply, control unit,
      // isolator, spur or thermostat, and a sauna heater that is fitted or moved. Not the water supply, a hose or a pipe,
      // a heater guard or stones, or a 1 to 49 V heater.
      re(`(?<!${LOWV}\\s+)\\b(?:wire|hard-?wire|connect)\\s+(?:up\\s+)?(?:the|a|an)\\s+(?:new\\s+)?(?:(?:sauna|electric|immersion|storage)\\s+)?(?:heaters?|hot\\s+tubs?|spas?|underfloor\\s+heating(?:\\s+(?:mats?|cables?))?)\\b(?!\\s*(?:-\\s*)?(?:hoses?|pipes?|valves?|covers?|guards?|stones?|filters?)\\b)[^.!?]{0,40}?\\bto\\s+(?:the|a|an)\\s+(?:new\\s+)?(?:(?:mains|power|electrical|electric)\\s+)?(?:supply(?:\\s+cables?)?|control\\s+(?:units?|box|panel)|contactor|isolator|isolating\\s+switch|spur|thermostat)\\b${NOT_LV}`),
      re("\\b(?:install|fit|move|relocate|replace)\\s+(?:the|a|an)\\s+(?:new\\s+|old\\s+)?(?:electric\\s+)?sauna\\s+heaters?\\b(?!\\s*(?:-\\s*)?(?:guards?|covers?|stones?|rails?|fences?)\\b)"),
      re(`(?<!${LOWV}\\s+(?:[\\p{L}-]+\\s+)?)\\bjunction\\s+box(?:es)?\\b${NOT_LV}`),
      re("\\bring\\s+main\\b"),
      // A mains voltage before a fixed conductor: "230 V wiring", "120 V circuit", "240 V cable". Not the cable of a tool
      // ("the 230 V cable of the saw").
      re(`\\b${V}\\s+(?:ac\\s+)?(?:wiring|wires?|circuits?|cables?|supply|outlets?|sockets?|receptacles?|lines?)\\b(?!\\s+(?:of|on)\\s+(?:the|a|an|your)\\s+(?:[\\p{L}-]+\\s+)?(?:saw|drill|sander|router|planer|grinder|tool|mower|trimmer|vacuum|jigsaw)\\b)`),
      // Work on a mains cord, flex or lead: "fit a new 230 V cord", "a new 120 V lamp cord". Not a tool's own cord ("the
      // 120 V cord of the drill"), a pre-wired or moulded one, or a cord set or kit. The verb and the cord are in one
      // clause: no comma, "then" or "and" between them.
      re(`\\b(?:fit|wire|rewire|re-wire|connect|strip|replace|change|install|shorten|lengthen|extend|repair|splice|feed|thread|new)\\b(?:(?![,;]|\\bthen\\b|\\band\\b)[^.!?]){0,30}?(?<!\\b(?:pre-?wired|ready-?made|moulded|molded|factory|certified)\\s+)\\b${V}\\s+(?:ac\\s+)?(?:lamp\\s+)?(?:cords?|flex(?:es)?|leads?)\\b(?!\\s*(?:-\\s*)?(?:sets?|kits?)\\b)(?!\\s+(?:and|with)\\s+(?:an?\\s+)?(?:plug|switch)\\s+sets?\\b)`),
      re("\\b(?:light\\s+switch|switch|outlet|socket|receptacle)\\s+wiring\\b"),
      // Wire, install, replace, add, move, fit or swap a switch, an outlet, a light or a fixed appliance, with up to two
      // words such as "new", "GFCI" or "double" before it. A cover, a plate or a pipe of one is not mains work, nor a
      // spur of a fence post. A fixed mains item stays a hit next to a USB or battery word (ON_LV); an item that can be
      // low voltage (a dimmer, a smart switch, a light) does not count in a low-voltage build (NOT_LV).
      re(`\\b${FIT}\\s+(?:in\\s+)?(?:an?\\s+|the\\s+)?${MOD}(?:light\\s+switch(?:es)?|wall\\s+socket|power\\s+socket|power\\s+outlet|outlets?|receptacles?|circuit\\s+breakers?|ceiling\\s+fans?|chandeliers?|electric\\s+showers?|(?:electric|heated)\\s+towel\\s+(?:rails?|radiators?)|shaver\\s+(?:points?|units?)|ev\\s+chargers?|spurs?(?![^.!?]{0,40}\\b(?:fence|gate|posts?|concrete)\\b))\\b(?!\\s*(?:covers?|plates?|faceplates?|guards?|spacers?|extenders?|strips?|pipes?|hoses?|taps?|valves?|vents?|grilles?|filters?|ducts?|ducting|traps?|brackets?|shel(?:f|ves))\\b)(?!\\s+and\\s+(?:the\\s+)?waste\\b)${ON_LV}`),
      re(`\\b${FIT}\\s+(?:in\\s+)?(?:an?\\s+|the\\s+)?${MOD}(?:dimmer\\s+switch(?:es)?|smart\\s+switch(?:es)?|light\\s+fixtures?|light\\s+fittings?|ceiling\\s+lights?|wall\\s+lights?|pendant\\s+lights?|recessed\\s+lights?|downlights?|can\\s+lights?|mirror\\s+lights?)\\b(?!\\s*(?:covers?|plates?|faceplates?|guards?|spacers?|extenders?|strips?|pipes?|hoses?|taps?|valves?|vents?|grilles?|filters?|ducts?|ducting|traps?|brackets?|shel(?:f|ves))\\b)(?!\\s+and\\s+(?:the\\s+)?waste\\b)${NOT_LV}`),
      // An extractor or exhaust fan of a room. Not the fan of a 3D-printer enclosure, a case, a grow tent, a spray booth
      // or a solder fume box, and not its cover, grille, filter or duct.
      re(`\\b${FIT}\\s+(?:in\\s+)?(?:an?\\s+|the\\s+)?${MOD}(?:extractor|exhaust)\\s+fans?\\b(?!\\s*(?:covers?|plates?|faceplates?|guards?|spacers?|extenders?|strips?|pipes?|hoses?|vents?|grilles?|filters?|ducts?|ducting|brackets?|shel(?:f|ves))\\b)(?![^.!?]{0,60}\\b(?:enclosures?|cases?|tents?|booths?|printers?|fume\\s+box(?:es)?|solder(?:ing)?)\\b)${NOT_LV}`),
      // One more word before a light fixture or fitting ("the under-cabinet light fixture"), but not a plug-in, battery,
      // USB or solar one.
      re(`\\b${FIT}\\s+(?:in\\s+)?(?:an?\\s+|the\\s+)?${MOD}(?:(?!plug-?in\\b|battery\\b|batteries\\b|usb\\b|solar\\b)[\\p{L}-]+\\s+)?light\\s+(?:fixtures?|fittings?)\\b`),
      // A socket with a word before it ("a double socket", "a new socket", "a 13 A socket"), or a socket in a wall or a
      // room. Not a socket set, a socket wrench or a socket head screw, a socket on a tool, or a socket in a case, an
      // enclosure or a front panel.
      re(`\\b${FIT}\\s+(?:in\\s+)?(?:an?\\s+|the\\s+)?(?!usb\\s+sockets?\\s+(?:to|in|on|into)\\s+(?:the|a)\\s+(?:(?:front|back|rear|side|top|bottom)\\s+)?(?:panel|lid)\\b)(?:(?:new|old|existing|extra|replacement|double|twin|single|usb|switched|fused|outdoor|weatherproof|shaver|floor|13\\s*a)\\s+){1,2}sockets?\\b(?!\\s*(?:-\\s*)?(?:covers?|plates?|faceplates?|sets?|wrench(?:es)?|spanners?|heads?|caps?|screws?|bolts?|bits?|drivers?|adapters?|extensions?|ratchets?)\\b)(?!\\s+(?:to|on|onto)\\s+(?:the|a|an|your)\\s+(?:[\\p{L}-]+\\s+)?(?:driver|wrench|ratchet|breaker\\s+bar|extension\\s+bar|spanner)\\b)(?!\\s+(?:in|on|into)\\s+(?:the|a)\\s+(?:[\\p{L}-]+\\s+)?(?:wall\\s+of\\s+the\\s+)?(?:case|enclosure|box)\\b)(?![^.!?]{0,40}\\b(?:enclosures?|cases?)\\b)`),
      re(`\\b${FIT}\\s+(?:in\\s+)?(?:an?\\s+|the\\s+)?sockets?\\s+(?:to|in|on|into)\\s+(?:the\\s+|a\\s+)?(?:\\p{L}+\\s+)?(?:wall|kitchen|garage|bedroom|bathroom|hall|room|lounge|office)\\b(?!\\s+of\\s+(?:the|a|an)\\s+(?:[\\p{L}-]+\\s+)?(?:enclosure|case|box|cabinet|panel)\\b)`),
      // Move a socket ("Move the socket 300 mm to the left"): not a socket set, wrench or bit.
      re("\\b(?:move|relocate|reposition)\\s+(?:the|a|an)\\s+sockets?\\b(?!\\s*(?:-\\s*)?(?:sets?|wrench(?:es)?|spanners?|heads?|bits?|drivers?|adapters?|extensions?|ratchets?)\\b)"),
      // A new circuit, a cable to an outbuilding and US outlet and fixture boxes. Not a circuit board, an LED, buzzer,
      // bulb, simple, series or parallel circuit (a battery circuit of a kids' build), or a circuit or an armoured cable
      // of a low-voltage build.
      re("\\bnew\\s+circuits?\\b(?!\\s*(?:-\\s*)?boards?)"),
      re(`\\b(?:dedicated|cooker|radial|immersion|shower)\\s+circuits?\\b|\\b(?:add|run|install)\\s+(?:an?|the)\\s+(?:new\\s+)?(?:(?!(?:led|buzzer|bulb|simple|series|parallel|electronic|toy|model)\\b)[\\p{L}-]+\\s+)?circuit\\b(?!\\s*(?:-\\s*)?boards?)${NOT_LV}`),
      re("\\b(?:wire|connect)\\b[^.!?]{0,40}?\\bto\\s+(?:the\\s+|a\\s+|an\\s+)?(?:existing\\s+)?(?:light(?:ing)?|ring|radial)\\s+circuits?\\b"),
      re(`\\barmou?red\\s+cables?\\b${NOT_LV}`),
      re("\\b(?:two|three|2|3)-?\\s*prong\\s+(?:outlets?|receptacles?)\\b"),
      // A ceiling box or a ceiling rose. Not a plaster or decorative rose (a moulding).
      re("\\bceiling\\s+box(?:es)?\\b|(?<!\\b(?:plaster|decorative|polyurethane|polystyrene|resin)\\s+)\\bceiling\\s+roses?\\b(?!\\s+(?:mouldings?|moldings?|medallions?))"),
      re(`\\b(?:replace|swap|change)\\s+(?:the|a|an)\\s+(?:(?:old|existing)\\s+)?(?:wall\\s+|light\\s+)?switch(?:es)?\\b(?=[^.!?]{0,40}\\b(?:dimmer|smart\\s+switch|wall|door)\\b)${NOT_LV}`),
      // Wire or connect a light to the switch. Not fairy, string, battery, USB, solar or toy lights.
      re(`\\b(?:wire|connect)\\s+(?:the|a|an)\\s+(?:new\\s+)?(?:(?!(?:fairy|string|battery|usb|solar|toy)\\b)\\p{L}+\\s+)?lights?\\s+to\\s+(?:the|a)\\s+(?:wall\\s+|light\\s+)?switch\\b${NOT_LV}`),
      re("\\b(?:switched\\s+)?fused\\s+(?:spurs?|connection\\s+units?)\\b"),
      re("\\bconnect\\b[^.!?]{0,30}?\\bto\\s+(?:the|a)\\s+(?:new\\s+)?spur\\b"),
      // Work on a mains lead or plug: "fit a new mains lead", "wire the plug", "rewire the lamp". Not the plug of a
      // low-voltage item ("the plug of the 12 V adapter"), or a USB, battery or solar light.
      re("\\b(?:wire|rewire|re-wire|fit|connect|strip|replace|change|install)\\s+(?:in\\s+)?(?:an?\\s+|the\\s+)?(?:new\\s+)?mains\\s+(?:leads?|plugs?|cables?|cords?|flex)\\b"),
      re(`\\b(?:wire|rewire|re-wire)\\s+(?:up\\s+)?(?:an?\\s+|the\\s+)(?:new\\s+)?plugs?\\b(?!\\s+(?:of|on)\\s+(?:the|a|an)\\s+(?:(?:[1-9]|[1-4]\\d)\\s*(?:-\\s*)?v\\b|${LV}\\b|led\\s+strips?\\b|adapters?\\b))`),
      re(`\\b(?:rewire|re-wire)\\s+(?:the|a|an|this|that|your)\\s+(?:(?!${LV}\\b)\\p{L}+\\s+){0,2}(?:lamps?|lights?|plugs?|sockets?|switch(?:es)?|outlets?|house|room|kitchen|cords?|bedroom|bathroom|garage|shed|workshop|office|loft|flat|basement|cellar|extension)\\b(?!\\s+(?:of|on|in|for|to)\\s+(?:the|a|an|your)\\s+(?:new\\s+)?${LV}\\b)`),
      // Wire a lamp: "Wire the lamp.", "Wire the new table lamp". Not a part of the lamp, or a low-voltage lamp.
      re(`\\bwire\\s+(?:up\\s+)?(?:the|a|an|this|your)\\s+(?:(?:new|old)\\s+)?(?:(?!${LV}\\b|led\\b)\\p{L}+\\s+)?lamps?\\b(?!\\s+(?:bases?|columns?|shades?|stands?|posts?|frames?|tops?|arms?|necks?|body|bodies|foot|feet|holders?|sockets?)\\b)${NOT_LV}`),
      // A lamp holder, a lamp socket or a lamp cord: wire, connect, replace or swap one, or fit a new one. Not "fit the
      // lamp holder" of a pre-wired cord set, a lamp cord set or kit, or a bulb holder on a battery.
      re(`\\b(?:wire|rewire|re-wire|connect)\\s+(?:up\\s+)?(?:an?\\s+|the\\s+)?(?:new\\s+)?${HOLDER}\\b${NOT_LV}`),
      re(`\\b(?:replace|change|swap)\\s+(?:an?\\s+|the\\s+)?(?:(?:old|new|broken|damaged|existing)\\s+)?${HOLDER}\\b`),
      re(`\\b(?:fit|install|add|replace|change)\\s+(?:(?:an?|the)\\s+new|an?)\\s+${HOLDER}\\b${NOT_LV}`),
      re(`\\b(?:wire|connect)\\s+(?:it|them)\\s+(?:to|into)\\s+(?:the|a)\\s+(?:new\\s+)?${HOLDER}`),
      re(`\\b(?:wires?|cores?)\\s+(?:to|into)\\s+(?:the|a)\\s+(?:new\\s+)?${HOLDER}${NOT_LV}|\\b${HOLDER}\\s+terminals?\\b`),
      re("\\b(?:wire|rewire|re-wire|replace|change|repair|splice|shorten|lengthen|extend)\\s+(?:a|an|the)\\s+(?:new\\s+)?lamp\\s+(?:sockets?|holders?|cords?|flex|switch(?:es)?)\\b(?!\\s*(?:-\\s*)?(?:sets?|kits?)\\b)"),
      re("\\b(?:fit|install|attach)\\s+(?:a|an|the)\\s+new\\s+lamp\\s+(?:sockets?|holders?|cords?)\\b(?!\\s*(?:-\\s*)?(?:sets?|kits?)\\b)"),
      // A plug, a switch or a lamp holder on a cord, and the reverse: "fit an inline switch to the lamp flex", "connect the
      // flex to the lamp holder". Not a cable tie or a cable clip, or the cable of a 12 V, USB, battery or LED-strip item.
      re(`\\b(?:fit|wire|connect|attach|install|replace|change|add)\\s+(?:an?\\s+|the\\s+)?(?:new\\s+)?(?:plugs?|in-?line\\s+switch(?:es)?|(?:(?:foot|rocker|rotary|toggle|push|pull|cord)\\s+)?switch(?:es)?|dimmers?|${HOLDER})\\s+(?:to|on|onto)\\s+(?:the\\s+|a\\s+|an\\s+)?(?:new\\s+)?(?:lamp\\s+)?(?:flex|cords?|leads?|cables?)\\b(?!\\s*(?:-\\s*)?(?:ties?|clips?|clamps?|tidy|tidies)\\b)(?!\\s+(?:of|on|from|to|for)\\s+(?:the|a|an)\\s+(?:(?:[1-9]|[1-4]\\d)\\s*(?:-\\s*)?v\\b|(?:usb|solar|dc|bike|bicycle|toy|guitar)\\b|batter(?:y|ies)\\b(?!\\s+chargers?\\b)|led\\s+strips?\\b))${NOT_LV}`),
      re(`\\b(?:wire|connect|attach)\\s+(?:the\\s+|a\\s+|an\\s+)?(?:new\\s+)?(?:lamp\\s+)?(?:flex|cords?)\\s+(?:to|into|onto)\\s+(?:the\\s+|a\\s+|an\\s+)?(?:new\\s+)?(?:plugs?|in-?line\\s+switch(?:es)?|${HOLDER})\\b`),
      re("\\bconnect\\s+(?:the|a)\\s+(?:new\\s+)?(?:lamp\\s+)?flex\\b"),
      // A cord to a lamp: "fit a new cord to the lamp", "fit a new flex to the lamp holder". Not a part of the lamp ("the
      // lamp base"), or a USB, battery or LED light.
      re(`\\b(?:fit|wire|connect|attach)\\s+(?:an?\\s+|the\\s+)?(?:new\\s+)?(?:flex|lamp\\s+cord|cord|cable|lead)\\s+(?:to|on|onto|into)\\s+(?:the|a|an|this|your)\\s+(?:(?!${LV}\\b|led\\b)\\p{L}+\\s+)?(?:${HOLDER}|lamps?|lights?|plugs?)\\b(?!\\s+(?:bases?|columns?|shades?|stands?|posts?|frames?|tops?|arms?|necks?|body|bodies|foot|feet)\\b)`),
      // A cord or a plug on a lamp or an appliance: "Replace the frayed cord on the lamp.", "Fit a new plug to the kettle".
      // Not a wall plug, a bath plug, a dog lead or a blind cord.
      re(`\\b(?:replace|repair|splice|shorten|lengthen|extend|change)\\s+(?:the|a|an)\\s+(?:(?:old|frayed|damaged|worn|broken|new)\\s+)?(?:lamp\\s+)?(?:cords?|flex|leads?)\\b(?=[^.!?]{0,40}\\b(?:lamps?|iron|kettle|toaster|heater|vacuum|hoover|appliance|radio)\\b)${NOT_LV}`),
      // Splice a cord or a flex. Not a rope, hammock, swing, pulley or blind cord, or a cord that becomes a loop or an eye.
      re(`\\bsplice\\b[^.!?]{0,30}?\\b(?<!\\b(?:hammock|rope|swing|pulley|blind|paracord|nylon|sash|bungee|guy|washing|clothes|curtain|climbing|jute|sisal|cotton|bow)\\s+)(?:lamp\\s+)?(?:cords?|flex)\\b(?![^.!?]{0,40}\\b(?:ropes?|hammocks?|swings?|pulleys?|loops?|eyes?|thimbles?|knots?|whipping)\\b)${NOT_LV}`),
      re(`\\b(?:fit|change|replace|refit)\\s+(?:a|the)\\s+(?:new\\s+)?(?:13\\s*(?:-\\s*)?a\\s+|mains\\s+)?plugs?\\b(?!\\s*(?:-\\s*)?(?:sockets?|holes?|cutters?|of\\s+the\\s+cord\\s+set)\\b)(?=[^.!?]{0,40}\\b(?:flex|kettle|toaster|iron|vacuum|hoover|appliance|lamp|heater|radio)\\b)${NOT_LV}|\\b(?:flex|cord)\\b[^.!?]{0,40}?\\b(?:fit|refit|change|replace)\\s+(?:a|the)\\s+(?:new\\s+)?plugs?\\b${NOT_LV}`),
      re(`\\bfuse\\s+terminals?\\b|\\bcord\\s+grips?\\b(?=[^.!?]{0,40}\\b(?:plugs?|${HOLDER}|sheath)\\b)`),
      re(`\\b(?:brown|blue)\\s+(?:wires?|cores?)\\b(?=[^.!?]{0,60}\\b(?:blue|brown)\\s+(?:wires?|cores?)\\b)${NOT_LV}`),
      // The pins or terminals of a lamp holder, and an item connected to a mains voltage ("connect the lamp to 230 V"),
      // but not to an adapter, a charger or a site transformer.
      re(`\\b(?:pins?|terminals?|terminal\\s+screws?|contacts?)\\s+(?:of|on|in)\\s+(?:the|a)\\s+(?:new\\s+)?${HOLDER}\\b`),
      re(`\\bconnect\\b[^.!?]{0,40}?\\bto\\s+(?:the\\s+)?${V}\\b(?!\\s*(?:-\\s*)?(?:plug-in\\s+)?(?:adapters?|adaptors?|chargers?|(?:site\\s+)?transformers?|power\\s+(?:supply|supplies|adapters?)))`),
      // The conductors and terminals of a mains supply: "the live wire", "the L terminal", "the hot wire to the brass screw",
      // "the ground wire to the green screw", "a wire nut". Not a hot wire foam cutter, a crimp terminal, a doorbell or a
      // battery terminal, or a terminal or a wire nut in a sentence with a 1 to 49 V voltage.
      re("\\b(?:live|neutral|earth)\\s+(?:wires?|conductors?|terminals?|cores?)\\b"),
      re("(?<![\\p{L}\\p{N}])[LN]\\s+terminals?\\b"),
      re("\\bhot\\s+(?:conductors?|terminals?)\\b"),
      re("(?<!\\b(?:foam|polystyrene|styrofoam)\\b[^.!?]{0,80})\\bhot\\s+wires?\\b(?!\\s*(?:-\\s*)?(?:cutters?|foam|tools?|knife|knives|bows?|tables?)\\b)(?!\\s+away\\b)(?![^.!?]{0,80}\\b(?:foam|polystyrene|styrofoam)\\b)(?=[^.!?]{0,60}\\b(?:brass|silver|screw\\s+terminals?|outlets?|receptacles?|breakers?|neutral|ground|sockets?|lamp|panel))"),
      re("\\b(?:brass|silver)\\s+(?:screws?|terminals?)\\s+(?:of|on|in)\\s+(?:the|a|an)\\s+(?:new\\s+)?(?:lamp\\s+)?(?:sockets?|outlets?|receptacles?|holders?|switch(?:es)?|plugs?)\\b"),
      re(`(?<!\\bcrimp(?:s|ed|ing)?\\s+(?:an?\\s+|the\\s+)?)(?<!${LOWV}[^.!?]{0,60})(?<!\\b(?:door\\s*bell|bell|chime)\\b[^.!?]{0,40})\\b(?:brass|silver)\\s+terminals?\\b(?!\\s*(?:blocks?|strips?)\\b)(?![^.!?]{0,30}\\b(?:chimes?|doorbells?)\\b)(?![^.!?]{0,60}\\b${LOWV})`),
      re("\\b(?:ribbed|smooth)\\s+(?:wires?|sides?|conductors?)\\b(?=[^.!?]{0,60}\\b(?:brass|silver)\\s+screws?\\b)"),
      re("\\b(?:bare\\s+copper|ground(?:ing)?)\\s+(?:wires?|conductors?)\\b(?=[^.!?]{0,40}\\b(?:ground|green)\\s+screws?\\b)"),
      re("\\bground(?:ing)?\\s+wires?\\b(?=[^.!?]{0,40}\\bgreen\\s+(?:screws?|terminals?|wires?|nuts?)\\b)"),
      re("\\bgreen\\s+ground(?:ing)?\\s+screws?\\b"),
      re("\\bgreen[- ]and[- ]yellow\\s+(?:wires?|cores?|conductors?)\\b"),
      re(`(?<!${LOWV}[^.!?]{0,40})\\bwire\\s+nuts?\\b${NOT_LV}`),
    ],
    // Plug-in use is not mains work: "plug the saw into the mains", "unplug the lamp from the socket". A wire, cable,
    // terminal or fitting in the phrase still counts.
    skip: [re(`\\b(?:un)?plug(?:s|ged|ging)?\\b(?:(?!\\b(?:wires?|cables?|cores?|conductors?|fittings?|fixtures?|switch(?:es)?|sockets?|outlets?|terminals?)\\b)[^.!?;]){0,40}?\\b(?:into|in\\s+to|from)\\s+(?:an?\\s+|the\\s+)?(?:${V}\\s+|(?:mains|wall)\\s+)?(?:mains|sockets?|outlets?|receptacles?|supply|power\\s+points?)\\b(?!\\s*(?:-\\s*)?(?:terminals?|connectors?|blocks?|wires?|wiring|cables?|cords?|flex|leads?|boards?|units?|panels?|box(?:es)?)\\b)`)],
  },
  structural: {
    name: "structural work", aliases: ["structure", "structural work", "load-bearing"],
    text: "A structural engineer and a builder do all work on load-bearing walls, beams and joists.",
    patterns: [
      // Load-bearing (not "a load-bearing capacity of 50 kg"), and structural walls and beams (not "C24 structural timber").
      re("\\bload[- ]?bearing\\b(?!\\s+(?:capacity|capacities|rating|ratings)\\s+of\\s+\\d)"),
      re("\\bstructural\\s+(?:walls?|beams?|joists?|members?|columns?|supports?|work|changes?)\\b"),
      // A wall or a partition that comes out, or a new opening. Not the wall of a doll's house, a kennel, a cabinet, a
      // wardrobe, a shed or a greenhouse (WALL_SMALL).
      re(`\\b(?:remove|demolish|knock\\s+down|take\\s+down|knock\\s+out|take\\s+out)\\s+(?:a|an|the|this|that)\\s+(?:\\p{L}+\\s+)?(?:wall|partition(?:\\s+wall)?)(?=\\s*$|\\s*[.,;:!?)]|\\s+(?:between|to|in|and|from|so|of|with|for|or|that|completely|entirely)\\b)${NOT_WALL_SMALL_OF}`),
      re("\\bknock\\s+through\\b"),
      re(`\\bcut\\s+(?:an?\\s+)?(?:new\\s+)?(?:doorway|archway|serving\\s+hatch)\\s+(?:in|into|through)\\s+(?:the|a|this|that)\\s+(?:\\p{L}+\\s+)?wall\\b${NOT_WALL_SMALL_OF}`),
      re("\\bcut\\s+(?:an?\\s+)?(?:new\\s+)?(?:opening|hatch|hole)\\s+(?:in|into|through)\\s+(?:the|a|this|that)\\s+(?:\\p{L}+\\s+)?wall\\s+between\\s+(?:the\\s+)?(?:two\\s+)?(?:rooms?|kitchen|hall(?:way)?|lounge|living\\s+room|dining\\s+room|bed\\s*rooms?|bathroom|landing|garage|house|utility|study|office)\\b"),
      re(`\\b(?:open\\s+up|widen|remove\\s+part\\s+of|make\\s+an?\\s+(?:new\\s+)?opening\\s+in|knock\\s+an?\\s+(?:new\\s+)?opening\\s+in)\\s+(?:the|a|this)\\s+(?:\\p{L}+\\s+)?(?:wall|doorway)\\b(?!\\s*(?:-\\s*)?(?:cabinets?|cupboards?|units?|brackets?|plugs?|panels?|shel(?:f|ves)|lights?|hooks?)\\b)${NOT_WALL_SMALL_OF}`),
      re(`\\b(?:fit|install|put\\s+in|insert|add)\\s+(?:an?|the)\\s+(?:new\\s+)?(?:steel\\s+beams?|rsjs?|lintels?|concrete\\s+lintels?)\\b(?![^.!?]{0,40}\\b${WALL_SMALL}\\b)`),
      // Notched, cut or drilled joists (not pilot holes), a chimney breast, a loft hatch, and a deck ledger on the house
      // (not on a dog house or a summer house).
      re(`\\bnotch(?:es|ed|ing)?\\b[^.!?]{0,30}?\\bjoists?\\b${NOT_SMALL_OF}`),
      re("\\b(?:cut|saw)\\s+(?:through|into)\\s+(?:the|a|an|one|each)\\s+(?:\\p{L}+\\s+)?joists?\\b"),
      // A ceiling joist or an existing joist that is cut or comes out, a joist at the loft hatch, and a larger loft hatch
      // (the usual way to fit a loft ladder). Not a joist hanger, bracket or strap, and not the new joists of a deck or a
      // shed ("Cut the deck joists to length").
      re(`\\b(?:cut|saw|trim|shorten|remove|take\\s+out)\\b[^.!?]{0,30}?\\b(?:the|a|an|one|each|two)\\s+(?:(?:existing|old)\\s+)?(?:ceiling\\s+joists?|(?:existing|old)\\s+(?:floor\\s+|loft\\s+)?joists?)\\b(?!\\s*(?:-\\s*)?(?:hangers?|brackets?|straps?|clips?)\\b)${NOT_SMALL_OF}`),
      re("\\bcut\\s+(?:an?\\s+)?(?:new\\s+)?(?:opening|hole)\\s+in\\s+the\\s+ceiling\\s+for\\s+(?:the|a)\\s+(?:new\\s+)?(?:loft\\s+)?(?:hatch|ladder)\\b"),
      re("\\b(?:cut|saw|trim|shorten)\\b[^.!?]{0,30}?\\bjoists?\\s+(?:at|by|beside|next\\s+to|around|of)\\s+the\\s+(?:(?:edge|side|end)\\s+of\\s+the\\s+)?(?:loft\\s+)?hatch\\b"),
      re("\\b(?:widen|enlarge)\\s+(?:the|a)\\s+loft\\s+hatch(?:\\s+opening)?\\b|\\b(?:make|cut)\\s+the\\s+loft\\s+hatch(?:\\s+opening)?\\s+(?:wider|bigger|larger|longer)\\b"),
      re("\\b(?:drill|bore)\\b[^.!?]{0,30}?(?<!\\b(?:pilot|screw|clearance|nail|countersunk)\\s+)\\bholes?\\s+through\\s+(?:the|a)\\s+(?:floor\\s+|ceiling\\s+|loft\\s+)?joists?\\b"),
      re("\\b(?:remove|demolish|take\\s+out|knock\\s+out|knock\\s+down|cut\\s+into|cut\\s+through)\\s+(?:a|an|the|this|that)\\s+chimney\\s+breasts?\\b"),
      // A chimney breast that comes out, bricks that come out of it, or a new recess or opening in it. Not a shelf in the
      // recess (the alcove) next to it, and not a fixing that is drilled into its bricks.
      re("\\b(?:knock\\s+out|knock\\s+down|demolish)\\b[^.!?]{0,40}?\\bchimney\\s+breasts?\\b|\\b(?:remov\\w*|take\\s+out|knock\\s+out|cut\\s+out|chisel\\s+out|break\\s+out|hack\\s+out|chop\\s+out)\\b[^.!?]{0,20}?\\b(?:bricks?|brickwork)\\s+(?:of|from|in)\\s+the\\s+chimney\\s+breasts?\\b|\\btake\\s+(?:the\\s+|some\\s+)?(?:bricks?|brickwork)\\s+out\\s+of\\s+the\\s+chimney\\s+breasts?\\b|\\bcut\\s+(?:an?\\s+)?(?:new\\s+)?(?:recess|hole|opening|niche|slot|chase)\\s+(?:in|into|through)\\s+the\\s+chimney\\s+breasts?\\b|\\b(?:make|chisel|chop|form|knock)\\s+(?:an?\\s+)?(?:new\\s+)?(?:recess|opening|niche|alcove)\\s+(?:in|into|through)\\s+the\\s+chimney\\s+breasts?\\b"),
      re("\\b(?:cut|install|fit|add)\\s+(?:an?\\s+)?(?:new\\s+)?loft\\s+hatch(?:es)?\\b(?!\\s+(?:doors?|covers?|lids?|panels?|ladders?|seals?))"),
      re("\\bledger(?:\\s+(?:boards?|strips?))?\\b[^.!?]{0,40}?\\b(?:(?:to|of|on|against)\\s+(?:the|your|our|a|an)\\s+(?:[\\p{L}-]+\\s+)?(?<!\\b(?:dog|play|summer|bird|wendy|dolls?|doll['’]s|hen|tree|log|bat|hedgehog|bee|cat|chicken|duck|toy|fairy)\\s+)(?:house|home|building)\\b(?!\\s+(?:office|gym|studio|cinema|bar))|rim\\s+joists?|band\\s+joists?)"),
    ],
  },
  height: {
    name: "work at height", aliases: ["work at height", "height work", "roof", "roof work", "ladder", "scaffold"],
    text: "A professional with the correct access equipment does all work above 2 m (6 ft) and on roofs.",
    patterns: [
      re("\\bwork(?:ing)?\\s+at\\s+heights?\\b"),
      // A scaffold, but not scaffold boards or tube (a common reclaimed material).
      re("\\bscaffold(?:s|ing)?\\b(?!\\s*(?:-\\s*)?(?:boards?|planks?|tubes?|poles?|clamps?|fittings?)\\b)"),
      // On a roof. Not the roof of a bird box ("Work on the roof of the bird box") or a birdhouse roof.
      re(`\\b(?:climb|get|go|walk|stand|step|work)(?:s|ing)?\\s+(?:up\\s+)?(?:on|onto|on\\s+to)\\s+(?:a|the|your)\\s+(?:(?!(?:bird|dog|doll|hen|rabbit)-?house\\b)[\\p{L}-]+\\s+)?roof\\b${NOT_SMALL_OF}`),
      re("\\broof\\s+of\\s+(?:a|the|your)\\s+(?:house|home|building|garage)\\b"),
      // A house roof, but not the roof of a bird house, a dog house or a doll's house, or the roof space (the loft). Not
      // "before building roof panels".
      re("(?<!\\b(?:bird|dog|doll|doll['’]s|dolls|play|wendy|hen|rabbit|hedgehog|bat|bee|cat|chicken|duck|pig|toy|fairy|mouse|bug|insect)[\\s-]+)\\b(?:house|home|(?<!\\b(?:before|after|for|when|while|by|of|from|start|begin|finish|stop)\\s+)building)\\s+roofs?\\b(?!\\s+space)"),
      re("\\broof\\s*tops?\\b"),
      re("\\broof\\s+(?:work|access|repairs?|ladders?)\\b|(?<!\\b(?:old|reclaimed|spare|salvaged|leftover)\\s+)\\broof\\s+tiles?\\b"),
      // An extension ladder or a ladder of a length ("a 3 m ladder", "a 10 ft step ladder"). Not a ladder shelf, or a
      // ladder that is stored on a rack or hooks.
      re(`${STORED}\\bextension\\s+ladders?\\b(?!\\s+(?:on|in)\\s+(?:the|a)\\s+(?:wall\\s+)?(?:rack|hooks?)\\b)`),
      re(`\\bladders?\\b(?!\\s*(?:-\\s*)?(?:shel(?:f|ves)|bookcases?|book\\s*shel(?:f|ves)|racks?|shelving|desks?)\\b)[^.!?]{0,40}?\\b(?:above|over|higher\\s+than|more\\s+than|taller\\s+than)\\s+${NUM}\\s*${UNIT}`),
      re(`${STORED}(?<![\\p{L}\\p{N}.])${NUM}\\s*(?:-\\s*)?${UNIT}\\s*(?:-\\s*)?(?:(?:tall|high|long)\\s+)?(?:extension\\s+|(?<st>step)\\s*(?:-\\s*)?)?ladders?\\b(?!\\s*(?:-\\s*)?(?:shel(?:f|ves)|bookcases?|book\\s*shel(?:f|ves)|racks?|shelving|desks?)\\b)`),
      re(`(?<![\\p{L}\\p{N}.])${NUM}\\s*${UNIT}\\s+(?:above|from|off)\\s+(?:the\\s+)?(?:floor|ground)\\b`),
      re(`(?<![\\p{L}\\p{N}.])${NUM}\\s*${UNIT}\\s+up\\s+(?:the|a)\\s+(?:\\p{L}+\\s+)?wall\\b`),
      // Gutters, upstairs windows, a stairwell, an aerial on the chimney, the eaves and the house roof.
      // Not the gutter of a garden building (a shed, a summer house). A ladder with the stairs is not one that is stored
      // there ("a cupboard under the stairs to store the step ladder", "Hang the ladder on the wall under the stairs").
      re("\\b(?:house|upstairs|first[- ]floor)\\s+gutters?\\b|\\bgutters?\\s+(?:on|of)\\s+(?:the|your|our)\\s+(?:\\p{L}+\\s+)?(?:house|home|(?<!\\bgarden\\s+)building)\\b"),
      re(`\\bladders?\\b[^.!?]{0,40}\\b(?:upstairs|first[- ]floor|second[- ]floor|upper)\\s+windows?\\b|\\b(?:stairs|stairwell|staircase)\\b[^.!?]{0,40}${STORED}\\bladders?\\b(?!\\s*(?:-\\s*)?(?:shel(?:f|ves)|racks?)\\b)|${STORED}\\bladders?\\b(?!\\s*(?:-\\s*)?(?:shel(?:f|ves)|racks?)\\b)[^.!?]{0,40}\\b(?:stairs|stairwell|staircase)\\b`),
      re("\\b(?:aerial|antenna)s?\\b[^.!?]{0,20}\\bchimney\\b|\\beaves\\s+of\\s+(?:the|your)\\s+(?:house|home|building)\\b"),
      re("\\b(?:off|from)\\s+(?:the|your)\\s+(?:(?:house|garage|shed)\\s+)?roof\\b(?!\\s+(?:of\\s+(?:the|a)\\s+|panels?|space))|\\bon\\s+(?:the|your)\\s+(?:house|garage|main)\\s+roof\\b"),
    ],
  },
  permit: {
    name: "permit work", aliases: ["permits", "building permit", "planning permission", "building control"],
    text: "Ask the local building office if the work needs a permit before you start.",
    patterns: [
      re("\\bbuilding\\s+(?:permits?|consents?|control|regulations|regs|codes?)\\b"),
      re("\\bplanning\\s+(?:permission|consent|approval|application)\\b"),
      re("\\b(?:electrical|plumbing|construction|demolition|zoning)\\s+permits?\\b|\\bzoning\\s+(?:rules?|laws?|board|office|department|approval|variance)\\b"),
      // The building office, after a word such as "the" ("Ask the local building office"). Not the gerund "building
      // office shelves".
      re("\\b(?:the|a|an|your|my|our|their)\\s+(?:[\\p{L}']+\\s+)?(?:building|planning)\\s+(?:departments?|offices?|inspectors?)\\b"),
      re("\\b(?:needs?|requires?|get|apply\\s+for)\\s+(?:an?\\s+|the\\s+)?permits?\\b"),
    ],
  },
  asbestos: {
    name: "asbestos", aliases: [],
    text: "A licensed contractor tests and removes all material that can contain asbestos.",
    // Asbestos, and the old materials that can contain it: Artex, old pipe lagging (and pipe lagging that comes off, not
    // new or foam lagging), old cement sheets, a textured ceiling.
    patterns: [re("\\basbestos\\b"), re("\\bartex\\b|\\bold\\s+(?:pipe\\s+)?lagging\\b|\\b(?:remov\\w*|strip\\w*|scrap\\w*|replac\\w*|take\\s+off|cut\\s+off|break\\s+off)\\b[^.!?]{0,30}?(?<!\\b(?:new|foam)\\s+)\\bpipe\\s+lagging\\b|\\bold\\s+(?:fibre\\s+|fiber\\s+)?cement\\s+(?:sheets?|boards?|roofs?|panels?)\\b|\\b(?:scrape|sand|drill|remove|strip|cut)\\w*\\b[^.!?]{0,30}?\\btextured\\s+(?:ceilings?|coatings?)\\b")],
  },
  "lead-paint": {
    name: "lead paint", aliases: ["lead", "lead paint", "lead based paint"],
    text: "A certified contractor removes old paint that can contain lead.",
    patterns: [
      re("\\blead[- ]?(?:based\\s+)?paints?\\b"),
      re("\\bpaints?\\s+(?:that\\s+)?(?:contains?|containing|with)\\s+lead\\b(?!\\s*(?:-\\s*)?free)"),
      re("\\blead\\s+in\\s+(?:the\\s+)?(?:old\\s+)?paint\\b"),
      // "Old paint can contain lead.", "Do not sand the old paint. It may contain lead."
      re("\\bpaint(?:s|work)?\\b[^.!?]{0,30}?\\b(?:can|may|could|might|often|does|do)\\s+(?:also\\s+)?contain\\s+lead\\b"),
      re("\\bpaint(?:s|work)?[.!?]\\s+(?:it|they|this|that)\\s+(?:can|may|could|might|often|does|do)\\s+(?:also\\s+)?contains?\\s+lead\\b"),
    ],
  },
};

// The tip-over rule: an object of this height or more needs a wall fixing above the ratio limit (E_TIP_OVER); a smaller
// one gets the warning W_TIP_SMALL. In mm by project unit: 600 mm, or 24 in (609.6 mm) in an inch project, as the docs
// say. The storage-unit rule for a home with children is 700 mm (27 in).
const TIP_WALL = { mm: 600, in: 24 * 25.4 };
const TIP_CHILD = { mm: "700 mm", in: "27 in" };
// A project that lowers the limit under the default 2 is a step stool (safety.md section 6): a person moves it and
// stands on it, so the fix is a larger base, not a wall fixing.
const TIP_DEFAULT = 2;
const TIP_HINT_WALL = 'Add a step that attaches the object to the wall, with a WARNING about children. Give the wall fixing (part, or its material) "role": "anchor". Or make the base deeper.';
const TIP_HINT_STOOL = 'Make the base deeper and wider, or splay the legs. Do not attach a step stool to a wall. A person moves a stool, so a wall fixing cannot hold it. For furniture that stands against a wall, add the wall fixing with "role": "anchor".';

// A height in a pattern counts at 2 m, 6 ft (72 in) or more; a step ladder from 2.5 m (8 ft, 96 in), because a person on
// it stands about 0.6 m below its top.
const METRES = { mm: 0.001, cm: 0.01, m: 1, metre: 1, metres: 1, meter: 1, meters: 1, ft: 0.3048, feet: 0.3048, foot: 0.3048, "'": 0.3048, "′": 0.3048, in: 0.0254, inch: 0.0254, inches: 0.0254 };
const tall = (n, u, step) => {
  const f = METRES[u.toLowerCase()] ?? 1, ft = step ? 8 : 6;
  return f === 0.3048 ? Number(n) >= ft : f === 0.0254 ? Number(n) >= ft * 12 : Number(n) * f >= (step ? 2.5 : 2);
};

// A text with each run of white space as one space: the screen reads this form, so a long run of spaces or line breaks
// cannot make a pattern slow, and a hit shows single spaces.
const flat = (text) => String(text).replace(/\s+/g, " ");
// The text of a cleared hit for the safety review: up to 160 characters, with "…" at a cut. A cut never splits a
// surrogate pair.
const CONTEXT = 160;
const clip = (s) => {
  if (s.length <= CONTEXT) return s;
  const cut = /[\uD800-\uDBFF]/.test(s[CONTEXT - 2]) ? CONTEXT - 2 : CONTEXT - 1;
  return `${s.slice(0, cut)}…`;
};

// The first hand-off phrase in a text, or null.
function handoffHit(topic, text) {
  const s = flat(text), spans = (topic.skip ?? []).flatMap((r) => [...s.matchAll(r)].map((m) => [m.index, m.index + m[0].length]));
  const skipped = (m) => spans.some(([a, b]) => m.index >= a && m.index + m[0].length <= b);
  for (const p of topic.patterns) for (const m of s.matchAll(p)) if ((!m.groups?.n || tall(m.groups.n, m.groups.u, m.groups.st)) && !skipped(m)) return m[0];
  return null;
}

// The oily-rag WARNING, as safety.md section 5 and the finish-wipe card give it.
const RAGS = TECHNIQUES["finish-wipe"].warn.find((w) => /rags/.test(w.text)).text;
// A solvent finish or glue. Epoxy is not one: it gets its own skin note, and no fume or fire note (safety.md section 5).
const SOLVENT = /\b(?:solvent|oil[- ]based|alkyd|lacquer|shellac|varnish|polyurethane|spirits?|thinners?|turpentine|enamel|contact\s+(?:adhesive|cement))\b/i;
const WATER_BASED = /\bwater[- ]based\b|\bacrylic\b/i;
// Work on old paint: a verb before it ("Sand the old paint", "Sand the old painted door", "Remove the old paint with a
// heat gun"), a tool after it ("the old paint with a scraper"), "old" after the paint ("Strip the paint off the old
// chair", "Remove the paint from the old dresser"), or a paint stripper on an old item. Not an old paint can, tin, brush
// or colour, not "the old one" ("Sand the new paint so it matches the old one"), and not a word that starts with "sand"
// ("Sandra"). Each window has a bound.
const PAINT_THING = String.raw`(?!\s*(?:-\s*)?(?:cans?|tins?|pots?|brush(?:es)?|trays?|rollers?|lids?|colou?rs?|shades?)\b)`;
const OLD_WORDS = String.raw`\bold(?:,?\s+[\p{L}-]+)?\s+paint(?:ed\s+[\p{L}-]+|work)?\b${PAINT_THING}`;
const OLD_VERB = String.raw`(?:strip(?:s|ped|ping)?|sand(?:s|ed|ing)?|scrap(?:e|es|ed|ing)|burn(?:s|t|ed|ing)?)`;
const OLD_PAINT = new RegExp(String.raw`\b(?:${OLD_VERB}|heat(?:s|ed|ing)?|remov(?:e|es|ed|ing)|take|takes|took|taking)\b[^.!?]{0,40}?${OLD_WORDS}`
  + String.raw`|${OLD_WORDS}[^.!?]{0,60}?\b(?:heat[\s-]*guns?|scrapers?|sanders?|sand\s*paper|(?:paint\s+|chemical\s+)?strippers?|blow\s*torch(?:es)?|wire\s+brush(?:es)?)\b`
  + String.raw`|\b(?:${OLD_VERB}|heat(?:s|ed|ing)?|remov(?:e|es|ed|ing))(?:\s+off)?\s+(?:all\s+)?the\s+(?:[\p{L}-]+\s+)?paint(?:work)?\b${PAINT_THING}[^.!?]{0,30}?\bold\s+(?!ones?\b)\p{L}`
  + String.raw`|\b(?:paint|chemical)\s+strippers?\b[^.!?]{0,30}?\bold\s+(?!ones?\b)\p{L}`, "iu");

// PPE advice for the safety summary, by tool or finish type. on: where to look (tool name and spec, material name and
// spec, an amount material = a finish or consumable, a taught technique id). power: power tools only. not: skip on match.
export const PPE_FOR = {
  saw: { on: ["tool"], power: true, re: /saw(?!\s*-?\s*horse)|router|planer|jointer|grinder|nailer|nail gun|multi-?tool|biscuit joiner|rotary tool/i,
    note: "When you use a saw or a router, wear safety glasses and ear protection. The tool can throw chips, and the noise can hurt your ears." },
  drill: { on: ["tool"], power: true, re: /\bdrill|\bdriver\b|\bimpact\b/i, note: "When you drill, wear safety glasses. The bit can throw chips into your eyes." },
  sanding: { on: ["tool", "material", "technique"], re: /\bsand(?:er|ers|ing|paper)?\b/i, note: "When you sand, wear a dust mask. Fine dust can hurt your lungs." },
  mdf: { on: ["material"], re: /\bmdf\b|\b(?:pressure[- ])?treated\b|\bcca\b|\bacq\b/i, note: "When you cut or sand MDF or treated timber, wear a dust mask. The dust can hurt your lungs." },
  noise: { on: ["tool"], power: true, re: /\bsanders?\b/i, note: "When you use a power sander, wear ear protection. A loud sander can hurt your ears." },
  solder: { on: ["tool"], re: /\bsolder/i, note: "When you solder, wear safety glasses. Hot solder can spit into your eyes. Open a window for the fumes." },
  // A heat gun or a chemical stripper (not a wire stripper), as safety.md sections 4 and 5.
  heat: { on: ["tool", "material"], re: /\bheat[\s-]*guns?\b|\b(?:paint|varnish|chemical)\s+strippers?\b/i,
    note: "When you use a heat gun or a paint stripper, wear nitrile gloves and safety glasses. Heat and stripper can burn your skin and your eyes." },
  // A finish on the skin (safety.md sections 3 and 5): nitrile gloves for a solvent finish, and for epoxy.
  gloves: { on: ["finish"], re: SOLVENT, not: WATER_BASED, note: "Wear nitrile gloves. A solvent finish can hurt your skin." },
  epoxy: { on: ["finish"], re: /\bepoxy\b/i, note: "Wear nitrile gloves. Wet epoxy can cause a skin allergy." },
  solvent: { on: ["finish"], re: SOLVENT, not: WATER_BASED, note: "Open a window. Solvent fumes can make you ill." },
  flame: { on: ["finish"], re: SOLVENT, not: WATER_BASED, note: "Keep flames and sparks away. Solvent fumes can catch fire." },
  oil: { on: ["finish"], re: /\b(?:oils?|oiled|oil[- ]based|linseed|tung|danish|hardwax)\b/i, note: RAGS },
};

const pathOf = (seg) => seg.map((k, i) => (typeof k === "number" ? `[${k}]` : /^[\w-]+$/.test(k) ? `${i ? "." : ""}${k}` : `[${JSON.stringify(k)}]`)).join("");
function whereOf([a, b, c, d], P) {
  const tail = typeof d === "number" ? (c === "do" ? `, line ${d + 1}` : c === "warn" ? `, warning ${d + 1}` : "") : "";
  if (b === undefined) return "project";
  if (a === "steps") return `step ${b + 1}${tail}`;
  if (a === "parts") return `part ${P.parts?.[b]?.id ?? b + 1}`;
  if (a === "tools") return `tool ${P.tools?.[b]?.id ?? b + 1}`;
  if (a === "materials") return `material ${b}`;
  if (a === "techniques") return `technique ${b}${tail}`;
  if (a === "safety" && b === "cleared" && typeof c === "number") return `cleared entry ${c + 1}`;
  return "project";
}

// Every reader text and name the hand-off screen reads: [segments, text].
function texts(P) {
  const out = [], put = (seg, t) => typeof t === "string" && t && out.push([seg, t]);
  put(["title"], P.title);
  put(["summary"], P.summary);
  (P.steps ?? []).forEach((s, i) => {
    put(["steps", i, "title"], s.title);
    (s.warn ?? []).forEach((w, j) => put(["steps", i, "warn", j, "text"], w?.text));
    (s.do ?? []).forEach((d, j) => put(["steps", i, "do", j], typeof d === "string" ? d : d?.t));
    for (const k of ["check", "why", "tip"]) put(["steps", i, k], s[k]);
    put(["steps", i, "view", "note"], s.view?.note);
  });
  (P.parts ?? []).forEach((p, i) => put(["parts", i, "name"], p.name));
  for (const [id, m] of Object.entries(P.materials ?? {})) put(["materials", id, "name"], m?.name);
  (P.tools ?? []).forEach((t, i) => put(["tools", i, "name"], t.name));
  for (const [id, c] of Object.entries(P.techniques ?? {})) {
    put(["techniques", id, "name"], c?.name);
    put(["techniques", id, "why"], c?.why);
    (c?.warn ?? []).forEach((w, j) => put(["techniques", id, "warn", j, "text"], w?.text));
    (c?.do ?? []).forEach((d, j) => put(["techniques", id, "do", j], d));
  }
  return out;
}

const norm = (s) => String(s ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-");
const named = (list, id) => list.length > 1 ? `${list.slice(0, -1).map(id).join(", ")} and ${id(list.at(-1))}` : id(list[0]);

// The name of a hand-off for the reader: the topic's name ("Mains electrical work") for a topic id ("mains"), else the
// topic as written.
const nameOf = (t) => {
  const k = norm(t), x = Object.hasOwn(HANDOFF_TOPICS, k) ? HANDOFF_TOPICS[k] : null;
  return x ? x.name[0].toUpperCase() + x.name.slice(1) : t;
};

// The topic id of a name in handoff or safety.cleared: the id or an alias, in any letter case, with a space or "_" for
// a hyphen ("Lead paint", "mains_wiring"). null for any other name.
export function topicOf(name) {
  if (typeof name !== "string") return null;
  const k = norm(name);
  return Object.entries(HANDOFF_TOPICS).find(([id, t]) => [id, ...t.aliases].some((a) => norm(a) === k))?.[0] ?? null;
}

// safetyChecks(project, { mode, techniques, tools }) -> { problems, summary }. techniques: every card by id (default:
// the built-in cards and the project cards). tools: tool list or map (default: project.tools).
export function safetyChecks(P, { mode = "guide", techniques, tools } = {}) {
  const problems = [], add = (code, seg, msg, hint) => problems.push({ level: "error", code, path: pathOf(seg), where: whereOf(seg, P), msg, hint });
  const cards = techniques ?? { ...TECHNIQUES, ...(P.techniques ?? {}) };
  const toolList = tools ?? P.tools ?? [], byId = Array.isArray(toolList) ? Object.fromEntries(toolList.map((t) => [t.id, t])) : toolList;
  const allTools = Array.isArray(toolList) ? toolList : Object.entries(toolList).map(([id, t]) => ({ id, ...t }));
  const steps = P.steps ?? [], parts = P.parts ?? [], materials = P.materials ?? {}, units = P.units ?? "mm";

  // E_POWER_NO_WARNING: a WARNING in the step or in a card it teaches (a CAUTION does not count).
  steps.forEach((s, i) => {
    const power = (s.tools ?? []).map((id) => byId[id]).filter((t) => t?.power);
    if (!power.length) return;
    const warned = (s.warn ?? []).some((w) => w?.type === "warning") || (s.teach ?? []).some((id) => cards[id]?.warn?.some((w) => w?.type === "warning"));
    if (warned) return;
    const list = named(power, (t) => `"${t.name ?? t.id}"`);
    add("E_POWER_NO_WARNING", ["steps", i, "warn"], `The step uses the power tool${power.length > 1 ? "s" : ""} ${list}, but it has no WARNING.`,
      `Add a warning before the instructions, for example { "type": "warning", "text": "Wear safety glasses. The ${(power[0].name ?? "tool").toLowerCase()} can throw chips." }. A WARNING on a card in teach also counts. A CAUTION does not.`);
  });

  // E_TIP_OVER: tall and narrow, standing on the floor, and nothing anchors it.
  const anchors = new Set(Object.entries(materials).filter(([, m]) => m?.role === "anchor").map(([id]) => id));
  const anchored = parts.some((p) => p.role === "anchor" || anchors.has(p.material))
    || Object.values(P.props ?? {}).some((p) => p?.role === "anchor")
    || steps.some((s) => (s.fasteners ?? []).some((f) => anchors.has(f.material)) || Object.keys(s.uses ?? {}).some((id) => anchors.has(id)))
    || Object.keys(P.uses ?? {}).some((id) => anchors.has(id));
  const limit = P.safety?.tipRatio ?? TIP_DEFAULT;
  const placed = parts.length > 0 && parts.every((p) => Array.isArray(p.at));
  // The size of the object leaves out the wall fixing (a bracket above the top), as the page and plan.md do.
  const body = parts.filter((p) => p.role !== "anchor" && !anchors.has(p.material));
  const tip = placed ? { ...tipCheck(body.length ? body : parts, P.props ?? {}), limit, anchored } : null;
  const wall = TIP_WALL[units] ?? TIP_WALL.mm, wallText = fmtLen(wall, units);
  if (tip && mode !== "estimate" && tip.ratio !== null && tip.ratio > limit && !anchored) {
    const size = `The object is ${fmtLen(tip.height, units)} tall and ${fmtLen(tip.depth, units)} deep: ratio ${tip.ratio}, limit ${limit}.`;
    // Furniture from 600 mm (24 in) up needs a wall fixing. A smaller object (a lamp, a box) gets a warning only. 24 in
    // is 609.59999 mm after the unit change, so the tolerance keeps a 24 in object at the wall rule. A wall fixing still
    // clears the error under a lower limit, so a stricter limit on wall furniture works.
    if (tip.height >= wall - 1e-6)
      add("E_TIP_OVER", ["parts"], `${size} Nothing anchors it to a wall.`, limit < TIP_DEFAULT ? TIP_HINT_STOOL : TIP_HINT_WALL);
    else problems.push({ level: "warn", code: "W_TIP_SMALL", path: "parts", where: "project", msg: `${size} It can tip over.`,
      hint: `Make the base wider or deeper, or put weight in the base. A wall fixing is for furniture ${wallText} tall or more.` });
  }
  // Without positions (plan mode) the tip-over rule cannot run. Say so, so that 0 errors does not read as "checked".
  if (!tip && parts.length > 0 && mode !== "estimate" && !anchored)
    problems.push({ level: "info", code: "I_TIP_UNCHECKED", path: "parts", where: "project", msg: "The tip-over check did not run, because a part has no position.",
      hint: `Divide the height of the object by the depth of its base. If the object is ${wallText} tall or more and the ratio is more than ${limit}, the object needs a wall fixing. `
        + `In a home with children, a storage unit taller than ${TIP_CHILD[units] ?? TIP_CHILD.mm} also needs one. For a wall fixing, add a part with role anchor and a step with a WARNING. `
        + `If a smaller object has a ratio more than ${limit}, make the base wider or deeper, or put weight in the base. Or give every part an at.` });

  // E_HANDOFF: one problem per topic, at its first mention. The screen is a safety net: it finds common words only. A
  // topic in safety.cleared (and not in handoff) gives one info I_HANDOFF_CLEARED instead, and the summary lists every
  // text it clears, so the safety review shows each override. A cleared entry that clears nothing (no hit, a topic
  // that handoff names, a second entry for one topic) is the warning W_CLEARED_UNUSED: no topic is cleared in advance.
  const covered = new Set((P.handoff ?? []).map((h) => norm(h?.topic)));
  // Entries of each topic, in order (an entry with an unknown topic is an E_SCHEMA of validate, and clears nothing).
  const clear = Array.isArray(P.safety?.cleared) ? P.safety.cleared : [], clearedBy = new Map(), cleared = [];
  clear.forEach((c, k) => { const id = topicOf(c?.topic); if (id && typeof c.why === "string") clearedBy.set(id, [...(clearedBy.get(id) ?? []), k]); });
  const unused = (k, msg, hint) => problems.push({ level: "warn", code: "W_CLEARED_UNUSED", path: pathOf(["safety", "cleared", k]), where: whereOf(["safety", "cleared", k], P), msg, hint });
  const all = texts(P), screened = new Set();
  for (const [id, topic] of Object.entries(HANDOFF_TOPICS)) {
    const mine = clearedBy.get(id) ?? [];
    if ([id, ...topic.aliases].some((a) => covered.has(norm(a)))) {
      screened.add(id);
      for (const k of mine) unused(k, `The handoff list names ${topic.name}, so this entry clears nothing.`, `Remove the entry. The hand-off covers ${topic.name}.`);
      continue;
    }
    if (!mine.length) {
      for (const [seg, t] of all) {
        const hit = handoffHit(topic, t);
        if (!hit) continue;
        add("E_HANDOFF", seg, `The text mentions "${hit}" (${topic.name}), but handoff has no "${id}" entry.`,
          `Leave this work to a professional: add { "topic": "${id}", "text": "${topic.text}" } to handoff. Or remove the work from the guide.`);
        screened.add(id);
        break;
      }
      continue;
    }
    // A cleared topic: each text that the screen finds, and for lead-paint each text that works on old paint (the
    // entry records the answer to the paint-age question of I_OLD_PAINT). text: the matched words; context: the text
    // itself (up to CONTEXT characters), so the safety review shows a real hit next to the false alarm.
    const [first, ...more] = mine, why = clear[first].why, hits = [];
    for (const k of more) unused(k, `An earlier entry of safety.cleared clears ${topic.name} too, so this entry clears nothing.`, "Remove the entry. One entry for each topic is enough.");
    for (const [seg, t] of all) {
      const hit = handoffHit(topic, t) ?? (id === "lead-paint" ? OLD_PAINT.exec(flat(t))?.[0] ?? null : null);
      if (hit) hits.push({ path: pathOf(seg), where: whereOf(seg, P), text: hit, context: clip(flat(t).trim()) });
    }
    if (!hits.length) {
      unused(first, `The hand-off screen finds no ${topic.name} in the text, so this entry clears nothing.`,
        `Remove the entry. Clear a topic only after the screen finds it in a text that is not that work (E_HANDOFF${id === "lead-paint" ? " or I_OLD_PAINT" : ""}).`);
      continue;
    }
    screened.add(id);
    cleared.push({ topic: id, name: nameOf(id), why, entry: first, hits });
    const count = hits.length > 1 ? ` The screen finds ${topic.name} in ${hits.length} texts. The safety review lists each text.` : "";
    const fix = `remove the safety.cleared entry, and add { "topic": "${id}", "text": "${topic.text}" } to handoff.`;
    problems.push({ level: "info", code: "I_HANDOFF_CLEARED", path: hits[0].path, where: hits[0].where,
      msg: `The text mentions "${hits[0].text}" (${topic.name}). safety.cleared says that it is not that work: "${why}"${count}`,
      hint: id === "lead-paint" ? `Make sure that the paint is from 1978 (US) or 1992 (UK) or later, or that a lead test is clear. If not, ${fix}`
        : `Make sure that the guide has no ${topic.name}. If it has, ${fix}` });
  }
  // I_OLD_PAINT: a step strips, sands, scrapes, heats, burns or removes old paint, or names old paint with a heat gun,
  // a scraper, a sander or a stripper, and nothing names lead paint. The age of the paint decides: from before 1978 (US)
  // or 1992 (UK) it can contain lead (safety.md section 10).
  if (!screened.has("lead-paint")) {
    const old = all.find(([, t]) => OLD_PAINT.test(flat(t)));
    if (old) problems.push({ level: "info", code: "I_OLD_PAINT", path: pathOf(old[0]), where: whereOf(old[0], P), msg: "The text works on old paint.",
      hint: "Ask how old the paint is. Paint from before 1978 (US) or 1992 (UK) can contain lead. If it can, add the lead-paint hand-off." });
  }

  // Summary: PPE tools, power tools, PPE notes by tool and finish type.
  const taught = new Set(steps.flatMap((s) => s.teach ?? []));
  const toolText = allTools.map((t) => ({ t, s: [t.name, t.spec, t.id].filter(Boolean).join(" ") }));
  const matText = Object.entries(materials).map(([id, m]) => ({ m, s: [m?.name, m?.spec, m?.note, id].filter(Boolean).join(" ") }));
  const notes = [];
  for (const rule of Object.values(PPE_FOR)) {
    const test = (s) => rule.re.test(s) && !(rule.not && rule.not.test(s));
    const hit = rule.on.some((on) =>
      on === "tool" ? toolText.some(({ t, s }) => (!rule.power || t.power) && test(s))
        : on === "material" ? matText.some(({ s }) => test(s))
        : on === "finish" ? matText.some(({ m, s }) => m?.kind === "amount" && test(s))
        : [...taught].some((id) => test(id)));
    if (hit && !notes.includes(rule.note)) notes.push(rule.note);
  }
  // Each hand-off with a name for the reader (nameOf). topic stays as given (the model and JSON readers use it).
  // cleared: each cleared topic with its reason and every text it clears, for the safety review (never the page).
  const summary = {
    tip, ppe: allTools.filter((t) => t.ppe).map((t) => t.id),
    handoffs: (P.handoff ?? []).map((h) => (h && typeof h === "object" ? { ...h, name: nameOf(h.topic) } : h)),
    power: allTools.filter((t) => t.power).map((t) => t.id), notes, cleared,
  };
  return { problems, summary };
}
