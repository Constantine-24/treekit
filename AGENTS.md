# AGENTS.md

**treekit** — a framework-agnostic virtualized tree with native drag-and-drop: `@treekit/core` (headless, zero dependencies), `@treekit/angular` and `@treekit/react`, published to npm from this pnpm monorepo, plus a landing page and two mirrored demos deployed to GitHub Pages.

This file exists for cross-tool compatibility (Codex, Cursor, Aider, Copilot, …). The authoritative guidance for AI agents is **[CLAUDE.md](./CLAUDE.md)** and the rule modules under **[`.claude/rules/`](./.claude/rules/)**. Read them as the source of truth; this file only points at them and must not restate them.

## Project map

- `packages/core/` — `@treekit/core`, the headless engine (+ `@treekit/core/tanstack`)
- `packages/angular/projects/treekit/` — `@treekit/angular` (inside the `packages/angular` Angular CLI workspace)
- `packages/react/` — `@treekit/react`
- `apps/site/` — landing page (GitHub Pages root)
- `apps/demo-react/`, `apps/demo-angular/` — the two mirrored showcases; `apps/demo-shared/` — their shared fixtures and theme
- `apps/demo-vanilla/` — headless, dist-linked proof
- `.changeset/` — pending release notes; `BACKLOG.md` — deferred work
- `.github/` — CI, GitHub Pages deploy, Changesets release workflows; issue/PR templates

## Rule modules (project-wide — read all of them)

- [.claude/rules/architecture.md](./.claude/rules/architecture.md) — packages, the five core layers, adapter parity, public-API discipline
- [.claude/rules/commands.md](./.claude/rules/commands.md) — build / test / lint / verification gates, source- vs dist-linking
- [.claude/rules/code-style.md](./.claude/rules/code-style.md)
- [.claude/rules/testing.md](./.claude/rules/testing.md)
- [.claude/rules/styling.md](./.claude/rules/styling.md)
- [.claude/rules/accessibility.md](./.claude/rules/accessibility.md)
- [.claude/rules/workflow.md](./.claude/rules/workflow.md) — branches, Conventional Commits, TDD, changesets
- [.claude/rules/review-gate.md](./.claude/rules/review-gate.md) — review process + Required checks
- [.claude/rules/release.md](./.claude/rules/release.md) — Changesets + npm trusted publishing
- [.claude/rules/limitations.md](./.claude/rules/limitations.md) — deliberate v1 boundaries

## Area-specific rules (read when working in that directory)

- [packages/core/CLAUDE.md](./packages/core/CLAUDE.md)
- [packages/angular/CLAUDE.md](./packages/angular/CLAUDE.md)
- [packages/react/CLAUDE.md](./packages/react/CLAUDE.md)
- [apps/CLAUDE.md](./apps/CLAUDE.md)

## Commands & skills

- Changeset drafting: [.claude/commands/changeset.md](./.claude/commands/changeset.md) (Claude Code `/changeset`) — mirrored as the Codex skill [.agents/skills/changeset/SKILL.md](./.agents/skills/changeset/SKILL.md).
- Release verification: [.claude/commands/release-check.md](./.claude/commands/release-check.md) (Claude Code `/release-check`) — mirrored as [.agents/skills/release-check/SKILL.md](./.agents/skills/release-check/SKILL.md).
- Review: [.claude/rules/review-gate.md](./.claude/rules/review-gate.md) — apply its Required checks with whichever review runner your tool has.

## Enforcement

Rules that are enforced deterministically rather than as prose:

- **ESLint** (`pnpm lint`: `packages/core`, `packages/react`) and **Prettier** (`pnpm format:check`) — both run in CI.
- **Hooks** — `.claude/settings.json` → `.claude/hooks/*`; Codex mirrors them in `.codex/hooks.json` pointing at the same scripts:
  - PreToolUse (Bash): block npm/yarn dependency commands, any publish command, and direct `vitest` in the Angular workspace.
  - PostToolUse (Edit/Write): `prettier --write` the edited file.
- **CI** (`.github/workflows/ci.yml`) — format, build, lint, tests, LICENSE parity, package-tarball check, Pages build.

## MCP

[`.codex/config.toml`](./.codex/config.toml) registers `context7` (library docs) and `chrome-devtools` (live UI / a11y verification). Claude Code users get the same through their own MCP configuration; VS Code gets the Angular CLI MCP server from `.vscode/mcp.json`.
