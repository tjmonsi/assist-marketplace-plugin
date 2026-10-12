// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// Machine catalog of the writing rules in rules/writing-standard.md (that file is the human-readable source;
// keep the two in step). Used by the prose hooks to judge text written to prose files.
//
// Each rule: { id, family, tier, test, fix }
//   tier  "block"  a tell that is never correct in prose; the write gate may deny it.
//         "advise" a tell that is usually filler but can be legitimate; the advisor only mentions it.
//   test  a global RegExp, or a function (text) => [{ index, text }].
//   fix   a short hint shown with the finding.
//
// Design limits (kept on purpose):
//   - Pure functions, no I/O.
//   - Node 6 safe: ES2015 syntax only; patterns use no lookbehind, no \p{} escapes, no named groups, no s flag;
//     every repeat is bounded and no pattern nests an open-ended quantifier.
//   - High precision over recall: phrase rules are short fixed phrases, and the ones that are often legitimate
//     mid-sentence are anchored to the start of a line or sentence.
//   - Exempt regions (code, quotations, link targets, Mermaid, traceability markers, numeric ranges) are blanked
//     by blankExempt() before any rule runs, so offsets and line numbers still point into the original text.
"use strict";

const FAMILIES = {
  emDash: "em-dash",
  residue: "chatbot-residue",
  curlyQuote: "curly-quote",
  summaryLabel: "summary-label",
  hedge: "hedge",
  intensifier: "intensifier",
  aiVocabulary: "ai-vocabulary",
  throatClearing: "throat-clearing",
  contrast: "binary-contrast",
  enDash: "en-dash",
  arrow: "unicode-arrow",
};

const PROSE_EXTENSIONS = [".md", ".mdx", ".txt", ".rst", ".adoc"];
const EXCLUDED_BASENAME = /^(?:changelog|license|notice)/i;
const EXCLUDED_DIRECTORIES = ["node_modules", ".git"];

const MAX_QUOTED = 300; // a straight or curly double-quoted run longer than this is treated as prose
const MAX_EXCERPT = 80;

// Straight or curly apostrophe, so phrase rules match "it's" in either form.
const APOS = "['\\u2019]";
// Start of a line or of a sentence, with an optional list marker or bold opener before the phrase. It is capture
// group 1, the one capture group any pattern may use: scan() reports the match from the end of group 1.
const OPENER = "((?:^|[.!?][ \\t]{1,4})[ \\t]{0,3}(?:(?:[-*+]|\\d{1,3}[.)])[ \\t]{1,4})?(?:\\*\\*|__)?)";

const ARROWS = "\\u2190\\u2192\\u2194\\u21d0\\u21d2\\u21d4\\u27f5\\u27f6\\u27f9\\u2794\\u279c";
const ARROW_CHAR = new RegExp("[" + ARROWS + "]", "g");
const TABLE_ROW = /^[ \t]{0,3}\|/;

const RULES = [];

function add(id, family, tier, test, fix) {
  RULES.push({ id, family, tier, test, fix });
}

// One rule per entry: [id suffix, pattern source, fix]. Patterns are case-insensitive and multiline.
function addPhrases(family, tier, entries) {
  entries.forEach((entry) => {
    add(family + "/" + entry[0], family, tier, new RegExp(entry[1], "gim"), entry[2]);
  });
}

// ---------------------------------------------------------------------------------------------------------
// Block tier
// ---------------------------------------------------------------------------------------------------------

add("em-dash/char", FAMILIES.emDash, "block", /[\u2014\u2015]/g,
  "Replace the em dash with a period, comma, colon, parentheses, or semicolon.");

addPhrases(FAMILIES.residue, "block", [
  ["hope-it-helps", "\\b(?:I )?hope (?:this|that|it) helps\\b", "Delete the sign-off; end on the last piece of content."],
  ["let-me-know", "\\blet me know if (?:you (?:have|need|want|would like)|there" + APOS + "?s anything|there is anything)\\b",
    "Delete the offer; the reader will ask if they need more."],
  ["feel-free", "\\bfeel free to (?:reach out|ask|let me know|contact)\\b", "Delete the invitation."],
  ["happy-to-help", "\\b(?:I" + APOS + "d be|I would be|I" + APOS + "m|I am) (?:happy|glad|delighted) to help\\b|\\bhappy to help[.!]",
    "Delete it; do the work instead of offering it."],
  ["great-question", OPENER + "(?:that" + APOS + "s an? |what an? )?(?:great|good|excellent) question[!.,]",
    "Delete the compliment and answer."],
  ["as-an-ai", "\\bas (?:an AI(?: language model| assistant| model)?|a large language model),? I\\b",
    "Delete the self-reference; state the limit as a fact about the task."],
  ["anything-else", "\\banything else (?:I can (?:help|do)|you" + APOS + "?d like me to|you would like me to)\\b", "Delete the offer."],
  ["exclaimed-opener", "^([ \\t]{0,3})(?:certainly|absolutely|of course|sure thing|great)!", "Delete the opener; start with the content."],
  ["apology", "\\bI apologi[sz]e for (?:the|any) (?:confusion|oversight|inconvenience)\\b", "Delete the apology; state the correction."],
]);

add("curly-quote/char", FAMILIES.curlyQuote, "block", /[\u2018\u2019\u201c\u201d]/g,
  "Use straight quotes (\" and ').");

addPhrases(FAMILIES.summaryLabel, "block", [
  ["opener", OPENER + "(?:in conclusion|in summary|to summarize|to summarise|to sum up|all in all)(?:\\*\\*|__)?[,:]",
    "Delete the label and state the point; a summary that repeats findings goes too."],
  ["takeaway", "\\bkey takeaways?\\b", "Delete the label; name the content instead."],
  ["bottom-line", OPENER + "(?:the )?bottom line(?:\\*\\*|__)?(?:[,:]| is that\\b)", "Delete the label and state the point."],
  ["heading", "^[ \\t]{0,3}#{1,6}[ \\t]{1,4}(?:what follows|what this means|in conclusion|in summary|final thoughts|wrapping up|tl;dr)[ \\t]{0,4}:?[ \\t]{0,4}$",
    "Rename the heading after its content."],
]);

// ---------------------------------------------------------------------------------------------------------
// Advisory tier
// ---------------------------------------------------------------------------------------------------------

add("em-dash/spaced-double-hyphen", FAMILIES.emDash, "advise", /([A-Za-z0-9,)] )--(?= [A-Za-z(])/g,
  "A spaced double hyphen stands in for an em dash; use a period, comma, colon, parentheses, or semicolon.");

addPhrases(FAMILIES.hedge, "advise", [
  ["should-be-noted", "\\bit should be noted(?: that)?\\b", "Delete it and state the fact."],
  ["worth-noting", "\\bit(?:" + APOS + "s| is) worth (?:noting|mentioning|pointing out)(?: that)?\\b", "Delete it and state the fact."],
  ["arguably", "\\barguably\\b", "Make the argument or drop the word."],
  ["some-extent", "\\bto (?:some|a certain) extent\\b|\\bin some ways\\b", "Name the extent or drop the phrase."],
  ["could-be-said", "\\bit could be (?:said|argued)\\b|\\bone could argue\\b", "State the claim or leave it out."],
  ["seems", "\\bit (?:seems|appears) (?:that|like)\\b", "State what was observed and how."],
  ["double-modal", "\\b(?:could|may|might) (?:potentially|possibly)\\b", "Keep one modal verb."],
  ["perhaps", "\\bperhaps\\b", "Commit to the claim or name the uncertainty."],
  ["somewhat", "\\bsomewhat\\b", "Give the amount or drop the word."],
]);

add("intensifier/adverb", FAMILIES.intensifier, "advise",
  /\b(?:very|really|extremely|incredibly|truly|absolutely|quite|remarkably|exceptionally|literally|utterly)\b/gi,
  "Delete the intensifier, or replace it with a measured value.");

addPhrases(FAMILIES.aiVocabulary, "advise", [
  ["delve", "\\bdelv(?:e|es|ed|ing)\\b", "Use \"look at\" or \"examine\"."],
  ["leverage", "\\bleverag(?:e|es|ed|ing)\\b", "Use \"use\"."],
  ["utilize", "\\butili[sz](?:e|es|ed|ing|ation)\\b", "Use \"use\"."],
  ["seamless", "\\bseamless(?:ly)?\\b", "Say which steps the user no longer takes."],
  ["robust", "\\brobust(?:ly|ness)?\\b", "Name the property: retries, validation, tests, limits."],
  ["tapestry", "\\btapestry\\b", "Drop the metaphor; name the parts."],
  ["testament", "\\btestament to\\b", "Use \"shows\"."],
  ["pivotal", "\\bpivotal\\b", "Say what depends on it."],
  ["crucial", "\\bcrucial(?:ly)?\\b", "Say what breaks without it."],
  ["paramount", "\\bparamount\\b", "Use \"required\" or say what comes first."],
  ["showcase", "\\bshowcas(?:e|es|ed|ing)\\b", "Use \"show\"."],
  ["foster", "\\bfoster(?:s|ed|ing)?\\b", "Use \"build\" or \"encourage\", or say what changes."],
  ["realm", "\\b(?:the|this|that) realms? of\\b", "Use \"area\" or \"field\", or name it."],
  ["landscape", "\\b(?:the|this|today" + APOS + "s) (?:[a-z-]{1,30} )?landscape\\b(?! (?:mode|orientation|layout|format|page))", "Name the market, tools, or options."],
  ["embark", "\\bembark(?:s|ed|ing)?\\b", "Use \"start\"."],
  ["elevate", "\\belevat(?:e|es|ed|ing)\\b(?! (?:privileges?|permissions?|access|rights))", "Say what improves and by how much."],
  ["empower", "\\bempower(?:s|ed|ing|ment)?\\b", "Use \"let\" or \"allow\"."],
  ["streamline", "\\bstreamlin(?:e|es|ed|ing)\\b", "Say which step was removed or shortened."],
  ["holistic", "\\bholistic(?:ally)?\\b", "Name what is covered."],
  ["synergy", "\\bsynerg(?:y|ies|istic)\\b", "Name the combined effect."],
  ["cutting-edge", "\\b(?:cutting-edge|game-chang(?:er|ers|ing))\\b", "Name the capability or version."],
  ["unlock-potential", "\\bunlock(?:s|ed|ing)? (?:the |your |its |new )?(?:full )?potential\\b", "Say what becomes possible."],
  ["navigate-complexity", "\\bnavigat(?:e|es|ed|ing) (?:the )?complexit(?:y|ies)\\b", "Name the hard part and how it is handled."],
  ["fast-paced", "\\bin today" + APOS + "s (?:fast-paced |digital |modern )?world\\b|\\bever-(?:evolving|changing)\\b", "Delete it."],
  ["plays-a-role", "\\bplays? an? (?:crucial|vital|pivotal|key|important) role\\b", "Say what it does."],
  ["end-of-day", "\\bat the end of the day\\b", "Delete it."],
  ["myriad", "\\b(?:a )?myriad(?: of)?\\b", "Give the count or use \"many\"."],
  ["meticulous", "\\bmeticulous(?:ly)?\\b", "Name the check that was done."],
]);

addPhrases(FAMILIES.throatClearing, "advise", [
  ["important-to-note", "\\bit(?:" + APOS + "s| is) important to (?:note|remember|understand|mention)(?: that)?\\b", "Delete it and state the point."],
  ["lets-dive", "\\blet" + APOS + "?s (?:dive in|dive into|take a (?:closer )?look|explore|break (?:it|this) down)\\b", "Start with the content."],
  ["in-this-section", OPENER + "in this (?:document|section|article|guide|post|report),? (?:we|I)(?:" + APOS + "ll| will)\\b",
    "Delete the announcement; the heading already says it."],
  ["as-mentioned", "\\bas (?:mentioned|noted|discussed|stated) (?:earlier|above|previously|before)\\b", "Link the section or drop the phrase."],
  ["needless-to-say", "\\bneedless to say\\b|\\bit goes without saying\\b", "Delete it."],
  ["first-and-foremost", "\\bfirst and foremost\\b", "Use \"first\"."],
  ["when-it-comes-to", "\\bwhen it comes to\\b", "Name the subject directly."],
  ["in-order-to", "\\bin order to\\b", "Use \"to\"."],
  ["without-further-ado", "\\bwithout further ado\\b", "Delete it."],
  ["heres-the-thing", "\\bhere" + APOS + "?s (?:the thing|what you need to know)\\b", "Delete it and say the thing."],
  ["before-we-begin", OPENER + "before we (?:begin|start|dive in)\\b", "Delete it."],
  ["that-being-said", "\\b(?:that being said|with that said|having said that)\\b", "Use \"but\" or drop it."],
]);

addPhrases(FAMILIES.contrast, "advise", [
  ["not-just", "\\bnot (?:just|only|merely|simply) [^.!?\\n]{1,80}?[,;]? (?:but|it" + APOS + "s|they" + APOS + "re)\\b",
    "State what it is; drop the \"not X\" half."],
  ["is-not-but", "\\b(?:this|that|it) (?:is not|isn" + APOS + "t|was not|wasn" + APOS + "t) (?:just |only |merely |simply |about )?[^.!?\\n,;]{1,60}[,;] (?:but|it" + APOS + "s|it is|this is)\\b",
    "State what it is; drop the \"not X\" half."],
  ["x-not-y", "\\b(?:this|that|it) (?:is|was) (?:a |an |the )?[^.!?\\n,;]{1,50}, not (?:a |an |the )?[a-z]",
    "State what it is; drop the \"not Y\" half."],
]);

add("en-dash/char", FAMILIES.enDash, "advise", /\u2013/g,
  "In prose use a comma, colon, or parentheses; for a range use \"to\" or keep the digits on both sides.");

// Arrows stay in flows (two or more arrows on one line), table rows, diagrams, and code. A single arrow in a
// sentence is prose.
add("unicode-arrow/prose", FAMILIES.arrow, "advise", proseArrows,
  "Write the arrow as words (\"to\", \"becomes\", \"then\", \"leads to\"); keep arrows in flows, tables, and diagrams.");

function proseArrows(text) {
  const hits = [];
  let start = 0;
  while (start <= text.length) {
    let end = text.indexOf("\n", start);
    if (end === -1) end = text.length;
    const line = text.slice(start, end);
    if (!TABLE_ROW.test(line)) {
      const found = line.match(ARROW_CHAR);
      if (found && found.length === 1) {
        const column = line.search(ARROW_CHAR);
        hits.push({ index: start + column, text: line.charAt(column) });
      }
    }
    start = end + 1;
  }
  return hits;
}

// ---------------------------------------------------------------------------------------------------------
// Exempt regions
// ---------------------------------------------------------------------------------------------------------

// Same-length blanks: every character except a line break becomes a space, so offsets and line numbers hold.
function blank(segment) {
  return segment.replace(/[^\r\n]/g, " ");
}

const FENCE_OPEN = /^[ \t]*(`{3,40}|~{3,40})/; // any indentation, so fences inside nested lists count
const FENCE_CLOSE = /^[ \t]*(`{3,40}|~{3,40})[ \t]{0,40}\r?$/;
const BLOCKQUOTE = /^[ \t]{0,3}>/;

// Fenced code (Mermaid included) and blockquotes are whole-line regions. A fence closes on a line of the same
// character and at least the opening length. An unclosed fence runs to the end.
function blankLines(text) {
  const lines = text.split("\n");
  let fence = null;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (fence) {
      const close = FENCE_CLOSE.exec(line);
      if (close && close[1].charAt(0) === fence.charAt(0) && close[1].length >= fence.length) fence = null;
      lines[i] = blank(line);
      continue;
    }
    const open = FENCE_OPEN.exec(line);
    if (open) {
      fence = open[1];
      lines[i] = blank(line);
    } else if (BLOCKQUOTE.test(line)) {
      lines[i] = blank(line);
    }
  }
  return lines.join("\n");
}

// Inline code: a run of N backticks up to the next run of exactly N backticks on the same line.
function blankInlineCode(text) {
  return text.replace(/(`{1,3})[^\n]{0,500}?\1/g, (match, ticks, offset, whole) => {
    if (whole.charAt(offset + match.length) === "`" || (offset > 0 && whole.charAt(offset - 1) === "`")) {
      return match;
    }
    return blank(match);
  });
}

// Inline-region patterns, applied in order after line regions and inline code are blanked.
const INLINE_REGIONS = [
  // Traceability markers such as [SPEC-003 -> FR-045 -> UC-012 -> AC-2].
  { pattern: /\[[A-Z]{1,8}-\d{1,6}[^\]\n]{0,200}\]/g, keep: 0 },
  // Link and image targets: keep "](" and ")", blank the target. A target holding parentheses is cut short.
  { pattern: /\]\([^()\n]{0,2000}\)/g, keep: 2 },
  // Reference-style link definitions: [id]: target
  { pattern: /^[ \t]{0,3}\[[^\]\n]{1,200}\]:[ \t]{0,4}[^\n]{1,2000}$/gm, keep: 0 },
  // Autolinks and bare URLs.
  { pattern: /<[a-z][a-z0-9+.-]{1,31}:[^<>\s]{1,2000}>/gi, keep: 0 },
  { pattern: /\bhttps?:\/\/[^\s<>()\]]{1,2000}/gi, keep: 0 },
  // Quotations: keep the quote marks (so curly delimiters are still judged), blank what they enclose.
  { pattern: new RegExp("\"[^\"\\n]{1," + MAX_QUOTED + "}\"", "g"), keep: 1 },
  { pattern: new RegExp("\\u201c[^\\u201d\\n]{1," + MAX_QUOTED + "}\\u201d", "g"), keep: 1 },
];

function blankRegion(match, keep) {
  if (keep === 0) return blank(match);
  return match.slice(0, keep) + blank(match.slice(keep, match.length - 1)) + match.slice(match.length - 1);
}

// A dash between a digit and a number or numbered id (optionally one space each side) is a range, as in
// "10-20" or "ASI01-ASI10" written with an en or em dash: blank the dash only.
function blankNumericRanges(text) {
  return text.replace(/[ ]?[\u2013\u2014][ ]?(?=[A-Za-z]{0,8}\d)/g, (match, offset, whole) => {
    return offset > 0 && /\d/.test(whole.charAt(offset - 1)) ? blank(match) : match;
  });
}

function blankExempt(text) {
  if (typeof text !== "string" || text.length === 0) return "";
  let out = blankLines(text);
  out = blankInlineCode(out);
  INLINE_REGIONS.forEach((region) => {
    out = out.replace(region.pattern, (match) => blankRegion(match, region.keep));
  });
  return blankNumericRanges(out);
}

// ---------------------------------------------------------------------------------------------------------
// File selection and scanning
// ---------------------------------------------------------------------------------------------------------

function isProseFile(filePath) {
  if (typeof filePath !== "string" || filePath.length === 0) return false;
  const parts = filePath.split(/[\\/]+/);
  const base = parts[parts.length - 1];
  for (let i = 0; i < parts.length - 1; i += 1) {
    if (EXCLUDED_DIRECTORIES.indexOf(parts[i]) !== -1) return false;
  }
  if (EXCLUDED_BASENAME.test(base)) return false;
  const lower = base.toLowerCase();
  return PROSE_EXTENSIONS.some((ext) => lower.length > ext.length && lower.slice(-ext.length) === ext);
}

function regexHits(regex, text) {
  const hits = [];
  regex.lastIndex = 0;
  let match = regex.exec(text);
  while (match) {
    // Capture group 1, when a pattern has one, is a consumed prefix (sentence start, list marker): skip it.
    const lead = typeof match[1] === "string" ? match[1].length : 0;
    hits.push({ index: match.index + lead, text: match[0].slice(lead) });
    if (match[0].length === 0) regex.lastIndex += 1;
    match = regex.exec(text);
  }
  regex.lastIndex = 0;
  return hits;
}

function lineStarts(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) starts.push(i + 1);
  }
  return starts;
}

function locate(starts, index) {
  let low = 0;
  let high = starts.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (starts[mid] <= index) low = mid;
    else high = mid - 1;
  }
  return { line: low + 1, column: index - starts[low] + 1 };
}

// Runs every rule (or those of one tier) over the text with exempt regions blanked.
// Returns [{ id, family, tier, line, column, index, excerpt, fix }] in rule order, at most maxPerRule per rule.
function scan(text, options) {
  const opts = options || {};
  const maxPerRule = opts.maxPerRule || 50;
  const source = typeof text === "string" ? text : "";
  const judged = blankExempt(source);
  const starts = lineStarts(source);
  const findings = [];
  RULES.forEach((rule) => {
    if (opts.tier && rule.tier !== opts.tier) return;
    const hits = typeof rule.test === "function" ? rule.test(judged) : regexHits(rule.test, judged);
    hits.slice(0, maxPerRule).forEach((hit) => {
      const where = locate(starts, hit.index);
      findings.push({
        id: rule.id,
        family: rule.family,
        tier: rule.tier,
        line: where.line,
        column: where.column,
        index: hit.index,
        excerpt: source.substr(hit.index, Math.min(hit.text.length, MAX_EXCERPT)),
        fix: rule.fix,
      });
    });
  });
  return findings;
}

module.exports = {
  FAMILIES,
  RULES,
  PROSE_EXTENSIONS,
  blankExempt,
  isProseFile,
  scan,
};
