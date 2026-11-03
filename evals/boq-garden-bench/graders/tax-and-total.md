---
type: regex
pattern: '(GST|tax)[\s\S]*total|total[\s\S]*(GST|tax)'
flags: i
target: { source: file, path: bench/boq.md }
---
