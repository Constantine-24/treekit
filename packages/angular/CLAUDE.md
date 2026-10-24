# `@constantine-24/treekit-angular` — internals

A standalone Angular CLI workspace (`angular.json`, project `treekit`) holding the publishable library at `projects/treekit/`. It is on its **own TypeScript version** (~6.0) and does not extend the root `tsconfig.base.json`. It has no ESLint config yet (`BACKLOG.md`). Prettier resolves `.prettierrc` here (defaults + the `angular` HTML parser), so this code writes `(node) => ...`.

The component — `projects/treekit/src/lib/tree.ts` — is **deliberately thin**. Its React twin is `packages/react/src/tree.tsx`; keep them in parity (`.claude/rules/architecture.md`).

<important if="you are changing the Angular adapter (projects/treekit/src/lib)">

Notable patterns, all load-bearing:

- Core objects are **not reactive**. `TkTree` keeps a monotonic `_version` signal bumped by every state/engine notification; every `computed()` reads `this._version()` first to force re-derivation from the plain objects.
- **The repo is zoneless** — Angular 22 defaults to it and zone.js is absent, so `NgZone` resolves to `NoopNgZone` and change detection is signal-driven and asynchronous. The `_zone` wrapping exists for zone.js consumers: **outputs are wrapped, internal `_bump`/`announce` writes are not** (those notify the scheduler on their own). Keep that split.
- Engines attach inside `runOutsideAngular`; drops re-enter via `_zone.run`.
- `state` is a **required input**, so reading `tree.rows()` from a parent's `computed()` during the pass that creates the view throws `NG0950` — and an uncaught throw there aborts change detection, so it presents as a blank page. Read child state in `afterRenderEffect`, not `computed`.
- Scalar option inputs (`rowHeight`, `indentWidth`, `autoScrollEdge`, `springLoadDelay`, `dragHandleSelector`) are read `untracked` at attach time and pushed through **dedicated update effects** — reading them tracked would tear the engines down on every change, resetting keyboard focus and any in-flight drag.
- a11y uses `aria-activedescendant`. `activeDescendant()` returns `null` when the active row is not currently rendered, so the attribute never points at a missing element.
- Measured rows (`TkTreeRowMeasure`, when the virtualizer has `measure`) don't pin their height — pinning would feed the estimate back as the measurement.
  </important>

<important if="you are writing or running Angular specs">

- `ng test` only — never `vitest` directly here (a hook blocks it). `pnpm ng test --include 'src/lib/tree.spec.ts' --filter '<regex>'`.
- The spec uses a `StubVirtualizer` that renders every row. Keep at least one `await fixture.whenStable()` path with no manual `detectChanges()` (see `.claude/rules/testing.md`).
- `ng test` and `ng build treekit` resolve `@constantine-24/treekit-core` from `packages/core/dist` — build core first.
  </important>
