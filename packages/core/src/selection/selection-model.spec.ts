import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TreeInput, TreeNode } from '../tree/model';
import { TreeState } from '../tree/tree-state';
import { SelectionModel } from './selection-model';

/**
 * Fixture forest, expanded so every node starts visible:
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
      isExpanded: true,
      children: [
        { id: 'a1', name: 'Alpha One', item: 'A1' },
        {
          id: 'a2',
          name: 'Alpha Two',
          item: 'A2',
          isFolder: true,
          isExpanded: true,
          children: [{ id: 'a2x', name: 'Deep', item: 'A2X' }],
        },
      ],
    },
    { id: 'b', name: 'Beta', item: 'B', isFolder: true, children: [] },
    { id: 'c', name: 'Gamma', item: 'C' },
  ];
}

describe('SelectionModel', () => {
  let state: TreeState<string>;
  let selection: SelectionModel<string>;
  let changes: number;

  function node(id: string): TreeNode<string> {
    return state.findById(id)!;
  }

  function selectedIds(): string[] {
    return [...selection.selectedIds()].sort();
  }

  function visibleSelection(): string[] {
    return selection.selectedNodes().map(candidate => candidate.id);
  }

  beforeEach(() => {
    state = new TreeState<string>();
    state.setSource(fixture());
    changes = 0;
    selection = new SelectionModel<string>({ state, onChange: () => changes++ });
  });

  it('starts empty', () => {
    expect(selectedIds()).toEqual([]);
    expect(selection.size()).toBe(0);
    expect(selection.anchorNode()).toBeNull();
  });

  describe('click semantics', () => {
    it('a plain click replaces the selection and sets the anchor', () => {
      selection.selectOn(node('a1'));
      selection.selectOn(node('c'));

      expect(selectedIds()).toEqual(['c']);
      expect(selection.anchorNode()?.id).toBe('c');
    });

    it('ctrl-click toggles a row without disturbing the others', () => {
      selection.selectOn(node('a1'));
      selection.selectOn(node('c'), { ctrlOrMeta: true });
      expect(selectedIds()).toEqual(['a1', 'c']);

      selection.selectOn(node('a1'), { ctrlOrMeta: true });
      expect(selectedIds()).toEqual(['c']);
    });

    it('ctrl-click moves the anchor, so a later shift-click extends from it', () => {
      selection.selectOn(node('a'));
      selection.selectOn(node('a2'), { ctrlOrMeta: true });
      expect(selection.anchorNode()?.id).toBe('a2');

      selection.selectOn(node('c'), { shift: true });
      expect(visibleSelection()).toEqual(['a2', 'a2x', 'b', 'c']);
    });

    it('shift-click selects the visible range and replaces what was there', () => {
      selection.selectOn(node('a1'));
      selection.selectOn(node('b'), { shift: true });

      expect(visibleSelection()).toEqual(['a1', 'a2', 'a2x', 'b']);
    });

    it('shift-click works upward as well as downward', () => {
      selection.selectOn(node('b'));
      selection.selectOn(node('a1'), { shift: true });

      expect(visibleSelection()).toEqual(['a1', 'a2', 'a2x', 'b']);
    });

    it('keeps the anchor across successive shift-clicks, so the range shrinks and grows', () => {
      selection.selectOn(node('a'));
      selection.selectOn(node('b'), { shift: true });
      expect(visibleSelection()).toEqual(['a', 'a1', 'a2', 'a2x', 'b']);

      selection.selectOn(node('a2'), { shift: true });
      expect(visibleSelection()).toEqual(['a', 'a1', 'a2']);
      expect(selection.anchorNode()?.id).toBe('a');
    });

    it('shift-click with no prior anchor selects just that row', () => {
      selection.selectOn(node('a2'), { shift: true });

      expect(visibleSelection()).toEqual(['a2']);
      expect(selection.anchorNode()?.id).toBe('a2');
    });
  });

  describe('ranges follow the visible list', () => {
    it('skips collapsed descendants entirely', () => {
      state.collapse(node('a'));

      selection.selectOn(node('a'));
      selection.selectOn(node('c'), { shift: true });

      // a1 / a2 / a2x are hidden, so the range is roots only.
      expect(selectedIds()).toEqual(['a', 'b', 'c']);
    });

    it('selecting a folder does not implicitly select its descendants', () => {
      selection.selectOn(node('a'));

      expect(selectedIds()).toEqual(['a']);
    });
  });

  describe('hidden and stale ids', () => {
    it('keeps hidden ids selected but omits them from selectedNodes', () => {
      selection.selectOn(node('a1'));
      selection.selectOn(node('c'), { ctrlOrMeta: true });

      state.collapse(node('a'));

      expect(selectedIds()).toEqual(['a1', 'c']);
      expect(visibleSelection()).toEqual(['c']);

      state.expand(node('a'));
      expect(visibleSelection()).toEqual(['a1', 'c']);
    });

    it('a filter hides matches from selectedNodes without clearing the selection', () => {
      selection.selectOn(node('a1'));
      selection.selectOn(node('c'), { ctrlOrMeta: true });

      state.setFilter(candidate => candidate.id === 'c');

      expect(selectedIds()).toEqual(['a1', 'c']);
      expect(visibleSelection()).toEqual(['c']);
    });

    it('a removed node never reappears in selectedNodes, and prune drops its id', () => {
      selection.selectOn(node('c'));
      state.remove(node('c'));

      expect(visibleSelection()).toEqual([]);
      expect(selectedIds()).toEqual(['c']);

      expect(selection.prune()).toBe(true);
      expect(selectedIds()).toEqual([]);
      expect(selection.anchorNode()).toBeNull();
    });
  });

  describe('bulk operations', () => {
    it('selectAllVisible covers the visible list and anchors at its ends', () => {
      state.collapse(node('a'));
      selection.selectAllVisible();

      expect(selectedIds()).toEqual(['a', 'b', 'c']);
      expect(selection.anchorNode()?.id).toBe('a');
      expect(selection.leadNode()?.id).toBe('c');
    });

    it('setIds replaces the set and clear empties it', () => {
      expect(selection.setIds(['a', 'c'])).toBe(true);
      expect(selectedIds()).toEqual(['a', 'c']);

      expect(selection.clear()).toBe(true);
      expect(selectedIds()).toEqual([]);
    });
  });

  describe('change notification', () => {
    it('notifies exactly once per change', () => {
      selection.selectOn(node('a1'));
      selection.selectOn(node('c'), { ctrlOrMeta: true });

      expect(changes).toBe(2);
    });

    it('does not notify when the resulting set is unchanged', () => {
      selection.selectOn(node('a1'));
      changes = 0;

      expect(selection.select(node('a1'))).toBe(false);
      expect(selection.setIds(['a1'])).toBe(false);
      expect(changes).toBe(0);
    });

    it('setIds ignores argument order and duplicates when comparing', () => {
      selection.setIds(['a', 'c']);
      changes = 0;

      expect(selection.setIds(['c', 'a', 'c'])).toBe(false);
      expect(changes).toBe(0);
    });

    it('works without an onChange callback', () => {
      const bare = new SelectionModel<string>({ state });
      const listener = vi.fn();

      expect(() => bare.select(node('a'))).not.toThrow();
      expect(listener).not.toHaveBeenCalled();
    });
  });
});
