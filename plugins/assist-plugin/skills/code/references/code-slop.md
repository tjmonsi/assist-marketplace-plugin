# Code Slop

Generated code has recognizable tells. Each one adds lines a reader must parse without adding behavior, or hides evidence the compiler, the tests, or the next engineer needs. This catalog applies to every language; the examples are short and invented.

Fix the tell; do not suppress it. A lint disable, a broader type, or a skipped test moves the problem somewhere harder to see.

## Comments That Narrate the Next Line

**Why it hurts:** The comment repeats what the code already says, doubles the reading cost, and drifts out of date the first time the code changes.

**Spot it:** Delete the comment and ask whether the reader lost anything. Phrases like "Initialize the", "Loop through", "Check if", "Return the result" are strong signals.

```ts
// Loop through users and add active ones to the list
for (const user of users) {
  if (user.active) active.push(user);
}
```

**Fix:** Delete it. Keep comments that explain why: a constraint, a workaround, a non-obvious invariant, a requirement ID.

```ts
// Billing treats suspended users as active until the period ends.
const billable = users.filter((u) => u.active || u.suspendedUntil > periodEnd);
```

## Docstrings That Restate the Name

**Why it hurts:** `getUserById` documented as "Gets a user by ID" costs space and teaches nothing. It also signals that the real contract (what happens when the user is missing, what it throws) went unwritten.

**Spot it:** The docstring's first sentence is the function name with spaces added. Parameter docs repeat the parameter name and type.

```python
def get_user(user_id: str) -> User:
    """Get the user.

    Args:
        user_id: The user ID.
    Returns:
        The user.
    """
```

**Fix:** Document what the signature cannot say (failure behavior, units, side effects), or drop the docstring.

```python
def get_user(user_id: str) -> User:
    """Raises UserNotFound if the ID is unknown. Reads through the cache."""
```

## Swallowed or Blanket-Caught Errors

**Why it hurts:** The failure still happens; nobody learns about it. The caller receives a default value that looks like success, and the bug surfaces later, far from its cause.

**Spot it:** Empty catch blocks, `catch (e) { return null }`, `except Exception: pass`, `_ = err` in Go, `.unwrap_or_default()` on a fallible I/O call, a catch that logs and continues inside business logic.

```ts
try {
  return JSON.parse(raw) as Config;
} catch {
  return {} as Config;
}
```

**Fix:** Catch only the errors you can handle, at the boundary that can handle them, and follow [error-handling-standards.md](error-handling-standards.md). Otherwise let the error propagate or wrap it with context.

```ts
try {
  return parseConfig(JSON.parse(raw));
} catch (err) {
  throw new ConfigError(`invalid config at ${path}`, { cause: err });
}
```

## Speculative Parameters, Options, and Config

**Why it hurts:** Every option is a branch to test and a decision for every caller. Options nobody passes are untested code paths that still have to be read and kept working.

**Spot it:** Parameters with defaults that no call site overrides; `options` objects with one used field; config keys never read; flags named `enableX` that are always true.

```ts
function sendEmail(to: string, body: string, opts: { retries?: number; priority?: 'low' | 'high'; trackOpens?: boolean } = {}) { ... }
// every call site: sendEmail(to, body)
```

**Fix:** Remove what no caller uses. Add the option when the first caller needs it.

## Premature Abstraction

**Why it hurts:** An interface with one implementation, a factory that builds one type, or a strategy registry with one strategy adds indirection the reader must follow to find the real code, and it guesses at a future shape that is usually wrong.

**Spot it:** `IFooService` plus `FooServiceImpl` and nothing else; `createParser()` that always returns `new JsonParser()`; a base class with one subclass; a generic type parameter that is always the same type.

**Fix:** Use the concrete type. Extract the abstraction when the second implementation arrives (a test double counts only if the test actually needs it).

## Unexplained Type Escapes

**Why it hurts:** The type system is evidence about what the code accepts and returns. An escape hatch discards that evidence, so the compiler stops catching the bugs it exists to catch, and every caller inherits the gap.

**Spot it:**

- `any`, explicit or implicit
- `as` assertions without a guard, and chains like `x as unknown as Foo`
- `unknown` parameters or return types on functions inside the codebase
- `Record<string, unknown>` (or `dict[str, Any]`, `map[string]interface{}`) passed through layers instead of a defined shape
- `# type: ignore`, `@ts-ignore`, `@ts-expect-error`, `//nolint`, `#[allow(...)]`, `@Suppress` without a reason on the same line
- Non-null assertions (`!`, `!!`) without a comment naming the invariant

```ts
function applyDiscount(order: unknown, rules: Record<string, unknown>): unknown {
  const o = order as any;
  return { ...o, total: o.total * (rules.rate as number) };
}
```

**Fix:** Use concrete types inside the codebase. `unknown` belongs only at trust boundaries (parsed JSON, catch clauses, external input) and is narrowed or validated immediately into a concrete type. `Record<K, V>` with a concrete `V` is fine. Every remaining suppression carries a comment stating why it is safe.

```ts
function applyDiscount(order: Order, rules: DiscountRules): Order {
  return { ...order, total: order.total * rules.rate };
}
```

## Defensive Checks for Impossible States

**Why it hurts:** A null check on a value the type already guarantees, or a branch for a state the code cannot reach, tells the reader that the state is possible. They then search for how, find nothing, and trust the types less.

**Spot it:** `if (!user) return` right after `const user = new User()`; `if (items && items.length)` on a non-optional array; a `default` branch on an exhaustive union that returns a fallback instead of failing; `try` around code that cannot throw.

**Fix:** Delete the check and rely on the type. Where exhaustiveness matters, make the unreachable branch fail loudly (`assertNever(x)`, `unreachable!()`), so a new case is a compile or runtime error instead of a silent fallback.

## Runtime Type Checks That Re-Prove the Types

**Why it hurts:** A `typeof` or `isinstance` check on a value whose static type already guarantees the answer adds a branch that never runs. It suggests the types are untrustworthy, and the dead branch usually returns a made-up fallback.

**Spot it:** `typeof count === 'number'` on a `count: number` parameter; `isinstance(name, str)` on a `name: str` argument in fully typed code; `Array.isArray(items)` on `items: Item[]`; a schema validation repeated on data that was already validated at the boundary.

```ts
function total(prices: number[]): number {
  if (!Array.isArray(prices)) return 0;
  return prices.reduce((sum, p) => (typeof p === 'number' ? sum + p : sum), 0);
}
```

**Fix:** Validate once, at the trust boundary where untyped data enters, and pass the typed result inward. Inside the codebase, trust the signature.

```ts
function total(prices: number[]): number {
  return prices.reduce((sum, p) => sum + p, 0);
}
```

## Module-Wide Mocks in Tests

**Why it hurts:** Mocking an entire module (`jest.mock('./db')`, `vi.mock`, `patch('app.service')` at module scope) replaces every export, including ones the test never meant to touch. The test then verifies the mock's shape, and refactors that keep behavior identical still break it.

**Spot it:** A module mock at the top of a test file with many unrelated cases; mocks of the module under test's own internals; mock setup longer than the assertions.

**Fix:** Inject the dependency and pass a narrow fake for the one collaborator that crosses a boundary (network, clock, filesystem). Test pure logic directly with no mocks.

## Hollow Tests

**Why it hurts:** A test that cannot fail gives coverage numbers and no protection. It also blocks the next engineer, who assumes the behavior is tested.

**Spot it:**

- No assertion, or only `expect(result).toBeDefined()` / `assert result is not None`
- Asserts only that a mock was called, never what the code produced
- Asserts the value it just stubbed (`mock.returns(5); expect(fn()).toBe(5)` where `fn` returns the mock unchanged)
- Wraps the call in `try/catch` that also swallows the assertion failure
- Snapshot of a huge object nobody reviews

**Fix:** Assert the observable outcome: the return value, the persisted state, the emitted event, the error raised. Check that the test fails when you break the code under test.

## Skipped or Commented-Out Failing Tests

**Why it hurts:** A failing test is a report that behavior changed. Skipping it turns the suite green while the regression ships, and the skip tends to outlive everyone who remembers why it was added.

**Spot it:** New `it.skip`, `xit`, `test.todo`, `@pytest.mark.skip`, `@Disabled`, `#[ignore]`, `t.Skip()`; a test body commented out; an assertion loosened (`toEqual` to `toBeTruthy`) or an expected value edited to match new output without explaining why the old value was wrong.

**Fix:** Fix the code, or fix the test if the old expectation was wrong and say why in the change. If a skip is unavoidable, mark it with a ticket and the condition for re-enabling it, and call it out to the reviewer.

## Dead Code and TODO Litter

**Why it hurts:** Unused functions, commented-out blocks, and unowned TODOs look like live intent. Readers maintain them, search through them, and wonder whether they matter.

**Spot it:** Exports with no importers; commented-out code; `if (false)`; `// TODO: handle this` with no owner, ticket, or condition; `_unused` variables kept to silence a linter.

**Fix:** Delete dead code (version control remembers it). Turn each TODO into a ticket, or keep it only with an owner and a concrete trigger.

## Logging Noise

**Why it hurts:** Logs at every function entry and exit bury the line that explains an incident, raise storage cost, and often leak data. See [logging-standards.md](logging-standards.md).

**Spot it:** `logger.info('Entering processOrder')`; logging a value then returning it; the same error logged at every layer it passes through; `console.log` left from debugging; info-level logs inside hot loops.

**Fix:** Log state changes, decisions, and failures once, at the layer that handles them, with structured context. Drop the rest.

## Copy-Paste Near-Duplicates

**Why it hurts:** Two blocks that differ by one field drift apart: a bug fixed in one stays in the other. The reader also has to diff them by eye to find the real difference.

**Spot it:** Adjacent functions with the same structure and one changed constant; repeated validation blocks per field; parallel `if` ladders.

**Fix:** Extract the shared shape once the duplication is real (three copies, or two that must stay in sync), and pass the difference as data. Two similar blocks that change for different reasons can stay separate.

## Drive-By Edits to Untouched Code

**Why it hurts:** New comments, type annotations, docstrings, renames, or reformatting on lines the change did not otherwise need bury the real change in the diff, make review slower, and cause merge conflicts for everyone else working in the file.

**Spot it:** Diff hunks with no behavioral change; added docstrings on functions the task never called; whitespace or import reordering across a file where one line changed; annotations added to unrelated signatures.

**Fix:** Revert hunks the task does not require. Put a cleanup the codebase genuinely needs in its own change, where reviewers can judge it on its own.

## When Reviewing

- [ ] Every comment explains why, never what the next line does
- [ ] Docstrings state contracts the signature cannot express, or are absent
- [ ] No empty, blanket, or log-and-continue catch blocks outside a real boundary
- [ ] Every parameter, option, and config key has a caller that uses it
- [ ] Every interface, factory, or base class has more than one real implementation
- [ ] No `any`, `as` chains, internal `unknown` params or returns, or `Record<string, unknown>` pass-throughs; `unknown` appears only at trust boundaries and is narrowed immediately
- [ ] Every suppression (`@ts-ignore`, `# type: ignore`, `//nolint`, `!`) carries a reason
- [ ] No guards for states the types rule out; exhaustive branches fail loudly
- [ ] No runtime type checks on values the static types already guarantee; validation happens once at the boundary
- [ ] Tests mock only boundary collaborators, never whole modules
- [ ] Every test asserts an observable outcome and fails when the code breaks
- [ ] No newly skipped, commented-out, or loosened tests
- [ ] No dead code, commented-out blocks, or unowned TODOs
- [ ] Logs record decisions and failures once, not function entry and exit
- [ ] No near-duplicate blocks that must change together
- [ ] Every diff hunk is required by the task; no drive-by comments, annotations, or reformatting
