import { Component } from '@angular/core';
import { TkTree } from '@treekit/angular';
import { DropEvent, TreeState } from '@treekit/core';

interface FileItem {
  size: number;
}

@Component({
  selector: 'app-file-tree',
  imports: [TkTree],
  template: `
    <tk-tree [state]="state" ariaLabel="Files" (dropped)="onDrop($event)" style="height: 400px" />
  `,
})
export class FileTree {
  readonly state = new TreeState<FileItem>();

  constructor() {
    this.state.setSource([
      {
        id: 'src',
        name: 'src',
        item: { size: 0 },
        isFolder: true,
        children: [{ id: 'main', name: 'main.ts', item: { size: 812 } }],
      },
      { id: 'readme', name: 'README.md', item: { size: 2048 } },
    ]);
  }

  // The tree only reports the drop; your code applies it.
  onDrop(drop: DropEvent<FileItem>): void {
    if (drop.target) this.state.moveMany([...drop.nodes], drop.target);
  }
}
