import { describe, expect, it } from 'vitest';

import type { DropEvent, TreeNode } from './model';

describe('tree model', () => {
  it('links parent and children through the flat structure', () => {
    const root: TreeNode<string> = {
      id: 'root',
      item: 'root-item',
      name: 'Root',
      level: 0,
      parent: null,
      isFolder: true,
      isExpanded: true,
    };
    const child: TreeNode<string> = {
      id: 'child',
      item: 'child-item',
      name: 'Child',
      level: 1,
      parent: root,
    };
    root.children = [child];

    expect(child.parent).toBe(root);
    expect(root.children[0]).toBe(child);
  });

  it('represents an external drop with a null node', () => {
    const target: TreeNode<string> = {
      id: 'folder',
      item: 'folder-item',
      name: 'Folder',
      level: 0,
      parent: null,
      isFolder: true,
    };
    const drop: DropEvent<string> = {
      node: null,
      nodes: [],
      target: { node: target, mode: 'into' },
    };

    expect(drop.node).toBeNull();
    expect(drop.nodes).toEqual([]);
    expect(drop.target?.mode).toBe('into');
  });
});
