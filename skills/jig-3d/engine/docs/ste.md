# Writing in STE

The writing rules for every text a reader acts on: step titles, instructions, checks, warnings, technique cards and notes. They work for any procedure, not only DIY: a maintenance task, a shop SOP, assembly instructions, a setup guide. The engine checks the rules that a script can test (`lint`). You apply the rest by hand.

## Contents

1. [What STE is, and what this pack claims](#1-what-ste-is-and-what-this-pack-claims)
2. [Text kinds and limits](#2-text-kinds-and-limits)
3. [The rules the linter checks](#3-the-rules-the-linter-checks)
4. [The rules you apply by hand](#4-the-rules-you-apply-by-hand)
5. [Words to replace](#5-words-to-replace)
6. [Command verbs and trade verbs](#6-command-verbs-and-trade-verbs)
7. [Technical names](#7-technical-names)
8. [Sentence patterns](#8-sentence-patterns)
9. [Before and after](#9-before-and-after)
10. [When the linter is wrong](#10-when-the-linter-is-wrong)

## 1. What STE is, and what this pack claims

ASD-STE100 Simplified Technical English (STE) is the controlled language of aircraft maintenance manuals. It has two parts: writing rules, and a dictionary of close to 900 approved words, each with one meaning, plus rules for technical names and technical verbs. ASD (the Aerospace, Security and Defence Industries Association of Europe) publishes it. Issue 9, January 2025, is the current standard. It is free on request from asd-ste100.org. ASD-STE100 is a trademark of ASD, and the standard is copyrighted.

This pack writes **STE-style** text. It is not certified STE.

- The linter checks the rules a script can test: sentence length, command verb first, one instruction per sentence, condition first, -ing forms, passive voice, and a list of common words that STE replaces.
- The pack does not reproduce the STE dictionary. A sentence can pass the linter and still use words that the dictionary does not approve.
- Never call a text "STE compliant" or "certified STE". Write "STE-style" or "written to the ASD-STE100 writing rules".
- If the user needs certified STE (a contract, a regulator, an aerospace customer), say so. Point them to the standard and to a trained STE writer or a licensed STE checker.
- STE is English only. For another language, keep the same ideas (one instruction per sentence, the command first, numbers and units every time), but the linter does not apply.

Why STE for a procedure: the reader has a tool in one hand and a part in the other. They often read in a second language, and they act on each sentence before they read the next. STE was made for that reader.

## 2. Text kinds and limits

Each kind of text has its own limit. A number and its unit count as two words ("3 mm"). Joined forms count as one word ("4.5", "1/8", "pre-drill").

| Kind | Where in a project | Limit per sentence | Rules |
|---|---|---|---|
| `procedure` | Step instructions (`do`), checks, technique card lines | 20 words | Every sentence starts with a command verb (after a leading condition and its comma). One instruction per sentence. Condition first |
| title | Step titles | 10 words | One command and its object: "Attach the top shelf" |
| `warning` | WARNING and CAUTION text | 20 words | The first sentence is a command. The next sentences give the risk |
| `description` | `why`, `tip`, `summary`, notes | 25 words | Statements. Active voice, no -ing verb forms |

- `lint <file> --kind procedure|warning|description` lints a text file as one kind. `lint project.json` lints every reader text of a project with its own kind.
- The linter splits sentences at `.`, `!` and `?` before a capital letter or a digit, and at a blank line. Decimals ("4.5"), abbreviations ("approx.", "e.g.", "No. 8") and a unit before a lower-case word stay in one sentence.
- A list marker ("1.", "-") and a "WARNING:" or "CAUTION:" label at the start of a line are not words.

## 3. The rules the linter checks

Each finding has a code, a message with the sentence it found, and a hint. In a project, it also has `where` ("step 4, line 2") and `path` (`steps[3].do[1]`).

| Code | Rule | Before | After |
|---|---|---|---|
| `STE_LENGTH` | 20 words for an instruction or warning, 25 for a description, 10 for a title | Drill a 3 mm pilot hole through the side into the end of the shelf at each of the marks on the line. | Drill a 3 mm pilot hole at each mark. |
| `STE_VERB_FIRST` | Start each instruction with a command verb. After a leading condition, put a comma, then the command | Next, sand the edges. | Sand the edges. |
| `STE_TWO_ACTIONS` | Write one instruction in each sentence | Apply glue and clamp the parts. | Apply glue to the end of shelf B. Clamp the shelf to side A. |
| `STE_CONDITION_LAST` | Write the condition first, then the command | Stop the saw if the blade binds. | If the blade binds, stop the saw. |
| `STE_ING` | Do not use -ing verb forms | Hold the board while cutting. | Hold the board while you cut. |
| `STE_PASSIVE` | Use the active voice: say who does the action | The screws are driven into the side. | Drive the screws into the side. |
| `STE_WORD` | Use the word that STE uses (section 5) | Ensure that the shelf is level. | Make sure that the shelf is level. |
| `STE_WARN_NO_RISK` | A WARNING or CAUTION gives the risk after its command (kind `warning` only) | When you drill, wear safety glasses. | Wear safety glasses. The bit can throw chips into your eyes. |

How each rule reads a sentence:

- **Verb first** skips a removable word at the start ("Just drill" is a `STE_WORD` finding, not a verb finding). A sentence that starts with "If", "When", "Before", "After", "Until", "While", "Unless", "Once" or "To" needs a comma and then a command: "To remove the blade, loosen the nut." A label before a colon ("Tip: put a scrap board under it.") gets the hint 'Remove the label "Tip:"'. A label with an id ("Step 2: attach the shelf.") gets the hint 'Remove the label "Step 2:"'.
- **Warning risk** reads the sentences after the first one. One of them must give the risk: a sentence that is not a command, or a sentence with "can", "could", "may", "might", "will" or "would" ("Oily rags can catch fire."). A risk in the present simple counts, also when its first word is a verb too: "Dust hurts your lungs.", "Oil rags catch fire." A second command alone ("Open a window.") gives no risk. A second command after Then, Also, Always or Never is still a command. It gives no risk. A clause after the second command does not make it a risk: "Wear gloves. Hold the board where it is flat." A hazard word with a bare object is a command too: "Sand edges by hand." A later warning sentence that starts with "Never" also gets `STE_VERB_FIRST` with the hint 'Write "Do not"'.
- **Two actions** fires when "and", "then" or a comma comes before a second command verb and its object: "and clamp the parts", ", sand the joint". A list of nouns is one action: "Sand the faces and the edges."
- **Condition last** fires on "if", "when" or "unless" after the command. "Find out if", "Examine the board to see if" and "Make sure that you know when" are questions, not conditions, and pass.
- **Passive** is a form of "be", then up to two adverbs, then a past participle: "is attached", "are fully tightened". A state is not passive: "is flat", "is dry", "is ready", "is square". A state with "by" is passive: "is closed by the spring".
- **-ing** accepts nouns ("ceiling", "fitting", "housing", "opening", "wiring") and tool names ("sanding block", "marking gauge", "finishing nails", "soldering iron"). Add other technical names to `terms` (section 7).

## 4. The rules you apply by hand

The linter cannot see meaning. Check these on every text:

- **One word, one meaning, one thing.** Name each part once and keep the name. If the part is a "shelf", it is never a "board" or a "plank" in a later step. Use the part letter: "shelf B". Make the term list before you write.
- **Use articles.** Write "Put the shelf on the side", not "Put shelf on side".
- **Write noun clusters of three words or fewer.** Write "the screw holes in the top shelf", not "top shelf screw hole positions".
- **Write numbers and units every time.** Write "Drill a 3 mm pilot hole", never "a small pilot hole". Give a tolerance when it matters: "within 2 mm". Use one unit system in one text. Put a conversion in brackets: "700 mm (27 in)".
- **Keep the user's numbers.** Never round, convert or drop a value from the original. If a value is missing ("tighten firmly"), ask for it or mark the gap. Do not invent a torque or a time.
- **Use simple tenses.** Use the present tense for descriptions and the command form for instructions. Use the simple past or future only when the time is important: "The glue will be hard after 24 hours" becomes "After 24 hours, the glue is hard."
- **Write "do not" for a prohibition.** Do not start with "never", "don't" or "avoid": "Do not drill near the edge." Write "do not" and "it is", not contractions. The linter helps here: "avoid" is a `STE_WORD` finding ('Write "do not"'), and an instruction that starts with "never" or "don't" gets the hint 'Write "Do not" for a prohibition'.
- **Use one verb, not a verb phrase.** Write "do", not "carry out". Write "assemble", not "put together". Write "start", not "get going".
- **Keep a pronoun near its noun.** Use "it" only when the noun is in the same sentence or the sentence before.
- **Ask no questions in a procedure.** Write "Make sure that the glue is dry", not "Is the glue dry?".
- **Write lists vertically.** Give each instruction its own numbered line, in the order the reader does them.
- **Keep paragraphs short.** A description paragraph has one topic and six sentences or fewer. A Why or Tip note has two sentences or fewer.
- **Write a warning in the right form.** A WARNING is a risk of injury, and a CAUTION is a risk of damage. Start with a command, then give the risk. Put it before the instruction it covers. [safety.md](safety.md) section 2 has the forms.
- **Two actions at the same time.** STE lets one sentence hold two actions that the reader does at the same time ("Push and hold the button"). The linter cannot tell, so use one verb: "Hold the button down for 5 seconds."

## 5. Words to replace

The linter flags each word in the left column (and its forms: "ensures", "verified", "required"). The list holds common STE practice. The standard is the authority for the full dictionary.

| Do not write | Write |
|---|---|
| ensure, verify | make sure |
| check, inspect (as a verb) | examine, make sure. "Do a final check" is correct: there, "check" is a noun |
| utilize, utilise, make use of | use |
| begin, commence, initiate | start |
| terminate | stop |
| approximately, approx. | about |
| prior to, subsequent to, subsequently | before, after, then |
| sufficient, additional | enough, more |
| obtain, perform, locate, assist, attempt | get, do, find, help, try |
| adjacent | near, next to |
| require, required, requires | is necessary, necessary |
| allow | let |
| avoid | do not: "Do not drill near the edge" |
| place, position (as a verb) | put. "Put the position marks on the board" is correct |
| fix, secure (as a verb) | attach, tighten |
| should | a command: "Do ..." |
| could, might | can |
| would, please | (remove) |
| very, really, quite, just, simply, basically, easily | (remove) |
| gently | carefully, slowly |
| firmly, securely | tightly |
| properly | correctly |
| etc., e.g., i.e. | write the items |
| in order to | to |
| as well as | and |
| be able to | can |
| a lot of | much, many |

Also replace these by hand (the linter does not flag them): "carry out" (do), "regarding" (about), "in the event that" (if), "at this point in time" (now), "a number of" (some, or the number), "due to the fact that" (because).

## 6. Command verbs and trade verbs

The linter accepts 266 command verbs (`VERBS` in [../lib/ste.mjs](../lib/ste.mjs)), in these groups:

| Group | Examples |
|---|---|
| General | add, adjust, align, apply, assemble, attach, connect, do, examine, find, fit, hit, hold, install, keep, lift, lower, make, measure, move, open, put, read, record, remove, repeat, replace, set, start, stop, test, tighten, touch, turn, use, wait, wear |
| Woodwork | bevel, bore, chamfer, chisel, clamp, counterbore, countersink, crosscut, dado, dowel, drill, glue, mitre, miter, mortise, nail, notch, plane, rabbet, rebate, rip, rout, sand, saw, scribe, screw, shim, square, trim |
| Metal and mechanical | bend, bolt, calibrate, deburr, file, grind, hone, punch, ream, rivet, sharpen, tap, thread, torque, weld |
| Finishing and sealing | brush, buff, caulk, grout, mask, oil, paint, polish, prime, seal, spray, stain, varnish, wax, wipe |
| Electronics | crimp, desolder, solder, strip, tin, wire |
| Levels and lines | level, plumb, sight, zero |

- The prefixes re-, pre- and un- work on any verb in the list: "re-tighten", "pre-drill", "unclamp".
- A hyphenated verb whose first word is in the list passes: "dry-fit", "hand-tighten".
- Add a trade verb that the list does not have with `verbs` in the project, or `--verbs` on `lint`: "epoxy", "plaster", "flux". For software text, add "click", "type" and "tap" (tap is already in the list as a thread-cutting verb).
- Add only real verbs of the trade. A verb that only silences a finding ("tell", "report") is bending the rule: rewrite the sentence with a verb from the list ("call", "record", "write").

## 7. Technical names

STE lets a text use the technical names of the trade: part names, materials, products and processes. Give them to the linter so it does not flag them:

- In a project: `terms: ["edgebanding", "Just Nails"]`. On the command line: `--terms edgebanding,"Just Nails"`.
- Use `terms` for a product or brand name that contains a flagged word ("Just Nails"), for an -ing noun the linter does not know ("edgebanding", "flashing tape"), and for a participle that names a kind of part ("countersunk" in "countersunk screws").
- The linter already knows common -ing nouns: bearing, ceiling, coupling, decking, edging, fencing, fitting, flooring, framing, housing, landing, lighting, lining, moulding, opening, piping, railing, setting, shelving, siding, skirting, spring, string, tubing, warning, wiring. It also knows tool names such as "sanding block", "marking gauge", "cutting list", "measuring tape", "mixing stick", "soldering iron", "stripping tool" and "finishing nails".
- Teach a technical name the first time it appears: give it a technique card, or a Why note that says what it is.

## 8. Sentence patterns

Every example passes the linter for its kind.

| Pattern | Kind | Example |
|---|---|---|
| Command | procedure | Attach shelf B to side A. |
| Command with a quantity | procedure | Install 3 screws in each line. |
| Condition, then command | procedure | If the gap is more than 2 mm, sand the edge. |
| Time, then command | procedure | When the glue is dry, remove the clamps. |
| Wait | procedure | Wait 1 hour. |
| Purpose, then command | procedure | To remove the blade, loosen the nut. |
| Order | procedure | Before you cut, measure each length two times. |
| Prohibition | procedure | Do not drill within 25 mm of an end. |
| Check | procedure | Make sure that the two diagonals are equal within 2 mm. |
| Repeat | procedure | Repeat steps 3 to 5 for the other side. |
| Title | title | Attach the top shelf |
| WARNING | warning | Wear safety glasses. The bit can throw chips into your eyes. |
| CAUTION | warning | Put a scrap block under the part. The bit can split the back face. |
| Reason | description | A pilot hole gives the screw a path. Without it, the wood can split near an end. |

## 9. Before and after

Each "Before" breaks at least one rule. Each "After" passes the linter: the instructions as `procedure` (or `warning` after a label), the note as `description`. A reason goes in a note (a project's `why`), not in the instruction.

| Before | After | Note |
|---|---|---|
| You'll want to make sure the shelf is sitting flush before screwing it in place. | Align the front edge of the shelf with the front edge of the side. Install the screws. | |
| Drill pilot holes if you're working near the ends, otherwise the wood may split. | If the hole is less than 25 mm from an end, drill a pilot hole. | The wood can split near an end. |
| Apply glue and clamp the pieces together, then wait about an hour. | Apply glue to the end of shelf B. Clamp the shelf to side A. Wait 1 hour. | |
| Be careful with the saw! | WARNING: Keep your hands 150 mm from the blade. The blade can cut your fingers. | |
| The back panel is attached using 16 mm screws. | Attach back panel C with 16 mm screws. | |
| Sanding the edges smooth will help the finish look better. | Sand the edges with 180 grit. | Scratches show through the finish. |
| Prior to commencing work, the isolator should be switched off and locked. | WARNING: Lock the isolator in the OFF position before you start. The pump can start and cause injury. | |
| Grease should be applied sparingly (approx. 5 g) until fresh grease is seen at the relief port. | Apply about 5 g of grease. When fresh grease comes out of the relief port, stop. | |
| Staff should ensure the till is counted at close, and any shortfall over EUR 5 must be reported to the manager. | When the shop closes, count the cash in the till. If the difference is more than EUR 5, call the manager on duty. | |
| Once the installer has been downloaded, double-click it and follow the prompts. | When the download is complete, open the installer. Do the steps that the installer shows. | |
| Using a 25 W iron, tin the wire ends and then solder them to the terminals. | Tin the end of each wire with a 25 W soldering iron. Solder each wire to its terminal. | |
| Attach legs (D) to the tabletop using the 1-1/4" bolts and tighten firmly with the Allen key provided. | Attach the 4 legs D to tabletop A with the 1 1/4 in bolts. Tighten the bolts with the hex key from the kit. | |

## 10. When the linter is wrong

The linter is a tool, not the standard. It has two kinds of error.

- **It misses a fault.** "Put it there." passes, but it says nothing. "Use the board" passes when the part is "shelf B". A wrong order, a missing step and a vague number ("a little") all pass. Read the text as the reader: can a person who has never done this act on each sentence, in order, with only this page?
- **It flags a correct sentence.** A product name with a flagged word, a participle that names a part ("countersunk screws"), a noun that is also a verb. If the word is a real technical name or trade verb, add it to `terms` or `verbs`. Otherwise, rewrite the sentence.

Never bend the rule to silence a finding:

- Do not add common words to `terms` or `verbs`.
- Do not cut a sentence into fragments ("Shelf B. Side A. Attach.") to pass the limits.
- Do not drop a condition, a number or a warning to make a sentence shorter. Split the sentence.
