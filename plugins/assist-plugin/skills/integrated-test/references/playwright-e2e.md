# Playwright — Browser Automation and E2E Testing

Playwright testing conventions for web applications.

## Contents
- Setup and prerequisites
- Test structure
- Page Object Model pattern
- Locators (best practices hierarchy)
- Assertions
- Visual regression testing
- Accessibility testing
- Authentication state reuse
- Configuration
- CI integration
- Rules

---

## Setup and Prerequisites

### Installation

Before installing Playwright, **run the availability check** in [references/playwright-availability-check.md](playwright-availability-check.md).

```bash
npm install -D @playwright/test
npx playwright install
```

### Project structure
```
project/
  e2e/
    auth.setup.ts          # Authentication setup (runs once)
    login.spec.ts          # Login flow tests
    dashboard.spec.ts      # Dashboard tests
    pages/
      login.page.ts        # Page Object for login
      dashboard.page.ts    # Page Object for dashboard
  playwright.config.ts
```

---

## Test Structure

### Basic test

```typescript
import { test, expect } from '@playwright/test'

test.describe('Login flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
  })

  test('successful login redirects to dashboard', async ({ page }) => {
    await page.getByLabel('Email').fill('user@example.com')
    await page.getByLabel('Password').fill('password123')
    await page.getByRole('button', { name: 'Sign in' }).click()
    
    // Auto-retry assertions until timeout
    await expect(page).toHaveURL('/dashboard')
    await expect(page.getByText('Welcome back')).toBeVisible()
  })

  test('invalid password shows error', async ({ page }) => {
    await page.getByLabel('Email').fill('user@example.com')
    await page.getByLabel('Password').fill('wrong')
    await page.getByRole('button', { name: 'Sign in' }).click()
    
    await expect(page.getByText('Invalid credentials')).toBeVisible()
  })
})
```

---

## Page Object Model Pattern

Encapsulate page interactions in reusable classes:

```typescript
// pages/login.page.ts
import { type Page, type Locator } from '@playwright/test'

export class LoginPage {
  readonly emailInput: Locator
  readonly passwordInput: Locator
  readonly submitButton: Locator
  readonly errorMessage: Locator

  constructor(public readonly page: Page) {
    this.emailInput = page.getByLabel('Email')
    this.passwordInput = page.getByLabel('Password')
    this.submitButton = page.getByRole('button', { name: 'Sign in' })
    this.errorMessage = page.getByRole('alert')
  }

  async goto() {
    await this.page.goto('/login')
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)
    await this.submitButton.click()
  }
}
```

### Using Page Objects via fixtures

```typescript
import { test as base } from '@playwright/test'
import { LoginPage } from './pages/login.page'

type TestFixtures = {
  loginPage: LoginPage
}

const test = base.extend<TestFixtures>({
  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    await use(loginPage)
  }
})

// Now use in tests
test('user can login', async ({ loginPage }) => {
  await loginPage.login('user@example.com', 'password')
  await expect(loginPage.page).toHaveURL('/dashboard')
})
```

---

## Locators — Best Practices Hierarchy

Use this priority order (from most robust to least):

| Priority | Locator | When | Example |
|----------|---------|------|---------|
| 1st | `getByRole()` | Semantic role + accessible name | `page.getByRole('button', { name: 'Submit' })` |
| 2nd | `getByLabel()` | Form inputs with labels | `page.getByLabel('Email')` |
| 3rd | `getByText()` | Visible text content | `page.getByText('Welcome')` |
| 4th | `getByTestId()` | Custom `data-testid` attribute | `page.getByTestId('submit-btn')` |
| Last | `locator()` | CSS selector only when semantic fails | `page.locator('.btn-primary')` |

### Never use:
- XPath selectors
- Auto-generated class names (CSS modules, Tailwind arbitrary values)
- Index-based selectors (`nth-child`)
- Full CSS class lists that change on refactor

### Examples

```typescript
// Button by role and name (BEST)
page.getByRole('button', { name: 'Sign In' })

// Form input by label (GOOD)
page.getByLabel('Email Address')

// Text content (OK for unique content)
page.getByText('Account created successfully')

// Test ID only when needed (LAST RESORT)
page.getByTestId('save-btn')

// Avoid these
page.locator('form > div:nth-child(2) > input')  // Index-based
page.locator('.css_generated_12345')              // Auto-generated class
```

---

## Assertions

All assertions **auto-retry** until timeout — no manual waits needed.

### Visibility

```typescript
await expect(page.getByText('Success')).toBeVisible()
await expect(page.getByText('Loading')).toBeHidden()
```

### Text and content

```typescript
await expect(page.getByRole('heading')).toHaveText('Dashboard')
await expect(page.getByRole('list')).toContainText('Item 1')
```

### URL and page title

```typescript
await expect(page).toHaveURL('/dashboard')
await expect(page).toHaveTitle('My App - Dashboard')
```

### Element count

```typescript
await expect(page.getByRole('listitem')).toHaveCount(3)
```

### Element state

```typescript
await expect(page.getByRole('button')).toBeEnabled()
await expect(page.getByRole('button')).toBeDisabled()
```

---

## Visual Regression Testing

```typescript
// Full page screenshot
await expect(page).toHaveScreenshot('dashboard.png')

// Specific element screenshot
await expect(page.getByTestId('chart')).toHaveScreenshot('chart.png')

// With threshold for minor pixel differences (0 = strict, 1 = very lenient)
await expect(page).toHaveScreenshot({ maxDiffPixelRatio: 0.01 })
```

Update baselines after intentional visual changes:
```bash
npx playwright test --update-snapshots
```

---

## Accessibility Testing

### ARIA snapshot assertion

```typescript
await expect(page.locator('nav')).toMatchAriaSnapshot(`
  - navigation:
    - link "Home"
    - link "About"
    - link "Contact"
`)
```

### Accessible name and description

```typescript
await expect(page.getByTestId('save')).toHaveAccessibleName('Save document')
await expect(page.getByTestId('save')).toHaveAccessibleDescription('Save to disk')
```

### Comprehensive axe accessibility audit

```typescript
import AxeBuilder from '@axe-core/playwright'

test('page has no accessibility violations', async ({ page }) => {
  await page.goto('/dashboard')
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
})
```

---

## Authentication State

Save login state once, reuse across tests to avoid redundant logins.

### Setup file (runs once)

```typescript
// e2e/auth.setup.ts
import { test as setup } from '@playwright/test'

setup('authenticate user', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill('user@example.com')
  await page.getByLabel('Password').fill('password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  
  // Wait for navigation to confirm successful login
  await page.waitForURL('/dashboard')
  
  // Save authenticated session
  await page.context().storageState({ path: '.auth/user.json' })
})
```

### Config file (reuse saved state)

```typescript
// playwright.config.ts
export default defineConfig({
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: { storageState: '.auth/user.json' },
      dependencies: ['setup'],
    },
  ],
})
```

Now all tests run with pre-authenticated session — no login steps needed.

---

## Configuration

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  
  reporter: 'html',
  
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    screenshot: 'only-on-failure',  // Save screenshots only when tests fail
    trace: 'on-first-retry',        // Save traces only when retrying
    video: 'on-first-retry',
  },

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },

  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
})
```

---

## CI Integration

### Install browsers

```bash
npx playwright install --with-deps chromium
```

### Run tests

```bash
# All tests
npx playwright test

# Specific file
npx playwright test e2e/login.spec.ts

# Specific project
npx playwright test --project=chromium

# Debug mode
npx playwright test --debug

# View HTML report
npx playwright show-report
```

---

## Rules

1. **Use semantic locators:** `getByRole()` > `getByLabel()` > `getByText()` > `getByTestId()` > `locator()`.
2. **Page Object Model:** For any page with more than 3 user interactions, encapsulate in a Page class.
3. **Custom fixtures:** Use `test.extend()` for reusable test setup.
4. **Never use waitForTimeout():** Always use auto-retrying assertions instead.
5. **Save auth state:** Avoid login in every test — save and reuse authentication context.
6. **Local dev server:** Run tests against local app via `webServer` config, not production.
7. **Screenshots/traces on failure:** Configure `screenshot: 'only-on-failure'` to save storage space in CI.
8. **Test critical flows:** Login, main features, error states — not every edge case (use unit tests for those).
9. **Cross-browser in CI:** Run Chromium (required), Firefox and WebKit (recommended) in CI.
10. **data-testid sparingly:** Add only when no semantic locator exists, not as a substitute for proper HTML.
