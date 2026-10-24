# @constantine-24/treekit-angular

## 0.1.0

### Minor Changes

- f1fc3a4: Initial release.

  `@constantine-24/treekit-core` is a headless, zero-dependency engine for virtualized trees with native HTML5
  drag-and-drop, made of five independently attachable layers:

  - `TreeState` — the forest, its flat visible projection, structural mutations (`move`,
    `moveMany`, `add`, `remove`), filtering that never loses expansion state, and lazy loading.
  - `FixedHeightVirtualizer`, and `TanStackVirtualizer` for measured rows at
    `@constantine-24/treekit-core/tanstack` — one `TreeVirtualizer` interface.
  - `DndEngine` — pointer drag-and-drop resolved from pointer position (into / before / after),
    with an insertion line, folder highlight, auto-scroll, spring loading, drag handles,
    multi-node drags and external drag sources. It never mutates the tree: drops are reported
    as a `DropEvent` for you to apply.
  - `KeyboardController` — WAI-ARIA tree navigation plus keyboard drag-and-drop with
    screen-reader announcements.
  - `SelectionModel` — click / ctrl / shift multi-selection with anchored ranges, stored by id.

  `@constantine-24/treekit-angular` (`<tk-tree>`) and `@constantine-24/treekit-react` (`<TkTree>`) are thin adapters over the
  core with the same feature set, the same markup and the same `--tk-*` theming tokens:
  virtualized rendering, custom node templates, empty and loading placeholders, multi-select,
  indent guides, measured rows and an imperative `expandAll` / `collapseAll` / `scrollToNode` API.
