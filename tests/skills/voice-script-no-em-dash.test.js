// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Contract tests for the /voice-script skill text of release 1.13.1: a saved voice script holds no
// U+2014, U+2015, or curly quote anywhere. The skill is a prompt, so the tests read the skill
// files as text and assert the wording the specs fix, and they run the header and notes fixtures
// through the public prose-gate evaluate(input, options). No test runs the skill.
//
// Sources: specs/spec-skills-deslop-voice-clarify.md (Change Log 2026-10-23, called SDVC below:
// Requirement: No em dash, U+2015, or curly quote in a saved voice script; Requirement: Dash-style
// pause marks per model file, with its pause-mark table; Requirement: Draft and header text
// normalization; Requirement: Header notes for swaps and kept tells; Requirement: Typed values
// with a banned character are refused; Requirement: One same-path retry after a header deny;
// Requirement: Writing standard scope in the voice-script skill; MODIFIED Requirement: Saved
// voice-script file), specs/spec-hooks-prose-hooks.md (Change Log 2026-10-23: Requirement: Voice
// scripts judged like other prose files), specs/spec-skills.md (Change Log 2026-10-23: Requirement:
// Prose that skills write meets the block tier), and docs/requirements/FR-NFR-assist-plugin.md
// (FR-211, FR-212, FR-213, FR-163, NFR-019). Upstream ids: UR-058, UR-040, BR-008.
//
// Traceability format: [Scenario title | spec section | FR ids]. The specs use named requirement
// blocks and carry no SPEC-NNN id, so none is cited.
//
// Shared wording contract W1 to W8 (task plan docs/task-plans/task-plan-voice-script-no-em-dash-*.md).
// The skill text and this file are written in parallel, so the tests assert exactly the literal
// words below and nothing stricter. Every match is without regard to case.
//   W1  SKILL.md: a Markdown table row (a line that starts with "|") holds each model file name
//       and the mark words listed for it in PAUSE_ROWS; one row may cover several files. The
//       words "pause-mark table" appear in the Pauses rule (the one line that starts with
//       "**Pauses.**", which also says "no em dash").
//   W2  SKILL.md: "U+2014", "U+2015", "curly quote", "whole file", "before the write".
//   W3  SKILL.md and output-template.md: the three note strings, character for character;
//       output-template.md holds no "omit the section" clause; SKILL.md says "every saved script".
//   W4  SKILL.md: "refuse", "ask for it again", "do not repeat the value".
//   W5  SKILL.md: "retry once on the same path", "double quotes or a code span", "no new Glob",
//       "the file was not saved".
//   W6  SKILL.md: "governs the header, the notes, and chat replies".
//   W7  SKILL.md: the save-path sentence.
//   W8  Every file under skills/voice-script/: none of "may use em dashes", "may hold em dashes",
//       "prose-hook exemption", and none of U+2014, U+2015, U+2018, U+2019, U+201C, U+201D.
//
// The banned characters are built from code points, so this file holds none of them. A hit in a
// file the build did not touch is reported by file and line, so qa can judge it.
//
// Run: node --test tests/skills/voice-script-no-em-dash.test.js

"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const REPO = path.resolve(__dirname, "..", "..");
const PLUGIN = path.join(REPO, "plugins", "assist-plugin");
const SKILL_DIR = path.join(PLUGIN, "skills", "voice-script");
const MODELS_DIR = path.join(SKILL_DIR, "references", "models");
const gate = require(path.join(PLUGIN, "hooks", "impl", "prose-gate.js"));

const BANNED_CODES = [0x2014, 0x2015, 0x2018, 0x2019, 0x201c, 0x201d];
const BANNED_PHRASES = ["may use em dashes", "may hold em dashes", "prose-hook exemption"];

const EM = String.fromCharCode(0x2014);
const CURLY_APOSTROPHE = String.fromCharCode(0x2019);
const CURLY_OPEN = String.fromCharCode(0x201c);

function readFile(file) {
  return fs.readFileSync(file, "utf8");
}

function lower(file) {
  return readFile(file).toLowerCase();
}

const SKILL_FILE = path.join(SKILL_DIR, "SKILL.md");
const TEMPLATE_FILE = path.join(SKILL_DIR, "references", "output-template.md");
const ELEVENLABS_V2_FILE = path.join(MODELS_DIR, "elevenlabs-v2.md");

function walk(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  });
  return out;
}

function rel(file) {
  return path.relative(PLUGIN, file).split(path.sep).join("/");
}

function hex(code) {
  const h = code.toString(16).toUpperCase();
  return "U+" + new Array(Math.max(0, 4 - h.length) + 1).join("0") + h;
}

// Every banned character in `text`, as { line, code } with the line counted from 1.
function findBanned(text) {
  const hits = [];
  text.split(/\r?\n/).forEach((line, i) => {
    for (let k = 0; k < line.length; k++) {
      const code = line.charCodeAt(k);
      if (BANNED_CODES.indexOf(code) !== -1) hits.push({ line: i + 1, code: code });
    }
  });
  return hits;
}

// ---------------------------------------------------------------------------
// Environment isolation for the hook fixtures
// ---------------------------------------------------------------------------

const savedEnv = {};

before(() => {
  ["CLAUDE_PROJECT_DIR", "CLAUDE_PLUGIN_DATA"].forEach((k) => {
    savedEnv[k] = process.env[k];
    delete process.env[k];
  });
});

after(() => {
  Object.keys(savedEnv).forEach((k) => {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  });
});

// ---------------------------------------------------------------------------
// W8 and the character rule (NFR-019): no banned character or phrase in any voice-script file
// ---------------------------------------------------------------------------

const ALL_FILES = walk(SKILL_DIR, []).sort();

test("the file scan covers SKILL.md, output-template.md, elevenlabs-v2.md, and every model file", () => {
  // [Scenario: Whole-file count (scan coverage) | SDVC Requirement: No em dash, U+2015, or curly quote in a saved voice script | FR-211 | NFR-019 | UR-058]
  const rels = ALL_FILES.map(rel);
  ["SKILL.md", "references/output-template.md", "references/models/elevenlabs-v2.md", "references/models/chatterbox-turbo.md"].forEach((name) => {
    assert.ok(rels.indexOf("skills/voice-script/" + name) !== -1, "the scan misses " + name);
  });
  const models = rels.filter((r) => /\/references\/models\/[^/]+\.md$/.test(r));
  assert.ok(models.length >= 19, "expected at least 19 model files, found " + models.length);
});

test("the character finder reports each banned code point and ignores ASCII quotes and hyphens", () => {
  // Valid and invalid input of the helper itself, so a clean scan below means something.
  // [Scenario: Whole-file count | SDVC Requirement: No em dash, U+2015, or curly quote in a saved voice script | FR-211 | NFR-019]
  BANNED_CODES.forEach((code) => {
    const hits = findBanned("a" + String.fromCharCode(code) + "b");
    assert.deepStrictEqual(hits, [{ line: 1, code: code }], hex(code));
  });
  assert.deepStrictEqual(findBanned("plain 'single' \"double\" - -- ... , ."), []);
  assert.deepStrictEqual(findBanned("one\ntwo " + EM + "\n"), [{ line: 2, code: 0x2014 }]);
});

ALL_FILES.forEach((file) => {
  test(rel(file) + ": holds none of U+2014, U+2015, U+2018, U+2019, U+201C, and U+201D", () => {
    // [Scenario: Whole-file count; Topic script | SDVC Requirement: No em dash, U+2015, or curly quote in a saved voice script | FR-211 | NFR-019 | UR-058]
    // Invalid input: any of the six characters, in the skill, the template, or a model file.
    const hits = findBanned(readFile(file));
    assert.deepStrictEqual(
      hits,
      [],
      rel(file) + " holds banned characters: " + hits.map((h) => hex(h.code) + " at line " + h.line).join(", ")
    );
  });

  test(rel(file) + ": holds none of 'may use em dashes', 'may hold em dashes', and 'prose-hook exemption'", () => {
    // [Scenario: Stale Pauses rule; Voice-script save sentence stays | spec-skills.md Change Log 2026-10-23, Requirement: Documents describe voice scripts as gated prose | FR-211 | FR-213 | UR-058 | BR-008]
    const text = readFile(file).toLowerCase();
    const found = BANNED_PHRASES.filter((p) => text.indexOf(p) !== -1);
    assert.deepStrictEqual(found, [], rel(file) + " holds a banned phrase: " + found.join(", "));
  });
});

// ---------------------------------------------------------------------------
// W1: the pause-mark table in SKILL.md
// ---------------------------------------------------------------------------

// [model file, words the row must hold]. Words are matched without regard to case.
const PAUSE_ROWS = [
  ["elevenlabs-v2.md", ["spaced hyphen", "--"]],
  ["gemini-3-8-tts.md", ["--"]],
  ["elevenlabs-v4-v3.md", ["..."]],
  ["deepgram-aura-2.md", ["...", "comma", "period"]],
  ["microsoft-mai-voice.md", ["comma", "period", "paragraph break"]],
  ["chatterbox-turbo.md", ["...", "comma", "never a line break"]],
  ["xai-grok-voice-tts.md", ["comma", "period"]],
  ["fish-audio-s2.md", ["comma", "period"]],
  ["minimax-speech-2-8.md", ["comma", "period"]],
  ["gemini-3-1-tts-preview.md", ["comma", "period"]],
  ["qwen-audio-3-tts.md", ["comma", "period"]],
  ["hexgrad-kokoro.md", ["comma", "period"]],
  ["mistral-voxtral.md", ["comma", "period"]],
  ["sesame-csm.md", ["comma", "period"]],
  ["openai-gpt-audio.md", ["comma", "period"]],
  ["deepgram-flux-tts.md", ["comma", "period"]],
  ["seed-audio.md", ["comma", "period"]],
  ["fish-audio-s1.md", ["comma", "period"]],
  ["canopy-orpheus.md", ["comma", "period"]],
];

function tableRows(text) {
  return text.split(/\r?\n/).filter((line) => /^\s*\|/.test(line));
}

test("the pause-mark rows cover exactly the model files of the references/models folder", () => {
  // Guards the test's own list: a new or removed model file must change the contract and this table together.
  // [Scenario: Model outside the catalog; Ordinary-punctuation model | SDVC Requirement: Dash-style pause marks per model file | FR-211 | FR-162 | UR-058]
  const onDisk = fs.readdirSync(MODELS_DIR).filter((n) => /\.md$/.test(n)).sort();
  const listed = PAUSE_ROWS.map((r) => r[0]).sort();
  assert.deepStrictEqual(listed, onDisk);
});

PAUSE_ROWS.forEach((row) => {
  const file = row[0], words = row[1];
  test("SKILL.md pause-mark table: a row holds " + file + " with " + words.map((w) => "'" + w + "'").join(", "), () => {
    // [Scenarios: ElevenLabs v2; Gemini 3.8 TTS; Ordinary-punctuation model; Tag model; Chatterbox-Turbo; Model file with its own marks | SDVC Requirement: Dash-style pause marks per model file | FR-211 | FR-162 | UR-058 | UR-040]
    const rows = tableRows(readFile(SKILL_FILE)).map((r) => r.toLowerCase());
    const matching = rows.filter((r) => r.indexOf(file.toLowerCase()) !== -1);
    assert.ok(matching.length > 0, "no table row of SKILL.md names " + file);
    const ok = matching.some((r) => words.every((w) => r.indexOf(w.toLowerCase()) !== -1));
    assert.ok(ok, "no table row with " + file + " holds every word of " + JSON.stringify(words) + "; rows found: " + JSON.stringify(matching));
  });
});

test("SKILL.md pause-mark table: one row for a model outside the catalog holds 'outside the catalog', 'comma', and 'period'", () => {
  // [Scenario: Model outside the catalog | SDVC Requirement: Dash-style pause marks per model file | FR-211 | FR-212 | UR-058]
  const rows = tableRows(readFile(SKILL_FILE)).map((r) => r.toLowerCase());
  const ok = rows.some((r) => r.indexOf("outside the catalog") !== -1 && r.indexOf("comma") !== -1 && r.indexOf("period") !== -1);
  assert.ok(ok, "no table row covers a model outside the catalog with a comma and a period");
});

test("SKILL.md Pauses rule names the pause-mark table and says the script text holds no em dash", () => {
  // [Scenario: Pause mark outside the table; Stale Pauses rule | SDVC Requirement: Dash-style pause marks per model file | FR-211 | UR-058]
  // The rule is the one line that starts with "**Pauses.**". A reverted rule (the 1.13.0 wording) holds
  // neither phrase, so this fails where a loose search for "pause" anywhere would pass.
  const lines = readFile(SKILL_FILE).split(/\r?\n/).filter((l) => l.indexOf("**Pauses.**") === 0);
  assert.strictEqual(lines.length, 1, "expected exactly one line that starts with '**Pauses.**', found " + lines.length);
  const rule = lines[0].toLowerCase();
  assert.ok(rule.indexOf("pause-mark table") !== -1, "the Pauses rule lacks 'pause-mark table': " + lines[0]);
  assert.ok(rule.indexOf("no em dash") !== -1, "the Pauses rule lacks 'no em dash': " + lines[0]);
});

// ---------------------------------------------------------------------------
// elevenlabs-v2.md pause table (step 9 end state)
// ---------------------------------------------------------------------------

function pauseSectionRows(text) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => /^##\s+Pause and pronunciation markup/i.test(l));
  assert.ok(start !== -1, "elevenlabs-v2.md has no 'Pause and pronunciation markup' section");
  const rows = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) break;
    if (/^\s*\|/.test(lines[i])) rows.push(lines[i]);
  }
  return rows;
}

function cellsOf(row) {
  return row
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

function useOf(rows, row) {
  const header = cellsOf(rows[0]).map((c) => c.toLowerCase());
  const idx = header.indexOf("use");
  assert.ok(idx !== -1, "the pause table has no Use column");
  return (cellsOf(row)[idx] || "").replace(/`/g, "").trim().toLowerCase();
}

// A row for the spaced hyphen: the row says "spaced hyphen", or holds a code span of a space, a
// hyphen, and a space, or spells it out. A row whose markup cell holds "--" is the double-hyphen row.
function isSpacedHyphenRow(row) {
  if (cellsOf(row)[0].indexOf("--") !== -1) return false;
  return /spaced hyphen/i.test(row) || /`\s-\s`/.test(row) || /a space, `-`, (and )?a space/i.test(row);
}

test("elevenlabs-v2.md pause table has no row that names an em dash", () => {
  // [Scenario: ElevenLabs v2 | SDVC Requirement: Dash-style pause marks per model file | FR-211 | UR-058 | NFR-019]
  const rows = pauseSectionRows(readFile(ELEVENLABS_V2_FILE));
  const hits = rows.filter((r) => /em dash/i.test(r));
  assert.deepStrictEqual(hits, [], "the pause table still names an em dash: " + JSON.stringify(hits));
});

test("elevenlabs-v2.md pause table has a spaced-hyphen row with Use yes", () => {
  // [Scenario: ElevenLabs v2 | SDVC Requirement: Dash-style pause marks per model file | FR-211 | UR-058 | UR-040]
  const rows = pauseSectionRows(readFile(ELEVENLABS_V2_FILE));
  const spaced = rows.slice(2).filter(isSpacedHyphenRow);
  assert.ok(spaced.length >= 1, "no row for a spaced hyphen; rows: " + JSON.stringify(rows));
  assert.ok(spaced.some((r) => /^yes\b/.test(useOf(rows, r))), "the spaced-hyphen row must have Use yes: " + JSON.stringify(spaced));
});

test("elevenlabs-v2.md pause table keeps -- as a vendor fact with Use no", () => {
  // [Scenario: ElevenLabs v2 (never --) | SDVC Requirement: Dash-style pause marks per model file | FR-211 | UR-058]
  const rows = pauseSectionRows(readFile(ELEVENLABS_V2_FILE));
  const doubles = rows.slice(2).filter((r) => cellsOf(r)[0].indexOf("--") !== -1);
  assert.ok(doubles.length >= 1, "no row for --; rows: " + JSON.stringify(rows));
  assert.ok(doubles.every((r) => /^no\b/.test(useOf(rows, r))), "every -- row must have Use no: " + JSON.stringify(doubles));
});

// ---------------------------------------------------------------------------
// W2: the character rule and the whole-file check in SKILL.md
// ---------------------------------------------------------------------------

["U+2014", "U+2015", "curly quote", "whole file", "before the write"].forEach((word) => {
  test("SKILL.md holds '" + word + "' (character rule and whole-file check)", () => {
    // [Scenario: Whole-file count; Whole-file check replaces a composed em dash | SDVC Requirement: No em dash, U+2015, or curly quote in a saved voice script | FR-211 | NFR-019 | UR-058]
    assert.ok(lower(SKILL_FILE).indexOf(word.toLowerCase()) !== -1, "SKILL.md lacks '" + word + "'");
  });
});

// ---------------------------------------------------------------------------
// W3: the three note strings
// ---------------------------------------------------------------------------

const NOTE_STRINGS = [
  "Em dashes replaced: <N> (U+2014 and U+2015, draft, header, and composed text).",
  "Curly quotes straightened to ASCII quotes.",
  "Kept tell: <family id>, draft line <N>.",
];

NOTE_STRINGS.forEach((note) => {
  [
    ["SKILL.md", SKILL_FILE],
    ["references/output-template.md", TEMPLATE_FILE],
  ].forEach((pair) => {
    test(pair[0] + " holds the exact note '" + note + "'", () => {
      // [Scenarios: Draft with em dashes; Draft with curly quotes; Chatbot residue on draft line 4 | SDVC Requirement: Header notes for swaps and kept tells | FR-212 | FR-213 | UR-058]
      assert.ok(lower(pair[1]).indexOf(note.toLowerCase()) !== -1, pair[0] + " lacks the note string: " + note);
    });
  });
});

test("output-template.md holds no 'omit the section' clause, because the count note is on every script", () => {
  // [Scenario: Draft with neither; Topic script with clean header text | SDVC Requirement: Header notes for swaps and kept tells | FR-212 | UR-058]
  assert.ok(lower(TEMPLATE_FILE).indexOf("omit the section") === -1, "output-template.md still lets the Notes section be omitted");
});

test("SKILL.md says the count note is written on every saved script", () => {
  // [Scenario: Draft with neither; Topic script with clean header text | SDVC Requirement: Header notes for swaps and kept tells | FR-212 | UR-058]
  const text = lower(SKILL_FILE);
  assert.ok(text.indexOf("every saved script") !== -1, "SKILL.md lacks 'every saved script'");
  assert.ok(text.indexOf("em dashes replaced") !== -1, "SKILL.md lacks the count note");
});

// ---------------------------------------------------------------------------
// W4, W5, W6, W7: typed values, the retry, the writing-standard scope, the save path
// ---------------------------------------------------------------------------

// [contract id, phrase SKILL.md holds]. The trace of each row sits in the comment above it.
const SKILL_PHRASES = [
  // [Scenarios: Voice id with an em dash; Model id typed through Other; Clip path with a curly quote, then a clean path | SDVC Requirement: Typed values with a banned character are refused | FR-212 | UR-058 | UR-040]
  ["W4", "refuse"],
  // [Scenario: Voice id with an em dash | SDVC Requirement: Typed values with a banned character are refused | FR-212 | UR-058 | UR-040]
  ["W4", "ask for it again"],
  // [Scenario: Voice id with an em dash (the refusal names the field, not the value) | SDVC Requirement: Typed values with a banned character are refused | FR-212 | UR-058]
  ["W4", "do not repeat the value"],
  // [Scenario: Header denied by the prose gate | SDVC Requirement: One same-path retry after a header deny | FR-163 | FR-213 | UR-058]
  ["W5", "retry once on the same path"],
  // [Scenario: Header denied by the prose gate (the fix never wraps the flagged text) | SDVC Requirement: One same-path retry after a header deny | FR-163 | FR-213 | UR-058]
  ["W5", "double quotes or a code span"],
  // [Scenario: Header denied by the prose gate (same path, no new Glob or date run) | SDVC Requirement: One same-path retry after a header deny | FR-163 | UR-058]
  ["W5", "no new Glob"],
  // [Scenario: Second deny | SDVC Requirement: One same-path retry after a header deny | FR-163 | UR-058]
  ["W5", "the file was not saved"],
  // [Scenarios: Header under the standard; Script text not under the full standard | SDVC Requirement: Writing standard scope in the voice-script skill | FR-213 | FR-211 | FR-212 | UR-058]
  ["W6", "governs the header, the notes, and chat replies"],
  // [Scenario: Save folder unchanged by 1.13.1 | SDVC MODIFIED Requirement: Saved voice-script file | FR-163 | FR-213 | NFR-013 | UR-058]
  ["W7", "Path: `docs/tts/voice-<slug>-<stamp>.md` under the session's working directory"],
];

SKILL_PHRASES.forEach((row) => {
  test(row[0] + ": SKILL.md holds '" + row[1] + "'", () => {
    // Trace: the comment above this row in SKILL_PHRASES.
    assert.ok(lower(SKILL_FILE).indexOf(row[1].toLowerCase()) !== -1, "SKILL.md lacks '" + row[1] + "'");
  });
});

// ---------------------------------------------------------------------------
// Fixtures through the hook: header and notes as prose-gate judges them
// ---------------------------------------------------------------------------

const P = "/assist-test/project";
const VOICE_PATH = "docs/tts/voice-intro-20261023-0900.md";

function gateOptions() {
  return { readFile: () => null, allowlist: [], tmpdir: "/assist-test/tmp" };
}

function writeInput(content, target) {
  return {
    hook_event_name: "PreToolUse",
    tool_name: "Write",
    cwd: P,
    tool_input: { file_path: target || VOICE_PATH, content: content },
  };
}

function judged(content) {
  return gate.evaluate(writeInput(content), gateOptions());
}

function isDenied(result) {
  return result !== null && result !== undefined && result.deny === true;
}

// A saved script in the shape of the output template: title, header text, Notes list, one fenced block.
function savedScript(parts) {
  const p = Object.assign(
    {
      title: "# Voice script: Intro",
      header: "Calm and warm delivery.",
      notes: ["Em dashes replaced: 0 (U+2014 and U+2015, draft, header, and composed text)."],
      fence: "Hello there, and welcome.",
    },
    parts
  );
  return p.title + "\n\n" + p.header + "\n\n## Notes\n\n" + p.notes.map((n) => "- " + n).join("\n") + "\n\n## Script\n\n```text\n" + p.fence + "\n```\n";
}

// The notes with their placeholders filled in, as the skill writes them.
const FILLED_NOTES = [
  "Em dashes replaced: 3 (U+2014 and U+2015, draft, header, and composed text).",
  "Em dashes replaced: 0 (U+2014 and U+2015, draft, header, and composed text).",
  "Curly quotes straightened to ASCII quotes.",
  "Kept tell: chatbot-residue, draft line 4.",
  "Kept tell: summary-label, draft line 9.",
];

FILLED_NOTES.forEach((note) => {
  test("prose-gate passes the header note '" + note + "'", () => {
    // [Scenarios: Draft with em dashes; Draft with neither; Draft with curly quotes; Chatbot residue on draft line 4; Kept summary label | SDVC Requirement: Header notes for swaps and kept tells | FR-212 | FR-213 | NFR-019 | UR-058]
    const result = judged(savedScript({ notes: [note] }));
    assert.ok(!isDenied(result), "a note must pass prose-gate: " + note + " -> " + (result && result.reason));
  });
});

test("prose-gate passes a full header with the count note, the curly-quote note, and both kept-tell notes", () => {
  // [Scenario: Header under the standard | SDVC Requirement: Writing standard scope in the voice-script skill | FR-213 | FR-212 | UR-058]
  const content = savedScript({ notes: FILLED_NOTES.filter((n, i) => i !== 1) });
  assert.ok(!isDenied(judged(content)));
});

test("a header with an em dash is denied: title, delivery direction, and note text each", () => {
  // [Scenario: Em dash left in a voice script header | spec-skills.md Change Log 2026-10-23, Requirement: Prose that skills write meets the block tier | NFR-019 | FR-213 | UR-058]
  [
    savedScript({ title: "# Voice script: Intro " + EM + " part one" }),
    savedScript({ header: "Calm " + EM + " warm delivery." }),
    savedScript({ notes: ["Em dashes replaced: 1 " + EM + " done."] }),
  ].forEach((content) => {
    const result = judged(content);
    assert.ok(isDenied(result), "an em dash in the header must be denied");
    assert.ok(result.reason.indexOf("em-dash/char") !== -1, result.reason);
    assert.ok(result.reason.indexOf("assist-plugin prose-gate denied this write") === 0, result.reason);
  });
});

test("a header with a curly quote is denied: apostrophe and double quote", () => {
  // [Scenario: Header denied by the prose gate | SDVC Requirement: One same-path retry after a header deny | FR-163 | FR-213 | UR-058]
  [
    savedScript({ header: "It" + CURLY_APOSTROPHE + "s calm." }),
    savedScript({ title: "# Voice script: " + CURLY_OPEN + "Intro" }),
  ].forEach((content) => {
    const result = judged(content);
    assert.ok(isDenied(result), "a curly quote in the header must be denied");
    assert.ok(result.reason.indexOf("curly-quote/char") !== -1, result.reason);
  });
});

test("a script whose only em dash sits in the fence passes prose-gate: the skill, not the gate, controls the fence", () => {
  // [Scenario: Header passes the prose gate | SDVC Requirement: One same-path retry after a header deny | FR-163 | FR-213 | FR-105 | UR-058]
  const content = savedScript({ fence: "Pause here " + EM + " then go on." });
  assert.ok(!isDenied(judged(content)));
});

test("the fix of a denied header passes on the same path, with the flagged text rewritten and not quoted", () => {
  // [Scenario: Header denied by the prose gate | SDVC Requirement: One same-path retry after a header deny | FR-163 | FR-213 | UR-058]
  const bad = savedScript({ header: "Calm " + EM + " warm delivery." });
  assert.ok(isDenied(judged(bad)));
  const fixed = savedScript({ header: "Calm, warm delivery." });
  assert.ok(!isDenied(gate.evaluate(writeInput(fixed, VOICE_PATH), gateOptions())), "the rewritten header passes on the same path");
});

test("the save folder is unchanged: a script under docs/tts/ in the session directory is judged, not exempted", () => {
  // [Scenario: Save folder unchanged by 1.13.1 | SDVC MODIFIED Requirement: Saved voice-script file | FR-163 | FR-213 | NFR-013 | UR-058]
  const bad = savedScript({ header: "Calm " + EM + " warm delivery." });
  const target = P + "/docs/tts/voice-why-sleep-matters-20261023-1405.md";
  assert.ok(isDenied(gate.evaluate(writeInput(bad, target), gateOptions())));
});

// ---------------------------------------------------------------------------
// Frontmatter: the existing mirror test owns the comparison
// ---------------------------------------------------------------------------

test("voice-script has a metadata.json, so tests/skills/metadata-mirror.test.js compares its frontmatter", () => {
  // The frontmatter does not change in 1.13.1. This is not a second comparison.
  // [Scenario: Save folder unchanged by 1.13.1 (grant unchanged) | SDVC MODIFIED Requirement: Saved voice-script file | NFR-013 | FR-163]
  assert.ok(fs.existsSync(path.join(SKILL_DIR, "metadata.json")), "skills/voice-script/metadata.json is missing");
  assert.ok(/^---\r?\n/.test(readFile(SKILL_FILE)), "SKILL.md starts with frontmatter");
});
