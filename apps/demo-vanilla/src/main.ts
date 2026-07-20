import {
  DndEngine,
  DropEvent,
  FixedHeightVirtualizer,
  KeyboardController,
  TreeInput,
  TreeNode,
  TreeState,
} from '@treekit/core';

const ROW_HEIGHT = 28;
const PALETTE_MIME = 'application/x-treekit-label';

// MARK: - Data

function generateForest(): TreeInput<null>[] {
  const roots: TreeInput<null>[] = [];
  for (let group = 0; group < 100; group++) {
    roots.push({
      id: `group-${group}`,
      name: `Group ${String(group).padStart(3, '0')}`,
      item: null,
      isFolder: true,
      children: Array.from({ length: 99 }, (_, leaf) => ({
        id: `leaf-${group}-${leaf}`,
        name: `Sensor ${String(group).padStart(3, '0')}.${String(leaf).padStart(2, '0')}`,
        item: null,
      })),
    });
  }
  return roots;
}

// MARK: - Engines

const viewport = document.getElementById('viewport') as HTMLElement;
const content = document.getElementById('content') as HTMLElement;
const insertionLineElement = document.getElementById('insertion-line') as HTMLElement;
const liveRegion = document.getElementById('live-region') as HTMLElement;
const filterInput = document.getElementById('filter') as HTMLInputElement;
const paletteList = document.getElementById('palette') as HTMLElement;

const state = new TreeState<null>();
state.setSource(generateForest());

const virtualizer = new FixedHeightVirtualizer({ rowHeight: ROW_HEIGHT, overscan: 6 });

let addedCounter = 0;

function applyDrop(drop: DropEvent<null>): void {
  if (!drop.target) {
    return;
  }
  if (drop.node) {
    state.move(drop.node, drop.target);
    return;
  }
  const label = drop.dataTransfer?.getData(PALETTE_MIME);
  if (label) {
    state.add({ id: `added-${addedCounter++}`, name: label, item: null }, drop.target);
  }
}

const engine = new DndEngine<null>({
  getVisibleNodes: () => state.visibleNodes(),
  onDrop: applyDrop,
  onStateChange: render,
  canDropAt: (node, target) => (node ? state.canMove(node, target) : true),
});

const keyboard = new KeyboardController<null>({
  state,
  onDrop: applyDrop,
  canDropAt: (node, target) => (node ? state.canMove(node, target) : true),
  announce: message => {
    liveRegion.textContent = message;
  },
  scrollToIndex: index => virtualizer.scrollToIndex(index),
  onStateChange: render,
});

state.subscribe(() => {
  virtualizer.setCount(state.visibleNodes().length);
  render();
});
virtualizer.setCount(state.visibleNodes().length);
virtualizer.attach(viewport, render);
engine.attach(viewport, content);

// MARK: - Rendering

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function rowHtml(node: TreeNode<null>, top: number): string {
  const expandable = !!(node.isFolder && node.children?.length) || !!node.expandable;
  const expanded = state.isExpandedNow(node);
  const active = keyboard.activeNode() === node;
  const hovered = engine.hoveredFolder() === node;
  const classes = ['row'];
  if (hovered) {
    classes.push('folder-hovered');
  }
  if (active) {
    classes.push('active');
  }
  const toggle = expandable
    ? `<span class="toggle${expanded ? ' expanded' : ''}">▸</span>`
    : '<span class="toggle-spacer"></span>';
  return `
    <div class="${classes.join(' ')}"
         id="node-${node.id}"
         role="treeitem"
         aria-level="${node.level + 1}"
         ${expandable ? `aria-expanded="${expanded}"` : ''}
         data-node-id="${node.id}"
         draggable="true"
         style="transform: translateY(${top}px); height: ${ROW_HEIGHT}px; padding-left: ${node.level * 18}px">
      ${toggle}<span class="name">${escapeHtml(node.name)}</span>
    </div>`;
}

function render(): void {
  const visible = state.visibleNodes();
  content.style.height = `${virtualizer.totalSize()}px`;
  content.innerHTML = virtualizer
    .items()
    .map(item => {
      const node = visible[item.index];
      return node ? rowHtml(node, item.start) : '';
    })
    .join('');
  content.appendChild(insertionLineElement);

  const line = engine.insertionLine();
  insertionLineElement.hidden = !line;
  if (line) {
    insertionLineElement.style.top = `${line.top}px`;
    insertionLineElement.style.left = `${line.left}px`;
  }

  const active = keyboard.activeNode();
  viewport.setAttribute('aria-activedescendant', active ? `node-${active.id}` : '');
}

// MARK: - Interactions

viewport.addEventListener('click', event => {
  const row = (event.target as HTMLElement).closest('[data-node-id]');
  if (!row) {
    return;
  }
  const node = state.findById(row.getAttribute('data-node-id')!);
  if (!node) {
    return;
  }
  keyboard.setActive(node);
  if ((event.target as HTMLElement).classList.contains('toggle')) {
    state.toggle(node);
  } else if (node.isFolder) {
    state.toggle(node);
  }
});

viewport.addEventListener('keydown', event => {
  if (keyboard.handleKeyDown(event)) {
    event.preventDefault();
  }
});

filterInput.addEventListener('input', () => {
  const query = filterInput.value.trim().toLowerCase();
  state.setFilter(query ? node => node.name.toLowerCase().includes(query) : null);
});

// MARK: - Palette

const paletteLabels = ['Temperature', 'Pressure', 'Vibration', 'Humidity', 'Voltage', 'Current'];
paletteList.innerHTML = paletteLabels
  .map(label => `<li class="chip" draggable="true" data-label="${label}">${label}</li>`)
  .join('');
paletteList.addEventListener('dragstart', event => {
  const chip = (event.target as HTMLElement).closest('[data-label]');
  const dataTransfer = (event as DragEvent).dataTransfer;
  if (chip && dataTransfer) {
    dataTransfer.effectAllowed = 'copy';
    dataTransfer.setData(PALETTE_MIME, chip.getAttribute('data-label')!);
    dataTransfer.setData('text/plain', chip.getAttribute('data-label')!);
  }
});

render();
