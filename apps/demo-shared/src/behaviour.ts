import {
  DropEvent,
  DropMode,
  FixedHeightVirtualizer,
  resolveDropIntent,
  TreeNode,
  TreeState,
  TreeVirtualizer,
} from '@treekit/core';
import { TanStackVirtualizer } from '@treekit/core/tanstack';

import { DemoItem, LAZY_LOAD_DELAY, OVERSCAN, remoteChildren, ROW_HEIGHT } from './fixtures';
import { PALETTE_MIME } from './features';

/** Creates the showcase state; lazy folders resolve after a simulated delay. */
export function createDemoState(): TreeState<DemoItem> {
  const state: TreeState<DemoItem> = new TreeState<DemoItem>({
    onLoadChildren: node => {
      setTimeout(() => state.setChildren(node, remoteChildren()), LAZY_LOAD_DELAY);
    },
  });
  return state;
}

/** The fixed-height virtualizer, or TanStack's measuring one for "Measured rows". */
export function createVirtualizer(measured: boolean): TreeVirtualizer {
  return measured
    ? new TanStackVirtualizer({ estimateSize: () => ROW_HEIGHT, overscan: OVERSCAN })
    : new FixedHeightVirtualizer({ rowHeight: ROW_HEIGHT, overscan: OVERSCAN });
}

/** A case-insensitive name filter, or `null` to clear it. */
export function nameFilter(query: string): ((node: TreeNode<DemoItem>) => boolean) | null {
  const normalized = query.trim().toLowerCase();
  return normalized ? node => node.name.toLowerCase().includes(normalized) : null;
}

/**
 * Applies a drop the way an app would: the library only reports it. Moves
 * dragged rows, or adds a row for a palette chip dropped from outside the tree.
 *
 * @returns A status line describing what happened, or `null` if nothing did.
 */
export function applyDrop(
  state: TreeState<DemoItem>,
  drop: DropEvent<DemoItem>,
  nextId: () => string
): string | null {
  const target = drop.target;
  if (!target) {
    return null;
  }
  if (drop.nodes.length > 0) {
    if (!state.moveMany([...drop.nodes], target)) {
      return null;
    }
    const what = drop.nodes.length === 1 ? drop.nodes[0]!.name : `${drop.nodes.length} rows`;
    return `Moved ${what} ${target.mode} ${target.node.name}`;
  }
  const label = drop.dataTransfer?.getData(PALETTE_MIME);
  if (!label) {
    return null;
  }
  state.add({ id: nextId(), name: label, item: { kind: 'sensor' } }, target);
  return `Added ${label} ${target.mode} ${target.node.name}`;
}

/** Sets up a palette chip drag: an external source the tree needs no integration for. */
export function startPaletteDrag(event: DragEvent, label: string): void {
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData(PALETTE_MIME, label);
    event.dataTransfer.setData('text/plain', label);
  }
}

/**
 * Live reading of the drop decision under the pointer.
 *
 * The demo resolves this itself from the pointer position and the row's
 * rectangle, then calls the library's own exported `resolveDropIntent` — so the
 * readout is the real decision function, not a description of it.
 */
export interface DropProbe {
  name: string;
  isFolder: boolean;
  fraction: number;
  mode: DropMode;
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Recomputes the drop decision for the row under the pointer.
 *
 * Deliberately mirrors what `DndEngine` does internally — hit-test with
 * `elementFromPoint`, take the pointer's fraction within the row's rect, hand
 * both to `resolveDropIntent` — so the page shows the library's real
 * arithmetic rather than an illustration of it.
 */
export function probeDrop(
  state: TreeState<DemoItem>,
  clientX: number,
  clientY: number
): DropProbe | null {
  const row = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-node-id]');
  const node = row && state.findById(row.getAttribute('data-node-id') ?? '');
  if (!row || !node) {
    return null;
  }
  const rect = row.getBoundingClientRect();
  const fraction = rect.height > 0 ? (clientY - rect.top) / rect.height : 0;
  const isFolder = !!node.isFolder;
  return {
    name: node.name,
    isFolder,
    fraction,
    mode: resolveDropIntent(isFolder, fraction),
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

/** `0.4321` → `"0.43"`. */
export function formatFraction(fraction: number): string {
  return fraction.toFixed(2);
}

/**
 * Reports how many tree rows are actually in the DOM — the number the whole
 * library exists to keep small — whenever it changes.
 *
 * Observes the DOM rather than reading adapter internals, so the React and
 * Angular showcases measure it identically.
 *
 * @returns A function that stops observing.
 */
export function observeRenderedRows(
  container: HTMLElement,
  onCount: (count: number) => void
): () => void {
  let frame = 0;
  let last = -1;
  const report = () => {
    frame = 0;
    const count = container.querySelectorAll('.tk-row').length;
    if (count !== last) {
      last = count;
      onCount(count);
    }
  };
  const observer = new MutationObserver(() => {
    frame ||= requestAnimationFrame(report);
  });
  observer.observe(container, { childList: true, subtree: true });
  report();
  return () => {
    observer.disconnect();
    cancelAnimationFrame(frame);
  };
}
