import { DropEvent, TreeNode, TreeState, TreeVirtualizer } from '@constantine-24/treekit-core';
import {
  DemoItem,
  DropProbe,
  FeatureToggleKey,
  observeRenderedRows,
  probeDrop,
  ROW_HEIGHT,
  SPRING_LOAD_DELAY,
} from 'demo-shared';
import { TkTree, TkTreeHandle } from '@constantine-24/treekit-react';
import { ReactElement, Ref, useEffect, useImperativeHandle, useRef } from 'react';

/** Imperative API of the panel, forwarded to the tree's own handle. */
export interface TreePanelHandle {
  /** Expands every loaded folder through the tree's imperative API. */
  expandAll(): void;
  /** Collapses every folder through the tree's imperative API. */
  collapseAll(): void;
}

export interface TreePanelProps {
  ref?: Ref<TreePanelHandle>;
  state: TreeState<DemoItem>;
  virtualizer: TreeVirtualizer;
  toggles: Record<FeatureToggleKey, boolean>;
  /** Reported, not applied: the app decides what a drop does. */
  onDrop: (drop: DropEvent<DemoItem>) => void;
  onNodeClick: (node: TreeNode<DemoItem>) => void;
  onSelectionCountChange: (count: number) => void;
  onRenderedCountChange: (count: number) => void;
  onProbeChange: (probe: DropProbe | null) => void;
}

/**
 * The tree itself, plus the drag probe that feeds the calipers and status bar.
 */
export function TreePanel({
  ref,
  state,
  virtualizer,
  toggles,
  onDrop,
  onNodeClick,
  onSelectionCountChange,
  onRenderedCountChange,
  onProbeChange,
}: TreePanelProps): ReactElement {
  const hostRef = useRef<HTMLDivElement>(null);
  const treeRef = useRef<TkTreeHandle<DemoItem>>(null);

  useImperativeHandle(
    ref,
    () => ({
      expandAll: () => treeRef.current?.expandAll(),
      collapseAll: () => treeRef.current?.collapseAll(),
    }),
    []
  );

  useEffect(
    () => observeRenderedRows(hostRef.current!, onRenderedCountChange),
    [onRenderedCountChange]
  );

  return (
    <div
      ref={hostRef}
      className="tree-panel"
      onDragOver={event => onProbeChange(probeDrop(state, event.clientX, event.clientY))}
      onDragLeave={() => onProbeChange(null)}
      onDrop={() => onProbeChange(null)}
    >
      <TkTree
        ref={treeRef}
        state={state}
        virtualizer={virtualizer}
        rowHeight={ROW_HEIGHT}
        isReadonly={toggles.readOnly}
        multiSelect
        indentGuides={toggles.indentGuides}
        springLoadDelay={SPRING_LOAD_DELAY}
        ariaLabel="Sensor hierarchy"
        onDrop={onDrop}
        onNodeClick={onNodeClick}
        onSelectionChange={nodes => onSelectionCountChange(nodes.length)}
        renderNode={node => (
          <>
            <span className="row-name">{node.name}</span>
            {node.item.unit && <span className="row-unit">{node.item.unit}</span>}
          </>
        )}
        renderEmpty={() => <span className="label">No rows match that filter</span>}
      />
    </div>
  );
}
