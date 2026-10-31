/** The raw string storage underneath. Only this file touches the browser's storage API. */
export interface KeyValueBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  keys(): string[];
}

/** In memory; used on the server, in tests, and as the fallback when storage is blocked. */
export class MemoryBackend implements KeyValueBackend {
  private readonly map = new Map<string, string>();
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  keys() {
    return [...this.map.keys()];
  }
}

/**
 * The browser's localStorage, every call wrapped in try/catch (private mode, blocked or full
 * storage). Writes also go to memory, so the app keeps working for this visit when storage fails.
 */
export class BrowserBackend implements KeyValueBackend {
  private readonly memory = new MemoryBackend();
  getItem(key: string) {
    try {
      const v = window.localStorage.getItem(key);
      if (v !== null) return v;
    } catch {
      /* blocked: fall through to memory */
    }
    return this.memory.getItem(key);
  }
  setItem(key: string, value: string) {
    this.memory.setItem(key, value);
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* full or blocked: the value lives in memory for this visit */
    }
  }
  removeItem(key: string) {
    this.memory.removeItem(key);
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* blocked */
    }
  }
  keys() {
    const out = new Set(this.memory.keys());
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k !== null) out.add(k);
      }
    } catch {
      /* blocked */
    }
    return [...out];
  }
}
