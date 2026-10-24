# Review Gate

The review gate is **`/pr-review-toolkit:review-pr`** (requires the `pr-review-toolkit` plugin). It drives the specialist agents (`code-reviewer`, `silent-failure-hunter`, `pr-test-analyzer`, `comment-analyzer`, `type-design-analyzer`, `code-simplifier`) but knows nothing about this project. This file is the project delta to apply on top of it. Codex and other tools without the plugin run the same agents' roles manually, with the same deltas.

<important if="you are running a code review, dispatching any review or simplifier subagent, or about to mark a task complete">

- **Give every agent this project's rules**: `CLAUDE.md`, `CLAUDE.local.md` (if present), `.claude/rules/*.md`, and every subdirectory `CLAUDE.md` relevant to the diff. Without them the findings are generic noise.
- **Include the Required checks below verbatim** in the `code-reviewer` prompt, on the first pass and on the verify pass.
- **Suggestions are never auto-applied.** Only Critical and Important findings are mandatory fixes.
- **Run per chunk** — after each completed slice, not once at the end.
- **Verify after simplifying** by re-running `code-reviewer` plus each agent that raised a Critical or Important finding. Only `silent-failure-hunter` reliably catches a simplifier collapsing an error path into an optimistic one.
- **Hard cap: 2 simplify passes per chunk.** Past that, stop and raise it — repeated findings mean a design problem.
- **Reviewers may run on outdated framework knowledge.** Before acting on a flagged idiom, check it against the shipped sibling code and current docs (context7). Known false positives: "add `allowSignalWrites`" (removed in Angular 19), "add `standalone: true`" or "add `OnPush`" (defaults now), "add zone.js" (the repo is zoneless on purpose), "memoise every callback with `useCallback`" (the React adapter reads callbacks from a latest-value ref instead — see `packages/react/CLAUDE.md`).
- After any agent wave, assert `git status` is clean of unexpected changes before trusting a gate result or committing.
  </important>

## Required checks

These are blocking, specific to this project, and can't be deferred to a follow-up PR.

- **Public API discipline.** No unintended change to anything exported from a package entry point, or to any selector, input, output, prop, CSS class or `--tk-*` property. Intended changes have TSDoc, a changeset, README updates, and — if breaking — a `!` commit.
- **The core stays headless.** `@constantine-24/treekit-core` imports no framework and no runtime dependency; `@tanstack/virtual-core` is imported only from `src/tanstack.ts`.
- **The core never mutates on drop.** Engines report through `onDrop` / `onSpringLoad`; only consumer or adapter code calls `move` / `add` / `expand`.
- **Geometry contract.** No `index × rowHeight` outside `FixedHeightVirtualizer`; a new virtualizer is in the conformance suite.
- **Adapter parity.** A feature, fix, prop/input, class or token changed in one adapter is changed in the other, with a spec in both, or recorded in `BACKLOG.md` with the reason.
- **No dead code.** No unused exports, members, imports, unreachable branches, or commented-out blocks.
- **No leaks.** Every `addEventListener`, `subscribe`, timer, `ResizeObserver` and `requestAnimationFrame` has matching teardown — including on React StrictMode's mount → unmount → mount.
- **No `any`**, no `enum`, no decorator-based Angular inputs/outputs/host bindings.
- **Accessibility.** New or changed interactive UI keeps the contract in `accessibility.md` and has a keyboard-path spec.
- **No blank-render blind spot.** Adapter changes keep the async-render specs described in `testing.md`.

## Conflict precedence

Highest applicable rule wins:

```
1. CLAUDE.md / CLAUDE.local.md / .claude/rules/*.md / subdirectory CLAUDE.md
2. Plan adherence (no scope creep)
3. Agent finding severity
```
