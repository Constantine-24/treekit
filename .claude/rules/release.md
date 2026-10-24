# Release

Three packages are published to npm — `@treekit/core`, `@treekit/angular`, `@treekit/react` — by **Changesets** from `.github/workflows/release.yml`. Pushing to `main` opens or updates a "Version Packages" PR that bumps versions and writes each package's `CHANGELOG.md`; merging that PR publishes. Auth is **npm trusted publishing (OIDC)** with provenance — no npm token is stored in the repository. The root `package.json` and every app are private and never published.

<important if="you are making a user-visible change to a published package">

- Add a changeset: `pnpm changeset` (interactive) or `/changeset` (drafts one from the diff). One changeset per logical change, naming every affected package. Write it for consumers: what changed and what they must do.
- **Semver, pre-1.0:** a breaking change to public API or behaviour is a **minor** bump with a "Breaking changes" list and migration notes; features are minor; fixes are patch. From 1.0 on, breaking means major.
- **The three packages are versioned in lockstep** (`fixed` in `.changeset/config.json`): any release moves all three to the same version, so users only ever need "the same version of every `@treekit/*` package". A changeset still names only the packages that actually changed; their CHANGELOGs get the entry, the others just get the version.
- The adapters' peer range on core is `workspace:0.x` (published as `0.x`), together with `onlyUpdatePeerDependentsWhenOutOfRange`. Don't change it back to `workspace:^`: pre-1.0, `^0.1.0` excludes `0.2.0`, and Changesets answers a peer range left behind with a **major** bump of the dependents — every core minor would push the adapters (and, through `fixed`, everything) to 1.0.0. Run `pnpm changeset status --verbose` after touching the config and check the planned versions. At 1.0 the range becomes `workspace:^`.
- Private workspace packages (the apps, `@treekit/demo-shared`, the Angular workspace) are never versioned (`privatePackages: { version: false, tag: false }`).
- Peer ranges (`@angular/*`, `react`, `react-dom`, `@tanstack/virtual-core`) change only deliberately, with a changeset note.
  </important>

<important if="you are preparing, versioning, or publishing a release">

- **Never run `changeset publish`, `pnpm publish`, `npm publish` or `pnpm release`, and never push tags.** A hook blocks the publish commands. Releases happen only by merging the Version Packages PR.
- Before a release PR merges, run `/release-check` (all gates plus `pnpm pack:check`) and read the tarball lists. Each tarball has `package.json`, `README.md`, `LICENSE` and `dist/` (with `.d.ts`), and no `src/`, specs or `workspace:` specifiers. `@treekit/react` also has `dist/styles.css`.
- Each package directory carries a `LICENSE` that is a **byte-identical copy** of the root `LICENSE` (npm only packs files from inside the package; ng-packagr copies `packages/angular/projects/treekit/LICENSE`). CI compares them with `cmp`.
- `@treekit/angular` publishes from `packages/angular/dist/treekit` (`publishConfig.directory`); pnpm rewrites `workspace:` ranges there at pack time — `pnpm pack:check` proves it, and also runs arethetypeswrong on every tarball.
- The Version Packages PR is opened with `GITHUB_TOKEN`, and GitHub does not trigger other workflows from that token's pushes — so **that PR shows no CI checks**. `pnpm release` re-runs the build, tests and `pack:check` before publishing to compensate; to get real checks on the PR, give `changesets/action` a fine-grained PAT instead.
  </important>

## First publish and trusted publishing (maintainer)

npm trusted publishers are configured per **existing** package, so the very first version of each package cannot come from OIDC:

1. Locally, on an up-to-date `main` after the Version Packages PR merged: `npm login`, then `pnpm build && pnpm changeset publish` (the maintainer runs this — agents never do).
2. On npmjs.com, for each package → Settings → Trusted Publisher: GitHub owner `Constantine-24`, repository `treekit`, workflow `release.yml`, no environment, allow `npm publish`.
3. From then on, `release.yml` publishes through OIDC with provenance (`NPM_CONFIG_PROVENANCE`). After the first OIDC release, check that each npm page shows the provenance badge; if not, have `release.yml` write `provenance=true` to a CI-only `.npmrc` before publishing.
