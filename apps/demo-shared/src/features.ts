/**
 * What the two showcases render, as data — so `demo-react` and `demo-angular`
 * iterate the same lists instead of each hard-coding its own copy.
 */

/** MIME type of the palette chips' drag payload. */
export const PALETTE_MIME = 'application/x-treekit-label';

/** Labels of the external drag chips. */
export const PALETTE_LABELS: readonly string[] = [
  'Temperature',
  'Pressure',
  'Vibration',
  'Humidity',
  'Voltage',
];

/** Keys of the toolbar switches. */
export type FeatureToggleKey = 'indentGuides' | 'measuredRows' | 'readOnly';

export interface FeatureToggle {
  readonly key: FeatureToggleKey;
  readonly label: string;
  readonly initial: boolean;
}

/** The toolbar switches, in display order. */
export const FEATURE_TOGGLES: readonly FeatureToggle[] = [
  { key: 'indentGuides', label: 'Guides', initial: true },
  { key: 'measuredRows', label: 'Measured rows', initial: false },
  { key: 'readOnly', label: 'Read only', initial: false },
];

/** Initial value of every toolbar switch. */
export function initialToggles(): Record<FeatureToggleKey, boolean> {
  return Object.fromEntries(FEATURE_TOGGLES.map(toggle => [toggle.key, toggle.initial])) as Record<
    FeatureToggleKey,
    boolean
  >;
}

/** Keys of the gauges. */
export type GaugeKey = 'total' | 'visible' | 'rendered' | 'selected';

export interface Gauge {
  readonly key: GaugeKey;
  readonly label: string;
  /** Drawn in the signal colour — the number the library exists to keep small. */
  readonly accent?: boolean;
}

/** The gauges in the rail, in display order. */
export const GAUGES: readonly Gauge[] = [
  { key: 'total', label: 'Nodes' },
  { key: 'visible', label: 'Visible' },
  { key: 'rendered', label: 'In the DOM', accent: true },
  { key: 'selected', label: 'Selected' },
];

export interface KeyBinding {
  readonly keys: string;
  readonly action: string;
}

/** The key legend in the rail (multi-select mode bindings). */
export const KEY_LEGEND: readonly KeyBinding[] = [
  { keys: 'Space', action: 'toggle selection' },
  { keys: '⌃/⌘ Space', action: 'grab & move' },
  { keys: '⇧ ↑↓', action: 'extend range' },
  { keys: '⌃/⌘ A', action: 'select all' },
];

/** Links between the site and the two showcases, relative to each app's base. */
export const DEMO_LINKS = {
  github: 'https://github.com/Constantine-24/treekit',
  npm: 'https://www.npmjs.com/search?q=%40constantine-24%2Ftreekit',
} as const;
