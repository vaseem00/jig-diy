---
type: llm
focus: last_message
weight: 3
---

Judge only the rewritten instructions in the reply, not the explanation around them.

PASS if all of these are true:
- Sanding comes before the attachment, as in the original.
- There is an instruction to drill pilot holes before the screws go in.
- The shelves are attached to the sides with the 4 x 40 mm screws.
- There is an instruction to check or make sure that the shelves are level.
- Each sentence gives one instruction and starts with a command verb or with a short condition before the command.
- Each sentence has 20 words or fewer.
- There is no passive voice such as "should be attached" and no hedge such as "it might be a good idea".

FAIL if any fact of the original is missing (sanding first, pilot holes, the screw size, the level check), if a sentence joins two actions with "and", or if a passive or hedged sentence remains.
