import { beforeEach, describe, expect, it } from 'vitest';

import type { TreeInput, TreeNode } from './model';
import { denestNodes, isDescendantOfAny, normalizeDragNodes, TreeState } from './tree-state';

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

describe('drag payload normalization', () => {
  let state: TreeState<string>;
  let order: readonly TreeNode<string>[];

  function node(id: string): TreeNode<string> {
    return state.findById(id)!;
  }

  function nodes(...nodeIds: string[]): TreeNode<string>[] {
    return nodeIds.map(node);
  }

  beforeEach(() => {
    state = new TreeState<string>();
    state.setSource(fixture());
    order = state.nodes();
  });

  describe('isDescendantOfAny', () => {
    it('reports descendants at any depth', () => {
      expect(isDescendantOfAny(node('a2x'), new Set(nodes('a')))).toBe(true);
      expect(isDescendantOfAny(node('a2x'), new Set(nodes('a2')))).toBe(true);
    });

    it('excludes the node itself and unrelated subtrees', () => {
      expect(isDescendantOfAny(node('a'), new Set(nodes('a')))).toBe(false);
      expect(isDescendantOfAny(node('c'), new Set(nodes('a', 'b')))).toBe(false);
    });

    it('is false for an empty ancestor set', () => {
      expect(isDescendantOfAny(node('a2x'), new Set())).toBe(false);
    });
  });

  describe('denestNodes', () => {
    it('returns document order regardless of input order', () => {
      expect(ids(denestNodes(nodes('c', 'a1', 'b'), order))).toEqual(['a1', 'b', 'c']);
    });

    it('dedupes repeated nodes', () => {
      expect(ids(denestNodes(nodes('c', 'c', 'c'), order))).toEqual(['c']);
    });

    it('drops nodes whose ancestor is also present', () => {
      // Moving `a` already carries `a1`/`a2`/`a2x` with it.
      expect(ids(denestNodes(nodes('a', 'a1', 'a2', 'a2x'), order))).toEqual(['a']);
    });

    it('keeps siblings when only a deeper ancestor is absent', () => {
      expect(ids(denestNodes(nodes('a1', 'a2x'), order))).toEqual(['a1', 'a2x']);
    });

    it('returns an empty array for no input', () => {
      expect(denestNodes([], order)).toEqual([]);
    });
  });

  describe('normalizeDragNodes', () => {
    it('drops nodes that cannot be dragged', () => {
      node('a1').canDrag = false;

      expect(ids(normalizeDragNodes(nodes('a1', 'c'), order))).toEqual(['c']);
    });

    it('filters canDrag BEFORE de-nesting so a draggable child survives a locked parent', () => {
      node('a').canDrag = false;

      // De-nesting first would drop `a1` (it has a selected ancestor) and then
      // drop `a` itself, yielding nothing at all.
      expect(ids(normalizeDragNodes(nodes('a', 'a1'), order))).toEqual(['a1']);
    });

    it('still de-nests among draggable nodes', () => {
      expect(ids(normalizeDragNodes(nodes('a', 'a2x'), order))).toEqual(['a']);
    });

    it('treats an undefined canDrag as draggable', () => {
      expect(ids(normalizeDragNodes(nodes('c'), order))).toEqual(['c']);
    });
  });
});
