// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// Deterministic prompt-injection detector for untrusted text (web pages, MCP results, subagent output).
// Defensive only: it finds sentences that try to give the model orders, and replaces each such sentence with
// a visible marker. Everything it does not flag is returned byte for byte.
//
// Design limits (kept on purpose):
//   - Pure functions, no I/O. shouldSkip() is the one exception: it reads the optional allowlist file.
//   - Every rule is a bounded regex (no nested open-ended quantifiers, no unbounded `.*`), tested only on
//     one segment at a time. Segments are at most MAX_SEGMENT characters; longer text is cut into chunks first
//     so a long run of text cannot hide an injected sentence.
//   - High precision over recall: most imperative rules must start at the beginning of a sentence or clause,
//     so text that merely talks about injection ("an attacker may tell the model to ignore its rules") passes.
//   - Not covered: base64 or other encodings, homoglyphs outside Unicode NFKC, non-English text, and
//     instructions spread over several sentences.
"use strict";

const fs = require("fs");
const path = require("path");
const urlModule = require("url");

const MARKER_PREFIX = "[assist-plugin removed possible prompt injection: ";
const MAX_SEGMENT = 2000; // a segment longer than this is never tested whole
const CHUNK = 1000; // long sentences are cut into pieces of at most this size before testing
const MAX_TEXT = 2000000; // larger input passes through untouched
const TIME_BUDGET_MS = 1500; // text after the budget passes through untouched (fail-open)
const ALLOWLIST_FILE = "injection-allowlist.json";
const MAX_ALLOWLIST_ENTRIES = 200;
const MAX_ALLOWLIST_ENTRY_LENGTH = 500;

const FAMILIES = {
  override: "instruction-override",
  role: "role-reassignment",
  exfil: "system-prompt-or-secret-exfiltration",
  delimiter: "fake-role-or-chat-delimiters",
  carrier: "hidden-instruction-carrier",
  hijack: "tool-or-command-hijack",
  link: "data-exfil-link",
  conceal: "concealment",
};

// Words that name captured data inside an exfiltration URL.
const DATA_NAMES =
  "data|secret|prompt|history|conversation|context|summary|payload|exfil|leak|chat|msg|message|content|password|credentials?|session|cookie|system_?prompt|user_?data";

const USER_NOUN = "(?:the\\s+|your\\s+)?(?:user|human|operator|owner)\\b";

// Phrases that make a hidden carrier (comment, hidden element) an instruction to a model.
const CARRIER_WORDS =
  "(?:(?:ignore|disregard)\\s+(?:(?:all|any|the|your)\\s+){0,2}(?:previous|prior|above)\\b|" +
  "\\b(?:ai|llm)\\s+(?:agents?|assistants?|models?|systems?)\\b[^\\n]{0,200}?\\b(?:ignore|disregard|you\\s+(?:must|should)|always|never|do\\s+not|don't|instead|immediately)\\b|" +
  "\\bsystem\\s+prompt\\b|\\b(?:do\\s+not|don't|never)\\s+(?:tell|mention|reveal|disclose|inform)\\b|\\b(?:assistant|ai|claude)\\s*:)";

function plain(source) {
  return new RegExp(source, "i");
}

const RULES = [];

// test is a function of the normalized segment; source is kept for the self-test and for reporting.
function add(id, family, regex) {
  RULES.push({ id, family, source: regex.source, test: (segment) => regex.test(segment) });
}

function addFunction(id, family, test) {
  RULES.push({ id, family, source: "(function)", test });
}

// Words that, directly before a phrase, show it is being described or reported rather than given as an
// order ("attackers tell a model to ignore previous instructions", "never reveal your system prompt").
const DISCUSSION_WORDS = new Set([
  "to", "that", "would", "may", "might", "can", "could", "will", "shall", "should", "must", "not", "never", "cannot",
  "won't", "don't", "doesn't", "didn't", "isn't", "aren't", "by", "of", "about", "like", "as", "via", "with", "using",
  "called", "saying", "says", "said", "tell", "tells", "told", "telling", "ask", "asks", "asked", "asking", "instruct",
  "instructs", "instructed", "instructing", "e.g", "eg", "ie", "example", "if", "when", "whenever", "unless", "whether",
  "how", "why", "does", "do", "did", "is", "are", "was", "were", "be", "been",
]);
const OPENING_QUOTE = /["'`\u201c\u2018\u00ab]\s*$/;
const LAST_WORD = /([a-z']+)[^a-z']*$/;

// True when the text before index quotes the phrase or reports it ("... to ignore previous instructions").
function isDiscussed(segmentText, index) {
  if (index > 0 && /[-_/.@]/.test(segmentText.charAt(index - 1))) return true; // inside a compound word, path, or address
  const before = segmentText.slice(Math.max(0, index - 40), index);
  if (OPENING_QUOTE.test(before)) return true;
  const word = LAST_WORD.exec(before.toLowerCase());
  return !!word && DISCUSSION_WORDS.has(word[1]);
}

// An imperative phrase: matched anywhere in the segment, unless the words just before it show that the text
// is being quoted or described. source is a regex source that starts with a word character.
function addImperative(id, family, source) {
  const regex = new RegExp("\\b(?:" + source + ")", "gi");
  addFunction(id, family, (segmentText) => {
    regex.lastIndex = 0;
    let match;
    for (let tries = 0; tries < 10 && (match = regex.exec(segmentText)) !== null; tries++) {
      if (!isDiscussed(segmentText, match.index)) return true;
      if (match[0].length === 0) regex.lastIndex++;
    }
    return false;
  });
}

// ---- instruction-override -------------------------------------------------------------------------------
addImperative("io-ignore-previous", FAMILIES.override,
  ("(?:ignore|disregard|forget|override|discard)\\s+(?:(?:all|any|every|the|your|my|these|those|of)\\s+){0,3}" +
    "(?:previous|prior|above|earlier|preceding|original|initial|existing|current|system|developer)\\s+(?:\\w+\\s+){0,2}" +
    "(?:instructions?|prompts?|rules|directives|guidelines|constraints|programming)\\b"));
addImperative("io-forget-everything", FAMILIES.override,
  ("(?:ignore|disregard|forget)\\s+(?:everything|anything|all)\\s+(?:(?:that\\s+)?(?:you|i|we)(?:'ve|\\s+have|\\s+were|\\s+was|\\s+had)?\\s+(?:been\\s+)?)?" +
    "(?:told|said|given|instructed|above)\\b"));
addImperative("io-dont-follow", FAMILIES.override,
  ("(?:do\\s+not|don't|dont|never|stop)\\s+(?:follow|obey|listen\\s+to|comply\\s+with|adhere\\s+to)\\s+(?:(?:the|your|any|all)\\s+){0,2}" +
    "(?:previous|prior|earlier|original|system|developer)\\s+(?:instructions?|rules|guidelines|prompt|directives)\\b"));
addImperative("io-real-task", FAMILIES.override,
  ("(?:your|the)\\s+(?:real|true|actual)\\s+(?:task|instructions?|objective|goal|job|mission)\\s+(?:is|are)\\s+(?:now\\s+)?to\\b"));

// ---- role-reassignment ----------------------------------------------------------------------------------
add("rr-now-jailbroken", FAMILIES.role,
  plain("\\byou\\s+are\\s+now\\s+(?:in\\s+)?(?:(?:a|an|the)\\s+)?(?:\\w+\\s+){0,2}" +
    "(?:jailbroken|unrestricted|unfiltered|uncensored|god\\s+mode|do\\s+anything\\s+now)\\b"));
add("rr-pretend-unrestricted", FAMILIES.role,
  plain("\\b(?:pretend|act|behave|respond|roleplay|role-play|operate)\\s+(?:to\\s+be|as)\\s+(?:if\\s+you\\s+(?:are|were)\\s+)?(?:(?:a|an|the)\\s+)?(?:\\w+\\s+){0,3}" +
    "(?:without|with\\s+no|having\\s+no)\\s+(?:any\\s+)?(?:restrictions?|filters?|limitations?|rules|guidelines|censorship|safety|ethics|morals|limits)\\b"));
add("rr-mode-switch", FAMILIES.role,
  plain("\\b(?:enter|enable|activate|switch\\s+to|turn\\s+on|start)\\s+(?:the\\s+)?(?:dan|god|jailbreak|jailbroken|unrestricted|unfiltered)\\s+mode\\b"));
add("rr-from-now-on-persona", FAMILIES.role,
  plain("\\bfrom\\s+now\\s+on,?\\s+(?:you\\s+(?:are|will\\s+be|will\\s+act\\s+as|must\\s+act\\s+as)|act\\s+as|pretend\\s+to\\s+be)\\s+(?:\\w+\\s+){0,3}" +
    "(?:ai|assistant|chatbot|model|agent|persona|llm)\\b"));
add("rr-new-identity", FAMILIES.role,
  plain("\\byour\\s+(?:new|true|real|actual)\\s+(?:persona|identity)\\s+is\\b"));

// ---- system-prompt-or-secret-exfiltration -----------------------------------------------------------------
addImperative("sx-reveal-system-prompt", FAMILIES.exfil,
  ("(?:print|output|reveal|repeat|show|display|tell\\s+me|send|leak|disclose|share|echo|dump|give\\s+me|write\\s+out)\\s+(?:me\\s+)?" +
    "(?:(?:all|the|your|its|these|this|full|entire|complete|exact|verbatim|initial|original|hidden|secret|current)\\s+){0,3}" +
    "(?:system\\s+(?:prompt|message|instructions?)|(?:initial|original|hidden|secret|developer)\\s+(?:prompt|instructions?|message)|" +
    "(?:your|the\\s+above)\\s+(?:instructions?|prompt|rules|guidelines))\\b"));
add("sx-ask-system-prompt", FAMILIES.exfil,
  plain("\\b(?:what|which)\\s+(?:is|are|were)\\s+your\\s+(?:system\\s+(?:prompt|message|instructions?)|initial\\s+(?:prompt|instructions?)|hidden\\s+instructions?)\\b"));
addImperative("sx-repeat-above", FAMILIES.exfil,
  ("(?:repeat|print|output|write)\\s+(?:(?:all|everything|the\\s+words|the\\s+text|the\\s+content)\\s+){1,2}(?:above|before\\s+this)\\b"));
addImperative("sx-send-secrets", FAMILIES.exfil,
  ("(?:send|post|upload|forward|email|exfiltrate|transmit|leak|copy)\\s+(?:\\w+\\s+){0,4}" +
    "(?:\\.env\\b|environment\\s+variables|ssh\\s+keys?|private\\s+keys?|id_rsa|\\.ssh\\b|\\.aws\\b|all\\s+(?:secrets|credentials|passwords|tokens|api\\s+keys))" +
    "[^\\n]{0,100}?\\b(?:to|at|via)\\s+(?:https?://|[\\w.+-]+@[\\w-]+\\.)"));

// ---- fake-role-or-chat-delimiters -------------------------------------------------------------------------
add("fd-chat-template-token", FAMILIES.delimiter,
  plain("<\\|(?:im_start|im_end|system|user|assistant|endoftext|eot_id|start_header_id|end_header_id|begin_of_text)\\|>"));
add("fd-inst-sys-tags", FAMILIES.delimiter, plain("\\[/?inst\\]|<</?sys>>"));
add("fd-fake-system-tag", FAMILIES.delimiter,
  plain("</?(?:system[-_ ]?(?:reminder|prompt|message|instructions?)|new[-_ ]instructions?|admin[-_ ]override|assistant[-_ ]instructions?)\\s*>"));
add("fd-bracket-system", FAMILIES.delimiter,
  plain("\\[(?:system|admin|developer|assistant)\\s+(?:message|override|notice|prompt|instructions?)\\]"));
addImperative("fd-system-override", FAMILIES.delimiter,
  ("(?:system|developer)\\s+override\\s*[:!]"));

// ---- hidden-instruction-carrier ---------------------------------------------------------------------------
add("hc-html-comment", FAMILIES.carrier, plain("^<!--[\\s\\S]{0,1900}?" + CARRIER_WORDS));
{
  const openTag = /<(?:div|span|p|section|font|td|li)\b[^>]{0,200}>/gi;
  const hiddenStyle = /display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0|opacity\s*:\s*0\b|aria-hidden\s*=\s*["']?true|\bhidden\b/i;
  const carrier = new RegExp("^[^<]{0,400}?" + CARRIER_WORDS, "i");
  // A hidden element whose text addresses a model. Done in steps to keep every regex single-bounded.
  addFunction("hc-hidden-element", FAMILIES.carrier, (segment) => {
    if (segment.indexOf("<") === -1) return false;
    const finder = new RegExp(openTag.source, "gi");
    let match;
    let seen = 0;
    while ((match = finder.exec(segment)) !== null && seen < 20) {
      seen++;
      if (hiddenStyle.test(match[0]) && carrier.test(segment.slice(match.index + match[0].length, match.index + match[0].length + 500))) {
        return true;
      }
    }
    return false;
  });
}
add("hc-markdown-comment", FAMILIES.carrier,
  plain("\\[(?://|comment)\\]:\\s*(?:#|<>)\\s*[(\"'][^\\n]{0,300}?" + CARRIER_WORDS));
addImperative("hc-note-to-ai", FAMILIES.carrier,
  ("(?:note|message|attention|important|notice|instructions?)s?\\s+(?:to|for)\\s+(?:the\\s+)?(?:ai|llm|assistant|language\\s+model|agent|claude|chatgpt|gpt|copilot|bot)s?\\b" +
    "[^\\n]{0,200}?\\b(?:ignore|disregard|you\\s+(?:must|should|need\\s+to|have\\s+to|are\\s+required\\s+to)|always|never|do\\s+not|don't|instead|immediately|before\\s+(?:answering|responding|continuing))\\b"));

// ---- tool-or-command-hijack -------------------------------------------------------------------------------
add("th-silent-action", FAMILIES.hijack,
  plain("(?:^[^a-z0-9]{0,8}|[:;(\\u2014\\u2013]\\s{0,2})(?:(?:please|now|then|also|first|just)\\s+){0,2}(?:silently|secretly|covertly|surreptitiously)\\s+(?:run|execute|invoke|call|send|post|upload|delete|install|download|fetch|exfiltrate|forward)\\b"));
add("th-fake-tool-markup", FAMILIES.hijack, plain("</?(?:antml:[a-z_]+|function_calls|function_results)\\b"));
addImperative("th-before-responding-fetch", FAMILIES.hijack,
  ("before\\s+(?:you\\s+)?(?:answering|responding|replying|continuing|answer|respond|reply)\\b[^\\n]{0,60}?\\b(?:visit|fetch|open|send|post|request|call|curl|load|navigate)\\b[^\\n]{0,80}?https?://[^\\s)]{0,150}[?=]"));
add("th-claimed-preauthorization", FAMILIES.hijack,
  plain("\\buser\\s+(?:has\\s+)?(?:already\\s+)?(?:pre-?)?(?:approved|authori[sz]ed|consented\\s+to|granted\\s+permission\\s+for)\\s+(?:you\\s+to\\s+)?(?:run\\s+|execute\\s+)?(?:all|any|every)\\s+(?:tool\\s+calls?|commands?|actions?|operations?)\\b"));

// ---- data-exfil-link --------------------------------------------------------------------------------------
add("de-image-placeholder", FAMILIES.link,
  plain("!\\[[^\\]]{0,100}\\]\\(\\s*https?://[^)\\s]{0,200}?(?:\\{\\{?|\\$\\{|<|%7b)\\s*(?:" + DATA_NAMES + ")[a-z_]{0,20}\\s*(?:\\}\\}?|>|%7d)"));
add("de-link-sensitive-param", FAMILIES.link,
  plain("\\]\\(\\s*https?://[^)\\s]{0,150}?[?&](?:" + DATA_NAMES + ")=[A-Za-z0-9+/=_%.-]{40,}"));
addImperative("de-append-data-to-url", FAMILIES.link,
  ("(?:append|add|embed|encode|put|insert|include|attach)\\s+(?:\\w+\\s+){0,5}" +
    "(?:conversation|chat\\s+history|history|previous\\s+messages|system\\s+prompt|api\\s+keys?|secrets?|credentials|user\\s+data|the\\s+user'?s?\\s+(?:data|messages|files?))\\b" +
    "(?:\\s+\\w+){0,6}\\s+(?:to|in|into|onto|as\\s+part\\s+of)\\s+(?:the\\s+|this\\s+|that\\s+|a\\s+)?(?:url|link|query\\s+string|query\\s+parameter|image\\s+url|request)\\b"));
add("de-html-img-placeholder", FAMILIES.link,
  plain("<img\\b[^>]{0,150}?\\bsrc\\s*=\\s*[\"']?https?://[^\"'>\\s]{0,200}?(?:\\{\\{?|\\$\\{|%7b)\\s*(?:" + DATA_NAMES + ")"));

// ---- concealment ------------------------------------------------------------------------------------------
add("cn-dont-tell-user", FAMILIES.conceal,
  plain("\\b(?:do\\s+not|don't|dont|never|must\\s+not|should\\s+not|shouldn't)\\s+(?:ever\\s+)?(?:tell|inform|notify|alert|warn)\\s+" + USER_NOUN + "(?!\\s+(?:to|how|that)\\b)"));
add("cn-dont-mention-to-user", FAMILIES.conceal,
  plain("\\b(?:do\\s+not|don't|dont|never|must\\s+not|should\\s+not|shouldn't)\\s+(?:ever\\s+)?(?:mention|reveal|disclose|say|report)\\s+" +
    "(?:this|that|it|these|those|any\\s+of\\s+this|anything\\s+about\\s+(?:this|it))\\s+(?:to|with)\\s+" + USER_NOUN));
add("cn-hide-from-user", FAMILIES.conceal,
  plain("\\b(?:(?:hide|conceal|withhold)\\s+(?:this|that|it|these|those)|keep\\s+(?:this|that|it)\\s+(?:a\\s+)?(?:secret|hidden|confidential))\\s+from\\s+" + USER_NOUN));
add("cn-user-must-not-know", FAMILIES.conceal,
  plain("\\b(?:the\\s+)?(?:user|human|operator)\\s+(?:must|should|can|may|will)\\s+(?:not|never)\\s+(?:know|find\\s+out|be\\s+(?:told|informed|notified|aware)|notice|learn\\s+(?:of|about))\\b"));
add("cn-dont-mention-instructions", FAMILIES.conceal,
  plain("\\b(?:do\\s+not|don't|never)\\s+(?:acknowledge|mention|reveal|disclose)\\s+(?:the\\s+existence\\s+of\\s+)?(?:these|those|this|the\\s+(?:above|hidden|secret))\\s+(?:instructions?|message|note|text|directive)s?\\b"));

// ---------------------------------------------------------------------------------------------
// Normalization

// Zero-width (U+200B-200D, U+FEFF), bidi overrides (U+202A-202E, U+2066-2069), and Unicode tag
// characters (U+E0000-E007F, written as surrogate pairs so no regex "u" flag is needed).
const INVISIBLE = /[\u200B-\u200D\uFEFF\u202A-\u202E\u2066-\u2069]|\uDB40[\uDC00-\uDC7F]/g;
const NON_ASCII = /[^\x00-\x7f]/;

// Removes the invisible characters only; used on the text that is returned to the model.
function stripInvisible(text) {
  return text.replace(INVISIBLE, "");
}

// NFKC-normalizes and strips invisible characters. Returns {text, strippedInvisible}.
function normalize(text) {
  const input = String(text);
  let folded = input;
  if (NON_ASCII.test(folded) && typeof folded.normalize === "function") folded = folded.normalize("NFKC");
  const stripped = stripInvisible(folded);
  return { text: stripped, strippedInvisible: stripInvisible(input).length !== input.length };
}

// The form a segment is matched in: NFKC, straight apostrophes, single spaces.
function matchForm(segmentText) {
  return normalize(segmentText).text.replace(/[\u2018\u2019\u02BC]/g, "'").replace(/\s+/g, " ");
}

// ---------------------------------------------------------------------------------------------
// Segmentation

function isWhitespaceCode(code) {
  return code === 32 || (code >= 9 && code <= 13) || code === 0xa0 || code === 0x2028 || code === 0x2029 || code === 0x3000 || (code >= 0x2000 && code <= 0x200a);
}

function isTerminatorCode(code) {
  return code === 46 || code === 33 || code === 63; // . ! ?
}

// Emits [start, end) pieces of at most CHUNK characters, cutting at a space or clause mark where possible.
function emitPiece(text, start, end, out) {
  while (start < end && isWhitespaceCode(text.charCodeAt(start))) start++;
  while (end > start && isWhitespaceCode(text.charCodeAt(end - 1))) end--;
  while (end - start > CHUNK) {
    let cut = start + CHUNK;
    const floor = start + (CHUNK >> 1);
    while (cut > floor) {
      const code = text.charCodeAt(cut);
      if (isWhitespaceCode(code) || code === 44 || code === 59 || code === 58) break;
      cut--;
    }
    if (cut <= floor) cut = start + CHUNK;
    let pieceEnd = cut;
    while (pieceEnd > start && isWhitespaceCode(text.charCodeAt(pieceEnd - 1))) pieceEnd--;
    if (pieceEnd > start) out.push({ start, end: pieceEnd });
    start = cut;
    while (start < end && isWhitespaceCode(text.charCodeAt(start))) start++;
  }
  if (end > start) out.push({ start, end });
}

// Splits text[from, to) into lines and sentences.
function splitPlain(text, from, to, out) {
  let segStart = from;
  for (let i = from; i < to; i++) {
    const code = text.charCodeAt(i);
    if (code === 10 || code === 13) {
      emitPiece(text, segStart, i, out);
      segStart = i + 1;
    } else if (isTerminatorCode(code)) {
      let j = i;
      while (j + 1 < to && isTerminatorCode(text.charCodeAt(j + 1))) j++;
      if (j + 1 >= to || isWhitespaceCode(text.charCodeAt(j + 1))) {
        emitPiece(text, segStart, j + 1, out);
        segStart = j + 1;
      }
      i = j;
    }
  }
  emitPiece(text, segStart, to, out);
}

// segment(text) -> [{start, end}] in order and without overlap. The text between segments (spaces and
// line breaks) is never part of a segment, so replacing segments keeps all other bytes. An HTML comment
// that fits MAX_SEGMENT is one segment, even when it holds several sentences or lines.
function segment(text) {
  const out = [];
  let plainStart = 0;
  let from = 0;
  let closeAt = -1; // -1 not searched yet, -2 no closing marker remains
  for (;;) {
    const open = text.indexOf("<!--", from);
    if (open === -1) break;
    if (closeAt !== -2 && closeAt < open + 4) {
      closeAt = text.indexOf("-->", open + 4);
      if (closeAt === -1) closeAt = -2;
    }
    if (closeAt === -2) break;
    const end = closeAt + 3;
    if (end - open <= MAX_SEGMENT) {
      splitPlain(text, plainStart, open, out);
      out.push({ start: open, end });
      plainStart = end;
      from = end;
    } else {
      from = open + 4;
    }
  }
  splitPlain(text, plainStart, text.length, out);
  return out;
}

// ---------------------------------------------------------------------------------------------
// Scan

function marker(ruleId) {
  return MARKER_PREFIX + ruleId + "]";
}

// First matching rule for one segment's text, or null.
function matchRule(segmentText) {
  if (segmentText.length > MAX_SEGMENT) return null;
  const form = matchForm(segmentText);
  for (let i = 0; i < RULES.length; i++) {
    if (RULES[i].test(form)) return RULES[i];
  }
  return null;
}

// scan(text) -> {clean, findings: [{id, family}], strippedInvisible, strippedCount}
// Invisible characters are removed from clean. Each flagged segment is replaced by the marker; all other
// text is unchanged. Input that is not a string, or is larger than MAX_TEXT, is returned as is.
function scan(text) {
  const result = { clean: text, findings: [], strippedInvisible: false, strippedCount: 0 };
  if (typeof text !== "string" || text.length === 0 || text.length > MAX_TEXT) return result;
  const stripped = stripInvisible(text);
  result.strippedCount = text.length - stripped.length;
  result.strippedInvisible = result.strippedCount > 0;
  const deadline = Date.now() + TIME_BUDGET_MS;
  const segments = segment(stripped);
  let out = "";
  let position = 0;
  for (let i = 0; i < segments.length; i++) {
    if (Date.now() > deadline) break;
    const seg = segments[i];
    const rule = matchRule(stripped.slice(seg.start, seg.end));
    if (!rule) continue;
    result.findings.push({ id: rule.id, family: rule.family });
    out += stripped.slice(position, seg.start) + marker(rule.id);
    position = seg.end;
  }
  result.clean = out + stripped.slice(position);
  return result;
}

// ---------------------------------------------------------------------------------------------
// Allowlist: content from these sources is never filtered.

function defaultPluginRoots() {
  const roots = [path.resolve(__dirname, "..", "..")];
  if (process.env.CLAUDE_PLUGIN_ROOT) roots.push(path.resolve(process.env.CLAUDE_PLUGIN_ROOT));
  return roots;
}

// Array of substrings from ${CLAUDE_PLUGIN_DATA}/injection-allowlist.json; [] when absent or malformed.
function loadAllowlist() {
  const dir = process.env.CLAUDE_PLUGIN_DATA;
  if (!dir) return [];
  try {
    const data = JSON.parse(fs.readFileSync(path.join(dir, ALLOWLIST_FILE), "utf8"));
    if (!Array.isArray(data)) return [];
    return data
      .filter((entry) => typeof entry === "string" && entry.length > 0 && entry.length <= MAX_ALLOWLIST_ENTRY_LENGTH)
      .slice(0, MAX_ALLOWLIST_ENTRIES);
  } catch (err) {
    return [];
  }
}

function isUnderRoot(hint, roots) {
  let target = hint;
  if (/^file:\/\//i.test(target)) target = target.replace(/^file:\/\//i, "");
  else if (!/^(?:\/|[A-Za-z]:[\\/])/.test(target)) return false;
  const resolved = path.resolve(target);
  return roots.some((root) => resolved === root || resolved.indexOf(root + path.sep) === 0);
}

// A URL matches an entry when its host (or a parent domain of it) or its host+path starts with the entry.
// The query string and any user-info are ignored, so "?x=allowed.example" cannot spoof an entry.
function urlMatchesEntry(hint, entry) {
  let parsed;
  try {
    parsed = typeof URL === "function" ? new URL(hint) : urlModule.parse(hint);
  } catch (err) {
    return false;
  }
  const host = String(parsed.hostname || "").toLowerCase();
  if (!host) return false;
  const lowered = entry.toLowerCase();
  const hostPath = host + (parsed.pathname || "");
  return (
    host === lowered ||
    host.slice(-(lowered.length + 1)) === "." + lowered ||
    hostPath.indexOf(lowered) === 0 ||
    (parsed.protocol + "//" + hostPath).indexOf(lowered) === 0
  );
}

// shouldSkip(sourceHint, options?) -> true when the content comes from the plugin's own files or from an
// allowlisted source. sourceHint is a path, a file:// URL, or an http(s) URL (a string). Plugin files are
// matched only as paths, never inside a URL. options.pluginRoots and options.allowlist replace the defaults
// (used by tests).
function shouldSkip(sourceHint, options) {
  if (typeof sourceHint !== "string" || sourceHint.length === 0 || sourceHint.length > 4096) return false;
  const opts = options || {};
  const roots = opts.pluginRoots || defaultPluginRoots();
  const allowlist = opts.allowlist || loadAllowlist();
  const isUrl = /^https?:\/\//i.test(sourceHint);
  if (!isUrl && isUnderRoot(sourceHint, roots)) return true;
  return allowlist.some((entry) =>
    isUrl ? urlMatchesEntry(sourceHint, entry) : sourceHint.split(/[?#]/)[0].indexOf(entry) !== -1
  );
}

module.exports = {
  FAMILIES,
  RULES,
  MARKER_PREFIX,
  MAX_SEGMENT,
  CHUNK,
  MAX_TEXT,
  ALLOWLIST_FILE,
  normalize,
  stripInvisible,
  segment,
  scan,
  shouldSkip,
  loadAllowlist,
};
