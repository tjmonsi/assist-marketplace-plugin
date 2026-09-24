# Coverage Commands by Language

Reference for running coverage tools and interpreting output for each language.

---

## Python (pytest + coverage.py)

### Install coverage tool
```bash
pip install pytest-cov
```

### Run with coverage
```bash
pytest --cov=src --cov-report=term-missing --cov-report=html
```

### Output interpretation
```
Name                    Stmts   Miss  Cover   Missing
─────────────────────────────────────────────────────
src/models.py              45      3    93%   12-14, 78
src/utils.py               23      5    78%   9, 15, 20-22, 45
─────────────────────────────────────────────────────
TOTAL                      68      8    88%
```

- **Stmts:** Total lines of code
- **Miss:** Lines not executed
- **Cover:** Coverage percentage
- **Missing:** Specific line numbers not covered

### HTML report
```bash
open htmlcov/index.html  # macOS/Linux
start htmlcov/index.html # Windows
```

---

## TypeScript/JavaScript (Vitest with coverage)

### Install coverage (integrated with vitest)
```bash
npm install -D @vitest/coverage-v8
```

### Run with coverage
```bash
vitest run --coverage
# or
npm run test -- --coverage
```

### Config (vitest.config.ts)
```typescript
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      all: true,
      include: ['src/**/*.ts'],
      exclude: ['node_modules/', 'dist/']
    }
  }
})
```

### Output
```
File          % Stmts % Branch % Funcs % Lines Uncovered Line #s
──────────────────────────────────────────────────────────────
All files      88.2      75.4    91.2     88.2
 models.ts     93.3      85.0    95.2     93.3  12-14, 78
 utils.ts      78.1      62.5    80.0     78.1  9, 15, 20-22
```

### Jest alternative

```bash
jest --coverage --coverage-reporters=text --coverage-reporters=html
```

---

## Go (built-in coverage)

### Run tests with coverage
```bash
go test -cover ./...
```

### Generate coverage profile
```bash
go test -coverprofile=coverage.out ./...
go tool cover -func=coverage.out
go tool cover -html=coverage.out
```

### Output
```
coverage.out analysis:
    main.go:10:createUser    85.5%
    main.go:20:getUser       92.3%
    utils.go:5:validate      76.2%
```

### HTML report
```bash
go tool cover -html=coverage.out -o coverage.html
open coverage.html
```

### Coverage by package
```bash
go test -v -coverprofile=coverage.out ./...
go tool cover -func=coverage.out | grep -E "^(total|github.com)"
```

---

## Rust (cargo tarpaulin)

### Install
```bash
cargo install cargo-tarpaulin
```

### Run coverage
```bash
cargo tarpaulin --out Html --output-dir coverage/
cargo tarpaulin --out Text --exclude-files tests/*
```

### Output
```
lib.rs: 85.5%
models.rs: 92.1%
utils.rs: 78.3%
─────────────
Total: 87.2%
```

### With thresholds
```bash
cargo tarpaulin --timeout 600 --fail-under 85
```

---

## Kotlin (JaCoCo)

### Configure in build.gradle.kts
```kotlin
plugins {
    id("jacoco")
}

tasks.withType<JacocoReport> {
    reports {
        xml.required.set(true)
        html.required.set(true)
    }
}
```

### Run tests with coverage
```bash
./gradlew testDebugUnitTest jacocoTestDebugUnitTestReport
```

### View report
```bash
open app/build/reports/jacoco/jacocoTestDebugUnitTestReport/html/index.html
```

### Output format
- Reports generated in `build/reports/jacoco/`
- HTML report shows line and branch coverage by class
- Supports code highlighting of covered vs. uncovered lines

---

## General Guidelines

### Minimum targets
- **Line coverage:** 90%
- **Branch coverage:** 75% (secondary; focus on critical paths)
- **Function coverage:** 90%

### Interpreting percentages
- **90%+:** Good coverage. Investigate remaining gaps for critical paths.
- **85-89%:** Acceptable but gaps exist. Identify and address high-risk uncovered areas.
- **<85%:** Needs work. Identify uncovered files and add tests.

### Uncovered lines to prioritize
1. Error handlers (catch blocks, exception paths)
2. Security-critical code (auth, validation)
3. Boundary conditions (empty, null, overflow)
4. Cross-cutting concerns (logging, metrics)

### Ignore coverage for
- Auto-generated code (protobuf, swagger)
- Vendored dependencies
- Test fixtures and mocks (when configured)
- Main entry point (if framework-specific)

---

## Continuous Integration

### GitHub Actions example
```yaml
- name: Run tests with coverage
  run: npm test -- --coverage

- name: Upload coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/coverage-final.json
    fail_ci_if_error: true
```

### Common CI integration
- Fail build if coverage drops below threshold
- Comment coverage stats on pull requests
- Archive coverage reports for historical tracking
