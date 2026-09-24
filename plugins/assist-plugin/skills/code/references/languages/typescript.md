# TypeScript 5.x Reference

## Contents
- Mandatory Toolchain
- Required tsconfig.json Flags
- Code Style Rules
- Type System Rules
- Prohibited Patterns
- TS 5.x Preferred Features
- Required Configuration Files
- Project Structure

## Mandatory Toolchain

| Tool | Purpose | Prohibited alternatives |
|------|---------|------------------------|
| TypeScript 5.x | Language | < 4.9 |
| `tsx` or `ts-node` | Dev execution | `ts-node` without `esm` flag for ESM projects |
| `eslint` + `@typescript-eslint` | Lint | tslint (deprecated) |
| `prettier` | Format | manual formatting |
| `vitest` | Testing | jest — always use vitest for new projects |
| `npm` / `pnpm` | Package management | mixing lockfiles across tools |

## Required tsconfig.json Flags

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "bundler",
    "target": "ES2022",
    "module": "ESNext"
  }
}
```

## Code Style Rules

- Naming: `camelCase` for variables/functions, `PascalCase` for types/classes/interfaces, `UPPER_SNAKE_CASE` for constants
- Prefer `type` aliases for unions/intersections; `interface` for object shapes meant to be extended
- One export per module for primary entities; barrel files (`index.ts`) only at package boundaries
- Prefer named exports over default exports
- Arrow functions for callbacks; function declarations for top-level named functions
- No implicit `any` — every function parameter and return type is annotated unless trivially inferred
- ESLint + Prettier enforced in CI; no manual formatting overrides

## Type System Rules

- `strict: true` is non-negotiable — all strict-family flags on (see tsconfig flags above)
- Discriminated unions for state modeling: `{ status: 'loading' } | { status: 'success'; data: T } | { status: 'error'; error: string }`
- Use `unknown` for values of uncertain type; narrow with type guards before use
- Use utility types (`Partial`, `Pick`, `Omit`, `Record`) over hand-rolled equivalents
- `readonly` on properties and arrays that must not mutate after construction
- Branded/nominal types for IDs that must not be interchangeable: `type UserId = string & { readonly __brand: 'UserId' }`

## Prohibited Patterns

| Pattern | Fix |
|---------|-----|
| `any` type | Use `unknown` + narrowing |
| `as SomeType` without guard | Add runtime validation or type guard |
| `@ts-ignore` / `@ts-expect-error` without comment | Fix the type or add explanatory comment |
| Non-null assertion `!` without comment | Use optional chaining or explicit guard |
| `enum` (const or regular) | Use `const` objects + `keyof typeof` |
| `namespace` | Use ES modules |
| `console.log` | Use a structured logger with request/context binding |

## TS 5.x Preferred Features

- Stage 3 decorators (not legacy `experimentalDecorators`)
- `const` type parameters: `function identity<const T>(x: T)`
- `using` keyword for disposable resources
- `satisfies` operator for safe narrowing without widening

## Required Configuration Files

| File | Purpose | Committed? |
|------|---------|------------|
| `tsconfig.json` | Compiler options, strict flags | Yes |
| `package.json` | Dependencies, scripts | Yes |
| `package-lock.json` / `pnpm-lock.yaml` | Locked dependency graph | Yes |
| `eslint.config.js` | Lint rules (flat config) | Yes |
| `.prettierrc` | Format rules | Yes |

## Project Structure

```
src/
  index.ts               # Entry point
  config.ts              # Env loading, typed config object
  lib/                   # Shared utilities, no framework deps
  modules/
    <feature>/
      index.ts
      types.ts
      service.ts          # Business logic (no I/O framework concerns)
tests/
  <feature>.test.ts
tsconfig.json
package.json
eslint.config.js
.prettierrc
Dockerfile
```
