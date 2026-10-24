# Styling

The core ships no CSS. Each adapter ships one default stylesheet with the **same `tk-*` class names and the same `--tk-*` custom properties**:

- `@treekit/angular` — `packages/angular/projects/treekit/src/lib/tree.scss`, component-scoped.
- `@treekit/react` — `packages/react/src/tree.css`, exported as `@treekit/react/styles.css` (the consumer imports it once).

<important if="you are writing CSS or SCSS, modifying component styles, or touching theming">

- Theming happens only through `--tk-*` custom properties. Adding, renaming or removing one is public API (`architecture.md`) and must land in both adapter stylesheets — a spec in `packages/react` compares the two token sets.
- Every visual state needs light **and** dark verification (the demos have a theme toggle; also check the OS scheme).
- Honour `prefers-reduced-motion: reduce` — every transition and animation must be disabled under it.
- Interactive targets are at least 24×24 CSS px (WCAG 2.5.8) where the row height allows it.
- Library stylesheets have no lint coverage. The package build proves they compile, and a browser proves they render.
  </important>

<important if="you are styling apps/site, apps/demo-react, or apps/demo-angular">

- Both demos and the site share one theme: `apps/demo-shared/src/theme.css` (the "instrument panel" tokens `--ink`, `--paper`, `--signal`, `--into`, … in light and dark, plus the IBM Plex fonts). App-local styles reference those tokens; no hard-coded colours.
- The two demos must look identical: a style change in one is made in the other in the same change.
  </important>
