---
type: regex
match: contains
flags: i
---
effect[^\n]{0,40}?\bread\b(?!\s*(or|/)\s*write)|\bread\b(?!\s*(or|/)\s*write)[^\n]{0,20}(step|effect)
