// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// Structural grader for spec tasks in the evaluation benchmark harness (Group A). The structural score is the fraction of
// the deterministic checklist items that pass. It makes no model call and reads no clock and no random source, so ten
// scorings of one output give ten equal scores (NFR-037).
//
// Checklist items come from the task's rubric.json, "deterministic" group (key names are a plan choice, ASM-5):
//   { "id": "req-has-scenario", "source": "spec-from-requirements:completeness", "check": "every-requirement-has-scenario" }
// Every item declares a source: a `spec-from-requirements` review check (SKILL.md:140-149) or a `gather-requirements`
// quality criterion (SKILL.md:99-101). An item with no known source, an unknown check, or a missing parameter is
// rejected. Only mechanically checkable parts of those checks have a built-in check. Style and the judgment criteria stay
// with the judge rubric, so "spec-from-requirements:style" is not a known source (the user confirms the split, Step 7).
//
// Reference coverage uses a DECLARED item list in the rubric metadata (ASM-8), with no inference from the reference:
//   "referenceItems": [
//     { "id": "FR-3", "kind": "requirement" },
//     { "id": "FR-3-error", "kind": "error-path", "requirement": "FR-3", "match": "text the output holds for that path" }
//   ]
// An item of kind "requirement" matches its id as a whole token. Kind "scenario" and "error-path" need a `match` text,
// compared without regard to case or white space. A failed item names its `requirement` (or its id). The optional `source`
// of a reference item defaults to "gather-requirements:complete". Each declared item must also appear in the reference;
// one that does not reads error, so a stale declared list is never scored as a failing output.
//
// Result: { status: "scored" | "error", score, passed, total, cleared, items, failedNames, reason }.
// "error" means the reference or output is unreadable, the rubric is invalid, or the checklist is empty; the score is then
// null and never 0. `cleared` is true when every item passed, which is the gate the judge reads (A-13).
// No dependencies; ES2015 syntax only.
"use strict";

const fs = require("fs");

const oracleModule = require("./oracle.js");

const STATUS_SCORED = "scored";
const STATUS_ERROR = "error";

const MAX_TEXT_BYTES = 4 * 1024 * 1024;
const MAX_JSON_BYTES = 1024 * 1024;
const DOCUMENT_FILE = /\.md$/i;

// [FR-266] The known sources. The first group is the `spec-from-requirements` review checks that hold a mechanical part
// (Completeness, Correctness, Coherence); the second is the `gather-requirements` quality criteria.
const REVIEW_CHECKS = ["completeness", "correctness", "coherence"];
const QUALITY_CRITERIA = ["necessary", "unambiguous", "testable", "feasible", "complete", "consistent", "singular", "implementation-free", "traceable"];
const KNOWN_SOURCES = REVIEW_CHECKS.map((name) => "spec-from-requirements:" + name).concat(QUALITY_CRITERIA.map((name) => "gather-requirements:" + name));
const REFERENCE_ITEM_SOURCE = "gather-requirements:complete";

const REFERENCE_KINDS = ["requirement", "scenario", "error-path"];
const RFC2119_KEYWORD = /\b(?:SHALL NOT|MUST NOT|SHOULD NOT|SHALL|MUST|SHOULD|MAY|REQUIRED|RECOMMENDED|OPTIONAL)\b/g;
const REQUIREMENT_REF = /\b(?:NFR|FR|BR|UR|SC)-\d+\b/g;
const TOKEN_BEFORE = /[A-Za-z0-9_-]/;
const TOKEN_AFTER = /[A-Za-z0-9_]/;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function failed(reason) {
  return { status: STATUS_ERROR, score: null, passed: null, total: null, cleared: false, items: [], failedNames: [], reason };
}

// ---------------------------------------------------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------------------------------------------------

function readFileText(file) {
  try {
    if (fs.statSync(file).size > MAX_TEXT_BYTES) {
      return null;
    }
    return fs.readFileSync(file, "utf8");
  } catch (error) {
    return null;
  }
}

// Reads one markdown file, or every markdown file under a directory in sorted path order, so the text is the same on
// every read. Returns { ok: true, text } or { ok: false }. A symbolic link is not followed.
function readDocument(target) {
  let stat;
  try {
    stat = fs.statSync(target);
  } catch (error) {
    return { ok: false };
  }
  if (stat.isFile()) {
    const text = readFileText(target);
    return text === null ? { ok: false } : { ok: true, text };
  }
  if (!stat.isDirectory()) {
    return { ok: false };
  }
  const listing = oracleModule.listFiles(target);
  if (!listing.ok) {
    return { ok: false };
  }
  const parts = [];
  for (let index = 0; index < listing.files.length; index += 1) {
    const file = listing.files[index];
    if (file.symlink || !DOCUMENT_FILE.test(file.relative)) {
      continue;
    }
    const text = readFileText(file.absolute);
    if (text === null) {
      return { ok: false };
    }
    parts.push(text);
  }
  return parts.length === 0 ? { ok: false } : { ok: true, text: parts.join("\n\n") };
}

function readRubric(request) {
  if (isObject(request.rubric)) {
    return { ok: true, rubric: request.rubric };
  }
  if (typeof request.rubricPath !== "string") {
    return { ok: false };
  }
  try {
    if (fs.statSync(request.rubricPath).size > MAX_JSON_BYTES) {
      return { ok: false };
    }
    const value = JSON.parse(fs.readFileSync(request.rubricPath, "utf8"));
    return isObject(value) ? { ok: true, rubric: value } : { ok: false };
  } catch (error) {
    return { ok: false };
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Markdown structure (outside fenced code blocks)
// ---------------------------------------------------------------------------------------------------------------------

// Reads headings, requirement blocks with their scenarios, and the prose text. Requirement blocks follow the
// `### Requirement:` and `#### Scenario:` form of spec-from-requirements and gather-requirements.
function parseDocument(text) {
  const headings = [];
  const requirements = [];
  const prose = [];
  let requirement = null;
  let scenario = null;
  let inFence = false;
  text.split(/\r?\n/).forEach((line) => {
    if (/^\s*(?:```|~~~)/.test(line)) {
      inFence = !inFence;
      return;
    }
    if (inFence) {
      return;
    }
    prose.push(line);
    const heading = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const title = heading[2];
      headings.push(title);
      const asRequirement = /^Requirement:\s*(.*)$/i.exec(title);
      const asScenario = /^Scenario:\s*(.*)$/i.exec(title);
      if (level === 3 && asRequirement) {
        requirement = { title: asRequirement[1].trim(), statement: [], scenarios: [], afterStatement: false };
        requirements.push(requirement);
        scenario = null;
      } else if (requirement && (level === 4 || level === 5) && asScenario) {
        scenario = { title: asScenario[1].trim(), lines: [] };
        requirement.scenarios.push(scenario);
        requirement.afterStatement = true;
      } else if (level <= 3) {
        requirement = null;
        scenario = null;
      } else if (requirement) {
        scenario = null;
        requirement.afterStatement = true;
      }
      return;
    }
    if (scenario) {
      scenario.lines.push(line);
    } else if (requirement && !requirement.afterStatement) {
      requirement.statement.push(line);
    }
  });
  return {
    headings,
    requirements: requirements.map((entry) => ({
      title: entry.title,
      statement: entry.statement.join("\n").trim(),
      scenarios: entry.scenarios.map((item) => ({ title: item.title, body: item.lines.join("\n") })),
    })),
    prose: prose.join("\n"),
  };
}

function label(requirement) {
  return requirement.title === "" ? "(untitled requirement)" : requirement.title;
}

function keywordCount(statement) {
  const matches = statement.match(RFC2119_KEYWORD);
  return matches === null ? 0 : matches.length;
}

// ---------------------------------------------------------------------------------------------------------------------
// Built-in checks. Each takes the parsed document and the checklist item, and returns { passed, names }.
// ---------------------------------------------------------------------------------------------------------------------

function normalizeHeading(value) {
  return value.trim().replace(/:$/, "").replace(/\s+/g, " ").toLowerCase();
}

const CHECKS = {
  // [FR-266] spec-from-requirements review, Completeness: every Requirement has at least one Scenario.
  "every-requirement-has-scenario": {
    run(doc) {
      const names = doc.requirements.filter((requirement) => requirement.scenarios.length === 0).map(label);
      return { passed: doc.requirements.length > 0 && names.length === 0, names: doc.requirements.length === 0 ? ["(no requirement found)"] : names };
    },
  },
  // [FR-266] gather-requirements, Testable: every Scenario holds GIVEN, WHEN, and THEN.
  "scenario-has-given-when-then": {
    run(doc) {
      const names = [];
      let count = 0;
      doc.requirements.forEach((requirement) => {
        requirement.scenarios.forEach((scenario) => {
          count += 1;
          if (!/\bGIVEN\b/.test(scenario.body) || !/\bWHEN\b/.test(scenario.body) || !/\bTHEN\b/.test(scenario.body)) {
            names.push(scenario.title === "" ? "(untitled scenario)" : scenario.title);
          }
        });
      });
      return { passed: count > 0 && names.length === 0, names: count === 0 ? ["(no scenario found)"] : names };
    },
  },
  // [FR-266] spec-from-requirements review, Correctness: RFC 2119 keywords are present.
  "rfc2119-present": {
    run(doc) {
      const names = doc.requirements.filter((requirement) => keywordCount(requirement.statement) === 0).map(label);
      return { passed: doc.requirements.length > 0 && names.length === 0, names: doc.requirements.length === 0 ? ["(no requirement found)"] : names };
    },
  },
  // [FR-266] spec-from-requirements review, Correctness: RFC 2119 keywords are singular.
  "rfc2119-singular": {
    run(doc) {
      const names = doc.requirements.filter((requirement) => keywordCount(requirement.statement) !== 1).map(label);
      return { passed: doc.requirements.length > 0 && names.length === 0, names: doc.requirements.length === 0 ? ["(no requirement found)"] : names };
    },
  },
  // [FR-266] spec-from-requirements review, Completeness: every declared template section is present as a heading.
  "sections-present": {
    params: ["sections"],
    run(doc, item) {
      const present = doc.headings.map(normalizeHeading);
      const names = item.sections.filter((section) => present.indexOf(normalizeHeading(section)) === -1);
      return { passed: names.length === 0, names };
    },
  },
  // [FR-266] spec-from-requirements review, Correctness: requirement references point at IDs that exist (declared list).
  "refs-resolve": {
    params: ["knownIds"],
    run(doc, item) {
      const found = doc.prose.match(REQUIREMENT_REF) || [];
      const names = [];
      found.forEach((id) => {
        if (item.knownIds.indexOf(id) === -1 && names.indexOf(id) === -1) {
          names.push(id);
        }
      });
      return { passed: names.length === 0, names };
    },
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// Reference coverage (ASM-8)
// ---------------------------------------------------------------------------------------------------------------------

function normalizeText(value) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

// True when `token` appears in `text` as a whole token, so "FR-3" does not match inside "FR-30" or "FR-3-1".
function containsToken(text, token) {
  const haystack = text.toLowerCase();
  const needle = token.toLowerCase();
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) {
      return false;
    }
    const before = at === 0 ? "" : haystack.charAt(at - 1);
    const after = haystack.charAt(at + needle.length);
    const afterIsDigitSuffix = after === "-" && /\d/.test(haystack.charAt(at + needle.length + 1));
    if (!TOKEN_BEFORE.test(before) && !TOKEN_AFTER.test(after) && !afterIsDigitSuffix) {
      return true;
    }
    from = at + 1;
  }
}

function referenceItemHolds(text, item) {
  if (item.kind === "requirement") {
    return containsToken(text, isNonEmptyString(item.match) ? item.match : item.id);
  }
  return normalizeText(text).indexOf(normalizeText(item.match)) !== -1;
}

function referenceItemName(item) {
  return isNonEmptyString(item.requirement) ? item.requirement : item.id;
}

// ---------------------------------------------------------------------------------------------------------------------
// Checklist validation
// ---------------------------------------------------------------------------------------------------------------------

function itemProblem(item, message) {
  const id = isObject(item) && isNonEmptyString(item.id) ? item.id : "(no id)";
  return { item: id, message };
}

function sourceProblem(item) {
  if (!isNonEmptyString(item.source)) {
    return itemProblem(item, "checklist item declares no source");
  }
  if (KNOWN_SOURCES.indexOf(item.source) === -1) {
    return itemProblem(item, "checklist item source is not a spec-from-requirements review check or a gather-requirements quality criterion: " + item.source);
  }
  return null;
}

// [FR-266] validateChecklist(rubric) rejects an item with no known source, an unknown check, a missing parameter, or a
// duplicate id. Returns { ok, problems: [{ item, message }] }.
function validateChecklist(rubric) {
  const problems = [];
  if (!isObject(rubric) || !Array.isArray(rubric.deterministic)) {
    return { ok: false, problems: [{ item: "(rubric)", message: "rubric has no deterministic group" }] };
  }
  const seen = [];
  function track(item) {
    if (isObject(item) && isNonEmptyString(item.id)) {
      if (seen.indexOf(item.id) !== -1) {
        problems.push(itemProblem(item, "checklist item id is used twice"));
      }
      seen.push(item.id);
    }
  }
  rubric.deterministic.forEach((item) => {
    if (!isObject(item) || !isNonEmptyString(item.id)) {
      problems.push(itemProblem(item, "checklist item needs an id"));
      return;
    }
    track(item);
    const bad = sourceProblem(item);
    if (bad) {
      problems.push(bad);
    }
    const check = Object.prototype.hasOwnProperty.call(CHECKS, item.check) ? CHECKS[item.check] : null;
    if (check === null) {
      problems.push(itemProblem(item, "checklist item names no known check"));
      return;
    }
    (check.params || []).forEach((param) => {
      if (!Array.isArray(item[param]) || item[param].length === 0 || !item[param].every(isNonEmptyString)) {
        problems.push(itemProblem(item, "checklist item needs a non-empty list of strings in " + param));
      }
    });
  });
  const declared = rubric.referenceItems === undefined ? [] : rubric.referenceItems;
  if (!Array.isArray(declared)) {
    problems.push({ item: "(rubric)", message: "referenceItems must be a list" });
  } else {
    declared.forEach((item) => {
      if (!isObject(item) || !isNonEmptyString(item.id)) {
        problems.push(itemProblem(item, "reference item needs an id"));
        return;
      }
      track(item);
      if (REFERENCE_KINDS.indexOf(item.kind) === -1) {
        problems.push(itemProblem(item, "reference item kind must be requirement, scenario, or error-path"));
      }
      if (item.kind !== "requirement" && !isNonEmptyString(item.match)) {
        problems.push(itemProblem(item, "reference item of this kind needs a match text"));
      }
      if (item.source !== undefined) {
        const bad = sourceProblem(item);
        if (bad) {
          problems.push(bad);
        }
      }
    });
  }
  return { ok: problems.length === 0, problems };
}

// ---------------------------------------------------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------------------------------------------------

function unique(values) {
  const out = [];
  values.forEach((value) => {
    if (out.indexOf(value) === -1) {
      out.push(value);
    }
  });
  return out;
}

// [FR-265|FR-266|FR-267|NFR-037] scoreSpecRun(request) scores one spec output against the deterministic checklist.
//   request.outputPath | request.outputText       the spec output (a file, a directory of .md files, or text)
//   request.referencePath | request.referenceText the reference requirements set or reference spec
//   request.rubric | request.rubricPath           the task rubric (deterministic group and referenceItems)
function scoreSpecRun(request) {
  const settings = request || {};
  const loaded = readRubric(settings);
  if (!loaded.ok) {
    return failed("rubric could not be read");
  }
  const validation = validateChecklist(loaded.rubric);
  if (!validation.ok) {
    return failed("checklist is not valid: " + validation.problems[0].item + ": " + validation.problems[0].message);
  }
  const referenceItems = Array.isArray(loaded.rubric.referenceItems) ? loaded.rubric.referenceItems : [];
  if (loaded.rubric.deterministic.length + referenceItems.length === 0) {
    return failed("checklist holds no deterministic item");
  }

  // [FR-265] An unreadable reference or output means the checklist cannot run: the run reads error, never a score of 0.
  const reference = typeof settings.referenceText === "string" ? { ok: true, text: settings.referenceText } : readDocument(settings.referencePath);
  if (!reference.ok) {
    return failed("reference could not be read");
  }
  const output = typeof settings.outputText === "string" ? { ok: true, text: settings.outputText } : readDocument(settings.outputPath);
  if (!output.ok) {
    return failed("output could not be read");
  }

  // [FR-267] A declared reference item that the reference itself does not hold is a stale rubric, not a failing output.
  const stale = referenceItems.filter((item) => !referenceItemHolds(reference.text, item)).map((item) => item.id);
  if (stale.length > 0) {
    return failed("rubric declares reference items the reference does not hold: " + stale.join(", "));
  }

  const doc = parseDocument(output.text);
  const items = [];
  loaded.rubric.deterministic.forEach((item) => {
    const result = CHECKS[item.check].run(doc, item);
    items.push({ id: item.id, source: item.source, check: item.check, passed: result.passed, names: result.passed ? [] : result.names });
  });
  referenceItems.forEach((item) => {
    const passed = referenceItemHolds(output.text, item);
    items.push({
      id: item.id,
      source: isNonEmptyString(item.source) ? item.source : REFERENCE_ITEM_SOURCE,
      check: "reference-" + item.kind,
      passed,
      names: passed ? [] : [referenceItemName(item)],
    });
  });

  const passedCount = items.filter((item) => item.passed).length;
  return {
    status: STATUS_SCORED,
    score: passedCount / items.length,
    passed: passedCount,
    total: items.length,
    cleared: passedCount === items.length,
    items,
    failedNames: unique(items.filter((item) => !item.passed).reduce((all, item) => all.concat(item.names), [])),
    reason: null,
  };
}

module.exports = {
  scoreSpecRun,
  validateChecklist,
  parseDocument,
  KNOWN_SOURCES,
  CHECK_NAMES: Object.keys(CHECKS),
  STATUS_SCORED,
  STATUS_ERROR,
};
