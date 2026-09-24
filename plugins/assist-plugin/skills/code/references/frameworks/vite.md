# Vite Reference

## Contents
- Mandatory Toolchain
- vite.config.ts Setup
- Plugin System
- Environment Variables
- Dev Server
- Production Build Optimization
- Tree-Shaking
- Library Mode
- SSR Integration
- Module Federation
- Project Structure

## Mandatory Toolchain

| Tool | Purpose | Prohibited alternatives |
|------|---------|------------------------|
| Vite 5.x+ | Build tool / dev server | Webpack, Parcel for new projects |
| `vite-tsconfig-paths` | Resolve TS path aliases | Manual `resolve.alias` duplication of `tsconfig.json` paths |
| `vite-plugin-dts` | Emit `.d.ts` for library builds | Hand-written type declarations |
| Rollup (bundled) | Production bundler | — (Vite uses Rollup under the hood for builds) |
| esbuild (bundled) | Dependency pre-bundling, dev transforms | Babel for simple transpilation |

This file covers Vite as a build tool. When Vite is the underlying builder for a framework (Vue, Nuxt), consult that framework's reference for framework-specific config; this file covers the build-tool layer only.

## vite.config.ts Setup

```typescript
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tsconfigPaths from 'vite-tsconfig-paths'
import path from 'node:path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [vue(), tsconfigPaths()],
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': { target: env.VITE_API_PROXY_TARGET, changeOrigin: true },
      },
    },
    build: {
      target: 'es2022',
      sourcemap: mode !== 'production',
      rollupOptions: {
        output: { manualChunks: { vendor: ['vue', 'vue-router', 'pinia'] } },
      },
    },
  }
})
```

Rules:
- Use the function form of `defineConfig` (`({ mode, command }) => {...}`) whenever config depends on env or build/serve mode
- Never hardcode secrets in `vite.config.ts` — read via `loadEnv` and reference `process.env` only inside the config function, never in client code

## Plugin System

- Plugins hook into Rollup's build pipeline plus Vite-specific hooks (`configureServer`, `transformIndexHtml`, `handleHotUpdate`)
- Order matters: plugins run in array order for most hooks; use `enforce: 'pre' | 'post'` to run before/after core Vite transforms
- Prefer official/maintained plugins (`@vitejs/plugin-vue`, `@vitejs/plugin-react`, `@vitejs/plugin-legacy`) over custom transforms for standard frameworks

```typescript
function myPlugin(): Plugin {
  return {
    name: 'my-plugin',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('.special')) return
      return { code: transformSpecial(code), map: null }
    },
  }
}
```

## Environment Variables

- Only variables prefixed `VITE_` are exposed to client code via `import.meta.env`; all others stay server/build-only
- `.env`, `.env.local`, `.env.[mode]`, `.env.[mode].local` are loaded in that precedence order (later overrides earlier); `.env.local` and `.env.*.local` are gitignored
- Build-time constants (baked into the bundle, not readable at runtime) vs. runtime env (read from actual process env at server start) are different concerns — Vite only handles build-time; for runtime config in SSR/Node servers, read `process.env` directly in server code, not via `import.meta.env`

```typescript
// Client code — inlined at build time
const apiUrl = import.meta.env.VITE_API_URL

// Type-safe env — env.d.ts
interface ImportMetaEnv {
  readonly VITE_API_URL: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

Rules:
- Never put secrets (API keys, DB credentials) in `VITE_`-prefixed variables — they ship to the browser bundle in plaintext
- Use `import.meta.env.MODE`, `import.meta.env.DEV`, `import.meta.env.PROD` for mode-based branching, not custom flags

## Dev Server

- Native ESM dev server: no bundling in dev, near-instant HMR regardless of app size
- `server.proxy` forwards API calls to a backend to avoid CORS in local dev
- `server.hmr.overlay: false` to disable the error overlay only when a framework provides its own (rare; keep enabled by default)
- `optimizeDeps.include` / `exclude` to control esbuild dependency pre-bundling for packages with irregular exports

## Production Build Optimization

- `build.target` set to the actual minimum supported runtime (`es2022` for modern evergreen browsers); avoid `esnext` unless output is never shipped to older engines
- `build.rollupOptions.output.manualChunks` to split vendor code from app code for better long-term caching
- `build.cssCodeSplit: true` (default) — per-route CSS chunks instead of one monolithic stylesheet
- `build.sourcemap` — `true`/`'hidden'` in production only if source maps are uploaded to an error-tracking service, never served publicly with secrets embedded
- Compress and analyze with `rollup-plugin-visualizer` before shipping large dependency additions

## Tree-Shaking

- Rollup tree-shakes based on static `import`/`export` analysis — avoid `import * as X` when only a few members are used
- Mark side-effect-free packages in `package.json` (`"sideEffects": false`) so unused exports are dropped; list files with real side effects explicitly (`"sideEffects": ["*.css"]`)
- Avoid re-export barrel files (`index.ts` that does `export * from './x'`) for large modules — they can defeat tree-shaking in some bundler/plugin combinations and slow dev server cold start

## Library Mode

For publishing a package (not an app):

```typescript
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [dts({ rollupTypes: true })],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'MyLib',
      fileName: (format) => `my-lib.${format}.js`,
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: ['vue', 'react'],   // never bundle peer deps
      output: { globals: { vue: 'Vue' } },
    },
  },
})
```

Rules:
- Always mark framework peer dependencies as `external` — bundling them causes duplicate-instance bugs downstream
- Emit both `es` and `cjs` unless the target consumers are ESM-only
- Generate `.d.ts` via `vite-plugin-dts`, never hand-maintain them alongside source changes

## SSR Integration

```typescript
// server.ts (custom Node SSR server)
import { createServer as createViteServer } from 'vite'

const vite = await createViteServer({
  server: { middlewareMode: true },
  appType: 'custom',
})
app.use(vite.middlewares)

// per-request
const { render } = await vite.ssrLoadModule('/src/entry-server.ts')
const html = await render(url)
```

- `vite.config.ts` needs `build.ssr` entry (`build: { ssr: 'src/entry-server.ts' }`) for the production SSR bundle
- Use `vite.ssrLoadModule` only in dev; in production, `import()` the pre-built SSR bundle directly
- Full-framework SSR (Nuxt) manages this internally — only hand-roll this for custom SSR setups outside a meta-framework

## Module Federation

Vite does not include Module Federation natively (Webpack 5 feature). Use `@originjs/vite-plugin-federation` or `@module-federation/vite` when cross-app runtime code sharing is required:

```typescript
import federation from '@originjs/vite-plugin-federation'

export default defineConfig({
  plugins: [
    federation({
      name: 'host-app',
      remotes: { remoteApp: 'https://cdn.example.com/remote-app/assets/remoteEntry.js' },
      shared: ['vue'],
    }),
  ],
  build: { target: 'esnext', minify: false, cssCodeSplit: false },
})
```

Only adopt module federation for genuine micro-frontend requirements (independently deployed teams/apps sharing runtime). Prefer a monorepo + shared package for simpler code-sharing needs.

## Project Structure

```
src/
  main.ts                # App entry, mounts root component
  entry-server.ts        # SSR entry (only for custom SSR)
  App.vue / App.tsx
  env.d.ts               # ImportMetaEnv typing
vite.config.ts
.env
.env.local              # gitignored — local secrets/overrides
.env.production
index.html               # Vite entry HTML (not served from public/)
public/                  # Static assets copied as-is
dist/                    # Build output (gitignored)
```
