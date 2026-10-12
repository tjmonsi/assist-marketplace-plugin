# Structural Tells

Sentence and paragraph shapes that read as generated. No hook detects them: each one needs a reader who sees the whole sentence or paragraph. Use the id in `detect` findings. Examples are invented for this catalog.

Every entry gives the shape, the fix, and when the shape is legitimate. A shape on the "keep" list stays as written.

## tricolon

Three items, adjectives, or parallel clauses where one or two carry the content and the rest are there for rhythm.

- **Fix:** keep the items that add distinct information; cut the ones that restate them.
- **Keep:** a list of three real, distinct things (three files changed, three failing tests).
- Before: "The patch is small, focused, and targeted." After: "The patch is small and focused."
- Before: "It saves time, it saves money, and it saves headaches." After: "It saves time and money."

## binary-contrast

A sentence that spends half its length on what something is not ("not X but Y", "It's not about X. It's about Y.", "less X, more Y"). The `binary-contrast` family in `prose-rules.js` catches three fixed forms; this entry covers every variant, including the two-sentence form.

- **Fix:** state what it is and drop the negated half.
- **Keep:** a correction of a belief the reader holds and the text names, such as a ticket titled with the wrong cause.
- Before: "The outage was not a capacity problem but a configuration problem." After: "The outage was a configuration problem."
- Before: "It's not about speed. It's about trust." After: "It's about trust."

## self-answered-question

A question the writer asks only to answer in the next sentence, or a reveal set up with a colon or a one-word question ("The result?", "The fix: simple.").

- **Fix:** turn the answer into a statement and delete the question.
- **Keep:** FAQ headings, questions put to the reader that they must answer, and questions quoted from someone.
- Before: "So why did the build fail? The cache key ignored the lockfile." After: "The build failed because the cache key ignored the lockfile."
- Before: "The result? Half the jobs timed out." After: "Half the jobs timed out."

## fragment-drumbeat

A run of short fragments or one-line paragraphs used for drama, each landing like a beat.

- **Fix:** join the fragments into one or two full sentences that carry the same facts.
- **Keep:** a single fragment in dialogue or a heading-like label in a list.
- Before: "We tried caching. No change. We tried a bigger instance. Still nothing. Then we read the logs." After: "Caching and a bigger instance made no difference, so we read the logs."

## false-agency

An inanimate subject given a person's action: data that tells, results that speak, code that wants, the market that decides.

- **Fix:** use a plain verb ("shows", "contains") or name the person who acted.
- **Keep:** established technical usage where the subject does act ("the scheduler decides which job runs next").
- Before: "The logs tell a story of a slow leak." After: "The logs show a slow memory leak."
- Before: "The results speak for themselves." After: delete the sentence; the results are already stated.

## echo-summary

A closing sentence or paragraph that repeats what the paragraph or section just said, often opened with "In short", "Overall", or "Ultimately". At larger scale: a summary section that restates each finding.

- **Fix:** delete the echo. If it holds one new fact, move that fact into the body and delete the rest.
- **Keep:** a summary line at the end of a multi-finding report that repeats none of the findings (see `rules/writing-standard.md`, "Say each thing once").
- Before: "The retry loop never backs off, so a failing dependency floods the queue. In short, missing backoff is why the queue floods." After: "The retry loop never backs off, so a failing dependency floods the queue."

## signposting

A sentence that announces what the text is about to do ("Let's take a closer look at", "Below, we explore", "As we'll see") or narrates the document's own structure.

- **Fix:** delete the announcement and start with the content it announced.
- **Keep:** a cross-reference that tells the reader where to find something they need ("Setup steps are in `INSTALL.md`.").
- Before: "Let's take a closer look at how the parser handles errors. The parser drops malformed lines." After: "The parser drops malformed lines."

## stacked-hedge

Two or more hedges on one claim ("might possibly", "could perhaps suggest", "seems to somewhat").

- **Fix:** keep one plain hedge when the uncertainty is real; keep none when the text states a measured fact.
- **Keep:** one hedge plus the reason for the doubt ("may be too short; only two runs were timed").
- Before: "This might possibly suggest that the timeout could be somewhat too short." After: "The timeout may be too short."

## generic-opener

An opening sentence that would fit any document on the topic: the state of the world, the importance of the subject, a definition the reader already knows.

- **Fix:** delete it; the next sentence is usually the real opening.
- **Keep:** a definition the audience needs, such as a term the guide introduces.
- Before: "In today's software world, teams need reliable deployments. Our pipeline deploys on every merge." After: "Our pipeline deploys on every merge."

## generic-closer

A closing sentence that adds no fact: encouragement, a moral, "the right choice depends on your needs", or a forecast with no basis.

- **Fix:** delete it and end on the last piece of content.
- **Keep:** a closing sentence that states a next step the reader must take.
- Before: "Run the migration before Friday's release. With these steps, you're ready to ship with confidence." After: "Run the migration before Friday's release."

## same-shape-run

Three or more sentences or bullets in a row with the same opener, the same length, or the same "X does Y, so Z" pattern (see `rules/writing-standard.md`, "Structural repetition").

- **Fix:** join two of them, or change the opener of one by putting its subject first. Keep the words; change only the order and joins.
- **Keep:** reference lists and steps where the parallel shape helps the reader scan.
- Before: "The cache stores tokens. The cache expires them hourly. The cache logs every miss." After: "The cache stores tokens, expires them hourly, and logs every miss."
