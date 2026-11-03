---
name: near-miss-jig-vs-fixture
description: A near miss that shares the word "jig" but asks a short knowledge question, not for a build. No jig skill may start, and no file may be written.
tags: [negative, trigger, smoke]
plugins: ["../.."]
expected_outcome: A two-paragraph answer about jigs and fixtures in machining, with no Skill call to any jig skill and no file written.
max_turns: 6
timeout_seconds: 300
allowed_tools: [Read, Glob, Grep, Skill]
---

Quick question for my manufacturing class: what is the difference between a jig and a fixture in a machine shop? Two short paragraphs, please. I don't need any files.
