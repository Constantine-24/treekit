/**
 * A monotonic counter shaped for `useSyncExternalStore`.
 *
 * The core's objects are plain, non-reactive classes. Every notification they
 * emit bumps this store, and the component re-derives its render model from the
 * objects themselves — the React counterpart of the Angular adapter's
 * `_version` signal.
 */
export class VersionStore {
  private _version = 0;
  private readonly _listeners = new Set<() => void>();

  readonly subscribe = (listener: () => void): (() => void) => {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  };

  readonly getSnapshot = (): number => this._version;

  bump(): void {
    this._version++;
    for (const listener of this._listeners) {
      listener();
    }
  }
}
