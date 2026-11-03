---
name: boq-garden-bench
description: A cost question with no request for a guide. The jig-boq skill must compute a bill of quantities with the engine and must not build a guide page.
tags: [boq, estimate]
plugins: ["../.."]
expected_outcome: bench/boq.md written by the engine boq command, with group codes such as T01, the GST and a total, and no HTML page.
max_turns: 30
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Bash, Write, Edit]
---

Before I commit to building it, I want to know what a simple garden bench will cost. It's 1200 mm long, 400 mm deep and 450 mm high. The frame and the legs are 90 x 45 mm treated pine, and the seat is five 90 x 19 mm decking boards. My timber yard sells the 90 x 45 in 2.4 m and 3.6 m lengths and the decking in 2.4 m and 4.8 m lengths. I'll screw it together with 65 mm outdoor screws. Prices in AUD with 10% GST included. I only need the bill of quantities with costs, not a build guide. Save it as bench/boq.md.
