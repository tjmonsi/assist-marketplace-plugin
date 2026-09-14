# Documentation Standard

Writing standard for all assist-plugin docs, reports, and command output. Goal: remove AI-slop, cut tokens, keep meaning.

---

## What Is AI-Slop?

Patterns that pad text without adding value. Avoid these:

| Pattern | Example (bad) | Fix |
|---------|----------------|-----|
| Em-dashes | "Fast — but risky" | "Fast. Risky though." |
| Verbose transitions | "It's important to note that tests failed" | "Tests failed" |
| Flowery descriptors | "an elegant, sophisticated, powerful solution" | "a solution" |
| Hedging language | "This could arguably perhaps improve speed" | "This improves speed" |
| Unneeded passive voice | "Agents are matched by the router" | "The router matches agents" |
| Overcomplicated sentences | 30-word sentence with 3 clauses | Split into 2 sentences |
| Unnecessary adverbs | "This truly really actually works" | "This works" |
| Multi-paragraph run-ons | One 6-sentence paragraph | 2-3 short paragraphs |
| Oxford-comma lists in prose | "supports X, Y, and Z" inline | Bullet list of X, Y, Z |
| Verbose bullets | 4-line bullet explaining one idea | 1-2 line bullet |

---

## Writing Principles

- **Be brief.** Aim for short, direct sentences. Long sentences bury the point.
- **Use active voice.** "The router matches agents" not "Agents are matched by the router."
- **Be direct.** "Use Sonnet for cost savings" not "Sonnet can be utilized for potential cost optimization."
- **Be concrete.** Show code or examples. Skip abstract description.
- **One idea per sentence.** One topic per paragraph.

---

## Formatting Standards

- **Headings:** 2-4 words, imperative when possible. "Configure routing" not "Configuration of Routing."
- **Paragraphs:** Max 3 sentences.
- **Lists:** Use bullets, not prose lists.
- **Code:** Show real format. Never "[your code here]."
- **Links:** Relative paths, not absolute URLs.

---

## Conciseness Checklist

Run this before publishing any doc:

- [ ] No em-dashes? Use periods or parentheses instead
- [ ] Sentences under 25 words?
- [ ] Headings 4 words max?
- [ ] Each bullet 1-2 lines?
- [ ] Active voice throughout?
- [ ] Concrete examples present?
- [ ] No hedge words (arguably, perhaps, could, might)?
- [ ] Paragraph count matches topic count?

---

## Token Cost Awareness

Every word costs tokens. Verbose docs cost more to read, store, and re-process.

Concise rewrites typically cut 20-30% of tokens with no loss of meaning.

**Before (42 words):**
> It's important to note that the router is arguably a rather sophisticated and elegant component which is responsible for the task of matching incoming tasks to the most appropriate agent based on a variety of different factors.

**After (14 words):**
> The router matches incoming tasks to the best agent based on task type.

Review pass: remove every word that doesn't change the meaning.

---

## When to Apply

- All new documentation
- Technical reports
- Help text and command descriptions
- Answer outputs (from `ask` skill)
- PR descriptions
- Commit footers
