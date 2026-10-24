# Apps — `apps/`

| App            | Stack                                            | Linked to libraries via | Deployed to                                         |
| -------------- | ------------------------------------------------ | ----------------------- | --------------------------------------------------- |
| `site`         | Vite + React, `@constantine-24/treekit-react`    | source                  | `https://constantine-24.github.io/treekit/`         |
| `demo-react`   | Vite + React, `@constantine-24/treekit-react`    | source                  | `https://constantine-24.github.io/treekit/react/`   |
| `demo-angular` | Angular CLI, `@constantine-24/treekit-angular`   | source                  | `https://constantine-24.github.io/treekit/angular/` |
| `demo-shared`  | private source-only package                      | —                       | — (fixtures, theme, feature list)                   |
| `demo-vanilla` | Vite + plain DOM, `@constantine-24/treekit-core` | **dist**                | not deployed — the published-layout proof           |

`pnpm build:pages` assembles all three deployed apps into `_site/`; `.github/workflows/pages.yml` runs it on every push to `main`.

<important if="you are changing apps/demo-react or apps/demo-angular">

- **The two demos mirror each other.** Same folder layout and component names under `src/app/` (`toolbar/`, `gauges/`, `palette/`, `tree-panel/`, `calipers/`, `status-bar/`, `key-legend/`, `theme-toggle/`), one component per folder, same features, same look. A change to one is made in the other in the same change.
- Fixtures, palette labels, the feature/toggle list and theme tokens come from `demo-shared` — never duplicate them into an app.
- **Import only the public API** (`@constantine-24/treekit-core`, `@constantine-24/treekit-core/tanstack`, `@constantine-24/treekit-angular`, `@constantine-24/treekit-react`). Never reach into `packages/*/src` by relative path — the demos prove the published surface is enough.
  </important>

<important if="you are changing apps/site">

- One page, no router. Code snippets shown on the page must be valid, copy-pasteable usage that matches the root README's quick start.
- After a visible change, refresh the README screenshots `docs/images/demo.png` (light) and `docs/images/demo-dark.png` (dark): the hero viewport at 1280×760, device scale 2.
  </important>

<important if="you are changing how an app resolves the treekit packages, its Vite/Angular config, or its base path">

### The staleness trap source-linking replaced (don't reintroduce it)

The Angular demo used to consume both libraries through build output, which went stale silently in two different ways at once:

1. Vite pre-bundles node_modules deps into `.angular/cache/**/vite/deps/` and does **not** reliably invalidate that when a linked workspace package's `dist/` is rebuilt.
2. The dev server never watched `packages/angular/dist/treekit` at all, so library edits simply never reached the demo.

Together these served a months-old `@constantine-24/treekit-core` while `dist/` was current: `updateOptions` was missing at runtime, the option-push effect threw, change detection aborted mid-cycle, and the tree rendered zero rows with no scrollbar and no clue in the build output.

Source-linking removes both. The backstops:

- `serve.options.prebundle.exclude` in `apps/demo-angular/angular.json`. **List only `@constantine-24/treekit-core` there** — excluding `@constantine-24/treekit-angular` forces esbuild to resolve it from node_modules, where the symlink points at a source package with no `main`/`exports`, and the build fails with `Could not resolve "@constantine-24/treekit-angular"`.
- `optimizeDeps.exclude: ['@constantine-24/treekit-core', '@constantine-24/treekit-react']` in the Vite apps' configs, alongside `resolve.alias` to the sources.

If an app ever renders blank, **check the browser console first** — a throw inside a component `effect()` (Angular) or an effect/render (React) aborts the update before the view refreshes, so a stale-API error presents as a blank component, not as an error banner. `rm -rf apps/demo-angular/.angular/cache node_modules/.vite apps/*/node_modules/.vite` is the escape hatch.

### Base paths

Every deployed app builds at `/` locally and under its Pages sub-path in `pnpm build:pages`: Vite apps read `BASE_PATH` (`base: process.env.BASE_PATH ?? '/'`), the Angular demo gets `--base-href /treekit/angular/`. All asset URLs must be relative so they resolve under either.
</important>
