---
type: regex
pattern: '\b\d+(\.\d+)?\s?mm\b'
match: not_contains
target: { source: file, path: bookcase/cuts.md }
---
