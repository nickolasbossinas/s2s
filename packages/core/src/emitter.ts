/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Tiny type-safe event emitter. Zero dependencies.
 */
export class Emitter<Events extends { [K in keyof Events]: (...args: any[]) => void }> {
  private _listeners = new Map<keyof Events, Set<(...args: any[]) => void>>();

  on<K extends keyof Events>(event: K, fn: Events[K]): this {
    let set = this._listeners.get(event);
    if (!set) {
      set = new Set();
      this._listeners.set(event, set);
    }
    set.add(fn as (...args: any[]) => void);
    return this;
  }

  off<K extends keyof Events>(event: K, fn: Events[K]): this {
    this._listeners.get(event)?.delete(fn as (...args: any[]) => void);
    return this;
  }

  protected emit<K extends keyof Events>(event: K, ...args: Parameters<Events[K]>): void {
    const set = this._listeners.get(event);
    if (set) {
      for (const fn of set) {
        fn(...args);
      }
    }
  }

  removeAllListeners(): void {
    this._listeners.clear();
  }
}
