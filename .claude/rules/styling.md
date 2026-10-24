# Styling

The core ships no CSS. Each adapter ships one default stylesheet with the **same `tk-*` class names and the same `--tk-*` custom properties**:

- `@constantine-24/treekit-angular` — `packages/angular/projects/treekit/src/lib/tree.scss`, component-scoped.
- `@constantine-24/treekit-react` — `packages/react/src/tree.css`, exported as `@constantine-24/treekit-react/styles.css` (the consumer imports it once).

<important if="you are writing CSS or SCSS, modifying component styles, or touching theming">

- Theming happens only through `--tk-*` custom properties. Adding, renaming or removing one is public API (`architecture.md`) and must land in both adapter stylesheets — a spec in `packages/react` compares the two token sets.
- Every visual state needs light **and** dark verification (the demos have a theme toggle; also check the OS scheme).
- Honour `prefers-reduced-motion: reduce` — every transition and animation must be disabled under it.
- Interactive targets are at least 24×24 CSS px (WCAG 2.5.8) where the row height allows it.
- Library stylesheets have no lint coverage. The package build proves they compile, and a browser proves they render.
  </important>

<important if="you are styling apps/site, apps/demo-react, or apps/demo-angular">

- Both demos and the site share one theme: `apps/demo-shared/src/theme.css` — the "instrument panel" tokens (`--ink`, `--ink-muted`, `--ground`, `--panel`, `--rule`, `--signal`, `--into`, …) for light, dark-by-OS and the `<html data-theme>` toggle, plus the mapping of `--tk-*` onto them. Fonts are IBM Plex via `@fontsource`, imported per app. App styles reference the tokens; no hard-coded colours.
- The two demos have **no styles of their own**: their whole layout is `apps/demo-shared/src/demo.css`, written against the class each component puts on its root element (an Angular `host: { class }`, a React root element). So they cannot drift apart visually — keep it that way and add new demo styles there.
- Amber (`--into`) means exactly one thing — an `into` drop. Don't reuse it.
  </important>
