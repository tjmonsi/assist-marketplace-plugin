// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// Pure rules for AI attribution lines in a commit message or pull request body (used by
// impl/commit-attribution-guard.js). No I/O. Only lines that start a trailer or footer are judged, after
// optional leading whitespace, so a sentence that merely mentions a trailer passes.
//
// Judged lines:
//   - Co-Authored-By: <name and email> when the name or email names an AI tool or vendor. A human
//     co-author passes. Claude and Devin are also given names: "Claude Dupont" passes, while "Claude",
//     "Claude Opus 4.1", and "Claude Code" are tools.
//   - Generated with/by <AI tool> footers, with or without a leading robot emoji or a link.
//   - <Word>[-<Word>...]-Session: trailers (Claude-Session, Claude-Code-Session) whose value points at an AI
//     vendor host (claude.ai, chatgpt.com, ...), and a line that is only such a link whose path names a
//     session.
//   - Generated-by: and Assisted-by: trailers that name an AI tool.
// Not judged: a tool name inside a sentence, lines inside a closed code fence, and any other line shape.
// Each line rule runs on at most MAX_LINE characters of one line, so its cost is bounded. The fence scan is linear
// in the number of lines: a line longer than MAX_LINE is never a fence line.
"use strict";

const MAX_LINE = 600;

// Tool and vendor names matched as whole words (a letter before or after the name does not count).
const TOOL_NAMES = [
  "anthropic", "openai", "chatgpt", "gpt", "codex", "copilot", "gemini", "google\\s+bard", "cursor",
  "aider", "windsurf", "codeium", "amazon\\s+q", "codewhisperer", "tabnine", "sourcegraph", "replit",
  "jetbrains\\s+ai", "mistral", "grok", "xai", "deepseek", "qwen", "llama",
];
const TOOL_PATTERN = new RegExp("(^|[^a-z0-9])(" + TOOL_NAMES.join("|") + ")(?![a-z])", "i");

// Names that are also given names. In a Co-Authored-By name they count as a tool only alone or followed by a
// tool qualifier or a version number ("Claude Dupont" is a person). A Generated with/by or Assisted-by line is
// stricter: any whole-word mention denies, so "Assisted-by: Claude Dupont" is denied by design.
const GIVEN_NAME_TOOLS = ["claude", "devin"];
const GIVEN_NAME_PATTERN = new RegExp("(^|[^a-z0-9])(" + GIVEN_NAME_TOOLS.join("|") + ")(?![a-z])", "i");
const QUALIFIERS = {
  ai: true, code: true, agent: true, bot: true, opus: true, sonnet: true, haiku: true, instant: true,
  assistant: true, cli: true, sdk: true, integration: true,
};

// Vendor mail domains (anthropic.com, openai.com, and their subdomains). Only a noreply address there counts:
// a person who works at the vendor can co-author a commit under a personal address.
const VENDOR_MAIL = /(^|\.)(anthropic\.com|openai\.com)$/i;

// Hosts that identify an AI tool session link.
const AI_HOST = new RegExp(
  "(^|\\.)(claude\\.ai|claude\\.com|anthropic\\.com|chatgpt\\.com|openai\\.com|gemini\\.google\\.com|bard\\.google\\.com|" +
    "copilot\\.microsoft\\.com|cursor\\.com|cursor\\.sh|devin\\.ai|codeium\\.com|windsurf\\.com|mistral\\.ai|grok\\.com|" +
    "x\\.ai|deepseek\\.com|aider\\.chat|tabnine\\.com)$",
  "i"
);
const HOST_TOKEN = /[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi;

const CO_AUTHOR = /^co-authored-by\s*:(.*)$/i;
const GENERATED = /^generated\s+(?:with|by)\b(.*)$/i;
const SESSION = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*-session\s*:(.*)$/i;
const TOOL_TRAILER = /^(?:generated|assisted)-by\s*:(.*)$/i;
const BARE_LINK = /^<?(https?:\/\/[^\s<>]+)>?$/i;
const NOREPLY = /^no-?reply$/i;
const FENCE = /^[ \t]*(`{3,}|~{3,})/;
const FENCE_CLOSER = /^[ \t]*(`{3,}|~{3,})[ \t]*$/;
const SESSION_SEGMENT = /\/session[_-][A-Za-z0-9]/i;
const MAX_HITS = 5;
// Robot and other pictographs that may lead a footer line (surrogate pairs, dingbats, joiners, selectors).
const EMOJI_PREFIX = /^(?:(?:\uD83E[\uDD00-\uDDFF]|\uD83D[\uDC00-\uDFFF]|[\u2600-\u27BF]|\uFE0F|\u200D)\s*)+/;

function isGivenNameTool(name) {
  const words = name.toLowerCase().split(/[^a-z0-9.]+/).filter(Boolean);
  if (words.length === 0 || GIVEN_NAME_TOOLS.indexOf(words[0]) === -1) return false;
  return words.length === 1 || QUALIFIERS[words[1]] === true || /^[0-9]/.test(words[1]);
}

// True when the value of a Co-Authored-By line (name, email, or both) names an AI tool or vendor.
function isAiIdentity(value) {
  const text = String(value).slice(0, MAX_LINE);
  const match = /^([^<]*)<([^>]*)>/.exec(text);
  let name = match ? match[1] : text;
  let email = match ? match[2] : "";
  if (!match && name.indexOf("@") !== -1 && !/\s/.test(name.trim())) {
    email = name.trim();
    name = "";
  }
  email = email.trim();
  const at = email.lastIndexOf("@");
  const local = at === -1 ? email : email.slice(0, at);
  const domain = at === -1 ? "" : email.slice(at + 1);
  if (NOREPLY.test(local) && VENDOR_MAIL.test(domain)) return true;
  if (isGivenNameTool(name.trim() || local)) return true;
  return TOOL_PATTERN.test(name + " " + local);
}

function mentionsAiTool(text) {
  const rest = String(text);
  return TOOL_PATTERN.test(rest) || GIVEN_NAME_PATTERN.test(rest);
}

function pointsAtAiHost(value) {
  const hosts = String(value).match(HOST_TOKEN) || [];
  return hosts.some(function (host) {
    return AI_HOST.test(host);
  });
}

function oneLine(line) {
  return line.replace(/[\u0000-\u001f\u007f-\u009f]+/g, " ").slice(0, 140);
}

// True when the line is only a link (optionally inside <...>) to an AI vendor host whose path holds a session
// id segment (/session_01..., /session-abc). Documentation paths such as /sessions or realtime-sessions do not.
function isSessionLink(line) {
  const match = BARE_LINK.exec(line);
  if (!match) return false;
  const url = /^https?:\/\/([^\/?#:]*)([^?#]*)/i.exec(match[1]);
  return !!url && AI_HOST.test(url[1]) && SESSION_SEGMENT.test(url[2]);
}

// Judges one line. Returns {rule, line} for an AI attribution line, else null.
function judgeLine(rawLine) {
  const line = String(rawLine).slice(0, MAX_LINE).replace(/^\s+/, "");
  if (!line) return null;
  let match = CO_AUTHOR.exec(line);
  if (match) return isAiIdentity(match[1]) ? { rule: "AI co-author trailer", line: oneLine(line) } : null;
  match = SESSION.exec(line);
  if (match) return pointsAtAiHost(match[1]) ? { rule: "AI session trailer", line: oneLine(line) } : null;
  match = TOOL_TRAILER.exec(line);
  if (match) return mentionsAiTool(match[1]) || pointsAtAiHost(match[1]) ? { rule: "AI tool trailer", line: oneLine(line) } : null;
  if (isSessionLink(line.replace(/\s+$/, ""))) return { rule: "AI session link", line: oneLine(line) };
  match = GENERATED.exec(line.replace(EMOJI_PREFIX, ""));
  if (match) return mentionsAiTool(match[1]) || pointsAtAiHost(match[1]) ? { rule: "AI generated-with line", line: oneLine(line) } : null;
  return null;
}

// Marks the lines of each closed code fence (``` or ~~~), fence lines included. A fence that never closes
// marks nothing, so opening one cannot hide the lines after it. Linear: one pass finds each line's closer, a
// backward pass records the longest closer of each mark at or after every line, so an opener without a closer
// is skipped at once, and an opener with one scans only up to that closer.
function fencedLines(lines) {
  const count = lines.length;
  const closerMark = [];
  const closerSize = [];
  const longest = { "`": new Array(count + 1), "~": new Array(count + 1) };
  longest["`"][count] = 0;
  longest["~"][count] = 0;
  for (let j = 0; j < count; j++) {
    const match = lines[j].length <= MAX_LINE ? FENCE_CLOSER.exec(lines[j]) : null;
    closerMark[j] = match ? match[1].charAt(0) : "";
    closerSize[j] = match ? match[1].length : 0;
  }
  for (let j = count - 1; j >= 0; j--) {
    longest["`"][j] = Math.max(longest["`"][j + 1], closerMark[j] === "`" ? closerSize[j] : 0);
    longest["~"][j] = Math.max(longest["~"][j + 1], closerMark[j] === "~" ? closerSize[j] : 0);
  }
  const skip = [];
  let i = 0;
  while (i < count) {
    const open = lines[i].length <= MAX_LINE ? FENCE.exec(lines[i]) : null;
    if (!open) {
      i++;
      continue;
    }
    const mark = open[1].charAt(0);
    const size = open[1].length;
    if (longest[mark][i + 1] < size) {
      i++;
      continue;
    }
    let close = i + 1;
    while (closerMark[close] !== mark || closerSize[close] < size) close++;
    for (let k = i; k <= close; k++) skip[k] = true;
    i = close + 1;
  }
  return skip;
}

// Judges a message or body. Returns every hit (at most MAX_HITS) as [{rule, line}]; empty when there is none.
function judgeText(text) {
  const lines = String(text).split(/\r\n|\r|\n/);
  const skip = fencedLines(lines);
  const hits = [];
  for (let i = 0; i < lines.length && hits.length < MAX_HITS; i++) {
    if (skip[i]) continue;
    const hit = judgeLine(lines[i]);
    if (hit) hits.push(hit);
  }
  return hits;
}

module.exports = { MAX_HITS, isAiIdentity, judgeLine, judgeText };
