// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for the strict JSON parser (item 2, task plan step 6):
// plugins/assist-plugin/hooks/lib/strict-json.js.
//
// Sources: specs/spec-hooks-strict-json.md (Requirement 1: Reject a duplicate key at any depth;
// Requirement 2: Reject nesting deeper than 32 levels and accept depth 32; Requirement 3: The error
// carries a position and no slice of the input; Requirement 4: Valid duplicate-free JSON returns the
// JSON.parse value), docs/requirements/FR-NFR-harness-governance.md (FR-248, section 2.35; FR-249),
// docs/requirements/URD-harness-governance.md (UR-071, UR-075), docs/requirements/FR-NFR-assist-plugin.md
// (NFR-016 no-echo rule, NFR-017 Node floor). Task plan:
// docs/task-plans/task-plan-assist-pi-backport-20261120-0314.md, Steps 1 and 6.
//
// Traceability format: [AC-N | spec-hooks-strict-json R<n> | FR-nnn | UR-nnn | NFR-nnn]. The spec carries no
// SPEC-NNN id, so it is cited by file name. AC-N is the position of the Scenario inside its Requirement:
//   R1: AC-1 Duplicate key at the top level, AC-2 Duplicate key in a nested object
//   R2: AC-1 Depth over 32, AC-2 Depth at 32
//   R3: AC-1 Error holds no input
//   R4: AC-1 Valid input unchanged
// A case that goes beyond a named Scenario (a boundary the spec implies) carries the Requirement and no AC-N.
//
// Public interface used (the module contract of the task plan, Step 1):
//   parse(text) -> the value JSON.parse(text) returns, for valid duplicate-free text of depth 32 or less;
//     otherwise throws StrictJsonError
//   StrictJsonError: carries an integer `position` (a character offset into the text) and a fixed `reason`
//     code, one of "duplicate-key", "depth", "syntax"; its message holds fixed strings and the position only
//   Depth: a top-level object or array is level 1; 32 levels accept, 33 reject; objects and arrays both count.
//
// Run: node --test tests/hooks/strict-json.test.js

"use strict";

const { test } = require("node:test");
const assert = require("node:assert");
const path = require("node:path");

const REPO = path.resolve(__dirname, "..", "..");
const strictJson = require(path.join(REPO, "plugins", "assist-plugin", "hooks", "lib", "strict-json.js"));

const REASONS = ["duplicate-key", "depth", "syntax"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// n levels of nested objects, innermost value 1: {"a":{"a":...1...}}
function nestObjects(n) {
  let text = "1";
  for (let i = 0; i < n; i++) text = '{"a":' + text + "}";
  return text;
}

// n levels of nested arrays: [[[...]]]
function nestArrays(n) {
  return "[".repeat(n) + "]".repeat(n);
}

// n levels alternating array and object, innermost value 1
function nestMixed(n) {
  let text = "1";
  for (let i = 0; i < n; i++) text = i % 2 === 0 ? "[" + text + "]" : '{"k":' + text + "}";
  return text;
}

// n levels of nested objects whose innermost object (level n) holds the key "d" twice
function nestObjectsWithInnerDuplicate(n) {
  let text = '{"d":1,"d":2}';
  for (let i = 1; i < n; i++) text = '{"a":' + text + "}";
  return text;
}

function caught(fn) {
  try {
    fn();
  } catch (err) {
    return err;
  }
  return null;
}

function parseError(text) {
  const err = caught(() => strictJson.parse(text));
  assert.ok(err !== null, "expected a rejection for: " + String(text).slice(0, 60));
  return err;
}

// Everything the error exposes as text: message, String(error), stack, and every own property.
function exposedText(err) {
  const own = {};
  Object.getOwnPropertyNames(err).forEach((key) => {
    own[key] = err[key];
  });
  return [String(err.message), String(err), String(err.stack), JSON.stringify(own)].join("\n");
}

function assertStrictRejection(err, text, tokens) {
  assert.ok(err instanceof strictJson.StrictJsonError, "rejection is a StrictJsonError: " + String(err));
  assert.ok(Number.isInteger(err.position), "position is an integer: " + String(err.position));
  assert.ok(err.position >= 0 && err.position <= text.length, "position " + err.position + " lies inside the text of length " + text.length);
  assert.ok(REASONS.indexOf(err.reason) !== -1, "reason is a fixed code: " + String(err.reason));
  const shown = exposedText(err);
  (tokens || []).forEach((token) => {
    assert.ok(shown.indexOf(token) === -1, "the error exposes the input token " + token + ": " + shown);
  });
  if (text.length >= 8) {
    assert.ok(shown.indexOf(text) === -1, "the error exposes the whole input");
  }
}

function assertRejects(text, reason, tokens) {
  const err = parseError(text);
  assertStrictRejection(err, text, tokens);
  if (reason !== undefined) assert.strictEqual(err.reason, reason, "reason for " + text.slice(0, 60));
  return err;
}

function assertAcceptsLikeJsonParse(text) {
  assert.deepStrictEqual(strictJson.parse(text), JSON.parse(text), "value for " + text.slice(0, 60));
}

// ---------------------------------------------------------------------------
// Module surface
// ---------------------------------------------------------------------------

test("[spec-hooks-strict-json R1 to R4 | FR-248] the module exports parse and StrictJsonError", () => {
  assert.strictEqual(typeof strictJson.parse, "function");
  assert.strictEqual(typeof strictJson.StrictJsonError, "function");
});

// ---------------------------------------------------------------------------
// Requirement 1: a duplicate key at any depth rejects (RULE-001)
// ---------------------------------------------------------------------------

test("[AC-1 | spec-hooks-strict-json R1 | FR-248 | UR-071] a duplicate key at the top level rejects and the error carries a character position", () => {
  const text = '{"a":1,"a":2}';
  const err = assertRejects(text, "duplicate-key");
  assert.ok(Number.isInteger(err.position));
});

test("[AC-1 | spec-hooks-strict-json R1 | FR-248 | UR-071] a duplicate key rejects whatever the values are (equal values, different types, null)", () => {
  [
    '{"a":1,"a":1}',
    '{"a":1,"a":"x"}',
    '{"a":null,"a":null}',
    '{"a":{},"a":{}}',
    '{"a":[],"a":[]}',
    '{"a":1,"b":2,"a":3}',
    '{"a":1,"b":2,"c":3,"b":4}',
  ].forEach((text) => assertRejects(text, "duplicate-key"));
});

test("[AC-1 | spec-hooks-strict-json R1 | FR-248 | UR-071] a duplicate key rejects when whitespace and newlines surround the pairs", () => {
  assertRejects('  {\n  "a" : 1 ,\n\t"a" :\r\n 2\n}  ', "duplicate-key");
});

test("[AC-2 | spec-hooks-strict-json R1 | FR-248 | UR-071] a duplicate key inside an object nested at depth 5 rejects", () => {
  // Depth 5: the duplicate pair sits in the fifth nested object.
  assertRejects('{"x":{"x":{"x":{"x":{"a":1,"a":2}}}}}', "duplicate-key");
  assertRejects(nestObjectsWithInnerDuplicate(5), "duplicate-key");
});

test("[AC-2 | spec-hooks-strict-json R1 | FR-248 | UR-071] a duplicate key at depth 2, 3, 10, and 32 rejects", () => {
  [2, 3, 10, 32].forEach((depth) => {
    assertRejects(nestObjectsWithInnerDuplicate(depth), "duplicate-key");
  });
});

test("[AC-2 | spec-hooks-strict-json R1 | FR-248 | UR-071] a duplicate key inside an object held by an array rejects", () => {
  assertRejects('[{"a":1,"a":2}]', "duplicate-key");
  assertRejects('{"list":[1,2,{"inner":[{"a":1},{"b":1,"b":2}]}]}', "duplicate-key");
});

test("[AC-2 | spec-hooks-strict-json R1 | FR-248 | UR-071] a duplicate key in the middle of a wide object rejects", () => {
  const pairs = [];
  for (let i = 0; i < 3000; i++) pairs.push('"k' + i + '":' + i);
  pairs.push('"k1500":-1');
  assertRejects("{" + pairs.join(",") + "}", "duplicate-key");
});

test("[spec-hooks-strict-json R1 | FR-248 | UR-071] an escaped spelling of a key counts as the same key", () => {
  // Boundary: keys compare after decoding escapes, so "a" and "a" are one key.
  assertRejects('{"a":1,"\\u0061":2}', "duplicate-key");
  assertRejects('{"line\\n":1,"line\\u000a":2}', "duplicate-key");
  assertRejects('{"slash\\/":1,"slash/":2}', "duplicate-key");
});

test("[spec-hooks-strict-json R1 | FR-248 | UR-071] the keys __proto__, constructor, and toString repeated reject", () => {
  // Boundary: names that exist on Object.prototype are still ordinary keys.
  assertRejects('{"__proto__":1,"__proto__":2}', "duplicate-key");
  assertRejects('{"constructor":1,"constructor":2}', "duplicate-key");
  assertRejects('{"toString":1,"toString":2}', "duplicate-key");
});

test("[spec-hooks-strict-json R1 | FR-248 | UR-071] the same key in two sibling objects is not a duplicate", () => {
  // Boundary: keys are tracked per object scope.
  assertAcceptsLikeJsonParse('{"a":{"a":1},"b":{"a":2}}');
  assertAcceptsLikeJsonParse('[{"a":1},{"a":2},{"a":3}]');
  assertAcceptsLikeJsonParse('{"a":1,"nested":{"a":2,"deeper":{"a":3}}}');
});

test("[spec-hooks-strict-json R1 | FR-248 | UR-071] the same key in a parent and a child object is not a duplicate", () => {
  assertAcceptsLikeJsonParse('{"a":{"a":{"a":1}}}');
});

test("[spec-hooks-strict-json R1 | FR-248 | UR-071] keys that differ only by case or by one character are not duplicates", () => {
  assertAcceptsLikeJsonParse('{"a":1,"A":2,"a ":3,"aa":4,"":5," ":6}');
});

test("[spec-hooks-strict-json R1 | FR-248 | UR-071] names from Object.prototype used once as keys are accepted", () => {
  // Boundary: an implementation that tracked keys on a plain object would see these as already present.
  assertAcceptsLikeJsonParse('{"constructor":1,"toString":2,"hasOwnProperty":3,"valueOf":4,"isPrototypeOf":5}');
  assertAcceptsLikeJsonParse('{"__proto__":1,"b":2}');
});

test("[spec-hooks-strict-json R1 | FR-248 | UR-071] text that looks like a duplicate inside a string value is not a duplicate key", () => {
  // Boundary: object syntax inside a string is data.
  assertAcceptsLikeJsonParse('{"a":"\\"a\\":1,\\"a\\":2"}');
  assertAcceptsLikeJsonParse('{"a":"{\\"b\\":1,\\"b\\":2}","c":1}');
});

test("[spec-hooks-strict-json R1 | FR-248 | UR-071] a wide object of distinct keys is accepted", () => {
  const pairs = [];
  for (let i = 0; i < 5000; i++) pairs.push('"key' + i + '":' + i);
  assertAcceptsLikeJsonParse("{" + pairs.join(",") + "}");
});

// ---------------------------------------------------------------------------
// Requirement 2: depth 33 rejects, depth 32 accepts (RULE-002)
// ---------------------------------------------------------------------------

test("[AC-1 | spec-hooks-strict-json R2 | FR-248 | UR-075] text nested 33 levels of objects deep rejects", () => {
  assertRejects(nestObjects(33), "depth");
});

test("[AC-1 | spec-hooks-strict-json R2 | FR-248 | UR-075] text nested 33 levels of arrays deep rejects", () => {
  assertRejects(nestArrays(33), "depth");
});

test("[AC-1 | spec-hooks-strict-json R2 | FR-248 | UR-075] text nested 33 levels of mixed objects and arrays rejects", () => {
  assertRejects(nestMixed(33), "depth");
});

test("[AC-1 | spec-hooks-strict-json R2 | FR-248 | UR-075] text nested far over the limit (34, 64, 1000, 20000 levels) rejects with a StrictJsonError", () => {
  // Boundary: over the limit by one and by a lot. A very deep text must be rejected, not crash the parser.
  [34, 64, 1000, 20000].forEach((n) => {
    assertRejects(nestArrays(n), "depth");
    assertRejects(nestObjects(n), "depth");
  });
});

test("[AC-1 | spec-hooks-strict-json R2 | FR-248 | UR-075] 33 levels reject even when the deepest level sits in a later element or member", () => {
  assertRejects("[1," + nestArrays(32) + "]", "depth");
  assertRejects('{"first":1,"second":' + nestObjects(32) + "}", "depth");
});

test("[AC-2 | spec-hooks-strict-json R2 | FR-248 | UR-075] a duplicate-free text nested exactly 32 levels of objects deep is accepted", () => {
  assertAcceptsLikeJsonParse(nestObjects(32));
});

test("[AC-2 | spec-hooks-strict-json R2 | FR-248 | UR-075] a duplicate-free text nested exactly 32 levels of arrays deep is accepted", () => {
  assertAcceptsLikeJsonParse(nestArrays(32));
});

test("[AC-2 | spec-hooks-strict-json R2 | FR-248 | UR-075] a duplicate-free text nested exactly 32 levels of mixed objects and arrays is accepted", () => {
  assertAcceptsLikeJsonParse(nestMixed(32));
});

test("[AC-2 | spec-hooks-strict-json R2 | FR-248 | UR-075] depths 1, 2, 31, and 32 are accepted", () => {
  // Boundary: first level, second level, one under the limit, the limit.
  [1, 2, 31, 32].forEach((n) => {
    assertAcceptsLikeJsonParse(nestObjects(n));
    assertAcceptsLikeJsonParse(nestArrays(n));
  });
});

test("[AC-2 | spec-hooks-strict-json R2 | FR-248 | UR-075] a 32-level branch next to a shallow branch is accepted, and a 33-level branch next to a shallow branch rejects", () => {
  assertAcceptsLikeJsonParse('{"deep":' + nestArrays(31) + ',"flat":[1,2,3]}');
  assertRejects('{"deep":' + nestArrays(32) + ',"flat":[1,2,3]}', "depth");
});

test("[AC-2 | spec-hooks-strict-json R2 | FR-248 | UR-075] depth counts the deepest branch, not the sum of siblings", () => {
  // Boundary: 40 sibling arrays at level 2 stay within the limit.
  const siblings = [];
  for (let i = 0; i < 40; i++) siblings.push("[1]");
  assertAcceptsLikeJsonParse("[" + siblings.join(",") + "]");
});

test("[spec-hooks-strict-json R2 | FR-248 | UR-075] brackets inside a string value do not count as nesting", () => {
  // Boundary: a string of 100 opening brackets is data.
  assertAcceptsLikeJsonParse(JSON.stringify({ text: "[".repeat(100) + "{".repeat(100) }));
  assertAcceptsLikeJsonParse(JSON.stringify("[".repeat(500)));
});

test("[spec-hooks-strict-json R1 and R2 | FR-248 | UR-071 | UR-075] a duplicate key at depth 32 rejects, and the same text 33 deep rejects", () => {
  assertRejects(nestObjectsWithInnerDuplicate(32));
  assertRejects(nestObjectsWithInnerDuplicate(33));
});

// ---------------------------------------------------------------------------
// Requirement 3: the error holds a position and no slice of the input (RULE-003, NFR-016)
// ---------------------------------------------------------------------------

test("[AC-1 | spec-hooks-strict-json R3 | FR-248 | NFR-016] the error for a rejected text holding secret-value carries a position and none of the input", () => {
  const text = '{"secret-value":"secret-value","secret-value":"secret-value-2"}';
  const err = assertRejects(text, "duplicate-key", ["secret-value", "secret"]);
  assert.ok(Number.isInteger(err.position));
});

test("[AC-1 | spec-hooks-strict-json R3 | FR-248 | NFR-016] a duplicate key error does not echo the key name or either value", () => {
  const text = '{"api_key_ZQX":"sk-live-ZQX-111","api_key_ZQX":"sk-live-ZQX-222"}';
  assertRejects(text, "duplicate-key", ["api_key_ZQX", "sk-live-ZQX", "sk-live"]);
});

test("[AC-1 | spec-hooks-strict-json R3 | FR-248 | NFR-016] a depth error does not echo a value held in the deep text", () => {
  const text = "[".repeat(33) + '"secret-value"' + "]".repeat(33);
  assertRejects(text, "depth", ["secret-value", "secret"]);
});

test("[AC-1 | spec-hooks-strict-json R3 | FR-248 | NFR-016] a syntax error does not echo the input around the bad character", () => {
  [
    '{"secret-value": secret-value}',
    '{"secret-value":"secret-value",}',
    '["secret-value" "secret-value"]',
    'secret-value',
    '{"secret-value":"unterminated',
    '{"secret-value":1} secret-value',
  ].forEach((text) => {
    assertRejects(text, undefined, ["secret-value", "secret"]);
  });
});

test("[AC-1 | spec-hooks-strict-json R3 | FR-248 | NFR-016] a rejection of text with control characters, quotes, and escape sequences does not echo them", () => {
  const text = '{"k\\u0001\\"q":"v\\n","k\\u0001\\"q":"w"}';
  assertRejects(text, "duplicate-key", ['k\\u0001\\"q', "v\\n"]);
});

test("[AC-1 | spec-hooks-strict-json R3 | FR-248 | NFR-016] the error position is a character offset inside the text for every kind of rejection", () => {
  [
    '{"a":1,"a":2}',
    '{"x":{"x":{"a":1,"a":2}}}',
    nestArrays(33),
    "{",
    "[1,",
    '{"a":}',
    "",
  ].forEach((text) => {
    const err = parseError(text);
    assert.ok(Number.isInteger(err.position), "position for " + text.slice(0, 40));
    assert.ok(err.position >= 0 && err.position <= text.length, "position " + err.position + " for text of length " + text.length);
  });
});

test("[AC-1 | spec-hooks-strict-json R3 | FR-248 | NFR-016] the error message does not change with the secret held in the text", () => {
  // Contract: the message holds fixed strings and the position, so two inputs of the same shape and
  // different secrets give messages with no trace of either secret.
  const a = parseError('{"k":"AAAA-secret-one","k":"x"}');
  const b = parseError('{"k":"BBBB-secret-two","k":"x"}');
  [a, b].forEach((err) => {
    const shown = exposedText(err);
    ["AAAA", "BBBB", "secret-one", "secret-two"].forEach((token) => {
      assert.ok(shown.indexOf(token) === -1, "token " + token + " in " + shown);
    });
  });
});

test("[AC-1 | spec-hooks-strict-json R3 | FR-248 | NFR-016] the error exposes the reason as one of the three fixed codes", () => {
  assert.strictEqual(parseError('{"a":1,"a":2}').reason, "duplicate-key");
  assert.strictEqual(parseError(nestArrays(33)).reason, "depth");
  assert.strictEqual(parseError("{").reason, "syntax");
});

// ---------------------------------------------------------------------------
// Requirement 4: valid duplicate-free JSON returns the JSON.parse value
// ---------------------------------------------------------------------------

test("[AC-1 | spec-hooks-strict-json R4 | FR-248 | UR-071] valid duplicate-free JSON of depth 32 or less deep-equals the JSON.parse result", () => {
  [
    "{}",
    "[]",
    '{"a":1}',
    '{"a":1,"b":[1,2,3],"c":{"d":null,"e":true,"f":false}}',
    '[1,"two",3.5,null,true,false,{"k":"v"},[[]]]',
    '{"nested":{"list":[{"id":1,"tags":["x","y"]},{"id":2,"tags":[]}]}}',
    "  \n\t{ \"a\" : [ 1 , 2 ] }  \r\n",
  ].forEach(assertAcceptsLikeJsonParse);
});

test("[AC-1 | spec-hooks-strict-json R4 | FR-248 | UR-071] scalar top-level values equal the JSON.parse result", () => {
  ["0", "-0", "1", "-1.5", "1e3", "-2.5E-3", "123456789012345678901234567890", '"text"', '""', "true", "false", "null"].forEach(
    assertAcceptsLikeJsonParse
  );
});

test("[AC-1 | spec-hooks-strict-json R4 | FR-248 | UR-071] strings with escapes and non-ASCII characters equal the JSON.parse result", () => {
  [
    '{"s":"line\\nbreak\\ttab\\"quote\\\\slash\\/solidus"}',
    '{"s":"\\u0041\\u00e9\\u4e2d\\ud83d\\ude00"}',
    '{"s":"café 中文 😀"}',
    '{"\\u0061b":1}',
    '["\\u0000"]',
  ].forEach(assertAcceptsLikeJsonParse);
});

test("[AC-1 | spec-hooks-strict-json R4 | FR-248 | UR-071] the returned value is a fresh structure of plain data, not the text", () => {
  const value = strictJson.parse('{"a":[1,{"b":2}]}');
  assert.deepStrictEqual(value, { a: [1, { b: 2 }] });
  assert.ok(Array.isArray(value.a));
  assert.strictEqual(Object.getPrototypeOf(value), Object.prototype);
});

test("[AC-1 | spec-hooks-strict-json R4 | FR-248 | UR-071] a large duplicate-free text equals the JSON.parse result", () => {
  const items = [];
  for (let i = 0; i < 20000; i++) items.push({ id: i, name: "item-" + i, tags: ["a", "b"], meta: { ok: true } });
  assertAcceptsLikeJsonParse(JSON.stringify(items));
});

test("[AC-1 | spec-hooks-strict-json R4 | FR-248 | UR-071] a text that serialises a real object round-trips to the same value", () => {
  const original = { rules: { "sql-from-input": "blocking", other: "advisory" }, version: 2, list: [1, [2, [3]]] };
  assert.deepStrictEqual(strictJson.parse(JSON.stringify(original)), original);
  assert.deepStrictEqual(strictJson.parse(JSON.stringify(original, null, 2)), original);
});

// ---------------------------------------------------------------------------
// Malformed text that JSON.parse also rejects (spec Error handling, third row)
// ---------------------------------------------------------------------------

[
  ["an empty string", ""],
  ["only whitespace", "   \n"],
  ["an unclosed object", "{"],
  ["an unclosed array", "[1,2"],
  ["a trailing comma in an object", '{"a":1,}'],
  ["a trailing comma in an array", "[1,2,]"],
  ["a missing colon", '{"a" 1}'],
  ["a missing value", '{"a":}'],
  ["single-quoted strings", "{'a':1}"],
  ["an unquoted key", "{a:1}"],
  ["a bare word", "nope"],
  ["text after the value", '{"a":1} extra'],
  ["two top-level values", "{}{}"],
  ["a leading zero", "01"],
  ["an unterminated string", '"abc'],
  ["a bad escape", '"\\q"'],
  ["a raw newline in a string", '"a\nb"'],
  ["a comment", '{"a":1} // note'],
  ["NaN", "NaN"],
  ["undefined", "undefined"],
].forEach((row) => {
  test("[spec-hooks-strict-json R4 | FR-248 | NFR-016] malformed text that JSON.parse rejects (" + row[0] + ") rejects with a StrictJsonError and a position", () => {
    assert.throws(() => JSON.parse(row[1]), "set-up: JSON.parse rejects this text");
    assertRejects(row[1]);
  });
});

test("[spec-hooks-strict-json R4 | FR-248] a malformed text is rejected, not partly parsed: a duplicate-free prefix does not leak out", () => {
  const err = caught(() => strictJson.parse('{"a":1,"b":'));
  assert.ok(err instanceof strictJson.StrictJsonError);
});

// ---------------------------------------------------------------------------
// Repeatability
// ---------------------------------------------------------------------------

test("[spec-hooks-strict-json R1 to R4 | FR-248] the parser keeps no state between calls: a rejection does not change the next result", () => {
  assertRejects('{"a":1,"a":2}', "duplicate-key");
  assertAcceptsLikeJsonParse('{"a":1}');
  assertRejects(nestArrays(33), "depth");
  assertAcceptsLikeJsonParse(nestArrays(32));
  assertRejects('{"a":1,"a":2}', "duplicate-key");
  assertAcceptsLikeJsonParse('{"a":2}');
});
