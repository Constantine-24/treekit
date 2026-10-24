# CLAUDE.md

**treekit** — an open-source, framework-agnostic virtualized tree with native HTML5 drag-and-drop and keyboard-accessible DnD. A headless, zero-dependency engine (`@treekit/core`) plus thin adapters for Angular (`@treekit/angular`) and React (`@treekit/react`), all published to npm from this pnpm monorepo. The landing page and two mirrored showcases (`apps/`) deploy to GitHub Pages at `https://constantine-24.github.io/treekit/`.

You are an expert in TypeScript, Angular, React and accessible, publishable UI libraries. Everything under `packages/` is public API that other people install: favour backwards compatibility, documentation and test coverage over cleverness, and keep the two adapters in parity.

Use the MCP tools where they know more than training data: **context7** for Angular / React / Vite / Vitest / TanStack Virtual / Changesets / GitHub Actions APIs (the installed versions are newer than most training data), and **chrome-devtools** for live UI and accessibility verification of the apps. Raw Read/Edit/Grep and Bash remain the right tools for plain-text search and shell work.

Per-developer overrides go in `CLAUDE.local.md` (gitignored, auto-loaded alongside this file).

## Rule modules

Project-wide rules live under `.claude/rules/` and are loaded via `@`-import below. They are the single source of truth; `AGENTS.md`, `.cursor/rules/` and `.codex/` only point here.

@.claude/rules/architecture.md
@.claude/rules/commands.md
@.claude/rules/code-style.md
@.claude/rules/testing.md
@.claude/rules/styling.md
@.claude/rules/accessibility.md
@.claude/rules/workflow.md
@.claude/rules/review-gate.md
@.claude/rules/release.md
@.claude/rules/limitations.md

## Area-specific rules (lazy-loaded)

These auto-load only when working in the relevant directory:

- `packages/core/CLAUDE.md` — the five layers' internals and invariants
- `packages/angular/CLAUDE.md` — Angular adapter: zoneless split, `_version` signal, NG0950, untracked scalar inputs
- `packages/react/CLAUDE.md` — React adapter: external store, latest-value refs, StrictMode, no synthetic drag handlers
- `apps/CLAUDE.md` — site and demos: mirroring rule, source-linking and the staleness trap, Pages base paths

Deferred work lives in `BACKLOG.md`; contributor docs in `CONTRIBUTING.md`.

## Slash commands

- `/pr-review-toolkit:review-pr` — the review gate. Run it per chunk and before marking any task complete, with `.claude/rules/review-gate.md` applied on top.
- `/changeset` — draft a changeset for the current diff. See `.claude/commands/changeset.md`.
- `/release-check` — run every gate plus the package-tarball check before a release PR merges. Never publishes. See `.claude/commands/release-check.md`.
