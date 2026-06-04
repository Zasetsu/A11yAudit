// Mark the test runtime as a React act() environment before any test module
// imports React, so React Testing utilities don't emit
// "The current testing environment is not configured to support act(...)"
// warnings. Harmless for non-React (node-environment) test files.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// happy-dom v20 exposes a non-functional `localStorage` stub (no getItem/setItem/clear).
// Install a minimal in-memory Storage when the runtime lacks a working one, so web
// components that persist UI preferences (e.g. locale) are testable.
{
  const existing = (globalThis as { localStorage?: { getItem?: unknown } }).localStorage;
  if (typeof existing?.getItem !== "function") {
    const store = new Map<string, string>();
    const memoryStorage = {
      get length() {
        return store.size;
      },
      getItem(key: string): string | null {
        return store.has(key) ? store.get(key)! : null;
      },
      setItem(key: string, value: string): void {
        store.set(key, String(value));
      },
      removeItem(key: string): void {
        store.delete(key);
      },
      clear(): void {
        store.clear();
      },
      key(index: number): string | null {
        return Array.from(store.keys())[index] ?? null;
      }
    };
    (globalThis as { localStorage?: unknown }).localStorage = memoryStorage;
    const win = (globalThis as { window?: { localStorage?: unknown } }).window;
    if (win) {
      win.localStorage = memoryStorage;
    }
  }
}
