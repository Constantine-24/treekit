# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

pnpm monorepo (pnpm 11.15.1 via corepack, Node >= 20). Run from the repo root:

```sh
pnpm install
pnpm build        # topological: core (tsup) -> @treekit/angular (ng-packagr) -> demo apps
pnpm test         # core vitest + angular ng test + demo-vanilla tsc --noEmit
pnpm lint         # only packages/core has a lint script (see below)
pnpm format:check # CI enforces this
```

Per-package:

```sh
# @treekit/core
cd packages/core
pnpm vitest run src/tree/tree-state.spec.ts      # single file
pnpm vitest run src/tree/tree-state.spec.ts -t 'filter'  # single test by name
pnpm test:watch
pnpm typecheck                                    # tsc --noEmit

# @treekit/angular (Angular CLI workspace; vitest via @angular/build:unit-test)
cd packages/angular
pnpm ng test --filter 'grabbed'                   # regex over suite/test names
pnpm ng test --include 'src/lib/tree.spec.ts'
pnpm ng build treekit

# demos
cd apps/demo-vanilla && pnpm dev                  # vite
cd apps/demo-angular && pnpm start                # ng serve, :4200
```

**`pnpm lint` only covers `packages/core`.** The Angular workspace has no ESLint config — lint findings there won't surface in CI.

### Who consumes source, and who consumes built output

- **`apps/demo-angular` is source-linked.** Its `tsconfig.json` maps `@treekit/angular`,
  `@treekit/core`, and `@treekit/core/tanstack` directly at the packages' sources, so editing
  either library hot-reloads the demo with no rebuild. Keep it that way — see the trap below.
- **`apps/demo-vanilla` is dist-linked**, resolving `@treekit/core` through node_modules and its
  `exports` map. It needs `packages/core` built, and it is what proves the published package
  layout actually works.
- **`packages/angular`** resolves `@treekit/core` through node_modules → `packages/core/dist`, so
  `ng test` and `ng build treekit` need core built first. Root `pnpm build` orders this correctly.

### The staleness trap this replaced (don't reintroduce it)

The demo used to consume both libraries through build output, which went stale silently in two
different ways at once:

1. Vite pre-bundles node_modules deps into `.angular/cache/**/vite/deps/` and does **not**
   reliably invalidate that when a linked workspace package's `dist/` is rebuilt.
2. The dev server never watched `packages/angular/dist/treekit` at all, so library edits simply
   never reached the demo.

Together these served a months-old `@treekit/core` while `dist/` was current: `updateOptions` was
missing at runtime, the option-push effect threw, change detection aborted mid-cycle, and the tree
rendered zero rows with no scrollbar and no clue in the build output.

Source-linking removes both. `serve.options.prebundle.exclude` in `apps/demo-angular/angular.json`
stays as a backstop for the node_modules path. If the demo ever renders blank again, **check the
browser console first** — a throw inside a component `effect()` aborts change detection before the
view refreshes, so a stale-API error presents as a blank component, not as an error banner.
`rm -rf apps/demo-angular/.angular/cache` is the escape hatch.

## Architecture

`@treekit/core` is five **independent, separately attachable layers**. They share no state — only `TreeNode` object identity and the `data-node-id` DOM attribute. Any of them can be used alone against plain DOM (see `apps/demo-vanilla`, the headless proof); `@treekit/angular` is a thin wiring adapter over all five.

The premise the whole design rests on: **rows are absolutely positioned by a virtualizer**, so flow-based DnD (placeholder elements, index-based sorting) cannot work. Every drop decision is made from pointer position against rendered rows instead.

### 1. `TreeState<T>` — `src/tree/tree-state.ts`

Owns the forest, its flat depth-first projection, and all structural mutations. Consumers map domain data into nested `TreeInput<T>`; state builds linked flat `TreeNode<T>`s from it.

- **Children arrays are the single source of order.** After _every_ structural mutation, `_recompute()` rebuilds the flat list, id map, `level`s, parent links, filter sets, and visible list from the roots — O(n). Virtualized rendering absorbs this easily, and flat order can never drift from the hierarchy. Don't add incremental splice paths.
- **Node object references are stable** across recomputes; the arrays from `nodes()`/`visibleNodes()` get a new identity on every change (suits framework change detection).
- Filtering never mutates `isExpanded`. It computes `_filterKeepIds` (matches + ancestors) and `_filterAncestorIds` (ancestors only, rendered force-expanded), so clearing the filter restores the prior view. `isExpandedNow(node)` is the render-time truth, not `node.isExpanded`.
- Lazy loading: expanding an `expandable` node with no children calls `onLoadChildren` and sets `isLoading` instead of toggling; the consumer replies with `setChildren`.

### 2. `TreeVirtualizer` — `src/virtualizer/`

`attach` / `setCount` / `totalSize` / `items` / optional `measure` + `scrollToIndex`.

**Contract rule: all geometry must flow through `items()`' `start`/`size` — never `index × rowHeight`.** The interface is shaped for the variable-height superset so measured-row implementations work with no consumer change. `FixedHeightVirtualizer` is the only place in the library allowed to derive geometry from `index × rowHeight`.

`TanStackVirtualizer` lives at the `@treekit/core/tanstack` subpath specifically to keep `@tanstack/virtual-core` an _optional_ peer dependency.

### 3. `DndEngine<T>` — `src/dnd/dnd-engine.ts`

Native HTML5 drag-and-drop. **Never inserts anything into the layout.**

- Target resolution: `document.elementFromPoint(x, y).closest('[data-node-id]')`, then look the id up in `getVisibleNodes()`.
- Intent: `resolveDropIntent(isFolder, fraction)` — pure, testable without layout. Folder middle 50% (fraction 0.25–0.75) = `into`; otherwise the pointer half picks `before`/`after`.
- Feedback is a folder highlight plus one overlay insertion line, positioned **relative to the content element** (the transformed container), which is why `attach(viewport, content)` takes both.
- A document-level `dragend` bound once per drag guarantees teardown even when the drag aborts or drops outside the tree.
- External drag sources need no integration: plain `draggable` + `dataTransfer` arrives as a drop with `node: null` and `nodes: []`.
- Spring loading (`springLoadDelay` + `onSpringLoad`) follows the same report-don't-mutate rule as `onDrop`: the engine times the hover, the consumer calls `expand`. The timer is keyed on the hovered node, so the stream of `dragover` events from a stationary pointer does not restart it.
- `dragHandleSelector` cancels `dragstart` outside a grip. Rows stay `draggable`, since the browser needs that to begin a drag at all.

### 4. `KeyboardController<T>` — `src/keyboard/keyboard-controller.ts`

ARIA tree navigation (roving active row, arrows, Home/End, expand/collapse) plus keyboard DnD: Space grabs, arrows step a preview through the same into/before/after positions, Space drops, Escape cancels. This is the **supported fallback on touch**, since native HTML5 drag doesn't fire from touch gestures on all platforms.

`_candidates()` enumerates drop positions in visual top-to-bottom order and is the trickiest piece: an expanded folder's own `after` coincides visually with its last descendant's, so it is represented there and omitted on the folder itself.

### 5. `SelectionModel<T>` — `src/selection/selection-model.ts`

Multi-selection with the anchor tracking that ranges need. Deliberately _not_ inside `TreeState`:
selection is not structural, and every `TreeState` mutator ends in an O(n) recompute plus a
notification — moving a highlight must not pay that.

Two rules carry most of the design weight:

- **Ids, not node references**, so a selection survives `setSource` and node churn.
- **`selectedNodes()` is visible-only** while `selectedIds()` keeps hidden ids. That single rule
  kills the class of bugs where a node hidden by collapse or filter silently rides along in a drag.
- **Selection is explicit** — selecting a folder never implies its descendants. Forced by drag
  semantics: `move` already relocates a whole subtree, so implied descendants would ask to move
  them independently _and_ inside their parent.

Payload normalization lives with the tree, not here: `denestNodes` / `normalizeDragNodes` in
`tree-state.ts`. In `normalizeDragNodes` the `canDrag` filter **must** run before de-nesting — for
a locked folder plus its draggable child, filtering first yields the child, de-nesting first yields
nothing.

### Cross-cutting: the core never mutates on drop

`onDrop` is a _notification_. Both engines emit the identical `DropEvent<T>`; the consumer decides and calls `state.move(...)` / `state.add(...)`. `canDropAt` is a pure validation hook — wire it to `TreeState.canMove` so invalid targets never light up.

### `@treekit/angular` — `packages/angular/projects/treekit/src/lib/tree.ts`

Deliberately thin. Notable patterns, all load-bearing:

- Core objects are **not reactive**. `TkTree` keeps a monotonic `_version` signal bumped by every state/engine notification; every `computed()` reads `this._version()` first to force re-derivation from the plain objects.
- Engines attach inside `runOutsideAngular`; drops re-enter via `_zone.run`.
- Scalar option inputs (`rowHeight`, `indentWidth`, `autoScrollEdge`) are read `untracked` at attach time and pushed through **dedicated update effects** — reading them tracked would tear the engines down on every change, resetting keyboard focus and any in-flight drag.
- a11y uses `aria-activedescendant`. `activeDescendant()` returns `null` when the active row is not currently rendered, so the attribute never points at a missing element.

## Conventions

- Private class members are `_camelCase` with a required leading underscore (enforced by `@typescript-eslint/naming-convention` in `packages/core/eslint.config.js`).
- `explicit-module-boundary-types` is an error — exported functions and methods need explicit return types.
- `// MARK: -` comments section long classes.
- `tsconfig.base.json` sets `strict` + `noUncheckedIndexedAccess`; hence the `!` assertions after array index access in core.
- **The Angular workspace does not extend `tsconfig.base.json`** — it's a standalone Angular CLI workspace on its own TypeScript version (~6.0.2 vs core's ^5.8) with its own compiler options.
- Two Prettier configs resolve per file: root (`arrowParens: avoid`, `trailingComma: es5`) and `packages/angular/.prettierrc` (defaults plus the `angular` HTML parser). This is why core writes `node => ...` and the Angular library writes `(node) => ...`.
- `@treekit/core` must stay zero-dependency: no framework, no RxJS, no DOM assumptions beyond standard APIs.

## Testing

- `src/virtualizer/conformance.spec.ts` runs **one shared suite over every `TreeVirtualizer` implementation** via `describe.each`. Any new virtualizer belongs in that list — it's the enforcement mechanism for the geometry contract above.
- jsdom has no layout, so specs mock geometry explicitly: `getBoundingClientRect`, `clientHeight`/`scrollHeight` via `defineProperty`, a `ResizeObserverStub`, and a manual `scrollTo` that dispatches `scroll`.
- The Angular spec uses a `StubVirtualizer` that renders every row, for the same reason.

## Releases

Changesets. Add one with `pnpm changeset` for any user-visible change to `@treekit/core` or `@treekit/angular`. Pushing to `main` opens/updates a release PR; merging it publishes. CI runs build → lint → test → format:check.

## Known v1 limitations (documented in README, don't "fix" accidentally)

Fixed row height in the built-in virtualizer (variable heights need `TanStackVirtualizer` plus the `TkTreeRowMeasure` directive); the tree owns its scroll viewport (no window-scroll mode); RTL untested; native HTML5 DnD does not fire from touch gestures on Android Chrome — keyboard DnD is the supported fallback.

**Enabling multi-select rebinds one key.** `Space` becomes "toggle selection" and `Ctrl/Cmd+Space` becomes "grab for keyboard drag"; with no `SelectionModel` wired, `Space` still grabs exactly as before. This mode-dependent binding is a real smell, accepted because every unambiguous alternative chord collides with a browser or OS shortcut (`Cmd+M`, `Ctrl+M`, `Ctrl+Shift+M`, `Alt+Space`), and because the only thing displaced is APG's `Ctrl+Space`, which APG itself calls a redundant alias for `Space`.
