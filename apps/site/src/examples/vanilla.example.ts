import {
  DndEngine,
  DropEvent,
  FixedHeightVirtualizer,
  KeyboardController,
  TreeState,
} from '@constantine-24/treekit-core';

// <div id="viewport" role="tree" tabindex="0" style="height: 400px; overflow: auto">
//   <div id="content" style="position: relative"></div>
// </div>
const viewport = document.getElementById('viewport')!;
const content = document.getElementById('content')!;

const state = new TreeState<null>();
state.setSource([
  {
    id: 'src',
    name: 'src',
    item: null,
    isFolder: true,
    children: [{ id: 'main', name: 'main.ts', item: null }],
  },
  { id: 'readme', name: 'README.md', item: null },
]);

// The engines only report drops; your code applies them.
const onDrop = (drop: DropEvent<null>) => {
  if (drop.target) state.moveMany([...drop.nodes], drop.target);
};
const canDropAt = state.canMoveMany.bind(state);

const virtualizer = new FixedHeightVirtualizer({ rowHeight: 28 });
const dnd = new DndEngine<null>({
  getVisibleNodes: () => state.visibleNodes(),
  onDrop,
  canDropAt,
  onStateChange: render,
});
const keyboard = new KeyboardController<null>({ state, onDrop, canDropAt, onStateChange: render });

function render(): void {
  const visible = state.visibleNodes();
  content.style.height = `${virtualizer.totalSize()}px`;
  // Rows are absolutely positioned; each needs data-node-id for drop targeting.
  content.innerHTML = virtualizer
    .items()
    .map(({ index, start, size }) => {
      const node = visible[index]!;
      return `<div role="treeitem" id="node-${node.id}" data-node-id="${node.id}" draggable="true"
        style="position: absolute; transform: translateY(${start}px); height: ${size}px;
               padding-left: ${node.level * 18}px">${node.name}</div>`;
    })
    .join('');
  const active = keyboard.activeNode();
  viewport.setAttribute('aria-activedescendant', active ? `node-${active.id}` : '');
}

state.subscribe(() => {
  virtualizer.setCount(state.visibleNodes().length);
  render();
});
virtualizer.attach(viewport, render);
dnd.attach(viewport, content);
viewport.addEventListener(
  'keydown',
  event => keyboard.handleKeyDown(event) && event.preventDefault()
);
virtualizer.setCount(state.visibleNodes().length);
