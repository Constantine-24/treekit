# Backlog

Deferred work, newest first. Each item says why it was deferred and what "done" means. Pick an item up on its own branch (`.claude/rules/workflow.md`) and delete it from here in the same PR.

## Tooling

### ESLint for the Angular workspace

- **Why deferred:** `packages/angular` is a standalone Angular CLI workspace on its own TypeScript version, and adding `angular-eslint` means choosing a config that agrees with the root naming rules (`_camelCase` privates, explicit module boundary types) without fighting the Angular style guide. It was out of scope for the publish preparation.
- **Done when:** `pnpm lint` also lints `packages/angular/projects/treekit` and `apps/demo-angular` with `angular-eslint` (`tsRecommended`, `templateRecommended`, `templateAccessibility`) plus the root naming rules, at 0 warnings, and CI runs it.

## Adapter follow-ups

Found in the review of the React adapter (2026-10-24). Both change public behaviour, so each needs a changeset.

- **`rowHeight` overrides a custom fixed-height virtualizer.** Both adapters push `rowHeight` (default `32`) into any `FixedHeightVirtualizer`, including one the consumer passed via `virtualizer` with its own height. The docs say `rowHeight` is for the default virtualizer. Done when the push is skipped for a consumer-supplied virtualizer (or the docs say otherwise), in both adapters, with a spec in each.
- **Node template context parity.** React's `renderNode` receives `{ index, row }` (the full `TkTreeRow` render model); Angular's `tkTreeNodeDef` context is `{ $implicit, node, index }` with no `row`. Done when Angular's context also exposes `row`, documented in its README.

## Library follow-ups

These are the deliberate v1 boundaries from `.claude/rules/limitations.md`. Each is a design change with its own plan, not a fix.

- **Window-scroll mode:** the tree currently owns its scroll viewport. Done when a virtualizer can be driven by the window scroll with no consumer-visible API change beyond an option.
- **RTL:** untested. Done when the indentation, insertion line and arrow-key semantics are verified (and specced) under `dir="rtl"` in both adapters.
- **Touch drag-and-drop:** native HTML5 DnD does not fire from touch gestures on Android Chrome; keyboard DnD is the fallback. Done when a pointer-events based drag path exists behind an option, reusing `resolveDropIntent`.
