# Final Audit

Run every check before returning a result. A failed check sends the text back to the pass named in brackets; return nothing until all checks pass.

## edit

- [ ] **Inventory intact.** Every number, unit, date, version, path, identifier, name, link, code span, and quotation listed in pass 1 is present and byte-identical. Any changed item: revert that sentence to the original. [pass 3]
- [ ] **Quotations verbatim.** Each quotation matches the original character for character, apart from visible `[...]` cuts and straightened delimiters. [pass 3]
- [ ] **Meaning unchanged.** Each changed sentence makes the same claim with the same strength, scope, and conditions. No hedge was dropped from a claim the text does not prove. [pass 3]
- [ ] **Nothing added.** No new claim, example, transition, heading, or sentence appears that the original lacked. [pass 2]
- [ ] **Exempt regions untouched.** Code blocks, inline code, Mermaid, link targets, traceability markers, numeric ranges, and frontmatter keys match the original. [pass 2]
- [ ] **No block-tier tell remains** outside quotations: no em dash, curly quote, chatbot residue, or summary label. Search the result for the em dash (U+2014), the horizontal bar (U+2015), and curly quotes (U+2018, U+2019, U+201C, U+201D). [pass 2]
- [ ] **No new tell introduced.** A rewritten sentence carries no tell from either catalog, including a fresh contrast frame or tricolon. [pass 2]
- [ ] **Voice kept.** Register, person, tense, spelling variant, terms, and formatting match pass 1 notes. [pass 3]
- [ ] **Output contract.** Inline text: the cleaned text only, nothing before or after it. File: only the named file changed, and the reply is the one `Edited` or `No changes` line. [output]

## detect

- [ ] **No edits.** No file was changed.
- [ ] **Every finding located.** Each line number points at the excerpt, and each excerpt is copied exactly.
- [ ] **Kept cases skipped.** No finding flags a term of art, a quotation, or a shape on a catalog's keep list.
- [ ] **One line when clean.** A clean text gets the single `No findings` line and nothing else.
