---
name: cut-list-imperial
description: A cut list only, in inches, with two stock lengths and prices. The jig-cut skill must run the engine cut command, keep inch fractions and pick the cheapest boards (three 6 ft boards), with no guide page.
tags: [cut, imperial]
plugins: ["../.."]
expected_outcome: bookcase/cuts.md from the engine cut command, lengths in inch fractions such as 30 1/2, no millimetres, and a reply that recommends three 6 ft boards and no 8 ft board.
max_turns: 30
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Bash, Write, Edit]
---

I need a cut list for a simple bookcase. The two sides are 3/4 x 11 1/4 x 36 inches and the four shelves are 3/4 x 11 1/4 x 30 1/2 inches, all from 1x12 pine. The store sells 1x12 boards in 6 ft lengths for USD 21.98 and in 8 ft lengths for USD 27.48. My saw blade cuts a 1/8 inch kerf. Which boards should I buy, and where do I cut each one? Save the cut list as bookcase/cuts.md.
