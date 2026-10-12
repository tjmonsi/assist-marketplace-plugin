# Writing Standard

Source of truth for how assist-plugin agents, skills, and hooks write: reports, findings, reviews, plans, documentation, commit bodies, and chat replies.

| File | Role |
|---|---|
| `rules/writing-standard.md` (this file) | Every rule, with its reason and examples. Change rules here first. |
| `rules/writing-standard-compact.md` | The always-on bullets. The `writing-context` hook injects the file as written into the session and into every subagent, and every `## Report Writing Standard` block in `agents/` and `skills/` is a copy of it. |
| `hooks/lib/prose-rules.js` | The machine catalog of the block and advisory tells below, used by the `prose-gate` and `prose-advisor` hooks. |
| `hooks/lib/prose-diff.js` | Finds the text a write adds, so `prose-gate` and `prose-advisor` judge only new text and leave old tells in the file alone. |
| `scripts/sync-writing-standard.js` | Rewrites every `## Report Writing Standard` block from the compact file. `--check` exits 1 while any copy differs. |

To change a rule, edit this file, update the compact file and `prose-rules.js` when the rule appears there, then run `node scripts/sync-writing-standard.js` from the plugin root. Never edit a `## Report Writing Standard` block by hand; put file-specific guidance in another section of that file.

## Prose rules

### Lead with the point

Put the answer or the most important finding first. Position ranks it; do not rank it in words ("this is the more important of the two").

### Three-part findings

Every finding states:

1. **What happened:** the concrete observation or result.
2. **Why it matters:** the consequence for the reader or the system.
3. **What to do next:** the action, if any.

### Say each thing once

State each conclusion once. A multi-finding report may end with one summary line, placed after all findings, and that line repeats none of them. The first sentence of every paragraph adds new information; a paragraph that opens by restating the previous one is rewritten or cut.

### Active voice, important subject first

The subject is the most prominent position in a sentence. Put the noun that matters there, before the verb.

- Before: "The validation was skipped when the flag was not set." After: "Validation is skipped when the flag is not set."
- Before: "The code can leak credentials if an exception occurs." After: "Credentials leak if an exception occurs."

### Plain words

Prefer short, concrete words: "use" for "utilize", "break" for "fail to maintain", "now" for "at the present time". Cut qualifiers and adverbs that leave the meaning unchanged. Join two short sentences when one causes the other: "A causes B, which causes C."

### No filler

- **Hedges** ("it should be noted", "arguably", "to some extent") carry no information. State the fact, or name the uncertainty and where it comes from.
- **Contrastive framing** ("This is X, not Y", "not just X but Y") spends half the sentence on what something is not. Say what it is: "Coverage is missing." in place of "This is a coverage issue, not a logic bug."
- **Intensifiers** ("very", "extremely", "truly") stand in for evidence. Give the measurement or delete the word.
- **Throat-clearing** ("It's important to note that", "In this section, we will") delays the point. Start with the point.

### Headings name content

A heading states what its section says. Labels about the act of writing ("What follows", "What this means", "Key takeaways", "In conclusion") tell the reader nothing; replace them with the finding.

- Before: `## What This Means`. After: `## Null input crashes parseUser`.

### Structure only when needed

Add severity badges, remediation blocks, or summary sections only when the reader would be lost without them. A well-formed three-part finding rarely needs more.

### Structural repetition

Vary sentence shape. Three sentences or bullets in a row with the same opener, the same length, or the same "X does Y, so Z" pattern read as generated, and so do triplets of adjectives or parallel clauses added for rhythm. No hook detects this; the writer and the reviewer check it.

### Evidence and number basis

Every factual claim traces to evidence the reader can check: a code excerpt, a log line, a test result, a file and line range (`path/to/file.ts:12-30`), or a full URL to an external source. Every number has a stated basis: a command's output, a count over named files, a benchmark run, or a cited document. Investigate a claim that lacks evidence, or mark it unverified. The user's prompt is never evidence.

### Estimate labels

Label every number that was not measured as an estimate, and give what it rests on: "about 40 files (estimate from the `skills/` listing)". An estimate never appears in the same form as a measured value.

### Report tested results

Never restate the user's prompt or an assumption as fact. A suggested cause is a hypothesis; report what testing showed.

- Before: "As you requested, we have implemented X." After: "X is implemented."
- Before: "You were right; the bug is in the cache." After: "The bug is in the cache layer, triggered by stale entries after a concurrent write."

### Audience hygiene

User-facing text (READMEs, guides, release notes, PR descriptions, UI copy, error messages) carries no internal ticket ids, plan step numbers, or agent names, and assigns no blame ("the previous change broke this"). Say what changed and what the reader does now. Internal ids belong in commit footers, traceability comments, and internal plans.

### Quotation integrity

A quotation reproduces its source exactly: same words, spelling, punctuation, and casing. Mark omissions with `[...]` and insertions with square brackets. Never reword, tidy, or de-slop a quote; the mechanical rules skip quoted text for this reason. Paraphrase without quote marks when the exact words are not needed.

## Minimal output

- **Answer first.** The first line is the answer, the result, or the most important finding.
- **No preamble.** Skip openers ("Let me", "I'll start by", "Great question") and never restate the question or the task.
- **No recap.** Do not close by summarizing what was just said or listing the steps taken, unless asked.
- **Length follows content.** A yes or no question gets one line. A review gets one entry per finding and nothing for areas that passed.
- **One line when clean.** A check that finds nothing reports it in one line: "All 68 tests pass." or "No findings."
- **No sign-off.** End on the last piece of content; no offers of further help.

## Mechanical tiers

The prose hooks judge text written to prose files with the catalog in `hooks/lib/prose-rules.js`. Each rule has one family and one tier, and each word or phrase sits in exactly one tier. Real engineering terms such as `robust` and `leverage` are advisory because they are sometimes the right word.

### Block tier

Tells that are never correct in prose. The write gate may deny a write that adds one.

| Family | Catches | Fix |
|---|---|---|
| `em-dash` | The em dash (U+2014) and the horizontal bar (U+2015) | A period, comma, colon, parentheses, or semicolon |
| `chatbot-residue` | Assistant phrasing left in a file: sign-offs (`I hope this helps`), offers (`Let me know if you have questions`, `Feel free to reach out`, `anything else I can help with`), compliments (`Great question!`), self-reference (`As an AI language model, I`), exclaimed openers (`Certainly!` at the start of a line), and stock apologies | Delete it |
| `curly-quote` | Curly single and double quotes (U+2018, U+2019, U+201C, U+201D) | Straight quotes |
| `summary-label` | Labels that announce a summary: `In conclusion,`, `In summary:`, `To sum up,`, `Key takeaways`, `Bottom line:`, and headings such as `What follows` or `Final thoughts` | Delete the label and state the point; name headings after their content |

### Advisory tier

Usually filler, occasionally right (a real technical term, a quoted error message). The advisor names each one with a fix hint and never blocks.

| Family | Catches | Fix |
|---|---|---|
| `hedge` | `it should be noted`, `it is worth noting`, `arguably`, `to some extent`, `it seems that`, `could potentially`, `perhaps`, `somewhat` | State the fact or name the uncertainty |
| `intensifier` | `very`, `really`, `extremely`, `incredibly`, `truly`, `absolutely`, `quite`, `literally` | Delete it or give the measured value |
| `ai-vocabulary` | Words that mark generated text: `delve`, `leverage`, `utilize`, `seamless`, `robust`, `pivotal`, `crucial`, `showcase`, `foster`, `empower`, `streamline`, `holistic`, `the ... landscape`, `plays a key role`, `at the end of the day`, and similar | Each rule carries its own replacement, such as `use` for `leverage` |
| `throat-clearing` | Openers that delay the point: `It's important to note that`, `Let's dive in`, `In this section, we will`, `As mentioned above`, `When it comes to`, `In order to`, `That being said` | Start with the point |
| `binary-contrast` | `not just X, but Y`, `This isn't X; it's Y`, `This is X, not Y` | State what it is |
| `en-dash` | The en dash (U+2013) in prose | A comma, colon, or parentheses; `to` for a range |
| `unicode-arrow` | A single Unicode arrow (U+2192 and its relatives) on a prose line | Words: `to`, `becomes`, `then`, `leads to` |
| `em-dash` | A spaced double hyphen (` -- `) standing in for an em dash | Same as the em dash |

Arrows stay where they carry structure: flows with two or more arrows on one line, table rows, diagrams, and code.

## Exemptions

The mechanical rules skip the regions below. `blankExempt()` replaces each with spaces of the same length before any rule runs, so reported lines and columns still point into the original text.

- **Code:** fenced blocks (three or more backticks or tildes) and inline code spans. An unclosed fence runs to the end of the text. Indented code blocks are not recognized; fence code instead.
- **Mermaid:** Mermaid diagrams sit in fenced blocks and are skipped with them.
- **Quotations:** blockquote lines, and text inside straight or curly double quotes on one line (up to 300 characters). The quote marks themselves stay, so curly delimiters are still caught. Single quotes do not delimit quotations because apostrophes would pair with them.
- **Link targets:** the URL in `[text](url)`, reference definitions, autolinks, and bare URLs. Link text is prose.
- **Traceability markers:** `[FR-045]`, `[SPEC-003 -> FR-045 -> UC-012 -> AC-2]`, and the same with Unicode arrows.
- **Numeric ranges:** an en or em dash between a digit and a number or numbered id, as in a page range or the span from `ASI01` to `ASI10`.
- **Whole files:** CHANGELOG history, LICENSE and NOTICE files, anything under `node_modules/` or `.git/`, and every file that is not `.md`, `.mdx`, `.txt`, `.rst`, or `.adoc` (see `isProseFile()`).

## Scope

The standard applies to agent and skill output (reports, RCAs, reviews, plans, findings), documentation that agents write, error messages and advice from skills, chat replies, and any other human-readable text a subagent produces.

Commit messages, changelog entries, and governance checklists keep their own formats (Conventional Commits, Keep a Changelog, signature lines such as `✓ OWASP Clear`). Apply the prose rules to their free-text parts only.
