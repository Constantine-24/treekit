import { TreeState } from '@constantine-24/treekit-core';
import { TkTree } from '@constantine-24/treekit-react';
import '@constantine-24/treekit-react/styles.css';
import { useState } from 'react';

interface FileItem {
  size: number;
}

export function FileTree() {
  const [state] = useState(() => {
    const tree = new TreeState<FileItem>();
    tree.setSource([
      {
        id: 'src',
        name: 'src',
        item: { size: 0 },
        isFolder: true,
        children: [{ id: 'main', name: 'main.ts', item: { size: 812 } }],
      },
      { id: 'readme', name: 'README.md', item: { size: 2048 } },
    ]);
    return tree;
  });

  return (
    <div style={{ height: 400 }}>
      <TkTree
        state={state}
        ariaLabel="Files"
        // The tree only reports the drop; your code applies it.
        onDrop={drop => {
          if (drop.target) state.moveMany([...drop.nodes], drop.target);
        }}
      />
    </div>
  );
}
