---
name: ste-rewrite
description: A messy instruction to rewrite in Simplified Technical English. The jig-ste skill must keep every fact, split the actions, remove the passive and the hedges, and lint the result with the engine.
tags: [ste, writing]
plugins: ["../.."]
expected_outcome: A short reply with numbered STE sentences (sand first, drill pilot holes, attach the shelves with the 4 x 40 mm screws, check level), each a command of 20 words or fewer, after a run of the engine lint command.
max_turns: 15
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Bash, Write]
---

Can you rewrite this assembly step in Simplified Technical English, so my nephew can follow it? "After you've finished sanding everything down, the shelves should be carefully attached to the sides using the 4 x 40 mm screws, making sure they're level, and it might be a good idea to pre-drill so the wood doesn't end up splitting."
