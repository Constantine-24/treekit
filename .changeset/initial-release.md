---
'@treekit/core': minor
'@treekit/angular': minor
'@treekit/react': minor
---

Initial release.

`@treekit/core` is a headless, zero-dependency engine for virtualized trees with native HTML5
drag-and-drop, made of five independently attachable layers:

- `TreeState` — the forest, its flat visible projection, structural mutations (`move`,
  `moveMany`, `add`, `remove`), filtering that never loses expansion state, and lazy loading.
- `FixedHeightVirtualizer`, and `TanStackVirtualizer` for measured rows at
  `@treekit/core/tanstack` — one `TreeVirtualizer` interface.
- `DndEngine` — pointer drag-and-drop resolved from pointer position (into / before / after),
  with an insertion line, folder highlight, auto-scroll, spring loading, drag handles,
  multi-node drags and external drag sources. It never mutates the tree: drops are reported
  as a `DropEvent` for you to apply.
- `KeyboardController` — WAI-ARIA tree navigation plus keyboard drag-and-drop with
  screen-reader announcements.
- `SelectionModel` — click / ctrl / shift multi-selection with anchored ranges, stored by id.

`@treekit/angular` (`<tk-tree>`) and `@treekit/react` (`<TkTree>`) are thin adapters over the
core with the same feature set, the same markup and the same `--tk-*` theming tokens:
virtualized rendering, custom node templates, empty and loading placeholders, multi-select,
indent guides, measured rows and an imperative `expandAll` / `collapseAll` / `scrollToNode` API.
