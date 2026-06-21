/**
 * Secure Token Storage - Alternatives to localStorage
 *
 * localStorage is NOT safe for sensitive tokens because:
 * - Vulnerable to XSS attacks (JavaScript can access it)
 * - Not automatically cleared when browser closes
 * - Persists even in private mode
 *
 * Recommendations by use case:
 * 1. MOST SECURE: HttpOnly Cookies (set by server)
 * 2. MEMORY: In-memory storage (cleared on page reload)
 * 3. SESSION: sessionStorage (cleared when tab closes)
 * 4. HYBRID: Memory + SessionStorage backup
 */

export interface TokenStorage {
  set(token: string): void | Promise<void>;
  get(): string | null | Promise<string | null>;
  clear(): void | Promise<void>;
  has(): boolean | Promise<boolean>;
}

/**
 * In-memory token storage
 * PROS: Secure (not accessible to XSS), fast
 * CONS: Lost on page reload
 * USE: SPAs, where token is loaded from API on app start
 */
export class MemoryTokenStorage implements TokenStorage {
  private token: string | null = null;

  set(token: string): void {
    this.token = token;
  }

  get(): string | null {
    return this.token;
  }

  clear(): void {
    this.token = null;
  }

  has(): boolean {
    return this.token !== null;
  }
}

/**
 * Check if sessionStorage is available in the current environment
 */
function isSessionStorageAvailable(): boolean {
  try {
    return typeof sessionStorage !== "undefined";
  } catch {
    return false;
  }
}

/**
 * SessionStorage token storage
 * PROS: Persists during session, cleared when tab closes
 * CONS: Still vulnerable to XSS (JS can access)
 * USE: Less critical tokens, development environments
 *
 * Falls back to in-memory storage when sessionStorage is not available (e.g. SSR, tests).
 */
export class SessionStorageTokenStorage implements TokenStorage {
  private readonly key = "rhttp_token";
  private fallbackMemory: string | null = null;

  set(token: string): void {
    if (isSessionStorageAvailable()) {
      try {
        sessionStorage.setItem(this.key, token);
        return;
      } catch (e) {
        console.warn("SessionStorage unavailable:", e);
      }
    }
    this.fallbackMemory = token;
  }

  get(): string | null {
    if (isSessionStorageAvailable()) {
      try {
        return sessionStorage.getItem(this.key);
      } catch (e) {
        console.warn("SessionStorage unavailable:", e);
      }
    }
    return this.fallbackMemory;
  }

  clear(): void {
    if (isSessionStorageAvailable()) {
      try {
        sessionStorage.removeItem(this.key);
      } catch (e) {
        console.warn("SessionStorage unavailable:", e);
      }
    }
    this.fallbackMemory = null;
  }

  has(): boolean {
    return this.get() !== null;
  }
}

/**
 * Hybrid storage: Memory + SessionStorage backup
 *
 * Strategy:
 * 1. Try to load from sessionStorage on init
 * 2. Keep token in memory
 * 3. Sync to sessionStorage on update
 * 4. Fallback to sessionStorage if memory is cleared
 *
 * PROS: Best of both worlds - XSS protection + persistence within session
 * USE: Recommended for most applications
 */
export class HybridTokenStorage implements TokenStorage {
  private memory: string | null = null;
  private readonly storageKey = "rhttp_token_backup";

  constructor() {
    // Load from sessionStorage on init (safe for SSR / non-browser envs)
    if (isSessionStorageAvailable()) {
      try {
        this.memory = sessionStorage.getItem(this.storageKey);
      } catch (e) {
        console.warn("SessionStorage unavailable:", e);
      }
    }
  }

  set(token: string): void {
    this.memory = token;
    if (isSessionStorageAvailable()) {
      try {
        sessionStorage.setItem(this.storageKey, token);
      } catch (e) {
        console.warn("SessionStorage sync failed:", e);
      }
    }
  }

  get(): string | null {
    // Priority: Memory > SessionStorage
    if (this.memory) return this.memory;

    if (isSessionStorageAvailable()) {
      try {
        const stored = sessionStorage.getItem(this.storageKey);
        if (stored) this.memory = stored;
        return stored;
      } catch (e) {
        console.warn("SessionStorage unavailable:", e);
      }
    }
    return null;
  }

  clear(): void {
    this.memory = null;
    if (isSessionStorageAvailable()) {
      try {
        sessionStorage.removeItem(this.storageKey);
      } catch (e) {
        console.warn("SessionStorage unavailable:", e);
      }
    }
  }

  has(): boolean {
    return this.get() !== null;
  }
}

/**
 * IndexedDB token storage (for large tokens or offline support)
 * PROS: Large storage capacity, works offline
 * CONS: Async, more complex, still vulnerable to XSS if not encrypted
 * USE: Progressive web apps with offline support
 */
export class IndexedDBTokenStorage implements TokenStorage {
  private dbName = "rhttp_auth";
  private storeName = "tokens";
  private readonly key = "access_token";
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
    });
  }

  async set(token: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.put(token, this.key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async get(): Promise<string | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], "readonly");
      const store = transaction.objectStore(this.storeName);
      const request = store.get(this.key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  async clear(): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(this.key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async has(): Promise<boolean> {
    return (await this.get()) !== null;
  }
}

/**
 * Get recommended token storage for environment
 */
export function getRecommendedTokenStorage(): TokenStorage {
  if (typeof window === "undefined") {
    // Server environment
    return new MemoryTokenStorage();
  }

  // Client environment - use Hybrid as default
  return new HybridTokenStorage();
}

/**
 * Get token storage based on config
 * @param storageType Type of storage to use
 */
export function getTokenStorage(
  storageType: "memory" | "session" | "hybrid" | "indexeddb" = "hybrid"
): TokenStorage {
  switch (storageType) {
    case "memory":
      return new MemoryTokenStorage();
    case "session":
      return new SessionStorageTokenStorage();
    case "indexeddb":
      return new IndexedDBTokenStorage();
    case "hybrid":
    default:
      return new HybridTokenStorage();
  }
}
