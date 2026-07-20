import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TreeInput, TreeNode } from './model';
import { TreeState } from './tree-state';

/**
 * Builds the standard fixture forest:
 *
 * a (folder)
 *   a1
 *   a2 (folder)
 *     a2x
 * b (folder, empty)
 * c (leaf)
 */
function fixture(): TreeInput<string>[] {
  return [
    {
      id: 'a',
      name: 'Alpha',
      item: 'A',
      isFolder: true,
      children: [
        { id: 'a1', name: 'Alpha One', item: 'A1' },
        {
          id: 'a2',
          name: 'Alpha Two',
          item: 'A2',
          isFolder: true,
          children: [{ id: 'a2x', name: 'Deep', item: 'A2X' }],
        },
      ],
    },
    { id: 'b', name: 'Beta', item: 'B', isFolder: true, children: [] },
    { id: 'c', name: 'Gamma', item: 'C' },
  ];
}

function ids(nodes: readonly TreeNode<string>[]): string[] {
  return nodes.map(node => node.id);
}

describe('TreeState', () => {
  let state: TreeState<string>;

  beforeEach(() => {
    state = new TreeState<string>();
    state.setSource(fixture());
  });

  describe('setSource / flatten', () => {
    it('flattens the forest depth-first with levels and parent links', () => {
      expect(ids(state.nodes())).toEqual(['a', 'a1', 'a2', 'a2x', 'b', 'c']);
      const a2x = state.findById('a2x')!;
      expect(a2x.level).toBe(2);
      expect(a2x.parent?.id).toBe('a2');
      expect(state.findById('a')!.parent).toBeNull();
      expect(state.findById('a')!.level).toBe(0);
    });

    it('starts collapsed by default, so only roots are visible', () => {
      expect(ids(state.visibleNodes())).toEqual(['a', 'b', 'c']);
    });

    it('respects isExpanded from the input', () => {
      const source = fixture();
      source[0]!.isExpanded = true;
      state.setSource(source);
      expect(ids(state.visibleNodes())).toEqual(['a', 'a1', 'a2', 'b', 'c']);
    });
  });

  describe('expansion', () => {
    it('expand reveals direct children only while grandchildren stay collapsed', () => {
      state.expand(state.findById('a')!);
      expect(ids(state.visibleNodes())).toEqual(['a', 'a1', 'a2', 'b', 'c']);
    });

    it('toggle flips expansion', () => {
      const alpha = state.findById('a')!;
      state.toggle(alpha);
      expect(alpha.isExpanded).toBe(true);
      state.toggle(alpha);
      expect(ids(state.visibleNodes())).toEqual(['a', 'b', 'c']);
    });

    it('expandAll / collapseAll affect every folder', () => {
      state.expandAll();
      expect(ids(state.visibleNodes())).toEqual(['a', 'a1', 'a2', 'a2x', 'b', 'c']);
      state.collapseAll();
      expect(ids(state.visibleNodes())).toEqual(['a', 'b', 'c']);
    });
  });

  describe('move', () => {
    it('moves a leaf into a folder as its last child', () => {
      const moved = state.move(state.findById('c')!, { node: state.findById('b')!, mode: 'into' });
      expect(moved).toBe(true);
      expect(ids(state.nodes())).toEqual(['a', 'a1', 'a2', 'a2x', 'b', 'c']);
      const c = state.findById('c')!;
      expect(c.parent?.id).toBe('b');
      expect(c.level).toBe(1);
    });

    it('reorders before a sibling within the same parent', () => {
      state.move(state.findById('a2')!, { node: state.findById('a1')!, mode: 'before' });
      expect(ids(state.nodes())).toEqual(['a', 'a2', 'a2x', 'a1', 'b', 'c']);
    });

    it('moves after a node in a different parent, adopting its level', () => {
      state.move(state.findById('c')!, { node: state.findById('a1')!, mode: 'after' });
      const c = state.findById('c')!;
      expect(c.parent?.id).toBe('a');
      expect(c.level).toBe(1);
      expect(ids(state.nodes())).toEqual(['a', 'a1', 'c', 'a2', 'a2x', 'b']);
    });

    it('moves a subtree keeping descendant order and re-leveling them', () => {
      state.move(state.findById('a2')!, { node: state.findById('b')!, mode: 'into' });
      expect(ids(state.nodes())).toEqual(['a', 'a1', 'b', 'a2', 'a2x', 'c']);
      expect(state.findById('a2')!.level).toBe(1);
      expect(state.findById('a2x')!.level).toBe(2);
    });

    it('rejects moving a node into itself or its own descendant', () => {
      const alpha = state.findById('a')!;
      expect(state.move(alpha, { node: alpha, mode: 'into' })).toBe(false);
      expect(state.move(alpha, { node: state.findById('a2x')!, mode: 'before' })).toBe(false);
      expect(ids(state.nodes())).toEqual(['a', 'a1', 'a2', 'a2x', 'b', 'c']);
    });

    it('rejects an into-drop on a non-folder or a canDrop:false target', () => {
      expect(state.move(state.findById('a1')!, { node: state.findById('c')!, mode: 'into' })).toBe(
        false
      );
      const beta = state.findById('b')!;
      beta.canDrop = false;
      expect(state.move(state.findById('c')!, { node: beta, mode: 'into' })).toBe(false);
    });

    it('exposes the same validation through canMove without mutating', () => {
      const alpha = state.findById('a')!;
      expect(state.canMove(alpha, { node: state.findById('a2x')!, mode: 'after' })).toBe(false);
      expect(
        state.canMove(state.findById('c')!, { node: state.findById('b')!, mode: 'into' })
      ).toBe(true);
      expect(ids(state.nodes())).toEqual(['a', 'a1', 'a2', 'a2x', 'b', 'c']);
    });
  });

  describe('add / remove', () => {
    it('adds a node into a folder and at the root when target is null', () => {
      const added = state.add(
        { id: 'new', name: 'New', item: 'N' },
        { node: state.findById('b')!, mode: 'into' }
      );
      expect(added?.parent?.id).toBe('b');
      expect(ids(state.nodes())).toEqual(['a', 'a1', 'a2', 'a2x', 'b', 'new', 'c']);

      const root = state.add({ id: 'root-new', name: 'Root New', item: 'RN' }, null);
      expect(root?.parent).toBeNull();
      expect(ids(state.nodes()).at(-1)).toBe('root-new');
    });

    it('removes a subtree including all descendants', () => {
      expect(state.remove(state.findById('a2')!)).toBe(true);
      expect(ids(state.nodes())).toEqual(['a', 'a1', 'b', 'c']);
      expect(state.findById('a2x')).toBeUndefined();
    });

    it('removes a root node', () => {
      expect(state.remove(state.findById('c')!)).toBe(true);
      expect(ids(state.nodes())).toEqual(['a', 'a1', 'a2', 'a2x', 'b']);
    });
  });

  describe('toHierarchy', () => {
    it('serializes back to nested inputs reflecting structural changes', () => {
      state.move(state.findById('c')!, { node: state.findById('b')!, mode: 'into' });
      const hierarchy = state.toHierarchy();
      expect(hierarchy.map(root => root.id)).toEqual(['a', 'b']);
      expect(hierarchy[1]!.children?.map(child => child.id)).toEqual(['c']);
      expect(hierarchy[1]!.children?.[0]!.item).toBe('C');
    });
  });

  describe('filter', () => {
    it('shows matches plus their ancestors, auto-expanded', () => {
      state.setFilter(node => node.name === 'Deep');
      expect(ids(state.visibleNodes())).toEqual(['a', 'a2', 'a2x']);
    });

    it('does not mutate expansion state — clearing restores the previous view', () => {
      state.expand(state.findById('a')!);
      state.setFilter(node => node.name === 'Deep');
      state.setFilter(null);
      expect(ids(state.visibleNodes())).toEqual(['a', 'a1', 'a2', 'b', 'c']);
      expect(state.findById('a2')!.isExpanded).toBeFalsy();
    });

    it('allows collapsing a revealed ancestor while filtered, and forgets it on filter change', () => {
      state.setFilter(node => node.name === 'Deep');
      state.collapse(state.findById('a2')!);
      expect(ids(state.visibleNodes())).toEqual(['a', 'a2']);
      state.setFilter(node => node.name.startsWith('Deep'));
      expect(ids(state.visibleNodes())).toEqual(['a', 'a2', 'a2x']);
    });
  });

  describe('lazy loading', () => {
    it('requests children on first expand of an expandable node and defers expansion', () => {
      const onLoadChildren = vi.fn();
      const lazyState = new TreeState<string>({ onLoadChildren });
      lazyState.setSource([{ id: 'lazy', name: 'Lazy', item: 'L', expandable: true }]);
      const lazy = lazyState.findById('lazy')!;

      lazyState.expand(lazy);

      expect(onLoadChildren).toHaveBeenCalledWith(lazy);
      expect(lazy.isLoading).toBe(true);
      expect(lazy.isExpanded).toBeFalsy();

      lazyState.setChildren(lazy, [{ id: 'lazy-child', name: 'Loaded', item: 'LC' }]);
      expect(lazy.isLoading).toBe(false);
      expect(lazy.isExpanded).toBe(true);
      expect(ids(lazyState.visibleNodes())).toEqual(['lazy', 'lazy-child']);
    });

    it('does not re-request while a load is in flight', () => {
      const onLoadChildren = vi.fn();
      const lazyState = new TreeState<string>({ onLoadChildren });
      lazyState.setSource([{ id: 'lazy', name: 'Lazy', item: 'L', expandable: true }]);
      const lazy = lazyState.findById('lazy')!;
      lazyState.expand(lazy);
      lazyState.expand(lazy);
      expect(onLoadChildren).toHaveBeenCalledTimes(1);
    });
  });

  describe('filter and expansion interplay', () => {
    it('a matched collapsed folder is not reported expanded, so toggle expands it', () => {
      state.setFilter(node => node.name === 'Beta');
      const beta = state.findById('b')!;
      expect(state.isExpandedNow(beta)).toBe(false);
      state.toggle(beta);
      expect(beta.isExpanded).toBe(true);
    });

    it('toggling a matched lazy folder under a filter still requests children', () => {
      const onLoadChildren = vi.fn();
      const lazyState = new TreeState<string>({ onLoadChildren });
      lazyState.setSource([
        { id: 'other', name: 'Other', item: 'O' },
        { id: 'remote', name: 'Remote', item: 'R', isFolder: true, expandable: true },
      ]);
      lazyState.setFilter(node => node.name === 'Remote');
      const remote = lazyState.findById('remote')!;
      lazyState.toggle(remote);
      expect(onLoadChildren).toHaveBeenCalledWith(remote);
      expect(remote.isLoading).toBe(true);
    });

    it('still force-expands ancestors of matches', () => {
      state.setFilter(node => node.name === 'Deep');
      expect(state.isExpandedNow(state.findById('a')!)).toBe(true);
      expect(state.isExpandedNow(state.findById('a2')!)).toBe(true);
    });
  });

  describe('change notification', () => {
    it('notifies subscribers once per mutating call and supports unsubscribe', () => {
      const listener = vi.fn();
      const unsubscribe = state.subscribe(listener);

      state.expand(state.findById('a')!);
      expect(listener).toHaveBeenCalledTimes(1);

      state.move(state.findById('c')!, { node: state.findById('b')!, mode: 'into' });
      expect(listener).toHaveBeenCalledTimes(2);

      unsubscribe();
      state.collapseAll();
      expect(listener).toHaveBeenCalledTimes(2);
    });

    it('does not notify on a rejected move', () => {
      const listener = vi.fn();
      state.subscribe(listener);
      const alpha = state.findById('a')!;
      state.move(alpha, { node: state.findById('a2x')!, mode: 'before' });
      expect(listener).not.toHaveBeenCalled();
    });
  });
});
