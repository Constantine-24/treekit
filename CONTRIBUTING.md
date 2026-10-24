# Contributing

Thanks for your interest in improving **treekit**! Bug reports, docs fixes and pull requests are all welcome.

## Getting started

```bash
git clone https://github.com/Constantine-24/treekit.git
cd treekit
nvm use               # Node version from .nvmrc
corepack enable       # pnpm version from package.json "packageManager"
pnpm install
pnpm build            # core → adapters → apps
```

Then run whichever app you're working against — all of them except `demo-vanilla` use the library **sources** live, so edits hot-reload without a rebuild:

```bash
pnpm --filter site dev            # landing page
pnpm --filter demo-react dev      # React showcase
pnpm --filter demo-angular start  # Angular showcase on http://localhost:4200
```

## Project layout

| Path                                     | What                                                                        |
| ---------------------------------------- | --------------------------------------------------------------------------- |
| `packages/core/`                         | `@treekit/core` — the headless, zero-dependency engine                      |
| `packages/angular/projects/treekit`      | `@treekit/angular` — the Angular adapter (inside an Angular CLI workspace)  |
| `packages/react/`                        | `@treekit/react` — the React adapter                                        |
| `apps/site/`                             | The landing page, deployed to GitHub Pages                                  |
| `apps/demo-react/`, `apps/demo-angular/` | Two mirrored showcases (shared fixtures and theme in `apps/demo-shared/`)   |
| `apps/demo-vanilla/`                     | Plain-DOM usage of the core, built against the published package layout     |
| `.claude/rules/`                         | Engineering rules — they apply to humans too. Read `architecture.md` first. |

## Development loop

```bash
pnpm --filter @treekit/core exec vitest run src/tree/tree-state.spec.ts   # scoped core tests
pnpm --filter @treekit/react exec vitest run                              # React adapter tests
(cd packages/angular && pnpm ng test --include 'src/lib/tree.spec.ts')    # Angular adapter tests
pnpm test            # everything
pnpm lint            # ESLint (core + react)
pnpm format          # Prettier
```

## Pull requests

1. Open an issue first for anything beyond a small fix, so we can agree on the API.
2. Branch from `main` (`feat/…`, `fix/…`, `docs/…`).
3. Write a failing test first. A change to one adapter comes with the same change — and the same spec — in the other.
4. Keep the accessibility contract: ARIA tree semantics, keyboard navigation and keyboard drag-and-drop, WCAG AA contrast in light and dark.
5. Add a changeset (`pnpm changeset`) for any user-visible change to a published package.
6. Use [Conventional Commits](https://www.conventionalcommits.org/) (`fix(core): …`, `feat(react): …`).

CI must be green (format, build, lint, tests, package check, Pages build) before merge.

## Releases

Releases are automated with [Changesets](https://github.com/changesets/changesets): merged changesets accumulate in a "Version Packages" PR, and merging that PR publishes to npm with provenance. See `.claude/rules/release.md`.

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
