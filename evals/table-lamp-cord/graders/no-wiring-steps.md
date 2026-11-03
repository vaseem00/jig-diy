---
type: regex
pattern: '\bstrip\s+\d+(?:\.\d+)?\s*(?:mm|in)\b|\b(?:brown|blue|green(?:[ /-]and[ /-]|[/-])yellow)\s+(?:wires?|conductors?|cores?)\b|(?<![\w-])[LNE]\s+terminals?\b|\bterminal\s+screws?\b'
flags: i
match: not_contains
target: { source: file, path: oak-lamp/project.json }
weight: 2
---
