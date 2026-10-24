import { DropEvent, TreeState } from '@constantine-24/treekit-core';
import { describe, expect, it } from 'vitest';

import { applyDrop, nameFilter } from './behaviour';
import { FEATURE_TOGGLES, initialToggles, PALETTE_MIME } from './features';
import { DemoItem, formatCount, generateForest } from './fixtures';

function stateWith(groups: number, leaves: number): TreeState<DemoItem> {
  const state = new TreeState<DemoItem>();
  state.setSource(generateForest(groups, leaves));
  return state;
}

function dataTransferWith(label: string): DataTransfer {
  return { getData: (type: string) => (type === PALETTE_MIME ? label : '') } as DataTransfer;
}

describe('demo fixtures', () => {
  it('generates about ten thousand rows by default', () => {
    const state = new TreeState<DemoItem>();
    state.setSource(generateForest());
    expect(state.nodes()).toHaveLength(100 + 100 * 99 + 1);
  });

  it('groups thousands', () => {
    expect(formatCount(10101)).toBe('10,101');
    expect(formatCount(42)).toBe('42');
  });

  it('has an initial value for every toggle', () => {
    expect(Object.keys(initialToggles())).toEqual(FEATURE_TOGGLES.map(toggle => toggle.key));
  });
});

describe('applyDrop', () => {
  it('moves dragged rows and describes the move', () => {
    const state = stateWith(2, 1);
    const leaf = state.findById('leaf-0-0')!;
    const target = { node: state.findById('group-1')!, mode: 'into' as const };
    const drop = { node: leaf, nodes: [leaf], target } as DropEvent<DemoItem>;

    expect(applyDrop(state, drop, () => 'unused')).toBe('Moved Sensor 000.00 into Group 001');
    expect(state.findById('leaf-0-0')!.parent?.id).toBe('group-1');
  });

  it('adds a row for a palette chip dropped from outside the tree', () => {
    const state = stateWith(1, 1);
    const target = { node: state.findById('group-0')!, mode: 'into' as const };
    const drop = {
      node: null,
      nodes: [],
      target,
      dataTransfer: dataTransferWith('Pressure'),
    } as unknown as DropEvent<DemoItem>;

    expect(applyDrop(state, drop, () => 'added-0')).toBe('Added Pressure into Group 000');
    expect(state.findById('added-0')?.name).toBe('Pressure');
  });

  it('ignores a drop with no target', () => {
    const state = stateWith(1, 1);
    const drop = { node: null, nodes: [], target: null } as unknown as DropEvent<DemoItem>;

    expect(applyDrop(state, drop, () => 'x')).toBeNull();
  });
});

describe('nameFilter', () => {
  it('matches case-insensitively and clears on blank input', () => {
    const state = stateWith(1, 3);
    const filter = nameFilter('  SENSOR 000.01 ')!;

    expect(
      state
        .nodes()
        .filter(filter)
        .map(node => node.id)
    ).toEqual(['leaf-0-1']);
    expect(nameFilter('   ')).toBeNull();
  });
});
