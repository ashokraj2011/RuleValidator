/**
 * Persistence port. Centralizes all serialization behind one interface so the
 * store no longer scatters `JSON.stringify(...)` + `localStorage.setItem(...)`
 * at every mutation site, and so the backing store is swappable (localStorage
 * today; could be IndexedDB or a server later). Includes a versioned migration
 * step so persisted data can evolve without silently corrupting.
 */

export interface PersistencePort {
  read<T>(key: string, fallback: T): T;
  write<T>(key: string, value: T): void;
  remove(key: string): void;
}

/** Default adapter — browser localStorage, fault-tolerant. */
export class LocalStoragePort implements PersistencePort {
  read<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  }

  write<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* quota / serialization errors are non-fatal for a demo */
    }
  }

  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

/** In-memory adapter — used when localStorage is unavailable (SSR / tests). */
export class MemoryPort implements PersistencePort {
  private readonly map = new Map<string, string>();
  read<T>(key: string, fallback: T): T {
    const raw = this.map.get(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  }
  write<T>(key: string, value: T): void {
    this.map.set(key, JSON.stringify(value));
  }
  remove(key: string): void {
    this.map.delete(key);
  }
}

export const STORE_KEYS = {
  cases: 'ruleValidator_testCases',
  runs: 'ruleValidator_runHistory',
  fixtures: 'ruleValidator_fixtures',
  suites: 'ruleValidator_suites',
  seed: 'ruleValidator_seeded',
  schemaVersion: 'ruleValidator_schemaVersion',
} as const;

/** Current persisted-data schema version. Bump when the on-disk shape changes. */
export const STORE_SCHEMA_VERSION = 2;

/**
 * Run forward migrations. Today this just ensures the new fixture/suite buckets
 * exist and records the version; the structure makes future shape changes a
 * matter of adding a numbered step rather than ad-hoc patching.
 */
export function migrate(port: PersistencePort): void {
  const from = port.read<number>(STORE_KEYS.schemaVersion, 0);
  if (from >= STORE_SCHEMA_VERSION) return;

  if (from < 2) {
    // v1 → v2: introduce fixtures + suites buckets (empty is fine).
    if (port.read(STORE_KEYS.fixtures, null) === null) port.write(STORE_KEYS.fixtures, []);
    if (port.read(STORE_KEYS.suites, null) === null) port.write(STORE_KEYS.suites, []);
  }

  port.write(STORE_KEYS.schemaVersion, STORE_SCHEMA_VERSION);
}
