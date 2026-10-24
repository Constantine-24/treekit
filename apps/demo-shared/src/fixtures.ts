import { TreeInput } from '@constantine-24/treekit-core';

/** Domain payload of every demo row. */
export interface DemoItem {
  kind: 'group' | 'sensor';
  unit?: string;
}

/** Row height of the showcases, in pixels. */
export const ROW_HEIGHT = 28;

/** Overscan rows of both virtualizers. */
export const OVERSCAN = 6;

/** Mid-drag hover time before a collapsed folder springs open, in milliseconds. */
export const SPRING_LOAD_DELAY = 600;

/** Simulated latency of the lazily loaded "Remote site" folder, in milliseconds. */
export const LAZY_LOAD_DELAY = 800;

const UNITS = ['°C', 'bar', 'mm/s', '%', 'V'];

/**
 * The showcase forest: `groups` folders of `leavesPerGroup` sensors each, plus
 * one lazily loaded folder. The defaults give 100 groups × 99 leaves — about
 * 10,000 rows, enough to make virtualization visible.
 */
export function generateForest(groups = 100, leavesPerGroup = 99): TreeInput<DemoItem>[] {
  const roots: TreeInput<DemoItem>[] = [];
  for (let group = 0; group < groups; group++) {
    const groupLabel = String(group).padStart(3, '0');
    roots.push({
      id: `group-${group}`,
      name: `Group ${groupLabel}`,
      item: { kind: 'group' },
      isFolder: true,
      children: Array.from({ length: leavesPerGroup }, (_, leaf) => ({
        id: `leaf-${group}-${leaf}`,
        name: `Sensor ${groupLabel}.${String(leaf).padStart(2, '0')}`,
        item: { kind: 'sensor', unit: UNITS[leaf % UNITS.length] },
      })),
    });
  }
  roots.push({
    id: 'remote',
    name: 'Remote site (lazy)',
    item: { kind: 'group' },
    isFolder: true,
    expandable: true,
  });
  return roots;
}

/** The children the lazy "Remote site" folder resolves to. */
export function remoteChildren(): TreeInput<DemoItem>[] {
  return Array.from({ length: 25 }, (_, index) => ({
    id: `remote-${index}`,
    name: `Remote sensor ${index}`,
    item: { kind: 'sensor', unit: 'kW' },
  }));
}

/** `10100` → `"10,100"`. */
export function formatCount(value: number): string {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
