---
description: Run every gate plus the package-tarball check before a release PR merges. Never publishes.
---

# /release-check

Verify that `main` (or the Version Packages PR branch) is releasable, following `.claude/rules/release.md`. **Never publish, tag or push** — a hook blocks publish commands anyway.

1. **Preconditions.** `git status --porcelain` is empty. Report the branch and `git log -1 --oneline`.
2. **Pending changesets.** Run `pnpm changeset status --verbose` and report the planned versions: all three `@treekit/*` packages must land on the **same** version, and nothing may jump to `1.0.0` by accident (see the peer-range note in `release.md`). List `.changeset/*.md` (excluding `README.md`) with their packages and bump levels. On a Version Packages branch there should be none left, and each package's `CHANGELOG.md` should have the new version at the top.
3. **Gates** (stop at the first failure and report it verbatim):
   1. `pnpm install --frozen-lockfile`
   2. `pnpm format:check`
   3. `pnpm build`
   4. `pnpm lint`
   5. `pnpm test`
   6. `pnpm --filter @treekit/core typecheck && pnpm --filter @treekit/react typecheck`
   7. LICENSE parity: `cmp LICENSE packages/core/LICENSE && cmp LICENSE packages/react/LICENSE && cmp LICENSE packages/angular/projects/treekit/LICENSE`
   8. `pnpm pack:check`
   9. `pnpm build:pages`
4. **Tarballs.** For each of `@treekit/core`, `@treekit/angular`, `@treekit/react`, report name, version, file count and packed size, and confirm: `package.json`, `README.md`, `LICENSE`, `dist/` with `.d.ts`; no `src/` or specs; no `workspace:` specifier in the packed `package.json`; `@treekit/react` includes `dist/styles.css`.
5. **Hand-off.** Summarise pass/fail. If everything passes, the maintainer merges the Version Packages PR; CI publishes through OIDC (`release.yml`).
