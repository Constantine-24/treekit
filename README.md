# treekit

Headless, virtualized tree with native HTML5 drag-and-drop. Framework-free core, thin Angular adapter.

Most tree widgets bolt drag-and-drop onto a flow-layout list, which falls apart once the list is
virtualized: placeholder elements shift absolutely-positioned rows, indices lie, and drop feedback
flickers. treekit takes the opposite approach — rows are positioned by a virtualizer, and drop
targets are resolved purely from the pointer position against the rendered rows. No placeholder ever
enters the layout; a single insertion line (or folder highlight) is drawn on top.

## Packages

| Package                                | Description                                                                  |
| -------------------------------------- | ---------------------------------------------------------------------------- |
| [`@treekit/core`](packages/core)       | Zero-dependency headless engine: tree state, virtualization, DnD, keyboard.  |
| [`@treekit/angular`](packages/angular) | Angular component (`<tk-tree>`) over the core. No Material / CDK dependency. |

## Features

- **Virtualized** — renders only visible rows; 10,000+ nodes stay smooth.
- **Native HTML5 drag-and-drop** — in-tree reorder, drop-into-folder, and external drag sources via
  plain `draggable` + `dataTransfer`. Cross-tree and cross-window drags work for free.
- **Precise drop feedback** — pointer-position hit-testing, `into`/`before`/`after` intent (folder
  middle 50% = into), explicit insertion line, edge auto-scroll during drag.
- **Keyboard-accessible DnD** — every pointer drag operation has a keyboard equivalent
  (grab → move → drop) emitting the same events; `role=tree` semantics and live-region announcements.
- **Filtering** — predicate-based; reveals matches plus their ancestors, auto-expanded; restores
  expansion state when cleared; drag stays enabled while filtered.
- **Lazy loading** — expandable nodes without children request them on first expand.
- **Headless** — the core has no framework, no RxJS, no DOM framework assumptions beyond the
  standard DOM APIs. Bring your own rendering, or use the Angular adapter.

## Rules & limitations (read before adopting)

- **Native HTML5 DnD does not fire from touch gestures on Android Chrome.** Desktop, mouse, and pen
  work everywhere; iOS Safari supports native DnD. The keyboard DnD mode is the supported fallback
  on touch devices.
- The built-in virtualizer assumes a **fixed row height** (configurable). Variable / measured row
  heights are supported through the optional `@treekit/core/tanstack` adapter, which requires
  installing `@tanstack/virtual-core`.
- The tree **owns its scroll viewport**. There is no window-scroll / scroll-margin mode.
- v1 drags **one node at a time**. Multi-select and multi-node drag are the headline v2 items.
- RTL layouts are untested in v1.

## Development

```sh
corepack enable pnpm
pnpm install
pnpm build     # build all packages
pnpm test      # run all test suites
pnpm lint
```

Releases are versioned with [Changesets](https://github.com/changesets/changesets).

## License

MIT
