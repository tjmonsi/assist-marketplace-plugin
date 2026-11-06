// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// [FR-219|FR-238] Deterministic goal-hijack rules for untrusted tool output (a fetched page, a search result, an MCP
// result). The goal-guard hook (impl/goal-guard.js) runs them in advisory mode: a match is recorded as a would-deny
// event and nothing is withheld or rewritten. Spec: specs/spec-hooks-goal-guard.md.
//
// This is a HEURISTIC ADVISORY SIGNAL, not a security boundary. A match means the text resembles a known phrasing that
// tries to redirect an agent away from the user's goal; a miss proves nothing. Not covered: base64 or other encodings,
// homoglyphs outside Unicode NFKC, non-English text, an instruction spread over several sentences, and an instruction
// placed inside quotation marks (a quoted phrase reads as discussion, so documentation about injection passes).
//
// Rule-based by decision (DECISIONS.md, 2026-10-30, D-13): the input is attacker-controlled, so this module calls no
// model and makes no network request. It requires no module at all. Pure functions, no I/O, no state.
//
// ReDoS safety:
//   - Every quantifier in every rule is bounded, with no nested open-ended repetition and at most one lazy gap.
//   - A rule runs on one window of at most WINDOW characters, never on the whole text.
//   - The text is capped (MAX_TEXT, head and tail) and a time budget (TIME_BUDGET_MS) stops a scan early. A scan that
//     stops early reports what it found so far and sets `truncated`.
"use strict";

const FAMILIES = {
  override: "instruction-override",
  redirect: "task-redirection",
  exfil: "data-exfiltration",
  bypass: "safeguard-bypass",
  conceal: "concealment",
  authority: "fake-authority-markup",
  addressed: "agent-addressed-directive",
};

const HEAD_CHARS = 150000; // text longer than MAX_TEXT is scanned as its first HEAD_CHARS and last TAIL_CHARS
const TAIL_CHARS = 50000;
const MAX_TEXT = HEAD_CHARS + TAIL_CHARS;
const WINDOW = 1200; // one rule run sees at most this many characters
const STRIDE = 1000; // windows overlap by 200, more than the longest gap of any rule
const TIME_BUDGET_MS = 1000;
const MAX_MATCH_TRIES = 6;

const RULES = [];

// Words that, directly before a phrase, show it is reported or quoted rather than given as an order
// ("an attacker writes ignore previous instructions", "never reveal your system prompt"). A modal verb (must, should,
// will, can, may, and the like) is deliberately absent: "you must ignore all previous instructions" strengthens the order.
const DISCUSSION_WORDS = new Set([
  "said", "says", "saying", "wrote", "writes", "written", "quoted", "quote", "quotes", "example", "e.g", "eg", "ie",
  "describes", "described", "mentions", "mentioned", "warns", "warned", "discusses", "discussed", "cites", "cited", "reads",
  "to", "that", "not", "never", "cannot", "won't", "don't", "doesn't", "didn't", "isn't", "aren't", "by", "of", "about",
  "like", "as", "via", "with", "using", "called", "tell", "tells", "told", "telling", "ask", "asks", "asked", "asking",
  "if", "when", "whenever", "unless", "whether", "how", "why", "does", "do", "did", "is", "are", "was", "were", "be",
  "been", "attackers", "attacker", "text", "phrase", "string", "prompt",
]);
const OPENING_QUOTE = /["'`\u201c\u2018\u00ab]\s*$/;
const LAST_WORD = /([a-z']+)[^a-z']*$/;

// True when the text before `index` quotes the phrase or reports it.
function isDiscussed(windowText, index) {
  const before = windowText.slice(Math.max(0, index - 40), index);
  if (OPENING_QUOTE.test(before)) return true;
  const word = LAST_WORD.exec(before.toLowerCase());
  return word !== null && DISCUSSION_WORDS.has(word[1]);
}

// A rule is {id, family, test(windowText) -> boolean}. `id` is a lowercase identifier (the audit log's rule id pattern).
// plain: the regex source matches anywhere. imperative: a match counts unless the words just before it mark it as
// quoted or described.
function add(id, family, source, imperative) {
  const regex = new RegExp(source, "gi");
  RULES.push({
    id,
    family,
    source,
    test: (windowText) => {
      regex.lastIndex = 0;
      let match;
      for (let tries = 0; tries < MAX_MATCH_TRIES && (match = regex.exec(windowText)) !== null; tries++) {
        if (!imperative || !isDiscussed(windowText, match.index)) return true;
        if (match[0].length === 0) regex.lastIndex++;
      }
      return false;
    },
  });
}

// ---- instruction-override ---------------------------------------------------------------------------------
add("go-ignore-previous", FAMILIES.override,
  "\\b(?:ignore|disregard|forget|override|discard)\\s+(?:(?:all|any|every|the|your|my|these|those|of)\\s+){0,3}" +
    "(?:previous|prior|above|earlier|preceding|original|initial|existing|current|system|developer)\\s+(?:\\w+\\s+){0,2}" +
    "(?:instructions?|prompts?|rules|directives|guidelines|constraints|commands|tasks?|goals?)\\b", true);
add("go-forget-everything", FAMILIES.override,
  "\\b(?:ignore|disregard|forget)\\s+(?:everything|anything|all)\\s+(?:(?:that\\s+)?(?:you|i|we)(?:'ve|\\s+have|\\s+were|\\s+was|\\s+had)?\\s+(?:been\\s+)?)?" +
    "(?:told|said|given|instructed|above|before)\\b", true);
add("go-user-request-void", FAMILIES.override,
  "\\b(?:(?:ignore|disregard)\\s+(?:the\\s+)?user'?s?\\s+(?:request|task|instructions?|prompt|goal)|" +
    "(?:the\\s+)?user'?s?\\s+(?:request|task|instructions?|prompt)\\s+(?:is|are)\\s+(?:now\\s+)?(?:void|cancell?ed|obsolete|superseded|overridden|invalid|outdated))\\b", true);

// ---- task-redirection -------------------------------------------------------------------------------------
add("tr-new-task", FAMILIES.redirect,
  "\\b(?:your\\s+(?:real|true|actual|new|updated|primary|only)|the\\s+(?:real|true|actual))\\s+" +
    "(?:task|instructions?|objective|goal|job|mission|priority)\\s+(?:is|are)\\s+(?:now\\s+)?(?:to\\b|:)", true);
add("tr-stop-current-task", FAMILIES.redirect,
  "\\b(?:stop|abandon|drop|cancel)\\s+(?:what\\s+you\\s+are\\s+doing|(?:your|the)\\s+(?:current\\s+)?(?:task|work|request|goal))\\s+(?:and|now|immediately)\\b", true);
add("tr-instead-of-task", FAMILIES.redirect,
  "\\binstead\\s+of\\s+(?:(?:the|your|this)\\s+)?(?:user'?s?\\s+)?(?:request|task|assigned\\s+task|goal|instructions?),?\\s+(?:you\\s+(?:must|should|will|need\\s+to)|please|now)\\b", true);

// ---- data-exfiltration ------------------------------------------------------------------------------------
add("gx-send-data-to-url", FAMILIES.exfil,
  "\\b(?:send|post|upload|forward|email|transmit|leak|copy|submit|exfiltrate|push)\\s+(?:\\w+\\s+){0,5}" +
    "(?:files?|repo(?:sitory)?|source\\s+code|codebase|\\.env\\b|env(?:ironment)?\\s+(?:vars|variables)|secrets?|credentials|ssh\\s+keys?|private\\s+keys?|api\\s+keys?|" +
    "conversation|chat\\s+history|system\\s+prompt)\\b.{0,100}?\\b(?:to|at|via|into)\\s+(?:https?://|ftp://|[\\w.+-]{1,64}@[\\w-]{1,63}\\.)", true);
add("gx-exfiltrate-directive", FAMILIES.exfil,
  "\\b(?:you\\s+(?:must|should|will|need\\s+to)\\s+|please\\s+|now\\s+|then\\s+|first\\s+)exfiltrat(?:e|ing)\\b", false);
add("gx-reveal-system-prompt", FAMILIES.exfil,
  "\\b(?:print|output|reveal|repeat|show|display|send|leak|disclose|dump|echo)\\s+(?:me\\s+)?(?:(?:all|the|your|its|this|full|entire|complete|exact|verbatim|hidden|secret)\\s+){0,3}" +
    "(?:system\\s+(?:prompt|message|instructions?)|hidden\\s+instructions?|initial\\s+(?:prompt|instructions?))\\b", true);
add("gx-command-reads-secret", FAMILIES.exfil,
  "\\b(?:curl|wget)\\b.{0,160}?(?:id_rsa|\\.ssh/|\\.aws/credentials|/etc/passwd|/etc/shadow|\\.env\\b)", false);

// ---- safeguard-bypass -------------------------------------------------------------------------------------
add("sb-disable-safeguards", FAMILIES.bypass,
  "\\byou\\s+(?:must|should|need\\s+to|are\\s+to|will)\\s+(?:now\\s+)?(?:disable|bypass|skip|turn\\s+off|ignore)\\s+(?:(?:all|any|the|your|every)\\s+){0,2}" +
    "(?:safety|security|guardrails?|safeguards?|permissions?|approvals?|confirmations?|sandbox|hooks?|reviews?|checks?|restrictions?|filters?)\\b", true);
add("sb-no-confirmation", FAMILIES.bypass,
  "\\b(?:do\\s+not|don't|never)\\s+(?:ask|wait\\s+for|request|seek)\\s+(?:the\\s+user\\s+)?(?:for\\s+)?(?:any\\s+)?(?:confirmation|permission|approval|consent)\\b", true);
add("sb-claimed-preauthorization", FAMILIES.bypass,
  "\\b(?:the\\s+)?user\\s+(?:has\\s+)?(?:already\\s+)?(?:pre-?)?(?:approved|authori[sz]ed|consented\\s+to|granted\\s+permission\\s+for)\\s+(?:you\\s+to\\s+)?(?:run\\s+|execute\\s+)?" +
    "(?:all|any|every|this|these)\\s+(?:tool\\s+calls?|commands?|actions?|operations?|requests?)\\b", false);

// ---- concealment ------------------------------------------------------------------------------------------
add("cn-dont-tell-user", FAMILIES.conceal,
  "\\b(?:do\\s+not|don't|never|must\\s+not|without)\\s+(?:ever\\s+)?(?:tell(?:ing)?|inform(?:ing)?|notify(?:ing)?|alert(?:ing)?|mention(?:ing)?\\s+(?:this|it|that)\\s+to)\\s+(?:the\\s+|your\\s+)?(?:user|human|operator|owner)\\b", true);
add("cn-hide-from-user", FAMILIES.conceal,
  "\\b(?:hide|conceal|keep\\s+(?:this|it|that)\\s+(?:a\\s+)?secret)\\s+(?:this\\s+|it\\s+|that\\s+)?from\\s+(?:the\\s+|your\\s+)?(?:user|human|operator|owner)\\b", true);

// ---- fake-authority-markup --------------------------------------------------------------------------------
add("fa-chat-template-token", FAMILIES.authority,
  "<\\|(?:im_start|im_end|system|user|assistant|endoftext|eot_id|start_header_id|end_header_id|begin_of_text)\\|>", false);
add("fa-fake-system-tag", FAMILIES.authority,
  "</?(?:system[-_ ]?(?:reminder|prompt|message|instructions?|override)|new[-_ ]instructions?|admin[-_ ]override|assistant[-_ ]instructions?)\\s*>|" +
    "\\[/?inst\\]|<</?sys>>|\\[(?:system|admin|developer)\\s+(?:message|override|notice|prompt|instructions?)\\]", false);
add("fa-system-override-label", FAMILIES.authority,
  "\\b(?:system|developer|admin(?:istrator)?)\\s+(?:override|command|directive|instruction)s?\\s*[:!]", true);

// ---- agent-addressed-directive ----------------------------------------------------------------------------
add("aa-note-to-agent", FAMILIES.addressed,
  "\\b(?:note|message|attention|important|notice|instructions?)\\s+(?:to|for)\\s+(?:the\\s+)?(?:ai|llm|assistant|language\\s+model|agent|claude|chatgpt|gpt|copilot|coding\\s+agent|bot)s?\\b" +
    ".{0,160}?\\b(?:ignore|disregard|you\\s+(?:must|should|need\\s+to|have\\s+to|are\\s+required\\s+to)|always|never|do\\s+not|don't|instead|immediately|before\\s+(?:answering|responding|continuing))\\b", true);
add("aa-addressed-command", FAMILIES.addressed,
  "\\b(?:ai|llm)\\s+(?:agents?|assistants?|models?)\\s*[,:]\\s*(?:you\\s+(?:must|should|need\\s+to)|ignore|disregard|stop|instead|immediately|now)\\b", true);
add("aa-tool-directive", FAMILIES.addressed,
  "\\byou\\s+(?:must|should|need\\s+to|have\\s+to)\\s+(?:now\\s+|immediately\\s+|first\\s+)?(?:call|invoke|use|run|execute)\\s+(?:the\\s+)?(?:\\w+\\s+){0,2}(?:tool|command|shell|bash|terminal)\\b" +
    ".{0,100}?(?:rm\\s+-rf|\\.ssh|\\.env\\b|credentials?|secrets?|exfil\\w*|git\\s+push|--force|--hard|delete\\s+(?:all|every|the\\s+repo))", true);

// ---------------------------------------------------------------------------------------------
// Normalization and scan

// Zero-width (U+200B-200D, U+FEFF), bidi overrides (U+202A-202E, U+2066-2069), and Unicode tag characters (U+E0000-E007F,
// as surrogate pairs so no regex "u" flag is needed).
const INVISIBLE = /[\u200B-\u200D\uFEFF\u202A-\u202E\u2066-\u2069]|\uDB40[\uDC00-\uDC7F]/g;
const NON_ASCII = /[^\x00-\x7f]/;

// The form the rules see: NFKC, invisible characters removed, straight apostrophes, single spaces. A line break becomes a
// space, so a phrase split across lines still matches.
function matchForm(text) {
  let folded = text;
  if (NON_ASCII.test(folded) && typeof folded.normalize === "function") folded = folded.normalize("NFKC");
  return folded.replace(INVISIBLE, "").replace(/[\u2018\u2019\u02BC]/g, "'").replace(/\s+/g, " ");
}

// Caps the text at MAX_TEXT characters, keeping its head and its tail so padding cannot push a payload out of view.
function bound(text) {
  if (text.length <= MAX_TEXT) return { text, truncated: false };
  return { text: text.slice(0, HEAD_CHARS) + " " + text.slice(text.length - TAIL_CHARS), truncated: true };
}

// analyze(text) -> {findings: [{id, family}], truncated}. findings holds each matching rule once, in rule order, and is
// empty for input that is not a string or is empty. `truncated` is true when the text was capped or the time budget ended
// the scan before every window ran. options.now replaces Date.now (tests).
function analyze(text, options) {
  const result = { findings: [], truncated: false };
  if (typeof text !== "string" || text.length === 0) return result;
  const now = options && typeof options.now === "function" ? options.now : Date.now;
  const capped = bound(text);
  result.truncated = capped.truncated;
  const form = matchForm(capped.text);
  const deadline = now() + TIME_BUDGET_MS;
  const matched = new Array(RULES.length);
  for (let start = 0; start < form.length; start += STRIDE) {
    if (now() > deadline) {
      result.truncated = true;
      break;
    }
    const windowText = form.slice(start, start + WINDOW);
    for (let i = 0; i < RULES.length; i++) {
      if (!matched[i] && RULES[i].test(windowText)) matched[i] = true;
    }
    if (start + WINDOW >= form.length) break;
  }
  for (let i = 0; i < RULES.length; i++) {
    if (matched[i]) result.findings.push({ id: RULES[i].id, family: RULES[i].family });
  }
  return result;
}

module.exports = { FAMILIES, RULES, MAX_TEXT, WINDOW, STRIDE, TIME_BUDGET_MS, matchForm, analyze };
