# `@constantine-24/treekit-react` — internals

`src/tree.tsx` is the React twin of the Angular `TkTree` (`packages/angular/projects/treekit/src/lib/tree.ts`) and is **deliberately thin**: same props (as React-named callbacks), same DOM, same classes, same ARIA. Keep them in parity (`.claude/rules/architecture.md`). Built with tsup (ESM + CJS + d.ts, `'use client'` banner); `src/tree.css` is copied to `dist/styles.css` and exported as `@constantine-24/treekit-react/styles.css`.

Peers: `react` / `react-dom` `^18 || ^19`. Don't use React-19-only APIs (`ref` as a plain prop, `use`, `useEffectEvent`) in the library — `forwardRef` stays until the React 18 peer is dropped.

<important if="you are changing the React adapter (src/tree.tsx)">

Each load-bearing Angular pattern has a React counterpart. Keep all of them:

- **Version counter → external store.** Core objects are not reactive. `VersionStore` (`src/version-store.ts`) is bumped by `state.subscribe`, the virtualizer/engine/keyboard `onStateChange`, and `SelectionModel.onChange`; the component reads it through `useSyncExternalStore` and re-derives the whole render model from the plain objects on every render. Don't copy core state into `useState`.
- **Untracked scalars → one attach effect keyed only on `[state, virtualizer]`.** Engines are created and attached in a single `useLayoutEffect`. Scalar props (`rowHeight`, `indentWidth`, `autoScrollEdge`, `springLoadDelay`, `dragHandleSelector`) are pushed by **dedicated** effects (`setRowHeight`, `engine.updateOptions`). Callbacks and the `multiSelect` / `isReadonly` flags are read from the `latest` ref, assigned in a layout effect declared _before_ the attach effect. Adding any other dependency to the attach effect tears the engines down on that change — resetting keyboard focus and any in-flight drag. A spec asserts callback identity changes don't re-attach.
- **Don't "fix" this with `useCallback`.** Consumers pass inline arrows; the latest-value ref is what makes that free. Memoising inside the library would not help and reviewers flagging it are wrong (see `review-gate.md`).
- **The core never mutates on drop.** `onDrop` only reports; spring-load calls `state.expand`, as in Angular.
- **Measured rows don't pin their height.** `TkTreeRowView` reports its element to `virtualizer.measure` in a layout effect keyed on `[virtualizer, index]` — the counterpart of the `TkTreeRowMeasure` directive — and uses `minHeight` instead of `height` when measuring.
- **`aria-activedescendant`** is `undefined` (attribute absent) when the active row isn't rendered.
- **React-only: no synthetic drag handlers.** `DndEngine.attach(viewport, content)` binds native listeners itself and resolves rows via `data-node-id`. Never add `onDragStart` / `onDragOver` / `onDrop` JSX handlers to rows or the viewport.
- **React-only: StrictMode.** The attach effect must be fully reversible: mount → unmount → mount leaves exactly one live attach, and unmount leaves none (spec'd). Every subscription it opens (`state.subscribe`, virtualizer, engine) is closed in its cleanup.
- **React-only: no zone wrapping.** There is no Angular-style zone split here; callbacks are called directly.
  </important>

<important if="you are writing or running React adapter specs">

- `pnpm vitest run src/tree.spec.tsx -t '<name>'`. Specs import vitest APIs explicitly; `src/test-setup.ts` registers Testing Library's `cleanup`.
- The spec mirrors `packages/angular/projects/treekit/src/lib/tree.spec.ts` scenario-for-scenario with a `StubVirtualizer` that renders every row. A new adapter scenario goes into both.
- Keep the spec that mutates `TreeState` **outside** `act()` and awaits `findBy*` — it is the only one that proves the external-store subscription re-renders on its own (the blank-render guard).
- `src/styles.spec.ts` compares the `--tk-*` tokens and `tk-*` classes of `tree.css` with the Angular `tree.scss`.
- Tests and builds resolve `@constantine-24/treekit-core` from `packages/core/dist` — build core first.
  </important>
