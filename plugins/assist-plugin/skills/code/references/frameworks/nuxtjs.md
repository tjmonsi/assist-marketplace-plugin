# Nuxt 4 Reference

## Contents
- Mandatory Toolchain
- Nuxt 4 Patterns
- Server Routes
- Data Fetching
- Pinia State Management
- Security (nuxt-security module)
- SEO Metadata
- Four-Viewport Validation
- Project Structure

## Mandatory Toolchain

| Tool | Purpose | Prohibited Alternatives |
|------|---------|------------------------|
| Nuxt 4 | Meta-framework (SSR, routing, server routes) | Nuxt 2/Bridge for new projects |
| Vite | Build (bundled with Nuxt) | Webpack (unless existing) |
| Pinia | State management | Vuex |
| `nuxt-security` | OWASP-aligned security headers/CSP module | Manual header middleware |
| Vitest + `@vue/test-utils` | Testing | Jest |

Vue-level conventions (Composition API, `<script setup>`, TypeScript) are covered by the Vue framework reference; this file covers Nuxt-specific patterns only.

## Nuxt 4 Patterns

### Auto-imports

Nuxt auto-imports Vue and Nuxt composables (`ref`, `computed`, `useRoute`, `useFetch`, `useState`). Do not add explicit imports for these.

## Server Routes

Use `defineEventHandler` in `server/api/`:

```typescript
// server/api/users/[id].get.ts
export default defineEventHandler(async (event): Promise<UserResponse> => {
  const id = getRouterParam(event, "id")
  if (!id) throw createError({ statusCode: 400, message: "id required" })
  return await getUserById(Number(id))
})
```

- File naming encodes the HTTP method and path (`[id].get.ts`, `login.post.ts`)
- Use `readBody(event)` for request bodies, `getQuery(event)` for query params
- Throw `createError({ statusCode, message })` for error responses — never return raw `Error` objects

## Data Fetching

- Use `useFetch` or `useAsyncData` -- never raw `fetch` in components
- Type the generic: `useFetch<User>(`/api/users/${id}`)`
- Use `useRequestHeaders(['authorization'])` to proxy auth during SSR, never expose tokens client-side

## Pinia State Management

- `defineStore` with setup syntax (composable style)
- Use `$fetch` inside stores for API calls
- Store file naming: `stores/<entity>.ts`

```typescript
// stores/user.ts
export const useUserStore = defineStore('user', () => {
  const user = ref<User | null>(null)
  const isAuthenticated = computed(() => user.value !== null)

  async function fetchCurrentUser(): Promise<void> {
    user.value = await $fetch<User>('/api/users/me')
  }

  return { user, isAuthenticated, fetchCurrentUser }
})
```

## Security (nuxt-security module)

Install `nuxt-security` for OWASP-aligned defaults. Missing this module in production apps is a violation.

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['nuxt-security'],
  security: {
    nonce: true,                          // enable CSP nonces for SSR
    sri: true,                            // subresource integrity
    headers: {
      contentSecurityPolicy: {
        'script-src': ["'self'", "'strict-dynamic'", "'nonce-{{nonce}}'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", "data:"],
        'base-uri': ["'none'"],
        'object-src': ["'none'"],
        'frame-ancestors': ["'none'"],
        'upgrade-insecure-requests': true,
      },
      crossOriginEmbedderPolicy: 'require-corp',
    },
  },
})
```

Per-route CSP overrides via `routeRules`:
```typescript
routeRules: {
  '/api/**': { security: { headers: { contentSecurityPolicy: false } } },
}
```

XSS prevention rules:
- `v-html` is prohibited without `DOMPurify.sanitize()` — use `v-text` or template interpolation
- Never render user input in `<script>` tags
- Use `useRequestHeaders(['authorization'])` to proxy auth during SSR, never expose tokens client-side

## SEO Metadata

Every page must call `useSeoMeta()`:
```vue
useSeoMeta({ title: "Page Title", description: "Page description" })
```

## Four-Viewport Validation

Every page must pass at these breakpoints:

| Breakpoint | Width | Device Class |
|-----------|-------|-------------|
| `xs` | 320px | Small mobile |
| `sm` | 640px | Mobile |
| `md` | 768px | Tablet |
| `lg` | 1024px | Desktop |
| `xl` | 1280px | Wide desktop |

### Rules

- Mobile-first breakpoints only (`sm:`, `md:`, `lg:`, `xl:`) -- no `max-*` overrides
- No horizontal scroll at any breakpoint -- fix the overflowing element, do not mask with `overflow-x: hidden`
- Text must not overflow containers -- use `truncate`, `break-words`, or `line-clamp`
- Interactive elements: minimum 44x44px touch target on mobile (`min-h-[44px] min-w-[44px]`)

### Review Gate Violations

- Content clipped or horizontally scrollable at `xs` or `sm`
- Text below 12px at any breakpoint
- Interactive elements smaller than 44x44px on mobile

## Project Structure

```
app/
  components/
    ui/                  # Generic UI components (Button, Modal, Input)
    layout/              # Layout components (Header, Footer, Sidebar)
    feature/             # Feature-specific components
  composables/
    useAuth.ts           # Auth state + methods
    useApi.ts            # Typed API wrapper around useFetch
  pages/
    index.vue            # / route
    login.vue            # /login route
    dashboard/
      index.vue          # /dashboard route
      [id].vue           # /dashboard/:id route
  layouts/
    default.vue          # Default layout with nav
    auth.vue             # Minimal layout for login/register
  middleware/
    auth.ts              # Route guard: redirect if not authenticated
  plugins/
    01.auth.ts           # Auth initialization plugin
  stores/
    auth.ts              # Pinia auth store
    user.ts              # Pinia user store
  types/
    api.ts               # API response/request types
    user.ts              # Domain types
  assets/
    css/
      main.css           # Global styles, Tailwind imports
  utils/
    format.ts            # Date, currency formatting
server/
  api/
    auth/
      login.post.ts      # POST /api/auth/login
      logout.post.ts
    users/
      index.get.ts       # GET /api/users
      [id].get.ts        # GET /api/users/:id
  middleware/
    auth.ts              # Server middleware: verify JWT
  utils/
    db.ts                # Database connection
public/
  favicon.ico
nuxt.config.ts
tailwind.config.ts
Dockerfile
```
