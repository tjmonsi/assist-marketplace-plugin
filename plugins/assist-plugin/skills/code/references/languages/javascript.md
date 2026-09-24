# JavaScript (ES2022+) Reference

## Contents
- Mandatory Toolchain
- Code Style Rules
- Type System Rules (JSDoc + Type Checking)
- Prohibited Patterns
- Modules (ESM)
- Required Configuration Files
- Project Structure

## Mandatory Toolchain

| Tool | Purpose | Prohibited alternatives |
|------|---------|------------------------|
| Node.js 20 LTS+ | Runtime | < 18 |
| `eslint` | Lint | jshint, jslint |
| `prettier` | Format | manual formatting |
| `vitest` | Testing | jest for new projects |
| `tsc --checkJs` (with JSDoc) | Type checking on plain JS | Skipping type checks entirely |
| `npm` / `pnpm` | Package management | mixing lockfiles across tools |

Gate: `eslint .` and `tsc --noEmit --checkJs` (if type-checked) must pass before commit.

## Code Style Rules

- ES6+ syntax throughout: `const`/`let` (never `var`), arrow functions, template literals, destructuring, spread/rest
- Author as ES modules (implicit strict mode); never legacy CommonJS `require`/`module.exports` for new code
- Naming: `camelCase` for variables/functions, `PascalCase` for classes, `UPPER_SNAKE_CASE` for constants
- Prefer `async`/`await` over raw Promise chains (`.then()`) for readability
- Prefer named exports; default exports only where a framework mandates them (e.g., a single React component per file)
- Immutability by default: `const` unless reassignment is required; avoid mutating function arguments
- No implicit global variables — every declaration is explicit

## Type System Rules (JSDoc + Type Checking)

JavaScript has no native static type system. Enforce types via JSDoc annotations checked by the TypeScript compiler:

- Annotate all exported functions with JSDoc `@param` / `@returns` tags
- Enable `checkJs: true` in `jsconfig.json` (or `tsconfig.json` with `allowJs`) to run TypeScript's type checker against `.js` files
- Use `@type` and `@typedef` for shape definitions instead of runtime-only conventions:

```javascript
/**
 * @typedef {Object} User
 * @property {string} id
 * @property {string} name
 */

/**
 * @param {User} user
 * @returns {string}
 */
function formatUser(user) {
  return `${user.name} (${user.id})`;
}
```

- Treat `tsc --checkJs` errors as build failures, same severity as ESLint errors
- If a file needs generics, unions, or complex narrowing regularly, migrate it to `.ts` rather than fighting JSDoc syntax

## Prohibited Patterns

| Pattern | Fix |
|---------|-----|
| `var` | Use `const`/`let` |
| `==` / `!=` | Use `===` / `!==` |
| CommonJS `require`/`module.exports` in new code | Use ESM `import`/`export` |
| Callback-style async (`fn(err, data) => ...`) | Use `async`/`await` with Promises |
| `console.log` in production code | Use a structured logger (Pino, Winston) |
| Mutating function arguments | Return new values; treat inputs as read-only |
| `eval()` / `new Function()` | Never — code injection risk |
| Untyped `.js` files with no JSDoc on exports | Add JSDoc or migrate to TypeScript |
| Global variable leakage (assigning without `const`/`let`) | Always declare explicitly |

## Modules (ESM)

- `"type": "module"` in `package.json` for Node.js ESM projects
- File extensions in relative imports are required under Node ESM: `import { x } from './utils.js'`
- Use `import.meta.url` instead of `__dirname`/`__filename` (not available in ESM)
- Top-level `await` is allowed in ESM entry points
- Dynamic `import()` for code splitting / lazy loading

## Required Configuration Files

| File | Purpose | Committed? |
|------|---------|------------|
| `package.json` | Dependencies, scripts, `"type": "module"` | Yes |
| `package-lock.json` / `pnpm-lock.yaml` | Locked dependency graph | Yes |
| `eslint.config.js` | Lint rules (flat config) | Yes |
| `.prettierrc` | Format rules | Yes |
| `jsconfig.json` (or `tsconfig.json` with `allowJs`) | Enables `checkJs` type checking | Yes, if type-checking `.js` |

## Project Structure

```
src/
  index.js               # Entry point
  config.js              # Env loading
  lib/                   # Shared utilities
  modules/
    <feature>/
      index.js
      service.js
tests/
  <feature>.test.js
package.json
eslint.config.js
.prettierrc
jsconfig.json
Dockerfile
```
