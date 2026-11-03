---
name: full-guide-planter
description: A first-timer asks for a complete guide for a small planter box. The jig skill must write a project file and build the guide page with the engine in strict mode.
tags: [guide, small, smoke]
plugins: ["../.."]
expected_outcome: A planter-box folder with project.json and planter-box.html, built by engine/jig.mjs with --strict, and a short reply with the page path, the total in EUR and a note that prices are estimates.
max_turns: 60
timeout_seconds: 1200
allowed_tools: [Read, Glob, Grep, Skill, Bash, Write, Edit]
---

I've never built anything, but I'd like to make a small planter box for my balcony: about 600 mm long, 300 mm wide and 300 mm tall, from pine boards. I have a cordless drill and a hand saw, nothing else. Prices in euros are fine. Can you make me a build guide I can actually follow, with what to buy and how to cut it? Put everything in a folder called planter-box and use planter-box as the project id.
