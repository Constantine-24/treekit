---
description: Draft a changeset for the current diff (affected packages, bump level, consumer-facing notes)
argument-hint: [optional summary hint]
---

# /changeset $ARGUMENTS

Draft a changeset for the work on the current branch, following `.claude/rules/release.md`. **Do not version, publish, tag or push.**

1. **Find the diff.** `git diff --name-only main...HEAD` plus uncommitted changes (`git status --porcelain`).
2. **Map files to packages.** `packages/core/**` → `@constantine-24/treekit-core`; `packages/angular/projects/treekit/**` → `@constantine-24/treekit-angular`; `packages/react/**` → `@constantine-24/treekit-react`. Ignore specs-only, apps, docs and tooling changes. If no published package changed in a user-visible way, stop and say no changeset is needed.
3. **Pick the bump per package** (pre-1.0 rules): breaking public API or behaviour → `minor` with a "Breaking changes" list; new feature → `minor`; fix → `patch`. A change to the core that also changes adapter behaviour names the adapters too.
4. **Check for an existing changeset** in `.changeset/*.md` that already covers this work on the branch; update it instead of adding a second one.
5. **Write** `.changeset/<kebab-case-summary>.md`:

   ```md
   ---
   '@constantine-24/treekit-core': minor
   ---

   One-paragraph summary for consumers: what changed and why it matters.

   Breaking changes (pre-1.0):

   - What broke, and the one-line migration.
   ```

   Use `$ARGUMENTS` as a hint for the summary if given. Write for people upgrading, not for reviewers: no internal file names, no implementation detail.

6. **Report** the file path, the packages and bump levels, and any judgement call (e.g. "treated X as a fix, not a feature").
