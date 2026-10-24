# `@constantine-24/treekit-core` — internals

The headless engine. Read `.claude/rules/architecture.md` first for the layer map; this file holds the invariants of each layer. Zero runtime dependencies, no framework, no DOM assumptions beyond standard APIs.

## 1. `TreeState<T>` — `src/tree/tree-state.ts`

Owns the forest, its flat depth-first projection, and all structural mutations. Consumers map domain data into nested `TreeInput<T>`; state builds linked flat `TreeNode<T>`s from it.

- **Children arrays are the single source of order.** After _every_ structural mutation, `_recompute()` rebuilds the flat list, id map, `level`s, parent links, filter sets, and visible list from the roots — O(n). Virtualized rendering absorbs this easily, and flat order can never drift from the hierarchy. Don't add incremental splice paths.
- **Node object references are stable** across recomputes; the arrays from `nodes()`/`visibleNodes()` get a new identity on every change (suits framework change detection).
- Filtering never mutates `isExpanded`. It computes `_filterKeepIds` (matches + ancestors) and `_filterAncestorIds` (ancestors only, rendered force-expanded), so clearing the filter restores the prior view. `isExpandedNow(node)` is the render-time truth, not `node.isExpanded`.
- Lazy loading: expanding an `expandable` node with no children calls `onLoadChildren` and sets `isLoading` instead of toggling; the consumer replies with `setChildren`.

## 2. `TreeVirtualizer` — `src/virtualizer/`

`attach` / `setCount` / `totalSize` / `items` / optional `measure` + `scrollToIndex`.

**Contract rule: all geometry must flow through `items()`' `start`/`size` — never `index × rowHeight`.** The interface is shaped for the variable-height superset so measured-row implementations work with no consumer change. `FixedHeightVirtualizer` is the only place in the library allowed to derive geometry from `index × rowHeight`.

`TanStackVirtualizer` lives at the `@constantine-24/treekit-core/tanstack` subpath (`src/tanstack.ts`) specifically to keep `@tanstack/virtual-core` an _optional_ peer dependency.

## 3. `DndEngine<T>` — `src/dnd/dnd-engine.ts`

Native HTML5 drag-and-drop. **Never inserts anything into the layout.**

- Target resolution: `document.elementFromPoint(x, y).closest('[data-node-id]')`, then look the id up in `getVisibleNodes()`.
- Intent: `resolveDropIntent(isFolder, fraction)` — pure, testable without layout. Folder middle 50% (fraction 0.25–0.75) = `into`; otherwise the pointer half picks `before`/`after`.
- Feedback is a folder highlight plus one overlay insertion line, positioned **relative to the content element** (the transformed container), which is why `attach(viewport, content)` takes both.
- The engine binds its own native listeners on attach. Adapters must not also bind framework-level drag handlers on rows.
- A document-level `dragend` bound once per drag guarantees teardown even when the drag aborts or drops outside the tree.
- External drag sources need no integration: plain `draggable` + `dataTransfer` arrives as a drop with `node: null` and `nodes: []`.
- Spring loading (`springLoadDelay` + `onSpringLoad`) follows the same report-don't-mutate rule as `onDrop`: the engine times the hover, the consumer calls `expand`. The timer is keyed on the hovered node, so the stream of `dragover` events from a stationary pointer does not restart it.
- `dragHandleSelector` cancels `dragstart` outside a grip. Rows stay `draggable`, since the browser needs that to begin a drag at all.
- `updateOptions` exists so adapters can change scalar options without detaching (which would reset focus and any in-flight drag).

## 4. `KeyboardController<T>` — `src/keyboard/keyboard-controller.ts`

ARIA tree navigation (roving active row, arrows, Home/End, expand/collapse) plus keyboard DnD: Space grabs, arrows step a preview through the same into/before/after positions, Space drops, Escape cancels. This is the **supported fallback on touch**, since native HTML5 drag doesn't fire from touch gestures on all platforms.

`_candidates()` enumerates drop positions in visual top-to-bottom order and is the trickiest piece: an expanded folder's own `after` coincides visually with its last descendant's, so it is represented there and omitted on the folder itself.

## 5. `SelectionModel<T>` — `src/selection/selection-model.ts`

Multi-selection with the anchor tracking that ranges need. Deliberately _not_ inside `TreeState`: selection is not structural, and every `TreeState` mutator ends in an O(n) recompute plus a notification — moving a highlight must not pay that.

Three rules carry most of the design weight:

- **Ids, not node references**, so a selection survives `setSource` and node churn.
- **`selectedNodes()` is visible-only** while `selectedIds()` keeps hidden ids. That single rule kills the class of bugs where a node hidden by collapse or filter silently rides along in a drag.
- **Selection is explicit** — selecting a folder never implies its descendants. Forced by drag semantics: `move` already relocates a whole subtree, so implied descendants would ask to move them independently _and_ inside their parent.

Payload normalization lives with the tree, not here: `denestNodes` / `normalizeDragNodes` in `tree-state.ts`. In `normalizeDragNodes` the `canDrag` filter **must** run before de-nesting — for a locked folder plus its draggable child, filtering first yields the child, de-nesting first yields nothing.

## Testing

See `.claude/rules/testing.md`: jsdom geometry mocks, and the virtualizer conformance suite in `src/virtualizer/conformance.spec.ts`.
