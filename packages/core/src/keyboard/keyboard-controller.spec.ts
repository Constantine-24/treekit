import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DropEvent, TreeInput } from '../tree/model';
import { SelectionModel } from '../selection/selection-model';
import { TreeState } from '../tree/tree-state';
import { KeyboardController } from './keyboard-controller';

/**
 * Fixture forest:
 *
 * a (folder, expanded)
 *   a1
 *   a2 (folder, expanded)
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

function keydown(
  key: string,
  modifiers: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean } = {}
): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...modifiers,
  });
}

describe('KeyboardController', () => {
  let state: TreeState<string>;
  let controller: KeyboardController<string>;
  let drops: DropEvent<string>[];
  let announcements: string[];
  let scrolledTo: number[];

  beforeEach(() => {
    state = new TreeState<string>();
    state.setSource(fixture());
    drops = [];
    announcements = [];
    scrolledTo = [];
    controller = new KeyboardController<string>({
      state,
      onDrop: event => drops.push(event),
      canDropAt: (nodes, target) => state.canMoveMany(nodes, target),
      announce: message => announcements.push(message),
      scrollToIndex: index => scrolledTo.push(index),
    });
  });

  describe('navigation', () => {
    it('starts on the first visible node', () => {
      expect(controller.activeNode()?.id).toBe('a');
    });

    it('moves through visible nodes with ArrowDown/ArrowUp and keeps the row in view', () => {
      expect(controller.handleKeyDown(keydown('ArrowDown'))).toBe(true);
      expect(controller.activeNode()?.id).toBe('a1');
      controller.handleKeyDown(keydown('ArrowDown'));
      expect(controller.activeNode()?.id).toBe('a2');
      controller.handleKeyDown(keydown('ArrowUp'));
      expect(controller.activeNode()?.id).toBe('a1');
      expect(scrolledTo).toEqual([1, 2, 1]);
    });

    it('jumps with Home and End', () => {
      controller.handleKeyDown(keydown('End'));
      expect(controller.activeNode()?.id).toBe('c');
      controller.handleKeyDown(keydown('Home'));
      expect(controller.activeNode()?.id).toBe('a');
    });

    it('ArrowRight enters an expanded folder, ArrowLeft returns to the parent', () => {
      controller.handleKeyDown(keydown('ArrowRight'));
      expect(controller.activeNode()?.id).toBe('a1');
      controller.handleKeyDown(keydown('ArrowLeft'));
      expect(controller.activeNode()?.id).toBe('a');
    });

    it('ArrowRight expands a collapsed folder in place, ArrowLeft collapses it', () => {
      state.collapse(state.findById('a')!);
      controller.setActive(state.findById('a')!);
      controller.handleKeyDown(keydown('ArrowRight'));
      expect(state.findById('a')!.isExpanded).toBe(true);
      expect(controller.activeNode()?.id).toBe('a');
      controller.handleKeyDown(keydown('ArrowLeft'));
      expect(state.findById('a')!.isExpanded).toBe(false);
    });

    it('ignores unrelated keys', () => {
      expect(controller.handleKeyDown(keydown('x'))).toBe(false);
    });

    it('gives only the active node a 0 tabindex', () => {
      expect(controller.tabIndexFor(state.findById('a')!)).toBe(0);
      expect(controller.tabIndexFor(state.findById('c')!)).toBe(-1);
    });
  });

  describe('grab / move / drop', () => {
    it('grabs a draggable node with Space and announces instructions', () => {
      controller.handleKeyDown(keydown('End'));
      expect(controller.handleKeyDown(keydown(' '))).toBe(true);
      expect(controller.grabbedNode()?.id).toBe('c');
      expect(announcements.at(-1)).toContain('Gamma');
    });

    it('does not grab a canDrag:false node', () => {
      state.findById('c')!.canDrag = false;
      controller.setActive(state.findById('c')!);
      controller.handleKeyDown(keydown(' '));
      expect(controller.grabbedNode()).toBeNull();
    });

    it('does not grab while disabled', () => {
      const disabledController = new KeyboardController<string>({
        state,
        onDrop: event => drops.push(event),
        isDisabled: () => true,
      });
      disabledController.handleKeyDown(keydown(' '));
      expect(disabledController.grabbedNode()).toBeNull();
    });

    it('steps the drop preview through positions, offering into for folders', () => {
      controller.setActive(state.findById('c')!);
      controller.handleKeyDown(keydown(' '));

      const seen: string[] = [];
      for (let step = 0; step < 3; step++) {
        controller.handleKeyDown(keydown('ArrowUp'));
        const preview = controller.dropPreview()!;
        seen.push(`${preview.mode}:${preview.node.id}`);
      }
      expect(seen).toEqual(['into:b', 'after:a2x', 'into:a2']);
    });

    it('skips positions inside the grabbed subtree', () => {
      controller.setActive(state.findById('a')!);
      controller.handleKeyDown(keydown(' '));
      controller.handleKeyDown(keydown('ArrowDown'));
      const preview = controller.dropPreview()!;
      expect(['a1', 'a2', 'a2x']).not.toContain(preview.node.id);
    });

    it('drops at the previewed position emitting the pointer-compatible DropEvent', () => {
      controller.setActive(state.findById('c')!);
      controller.handleKeyDown(keydown(' '));
      controller.handleKeyDown(keydown('ArrowUp'));
      expect(controller.dropPreview()).toEqual(expect.objectContaining({ mode: 'into' }));

      controller.handleKeyDown(keydown(' '));

      expect(drops).toHaveLength(1);
      expect(drops[0]!.node?.id).toBe('c');
      expect(drops[0]!.target?.node.id).toBe('b');
      expect(drops[0]!.target?.mode).toBe('into');
      expect(controller.grabbedNode()).toBeNull();
      expect(announcements.at(-1)).toContain('Gamma');
    });

    it('cancels with Escape without dropping', () => {
      controller.setActive(state.findById('c')!);
      controller.handleKeyDown(keydown(' '));
      controller.handleKeyDown(keydown('Escape'));
      expect(controller.grabbedNode()).toBeNull();
      expect(drops).toHaveLength(0);
      expect(announcements.at(-1)).toContain('cancel');
    });

    it('produces a DropEvent equivalent to the pointer engine for the same move', () => {
      controller.setActive(state.findById('c')!);
      controller.handleKeyDown(keydown(' '));
      controller.handleKeyDown(keydown('ArrowUp'));
      controller.handleKeyDown(keydown(' '));

      const keyboardDrop = drops[0]!;
      const pointerDrop: DropEvent<string> = {
        node: state.findById('c')!,
        nodes: [state.findById('c')!],
        target: { node: state.findById('b')!, mode: 'into' },
        dataTransfer: null,
      };
      expect(keyboardDrop.node).toBe(pointerDrop.node);
      expect(keyboardDrop.nodes).toEqual(pointerDrop.nodes);
      expect(keyboardDrop.target).toEqual(pointerDrop.target);
      expect(state.move(keyboardDrop.node!, keyboardDrop.target!)).toBe(true);
      expect(state.findById('c')!.parent?.id).toBe('b');
    });
  });

  describe('aria', () => {
    it('computes treeitem attributes for folders and leaves', () => {
      const folderAria = controller.rowAria(state.findById('a')!);
      expect(folderAria).toEqual(
        expect.objectContaining({ role: 'treeitem', 'aria-level': 1, 'aria-expanded': true })
      );
      const leafAria = controller.rowAria(state.findById('a1')!);
      expect(leafAria['aria-level']).toBe(2);
      expect('aria-expanded' in leafAria).toBe(false);
    });
  });

  describe('state notifications', () => {
    it('notifies on active/grab changes so adapters can re-render', () => {
      const onStateChange = vi.fn();
      const notifyingController = new KeyboardController<string>({
        state,
        onDrop: () => {},
        onStateChange,
      });
      notifyingController.handleKeyDown(keydown('ArrowDown'));
      expect(onStateChange).toHaveBeenCalled();
    });
  });
});

describe('KeyboardController multi-select keys', () => {
  let state: TreeState<string>;
  let selection: SelectionModel<string>;
  let controller: KeyboardController<string>;
  let drops: DropEvent<string>[];
  let announcements: string[];

  function press(key: string, modifiers?: Parameters<typeof keydown>[1]): boolean {
    return controller.handleKeyDown(keydown(key, modifiers));
  }

  function selectedIds(): string[] {
    return selection.selectedNodes().map(node => node.id);
  }

  beforeEach(() => {
    state = new TreeState<string>();
    state.setSource(fixture());
    state.expandAll();
    drops = [];
    announcements = [];
    selection = new SelectionModel<string>({ state });
    controller = new KeyboardController<string>({
      state,
      selection,
      onDrop: event => drops.push(event),
      canDropAt: (nodes, target) => state.canMoveMany(nodes, target),
      announce: message => announcements.push(message),
    });
  });

  it('Space toggles selection instead of grabbing', () => {
    expect(press(' ')).toBe(true);

    expect(selectedIds()).toEqual(['a']);
    expect(controller.grabbedNodes()).toEqual([]);
    expect(announcements.at(-1)).toContain('1 item selected');
  });

  it('Ctrl+Space grabs the selection for a keyboard move', () => {
    press(' ');
    press('ArrowDown');
    press(' ');
    expect(selectedIds()).toEqual(['a', 'a1']);

    expect(press(' ', { ctrlKey: true })).toBe(true);

    // `a1` rides inside `a`, so the payload de-nests to just `a`.
    expect(controller.grabbedNodes().map(node => node.id)).toEqual(['a']);
    expect(announcements.at(-1)).toContain('grabbed');
  });

  it('Shift+ArrowDown extends the range from the anchor', () => {
    press(' ');

    press('ArrowDown', { shiftKey: true });
    press('ArrowDown', { shiftKey: true });

    expect(selectedIds()).toEqual(['a', 'a1', 'a2']);
  });

  it('Shift+End extends to the last visible row', () => {
    press(' ');

    press('End', { shiftKey: true });

    expect(selectedIds()).toEqual(['a', 'a1', 'a2', 'a2x', 'b', 'c']);
  });

  it('plain arrows move the active row without touching the selection', () => {
    press(' ');
    expect(selectedIds()).toEqual(['a']);

    press('ArrowDown');
    press('ArrowDown');

    expect(controller.activeNode()?.id).toBe('a2');
    expect(selectedIds()).toEqual(['a']);
  });

  it('Ctrl+A selects every visible row', () => {
    expect(press('a', { ctrlKey: true })).toBe(true);

    expect(selectedIds()).toEqual(['a', 'a1', 'a2', 'a2x', 'b', 'c']);
    expect(announcements.at(-1)).toContain('6 items selected');
  });

  it('leaves a plain "a" keypress unhandled for the consumer', () => {
    expect(press('a')).toBe(false);
  });

  it('drops the whole grabbed payload, announcing it as a count', () => {
    // Select two independent leaves, then grab and move them.
    press('End');
    press(' ');
    press('ArrowUp');
    press(' ');
    expect(selectedIds()).toEqual(['b', 'c']);

    press(' ', { ctrlKey: true });
    expect(announcements.at(-1)).toContain('2 items grabbed');

    press('Home');
    press(' ');

    const drop = drops[0]!;
    expect(drop.nodes.map(node => node.id)).toEqual(['b', 'c']);
    expect(drop.node).toBe(drop.nodes[0]);
    expect(state.moveMany([...drop.nodes], drop.target!)).toBe(true);
  });

  it('never previews a drop onto a grabbed row or its descendants', () => {
    press(' ');
    press(' ', { ctrlKey: true });

    const seen: string[] = [];
    for (let step = 0; step < 12; step++) {
      press('ArrowDown');
      const preview = controller.dropPreview();
      if (preview) {
        seen.push(preview.node.id);
      }
    }

    expect(seen).not.toContain('a');
    expect(seen).not.toContain('a1');
    expect(seen).not.toContain('a2');
    expect(seen).not.toContain('a2x');
  });

  it('Escape cancels a multi-node grab', () => {
    press('End');
    press(' ');
    press(' ', { ctrlKey: true });

    expect(press('Escape')).toBe(true);

    expect(controller.grabbedNodes()).toEqual([]);
    expect(drops).toEqual([]);
    expect(announcements.at(-1)).toContain('cancelled');
  });

  it('honours isMultiSelectEnabled returning false by restoring Space-to-grab', () => {
    controller = new KeyboardController<string>({
      state,
      selection,
      isMultiSelectEnabled: () => false,
      onDrop: event => drops.push(event),
      announce: message => announcements.push(message),
    });

    expect(press(' ')).toBe(true);

    expect(controller.grabbedNodes().map(node => node.id)).toEqual(['a']);
    expect(selectedIds()).toEqual([]);
  });
});
