# Playwright Availability Detection

Before writing or running any Playwright-based E2E test, check for Playwright availability using this detection-then-fallback pattern.

---

## Purpose

Prevent silent failures where E2E tests are skipped because Playwright is not installed. The user must be explicitly notified and given clear installation instructions.

---

## Detection Pattern

### Step 1: Check for Playwright MCP Server

First, try to find a Playwright MCP (Model Context Protocol) server:

```
ToolSearch for playwright-related tools
```

If found, use the MCP server for E2E testing capabilities.

### Step 2: Fall Back to CLI Check

If no MCP server is available, check for Playwright CLI:

**On Unix/macOS:**
```bash
which playwright
```

**On Windows (PowerShell):**
```powershell
Get-Command playwright -ErrorAction SilentlyContinue
```

**Or use the standard npm command (works cross-platform):**
```bash
npx playwright --version
```

### Step 3: Handle Not Found

If neither MCP nor CLI is available:

1. **Report exactly what is needed:**
   ```
   E2E testing needs Playwright installed. Run:
   npm install -D @playwright/test
   npx playwright install
   ```

2. **Stop before writing tests:** Do not proceed with E2E test creation if Playwright is not available.

3. **Offer to install:** Ask the user whether to install Playwright before proceeding.

---

## Example Implementation

### As a skill check (pseudo-code)

```
Before running integrated-test for E2E:
  1. Attempt ToolSearch('playwright') for MCP tools
  2. If found: Use MCP server, proceed with E2E writing
  3. If not found:
     4. Run: npx playwright --version
     5. Parse stdout/stderr for version number
     6. If exit code 0 and version found: Playwright is installed, proceed
     7. If exit code != 0 or no version: Playwright not found
        8. Report: "E2E testing needs Playwright installed. Run: npm install -D @playwright/test && npx playwright install"
        9. Stop — do not write E2E tests
        10. Ask user: "Install Playwright now?" or "Continue without E2E tests?"
```

### In a Node.js script

```javascript
async function checkPlaywright() {
  const { execSync } = require('child_process')
  
  try {
    const version = execSync('npx playwright --version', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'] // Suppress stderr
    }).trim()
    console.log('Playwright is installed:', version)
    return true
  } catch (error) {
    console.error('Playwright not found.')
    console.error('Install with: npm install -D @playwright/test && npx playwright install')
    return false
  }
}
```

### In a Bash script

```bash
check_playwright() {
  if npx playwright --version &>/dev/null; then
    echo "Playwright is installed: $(npx playwright --version)"
    return 0
  else
    echo "ERROR: Playwright not found."
    echo "Install with: npm install -D @playwright/test && npx playwright install"
    return 1
  fi
}

if ! check_playwright; then
  exit 1
fi
```

---

## Expected Outcomes

### Success (Playwright Available)

```
✓ Playwright version X.Y.Z installed
✓ Proceeding with E2E test writing/execution
```

### Failure (Playwright Not Available)

```
ERROR: E2E testing needs Playwright installed.

Run:
  npm install -D @playwright/test
  npx playwright install

Then retry.
```

**Do not continue without explicit user confirmation.**

---

## User Communication

When Playwright is not available:

1. **Be explicit:** "Playwright is not installed" — not "E2E tests skipped"
2. **Provide exact command:** Copy-paste ready installation instructions
3. **Explain why:** "Playwright is required for browser automation E2E tests"
4. **Ask for confirmation:** "Would you like to install now?" — give the user choice

Never:
- Silently skip E2E tests
- Suggest using a different tool without asking
- Assume user will install manually without confirmation
- Continue as if tests will run without Playwright

---

## Integration with integrated-test Skill

The `integrated-test` skill's Playwright E2E workflows must include this check:

1. **Before creating any E2E test file:** Run availability check
2. **Before running any E2E test:** Run availability check again (in case environment changed)
3. **Report findings:** Clearly state whether E2E testing is available
4. **If not available:** Explain what to install and ask for next steps before continuing
