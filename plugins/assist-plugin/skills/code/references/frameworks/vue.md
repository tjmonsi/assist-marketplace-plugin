# Vue 3 Reference

## Contents
- Mandatory Toolchain
- Composition API Rules
- Vue 3 Specific Patterns
- Prohibited Patterns
- Project Structure

## Mandatory Toolchain

| Tool | Purpose | Prohibited Alternatives |
|------|---------|------------------------|
| Vue 3.4+ | Framework | Vue 2 |
| `<script setup>` | Component syntax | Options API for new code |
| TypeScript 5.x | Language | Plain `.js` SFCs |
| Vite | Build | Webpack (unless existing) |
| ESLint + `vue/recommended` | Lint | tslint |
| Vitest + `@vue/test-utils` | Testing | Jest — always use vitest for new projects |
| Vue Router | Routing (non-Nuxt SPA) | Manual history/hash routing |
| Pinia | State management | Vuex |

This file covers Vue 3 component-level patterns for any Vue app (SPA or embedded). For Nuxt-specific concerns (server routes, `useFetch`, auto-imports, nuxt-security), see [nuxtjs.md](nuxtjs.md).

## Composition API Rules

- All components use `<script setup lang="ts">`
- `defineProps<T>()` with TypeScript interface -- no runtime object syntax
- `defineEmits<T>()` typed -- no untyped emits
- `ref<T>()` and `computed<T>()` always typed
- Composables: `use` prefix, return plain refs (not reactive object)

```vue
<script setup lang="ts">
interface Props { userId: number; label?: string }
const props = defineProps<Props>()
const emit = defineEmits<{ update: [value: string] }>()
const count = ref<number>(0)
const doubled = computed<number>(() => count.value * 2)
</script>
```

## Vue 3 Specific Patterns

### Reactivity

- `ref()` for primitives and values reassigned wholesale; `reactive()` only for objects that are never reassigned
- Never destructure a `reactive()` object directly -- use `toRefs()` to preserve reactivity
- `shallowRef()` / `shallowReactive()` for large objects where deep reactivity is unnecessary (perf)
- `readonly()` when exposing state to child components that must not mutate it

```typescript
const state = reactive({ count: 0, name: 'a' })
const { count, name } = toRefs(state)   // correct — stays reactive
const { count } = state                 // wrong — loses reactivity
```

### Watchers

- `watch()` for reacting to specific source changes with access to old/new values
- `watchEffect()` for auto-tracked dependencies when old value is not needed
- Always specify `{ immediate: true }` explicitly when the effect must run on mount
- Clean up side effects with the `onCleanup` callback, not a separate `onUnmounted`

```typescript
watch(userId, async (newId, oldId, onCleanup) => {
  const controller = new AbortController()
  onCleanup(() => controller.abort())
  user.value = await fetchUser(newId, { signal: controller.signal })
})
```

### Lifecycle Hooks

Use composition lifecycle hooks (`onMounted`, `onUnmounted`, `onBeforeUpdate`, `onErrorCaptured`) inside `<script setup>` -- never Options API lifecycle methods.

### Template Refs

```vue
<script setup lang="ts">
const inputRef = ref<HTMLInputElement | null>(null)
onMounted(() => inputRef.value?.focus())
</script>
<template><input ref="inputRef" /></template>
```

### Provide / Inject

Type both ends with `InjectionKey<T>` to avoid `unknown` at the injection site:

```typescript
// keys.ts
export const authKey: InjectionKey<AuthState> = Symbol('auth')

// provider
provide(authKey, authState)

// consumer
const auth = inject(authKey)
if (!auth) throw new Error('authKey not provided')
```

### Slots and Teleport

- Typed slots via `defineSlots<{ default(props: { item: Item }): unknown }>()`
- `<Teleport to="body">` for modals/overlays to escape parent `overflow`/`z-index` stacking contexts
- `<Suspense>` to coordinate loading state across async components using top-level `await` in `<script setup>`

### defineModel (v-model)

```vue
<script setup lang="ts">
const model = defineModel<string>({ required: true })
</script>
<template><input v-model="model" /></template>
```

Prefer `defineModel()` over manual `props.modelValue` + `emit('update:modelValue')` boilerplate.

## Prohibited Patterns

| Pattern | Why | Fix |
|---------|-----|-----|
| Options API (`data()`, `methods:`) | Legacy | Composition API + `<script setup>` |
| `defineProps` without TypeScript | No type safety | `defineProps<Interface>()` |
| `this` in `<script setup>` | Does not exist | Direct ref access |
| `v-html` without sanitization | XSS risk | DOMPurify or avoid |
| Direct DOM manipulation | Bypasses reactivity | `ref` / `templateRef` |
| Destructuring a `reactive()` object | Loses reactivity | `toRefs()` |
| Mutating props directly | Breaks one-way data flow | Emit event, let parent update |
| Manual `modelValue` prop + emit boilerplate | Verbose, error-prone | `defineModel()` |

## Project Structure

```
src/
  components/
    ui/                  # Generic UI components (Button, Modal, Input)
    layout/              # Layout components (Header, Footer, Sidebar)
    feature/             # Feature-specific components
  composables/
    useAuth.ts           # Auth state + methods
    useApi.ts            # Typed API wrapper
  views/
    HomeView.vue
    LoginView.vue
    DashboardView.vue
  router/
    index.ts             # Vue Router route definitions
  stores/
    auth.ts              # Pinia auth store
    user.ts              # Pinia user store
  types/
    api.ts               # API response/request types
    user.ts              # Domain types
  assets/
    css/
      main.css           # Global styles
  utils/
    format.ts            # Date, currency formatting
public/
  favicon.ico
index.html
vite.config.ts
tsconfig.json
```
