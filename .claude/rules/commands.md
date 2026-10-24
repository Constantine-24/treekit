# Commands & Environment

Node: the version CI uses (`.nvmrc`, Node 22; `engines` allows ≥ 20). Package manager: **pnpm 11** via corepack (`packageManager` in the root `package.json`). Never npm or yarn — a hook blocks them. Run from the repo root:

| Script              | Runs                                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| `pnpm install`      | Install the workspace                                                                                |
| `pnpm build`        | Topological: core (tsup) → `@treekit/angular` (ng-packagr) / `@treekit/react` (tsup) → apps          |
| `pnpm test`         | core vitest + angular `ng test` + react vitest + demo/site smoke specs + demo-vanilla `tsc --noEmit` |
| `pnpm lint`         | ESLint for `packages/core` and `packages/react` (see below)                                          |
| `pnpm format:check` | Prettier gate (CI enforces it)                                                                       |
| `pnpm build:pages`  | Builds `_site/`: landing at `/`, React demo at `/react/`, Angular demo at `/angular/`                |
| `pnpm pack:check`   | `pnpm pack` every publishable package and assert no `workspace:` specifier survives                  |

Per package:

```sh
# @treekit/core   (same shape in packages/react)
cd packages/core
pnpm vitest run src/tree/tree-state.spec.ts             # single file
pnpm vitest run src/tree/tree-state.spec.ts -t 'filter' # single test by name
pnpm test:watch
pnpm typecheck                                          # tsc --noEmit

# @treekit/angular (Angular CLI workspace; vitest via @angular/build:unit-test)
cd packages/angular
pnpm ng test --filter 'grabbed'                         # regex over suite/test names
pnpm ng test --include 'src/lib/tree.spec.ts'
pnpm ng build treekit

# apps
cd apps/site && pnpm dev                                # vite
cd apps/demo-react && pnpm dev                          # vite
cd apps/demo-angular && pnpm start                      # ng serve, :4200
cd apps/demo-vanilla && pnpm dev                        # vite (needs core built)
```

**`pnpm lint` does not cover the Angular workspace** — it has no ESLint config, so lint findings there won't surface in CI (tracked in `BACKLOG.md`).

## Who consumes source, and who consumes built output

- **`apps/demo-angular`, `apps/demo-react` and `apps/site` are source-linked.** Their tsconfig `paths` (and, for Vite apps, `resolve.alias`) map `@treekit/*` straight at the packages' sources, so editing a library hot-reloads the app with no rebuild. Keep it that way — see the staleness trap in `apps/CLAUDE.md`.
- **`apps/demo-vanilla` is dist-linked**, resolving `@treekit/core` through node_modules and its `exports` map. It needs `packages/core` built, and it is what proves the published package layout actually works.
- **`packages/angular` and `packages/react`** resolve `@treekit/core` through node_modules → `packages/core/dist`, so their tests and builds need core built first. Root `pnpm build` orders this correctly.

`tsup` runs with `clean: true`, so while core is building the editor briefly reports `Could not find a declaration file for module '@treekit/core'`. It's a transient LSP read of a deleted `dist/` — ignore it unless a real toolchain command fails.

<important if="you have finished a code change and need to verify it">

Run these gates, scoped to what you touched while iterating, and in full before a PR:

1. `pnpm lint` — 0 errors, 0 warnings. No `eslint-disable` without a written justification on the same line.
2. Scoped tests (above), then `pnpm test`.
3. `pnpm --filter @treekit/core typecheck` / `pnpm --filter @treekit/react typecheck` — vitest does not type-check.
4. **Angular templates.** `tsc` does not check templates. If you touched an Angular template or inputs, run `pnpm --filter @treekit/angular-workspace exec ng build treekit` (and `pnpm --filter demo-angular build` if the demo changed) — that is the only gate that runs the template type-checker.
5. `pnpm format:check` (the PostToolUse hook formats edited files, but files written by shell commands are not covered).

For changes that affect what ships (entry points, `package.json`, `ng-package.json`, tsup config, README, LICENSE), also run `pnpm build && pnpm pack:check` and read the file lists.
</important>

<important if="you need to start a dev server or verify UI in a browser">

- Check for a running server first (`curl -s -o /dev/null -w '%{http_code}' http://localhost:4200/`, or the Vite port) and reuse it — it watches this checkout.
- Verify in a real browser with chrome-devtools MCP. Settle two `requestAnimationFrame`s before reading the DOM: under zoneless Angular and React's batched commits, the first frame can still show the previous render.
- If an app renders blank, **check the browser console first** (see `apps/CLAUDE.md`).
  </important>
