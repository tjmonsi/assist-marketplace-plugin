---
max_turns: 10
timeout_seconds: 300
allowed_tools: [Read, Glob, Grep, Write, Edit, Bash]
runs: 1
---

Create a file named `slugify.js` in the current working directory. It must export one function, `slugify(text)`, with `module.exports = { slugify }`. The function turns a piece of text into a URL slug.

Behavior:

1. Lowercase the whole text first.
2. Keep only the ASCII letters `a` to `z` and the digits `0` to `9`.
3. Replace each run of one or more other characters (spaces, punctuation, symbols, underscores, and any non-ASCII character, accented letters included) with a single hyphen `-`. Do not transliterate: `cafe` and `café` do not produce the same slug.
4. Remove any hyphen at the start or at the end of the result.
5. Return an empty string `""` when nothing is left, including for an empty input or an input with no letters or digits.
6. Throw a `TypeError` when `text` is not a string (`undefined`, `null`, a number, an object, an array, and so on). Do not convert it to a string.

Examples:

- `slugify("Hello, World!")` returns `"hello-world"`
- `slugify("  Release 2.0  ")` returns `"release-2-0"`
- `slugify("--A__B--")` returns `"a-b"`
- `slugify("***")` returns `""`

Constraints: the function is pure. It does no file or network access, reads no clock, and uses no randomness, so the same input always gives the same output. Use no third-party packages. Plain Node.js, any current version.

When you finish, state in one sentence which file you created.
