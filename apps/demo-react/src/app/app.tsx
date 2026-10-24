import { DropEvent, TreeNode } from '@constantine-24/treekit-core';
import {
  applyDrop,
  createDemoState,
  createVirtualizer,
  DEMO_LINKS,
  DemoItem,
  DropProbe,
  FeatureToggleKey,
  generateForest,
  initialToggles,
  nameFilter,
} from 'demo-shared';
import { ReactElement, useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { Calipers } from './calipers/calipers';
import { Gauges } from './gauges/gauges';
import { KeyLegend } from './key-legend/key-legend';
import { Palette } from './palette/palette';
import { StatusBar } from './status-bar/status-bar';
import { ThemeToggle } from './theme-toggle/theme-toggle';
import { Toolbar } from './toolbar/toolbar';
import { TreePanel, TreePanelHandle } from './tree-panel/tree-panel';

/** The page shell. Owns the tree state; every panel is a component under `src/app/`. */
export function App(): ReactElement {
  const [state] = useState(() => {
    const demoState = createDemoState();
    demoState.setSource(generateForest());
    return demoState;
  });
  const [toggles, setToggles] = useState(initialToggles);
  const [status, setStatus] = useState('');
  const [probe, setProbe] = useState<DropProbe | null>(null);
  const [selectedCount, setSelectedCount] = useState(0);
  const [renderedCount, setRenderedCount] = useState(0);
  const panelRef = useRef<TreePanelHandle>(null);
  const addedCounter = useRef(0);

  // The counters re-derive from the plain state object on every tree mutation.
  const subscribe = useCallback((listener: () => void) => state.subscribe(listener), [state]);
  const total = useSyncExternalStore(subscribe, () => state.nodes().length);
  const visible = useSyncExternalStore(subscribe, () => state.visibleNodes().length);

  const virtualizer = useMemo(
    () => createVirtualizer(toggles.measuredRows),
    [toggles.measuredRows]
  );

  const onToggle = (key: FeatureToggleKey, value: boolean) =>
    setToggles(current => ({ ...current, [key]: value }));

  const onDrop = (drop: DropEvent<DemoItem>) => {
    setProbe(null);
    const result = applyDrop(state, drop, () => `added-${addedCounter.current++}`);
    if (result) {
      setStatus(result);
    }
  };

  const onNodeClick = (node: TreeNode<DemoItem>) => setStatus(node.name);

  return (
    <div className="demo">
      <header className="masthead">
        <div className="mark">
          <h1 className="wordmark">
            <a href="../">treekit</a>
          </h1>
          <span className="rule-h" />
          <span className="label">React · headless · virtualized · native HTML5 drag</span>
        </div>
        <nav aria-label="treekit">
          <a className="ghost" href="../angular/">
            Angular demo
          </a>
          <a className="ghost" href={DEMO_LINKS.github}>
            GitHub
          </a>
        </nav>
        <ThemeToggle />
      </header>

      <main className="deck">
        <aside className="rail" aria-label="Controls and counters">
          <Gauges counts={{ total, visible, rendered: renderedCount, selected: selectedCount }} />
          <Palette onDragEnd={() => setProbe(null)} />
          <KeyLegend />
        </aside>

        <section className="instrument" aria-label="Tree">
          <Toolbar
            toggles={toggles}
            onFilterChange={query => state.setFilter(nameFilter(query))}
            onToggleChange={onToggle}
            onExpandAll={() => panelRef.current?.expandAll()}
            onCollapseAll={() => panelRef.current?.collapseAll()}
          />
          <TreePanel
            ref={panelRef}
            state={state}
            virtualizer={virtualizer}
            toggles={toggles}
            onDrop={onDrop}
            onNodeClick={onNodeClick}
            onSelectionCountChange={setSelectedCount}
            onRenderedCountChange={setRenderedCount}
            onProbeChange={setProbe}
          />
          <StatusBar probe={probe} status={status} />
        </section>
      </main>

      {probe && <Calipers probe={probe} />}
    </div>
  );
}
