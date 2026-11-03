# Rewrites

Five whole procedures, rewritten in STE style. Each one shows the original, the linter findings on it, the rewrite, and the decisions behind the rewrite. The original is linted as `procedure`. Each line of the original is one text, as `lint before.txt --kind procedure` reads it. In each rewrite, the instructions and checks are `procedure`, the WARNING and CAUTION lines are `warning`, the title is a title, and the notes are `description`. Every rewrite lints to 0 findings with the terms and verbs it names.

## Contents

1. [A DIY step: a wall shelf](#1-a-diy-step-a-wall-shelf)
2. [A maintenance task: grease a pump bearing](#2-a-maintenance-task-grease-a-pump-bearing)
3. [A shop SOP: close the till](#3-a-shop-sop-close-the-till)
4. [A setup guide: install Node.js](#4-a-setup-guide-install-nodejs)
5. [An electronics task: connect an LED strip](#5-an-electronics-task-connect-an-led-strip)
6. [What the five have in common](#6-what-the-five-have-in-common)

## 1. A DIY step: a wall shelf

The reader is a first-timer with a cordless drill. Units: mm.

**Before**

> Mounting the shelf: First you'll want to locate the studs using a stud finder and mark them.
> The brackets should be positioned 600mm apart and fixed to the studs with 50mm screws - make sure they are level!
> Then the shelf can be placed on the brackets and screwed from underneath using the 16mm screws provided.
> Be careful not to drill through the top of the shelf.

**Findings before:** 11 (`STE_VERB_FIRST` 4, `STE_ING` 3, `STE_WORD` 2, `STE_PASSIVE` 2).

**After**

Title: Attach the shelf to the wall

- WARNING: Do not drill above, below or beside a socket or a switch. Cables run there.
- WARNING: Wear safety glasses. The drill can throw dust into your eyes.

1. Find the studs with a stud finder.
2. Draw a level line on the wall at the height of the shelf.
3. Mark two studs that are 600 mm apart on the line.
4. Put the top of a bracket A on the line at each stud mark.
5. Attach each bracket to its stud with two 50 mm screws.
6. Put shelf B on the brackets.

- CAUTION: Use the 16 mm screws from the kit. A longer screw comes out of the top of the shelf.

7. Attach the shelf to each bracket from below with the 16 mm screws.

Check: Make sure that the shelf is level and does not move.

**Decisions**

- "Mounting the shelf" became a title with a command: "Attach the shelf to the wall".
- "locate" became "find", "positioned" became "put", and "fixed" became "attach".
- The drill is a power tool, so the step gets a WARNING. The cable WARNING comes from [engine/docs/safety.md](../engine/docs/safety.md) section 6.
- "Be careful not to drill through the top" became a CAUTION with a command and the risk, before step 7.
- "make sure they are level!" became the check at the end of the step.
- Each part has one name and a letter: bracket A, shelf B.

## 2. A maintenance task: grease a pump bearing

The reader is a trained technician. The text is for professionals, so the rewrite keeps all of the work. Units: metric.

**Before**

> Prior to commencing work, the isolator should be switched off and locked out.
> The bearing housing cover can then be removed by undoing the four M8 bolts, being careful not to drop the gasket.
> Grease should be applied sparingly (approx. 5 g) using the grease gun until fresh grease is seen at the relief port.
> Refit the cover and torque the bolts to 25 Nm in a cross pattern.
> Remove the lock and restore power, then run the pump for 10 minutes and verify that the bearing temperature does not exceed 80°C.

**Findings before:** 20 (`STE_WORD` 5, `STE_ING` 4, `STE_PASSIVE` 4, `STE_LENGTH` 3, `STE_VERB_FIRST` 2, `STE_TWO_ACTIONS` 2).

**After**

- WARNING: Lock the isolator in the OFF position before you start. The pump can start and cause injury.

1. Remove the 4 M8 bolts from the cover of the bearing housing.

- CAUTION: When you remove the cover, hold the gasket. A gasket that falls can become damaged.

2. Remove the cover.
3. Apply about 5 g of grease with the grease gun.
4. When fresh grease comes out of the relief port, stop.
5. Install the cover.
6. Tighten the 4 bolts to 25 N·m in a cross pattern.
7. Remove the lock from the isolator.
8. Set the isolator to ON.
9. Run the pump for 10 minutes.

Check: Make sure that the bearing temperature stays at or below 80 °C.

**Decisions**

- The lock-out moved into a WARNING at the start: it protects a person.
- "being careful not to drop the gasket" became a CAUTION with a condition first: it protects a part.
- "sparingly (approx. 5 g)" became "about 5 g". The number stayed.
- "Refit" became "Install". "restore power" became "Set the isolator to ON", the action the technician does.
- "verify that ... does not exceed 80°C" became the check, with the same limit.
- "the bearing housing cover" (a cluster of three nouns) became "the cover of the bearing housing".

## 3. A shop SOP: close the till

The reader is a shop assistant who reads English as a second language. Money: EUR.

**Before**

> At close of business, staff should ensure the till is counted and reconciled against the Z-report.
> Any shortfall or overage exceeding EUR 5 must be reported to the duty manager immediately.
> The float (EUR 150) is to be left in the drawer, and the remaining cash placed in a sealed bag which is then deposited in the safe.
> Don't forget to sign the cash log!

**Findings before:** 12 (`STE_VERB_FIRST` 4, `STE_PASSIVE` 3, `STE_WORD` 2, `STE_ING` 2, `STE_LENGTH` 1).

**After**

Lint with `--verbs print,sign`.

1. When the shop closes, print the Z-report.
2. Count the cash in the till.
3. Compare the total with the Z-report.
4. If the difference is more than EUR 5, call the duty manager immediately.
5. Leave the float of EUR 150 in the drawer.
6. Put the other cash in a cash bag.
7. Seal the bag.
8. Put the bag in the safe.
9. Lock the safe.
10. Sign the cash log.

Check: Make sure that the safe door does not open.

**Decisions**

- "print" and "sign" are real verbs of the job, so they go in `--verbs`. "Report" is not added: "call" says what to do.
- "counted and reconciled" became two steps: count, then compare.
- "the remaining cash" (an -ing form) became "the other cash".
- "Don't forget to sign" became the command "Sign".
- The amounts EUR 5 and EUR 150 stayed as they were.
- "Make sure that the safe is locked" is passive. The check names what the assistant sees instead.

## 4. A setup guide: install Node.js

The reader is a new developer on Windows or macOS.

**Before**

> Once the installer has been downloaded, double-click it and follow the on-screen prompts, making sure to tick 'Add to PATH'.
> When installation is complete you may need to restart your terminal.
> To verify, run node --version which should print v22 or later.

**Findings before:** 6 (`STE_VERB_FIRST` 2, `STE_WORD` 2, `STE_ING` 1, `STE_PASSIVE` 1). The linter does not know "double-click", and it does not flag "you may need to": both are faults for this reader.

**After**

Lint with `--verbs click,type`.

1. When the download is complete, open the installer.
2. Select the option "Add to PATH".
3. Click Next until the installer shows Finish.
4. Click Finish.
5. Close the terminal.
6. Open a new terminal.
7. Type node --version.
8. Press Enter.

Check: Make sure that the version is 22 or higher.

**Decisions**

- "click" and "type" are the verbs of a screen, so they go in `--verbs`.
- "follow the on-screen prompts" became the actions the reader does: select, click, click.
- "you may need to restart your terminal" became two steps for every reader. A new terminal does no harm, and the reader does not have to decide.
- "which should print v22 or later" became the check.

## 5. An electronics task: connect an LED strip

The reader is a hobbyist. The strip runs from a plug-in 12 V adapter, so no step touches mains wiring.

**Before**

> Strip about 5mm of insulation off each wire and tin them.
> Solder the red wire to the + pad and the black to the - pad, being careful not to overheat the strip.
> Slide heatshrink over the joints and shrink it with a heat gun.
> Plug the 12V adapter into the wall and check the LEDs light up.

**Findings before:** 4 (`STE_TWO_ACTIONS` 3, `STE_ING` 1), and two faults the linter cannot see: "the black" has no noun, and the soldering iron has no WARNING.

**After**

- WARNING: Put the hot iron in its stand. The tip is hotter than 300 °C.

1. Strip about 5 mm of insulation from the end of each wire.
2. Tin the end of each wire.
3. Solder the red wire to the + pad.
4. Solder the black wire to the - pad.

- CAUTION: When the solder flows, remove the iron from the pad. Too much heat can damage the LED strip.

5. Put a piece of heat-shrink tube over each joint.
6. Shrink the tube with the heat gun.
7. Plug the 12 V adapter into a wall socket.

Check: Make sure that all of the LEDs come on.

Note: The adapter changes the mains voltage to 12 V. Do not open the adapter.

**Decisions**

- The soldering iron burns, so the step gets a WARNING before the first instruction. Say that you added it.
- "being careful not to overheat the strip" became a CAUTION with a condition first. It gives no time limit, because the original gives none.
- "the black" became "the black wire": one name for one thing.
- A plug-in adapter is safe for an amateur. If the original said "connect the strip to the light switch", that is mains work: flag it and name a licensed electrician.
- The note gives a reason, so it is a description. Its second sentence is a command and passes as a description too.

## 6. What the five have in common

- A step title or a heading became a command.
- A long sentence became one action per line, in the order of work.
- Each warning moved before its action: the command first, then the risk.
- Each number, unit and tolerance stayed. No value was invented.
- Real trade verbs went into `--verbs`. Common words did not.
- Each check names what the reader can see or measure.
