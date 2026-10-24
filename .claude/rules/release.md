# Release

Three packages are published to npm — `@treekit/core`, `@treekit/angular`, `@treekit/react` — by **Changesets** from `.github/workflows/release.yml`. Pushing to `main` opens or updates a "Version Packages" PR that bumps versions and writes each package's `CHANGELOG.md`; merging that PR publishes. Auth is **npm trusted publishing (OIDC)** with provenance — no npm token is stored in the repository. The root `package.json` and every app are private and never published.

<important if="you are making a user-visible change to a published package">

- Add a changeset: `pnpm changeset` (interactive) or `/changeset` (drafts one from the diff). One changeset per logical change, naming every affected package. Write it for consumers: what changed and what they must do.
- **Semver, pre-1.0:** a breaking change to public API or behaviour is a **minor** bump with a "Breaking changes" list and migration notes; features are minor; fixes are patch. From 1.0 on, breaking means major.
- `@treekit/angular` and `@treekit/react` depend on `@treekit/core` via `workspace:^`; Changesets bumps their dependency range when core moves (`updateInternalDependencies: patch`).
- Peer ranges (`@angular/*`, `react`, `react-dom`, `@tanstack/virtual-core`) change only deliberately, with a changeset note.
  </important>

<important if="you are preparing, versioning, or publishing a release">

- **Never run `changeset publish`, `pnpm publish`, `npm publish` or `pnpm release`, and never push tags.** A hook blocks the publish commands. Releases happen only by merging the Version Packages PR.
- Before a release PR merges, run `/release-check` (all gates plus `pnpm pack:check`) and read the tarball lists. Each tarball has `package.json`, `README.md`, `LICENSE` and `dist/` (with `.d.ts`), and no `src/`, specs or `workspace:` specifiers. `@treekit/react` also has `dist/styles.css`.
- Each package directory carries a `LICENSE` that is a **byte-identical copy** of the root `LICENSE` (npm only packs files from inside the package; ng-packagr copies `packages/angular/projects/treekit/LICENSE`). CI compares them with `cmp`.
- `@treekit/angular` publishes from `packages/angular/dist/treekit` (`publishConfig.directory`); pnpm rewrites `workspace:^` there at pack time — `pnpm pack:check` proves it.
  </important>

## First publish and trusted publishing (maintainer)

npm trusted publishers are configured per **existing** package, so the very first version of each package cannot come from OIDC:

1. Locally, on an up-to-date `main` after the Version Packages PR merged: `npm login`, then `pnpm build && pnpm changeset publish` (the maintainer runs this — agents never do).
2. On npmjs.com, for each package → Settings → Trusted Publisher: GitHub owner `Constantine-24`, repository `treekit`, workflow `release.yml`, no environment, allow `npm publish`.
3. From then on, `release.yml` publishes through OIDC with provenance.
