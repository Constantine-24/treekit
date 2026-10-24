# Testing

Vitest everywhere: directly in `packages/core` and `packages/react` (jsdom), and through the Angular CLI (`@angular/build:unit-test`, jsdom, zoneless) in `packages/angular`. Commands are in `commands.md`.

<important if="you are writing, running, or debugging unit tests">

- **jsdom has no layout**, so specs mock geometry explicitly: `getBoundingClientRect`, `clientHeight`/`scrollHeight` via `defineProperty`, a `ResizeObserverStub`, and a manual `scrollTo` that dispatches `scroll`.
- `packages/core/src/virtualizer/conformance.spec.ts` runs **one shared suite over every `TreeVirtualizer` implementation** via `describe.each`. Any new virtualizer belongs in that list — it's the enforcement mechanism for the geometry contract.
- The adapter specs (`packages/angular/projects/treekit/src/lib/tree.spec.ts`, `packages/react/src/tree.spec.tsx`) use a `StubVirtualizer` that renders every row, for the same reason. The React spec ports the Angular scenarios one-for-one; a new adapter scenario goes into both.
- **Async rendering hides blank-render bugs.** Under zoneless Angular, `fixture.detectChanges()` before every assertion makes a spec pass whether or not the component ever notifies the scheduler. Keep at least one `await fixture.whenStable()` path with no manual `detectChanges()` — that's the only kind of spec that catches a blank-render regression. The React equivalent: keep at least one spec that asserts through `findBy*` / `waitFor` after a state change made _outside_ `act()` (a `TreeState` mutation), proving the external-store subscription re-renders on its own.
- The demos and the site each have one smoke spec that mounts the whole app and asserts rows render.
- jsdom compiles no component styles, so style assertions in specs are vacuous. Verify rendered styles in a browser (chrome-devtools MCP).
  </important>
