# Architecture

pnpm monorepo. Three publishable packages, three apps:

| Path                                   | Package                | What it is                                                                                     |
| -------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------- |
| `packages/core`                        | `@treekit/core`        | The headless engine (tsup → `dist/`). Zero dependencies. `@treekit/core/tanstack` subpath.     |
| `packages/angular/projects/treekit`    | `@treekit/angular`     | Thin Angular adapter (`<tk-tree>`), built by ng-packagr → `packages/angular/dist/treekit`.     |
| `packages/react`                       | `@treekit/react`       | Thin React adapter (`<TkTree>`), tsup → `dist/`, ships `styles.css`.                           |
| `apps/site`                            | — (private)            | The landing page deployed to GitHub Pages root. Built with `@treekit/react`.                   |
| `apps/demo-react`, `apps/demo-angular` | — (private)            | The two mirrored showcases, deployed to `/react/` and `/angular/`.                             |
| `apps/demo-shared`                     | `@treekit/demo-shared` | Private, source-only: fixtures, theme tokens and the feature list both showcases render.       |
| `apps/demo-vanilla`                    | — (private)            | Headless proof against plain DOM, **dist-linked** — the check that the published layout works. |

## The five layers of `@treekit/core`

Five **independent, separately attachable layers**. They share no state — only `TreeNode` object identity and the `data-node-id` DOM attribute. Any of them can be used alone against plain DOM (`apps/demo-vanilla` is the headless proof); each framework adapter is a thin wiring layer over all five.

The premise the whole design rests on: **rows are absolutely positioned by a virtualizer**, so flow-based DnD (placeholder elements, index-based sorting) cannot work. Every drop decision is made from pointer position against rendered rows instead.

1. **`TreeState<T>`** (`src/tree/tree-state.ts`) — the forest, its flat depth-first projection, all structural mutations, filtering, lazy loading.
2. **`TreeVirtualizer`** (`src/virtualizer/`) — `attach` / `setCount` / `totalSize` / `items` / optional `measure` + `scrollToIndex`. `FixedHeightVirtualizer` built in; `TanStackVirtualizer` at the `@treekit/core/tanstack` subpath.
3. **`DndEngine<T>`** (`src/dnd/dnd-engine.ts`) — native HTML5 drag-and-drop that **never inserts anything into the layout**.
4. **`KeyboardController<T>`** (`src/keyboard/keyboard-controller.ts`) — ARIA tree navigation plus keyboard DnD.
5. **`SelectionModel<T>`** (`src/selection/selection-model.ts`) — multi-selection with anchor tracking, deliberately outside `TreeState`.

The internals and invariants of each layer are in `packages/core/CLAUDE.md` — read it before changing the core.

## Cross-cutting rules

- **The core never mutates on drop.** `onDrop` is a _notification_. Both engines emit the identical `DropEvent<T>`; the consumer decides and calls `state.move(...)` / `state.add(...)`. `canDropAt` is a pure validation hook — wire it to `TreeState.canMove` so invalid targets never light up. Spring loading follows the same report-don't-mutate rule.
- **`@treekit/core` stays zero-dependency**: no framework, no RxJS, no DOM assumptions beyond standard APIs. `@tanstack/virtual-core` is an _optional_ peer, reachable only through the `tanstack` subpath.
- **All geometry flows through the virtualizer's `items()`** (`start`/`size`) — never `index × rowHeight`. `FixedHeightVirtualizer` is the only place allowed to derive geometry from `index × rowHeight`.

<important if="you are changing @treekit/angular or @treekit/react, or adding a feature to either adapter">

- **The adapters are kept in parity.** Same feature set, same names (Angular input `multiSelect` ↔ React prop `multiSelect`; Angular output `nodeClick` ↔ React `onNodeClick`), same `tk-*` class names and `--tk-*` CSS custom properties, same DOM/ARIA output. A feature added to one adapter is added to the other in the same change, or recorded in `BACKLOG.md` with the reason.
- Adapters contain wiring only. If an adapter needs logic that isn't framework glue, it belongs in the core where the other adapter (and vanilla users) get it too.
- The `--tk-*` token sets of `packages/angular/projects/treekit/src/lib/tree.scss` and `packages/react/src/tree.css` are compared by a spec in `packages/react` — change both together.
  </important>

<important if="you are adding, removing, or renaming anything exported from a package entry point">

- `packages/core/src/index.ts`, `packages/core/src/tanstack.ts`, `packages/angular/projects/treekit/src/public-api.ts` and `packages/react/src/index.ts` are the published contract. Every export needs TSDoc and a changeset.
- Removing or renaming an export, input, output, prop, CSS class or `--tk-*` custom property is a **breaking change**. Before 1.0 that is a minor bump with a migration note in the changeset; after 1.0, a major. Prefer deprecating with a `@deprecated` TSDoc tag and keeping the old name working.
- Export only what consumers need.
  </important>
