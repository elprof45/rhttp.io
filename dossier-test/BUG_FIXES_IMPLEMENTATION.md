# HTTP.io Bug Fixes Implementation Guide

This guide provides step-by-step implementations for critical bug fixes.

## Table of Contents

1. [CSRF Token Caching Fix](#1-csrf-token-caching-fix)
2. [Memory Leak Fix](#2-memory-leak-fix)
3. [Auth Token Refresh Loop Fix](#3-auth-token-refresh-loop-fix)
4. [Request Deduplication Key Fix](#4-request-deduplication-key-fix)
5. [Abort Controller Cleanup Fix](#5-abort-controller-cleanup-fix)
6. [Cache Cloning Fix](#6-cache-cloning-fix)

---

## 1. CSRF Token Caching Fix

### Problem
CSRF token promise is cached indefinitely, even after failure. Subsequent requests keep retrying the same failed promise.

### Current Code (Buggy)
```typescript
// In core.ts
let csrfTokenPromise: Promise<string> | null = null;

async function getCsrfToken(): Promise<string> {
  if (typeof document !== "undefined") {
    const cookieVal = getCookie(csrfConfig.cookieName);
    if (cookieVal) return cookieVal;
  }

  if (!csrfTokenPromise) {
    csrfTokenPromise = (async () => {
      try {
        const fetchFn = config.fetch || globalThis.fetch;
        const url = buildUrl(config.baseURL || "", csrfConfig.fetchEndpoint);
        const res = await fetchFn(url);
        if (res.ok) {
          const data = (await res.json()) as Record<string, any>;
          const token = data?.token || data?.csrfToken || "";
          return token;
        }
      } catch (err) {
        logger.error("Failed to fetch CSRF token", err);
      }
      return "";
    })();
  }
  return csrfTokenPromise;
}
```

### Fixed Code
```typescript
// In core.ts
interface CsrfCache {
  token: string;
  expiry: number;
}

let csrfTokenPromise: Promise<string> | null = null;
let csrfTokenCache: CsrfCache | null = null;

async function getCsrfToken(): Promise<string> {
  // Check cookie first
  if (typeof document !== "undefined") {
    const cookieVal = getCookie(csrfConfig.cookieName);
    if (cookieVal) return cookieVal;
  }

  // Check memory cache
  if (csrfTokenCache && csrfTokenCache.expiry > Date.now()) {
    return csrfTokenCache.token;
  }

  // Check if fetch is in progress
  if (csrfTokenPromise) {
    try {
      const token = await csrfTokenPromise;
      if (token) {
        // Cache the token
        csrfTokenCache = {
          token,
          expiry: Date.now() + (csrfConfig.tokenCacheTtl ?? 3600000), // 1 hour default
        };
        return token;
      }
      // Token was empty string, retry
      csrfTokenPromise = null;
    } catch (err) {
      // Fetch failed, retry
      csrfTokenPromise = null;
    }
  }

  // Fetch new token
  csrfTokenPromise = fetchCsrfTokenWithRetry();
  return csrfTokenPromise;
}

async function fetchCsrfTokenWithRetry(): Promise<string> {
  let lastError: any;
  
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const fetchFn = config.fetch || globalThis.fetch;
      const url = buildUrl(config.baseURL || "", csrfConfig.fetchEndpoint);
      const res = await fetchFn(url, { signal: AbortSignal.timeout(5000) });
      
      if (res.ok) {
        const data = (await res.json()) as Record<string, any>;
        const token = data?.token || data?.csrfToken || "";
        
        if (token) {
          csrfTokenCache = {
            token,
            expiry: Date.now() + (csrfConfig.tokenCacheTtl ?? 3600000),
          };
          return token;
        }
      }
    } catch (err) {
      lastError = err;
      if (attempt < 2) {
        await sleep(Math.min(100 * Math.pow(2, attempt), 1000));
      }
    }
  }

  logger.error("Failed to fetch CSRF token after retries", lastError);
  return "";
}

// Add to CsrfConfig type
export interface CsrfConfig {
  // ... existing ...
  tokenCacheTtl?: number; // Token cache duration in ms
}
```

---

## 2. Memory Leak Fix

### Problem
`cacheMap` and `dedupMap` grow unbounded, consuming more memory over time.

### Solution: Implement LRU Cache

```typescript
// Create new file: src/lru-cache.ts

interface LRUNode<K, V> {
  key: K;
  value: V;
  prev: LRUNode<K, V> | null;
  next: LRUNode<K, V> | null;
}

export class LRUCache<K, V> {
  private cache = new Map<K, LRUNode<K, V>>();
  private head: LRUNode<K, V> | null = null;
  private tail: LRUNode<K, V> | null = null;
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const node = this.cache.get(key);
    if (!node) return undefined;

    // Move to end (most recently used)
    this.moveToEnd(node);
    return node.value;
  }

  set(key: K, value: V): void {
    let node = this.cache.get(key);

    if (node) {
      // Update existing
      node.value = value;
      this.moveToEnd(node);
    } else {
      // Create new
      node = { key, value, prev: null, next: null };
      this.cache.set(key, node);
      this.addToEnd(node);

      // Evict if over capacity
      if (this.cache.size > this.maxSize) {
        this.evictLRU();
      }
    }
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    const node = this.cache.get(key);
    if (!node) return false;

    this.removeNode(node);
    this.cache.delete(key);
    return true;
  }

  clear(): void {
    this.cache.clear();
    this.head = null;
    this.tail = null;
  }

  private moveToEnd(node: LRUNode<K, V>): void {
    if (node === this.tail) return;
    this.removeNode(node);
    this.addToEnd(node);
  }

  private addToEnd(node: LRUNode<K, V>): void {
    if (!this.head) {
      this.head = this.tail = node;
      return;
    }

    node.prev = this.tail;
    node.next = null;
    this.tail!.next = node;
    this.tail = node;
  }

  private removeNode(node: LRUNode<K, V>): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
  }

  private evictLRU(): void {
    if (this.head) {
      this.cache.delete(this.head.key);
      this.removeNode(this.head);
    }
  }

  getSize(): number {
    return this.cache.size;
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      utilization: this.cache.size / this.maxSize,
    };
  }
}
```

### Update core.ts to use LRU Cache

```typescript
// In core.ts
import { LRUCache } from "./lru-cache";

// Replace:
// const cacheMap = new Map<string, { expiry: number; response: HttpResponse<any> }>();
// With:
const cacheMap = new LRUCache<string, { expiry: number; response: HttpResponse<any> }>(
  config.cache?.maxSize ?? 500
);

// Also replace dedupMap with LRU
const dedupMap = new LRUCache<string, Promise<HttpResponse<any>>>(100);

// Add to config interface
export interface CacheConfig {
  // ... existing ...
  maxSize?: number; // Max cache entries (default: 500)
}

// Replace all direct Map operations:
// cacheMap.get() -> works the same
// cacheMap.set() -> works the same
// cacheMap.delete() -> works the same
// cacheMap.has() -> works the same

// Add periodic cleanup
function setupCacheCleanup() {
  setInterval(() => {
    // Remove expired entries
    for (const [key, value] of cacheMap.entries() || []) {
      if (value.expiry < Date.now()) {
        cacheMap.delete(key);
      }
    }
  }, 60_000); // Every minute
}
```

---

## 3. Auth Token Refresh Loop Fix

### Problem
Token refresh can cause infinite loops if refresh endpoint returns 401.

### Fixed Code

```typescript
// In auth.ts - createRefreshAuthInterceptor

export function createRefreshAuthInterceptor(
  client: HttpClientInstance,
  options: RefreshAuthOptions
) {
  const statusCodes = options.statusCodes || [401];
  let isRefreshing = false;
  let refreshQueue: Array<{
    resolve: (token: string | null) => void;
    reject: (err: any) => void;
  }> = [];

  // Add refresh tracking
  let lastRefreshTime = 0;
  let refreshAttempts = 0;
  const MAX_REFRESH_ATTEMPTS = 3;
  const REFRESH_BACKOFF_MS = 5000;

  const processQueue = (err: any, token: string | null = null) => {
    refreshQueue.forEach((promise) => {
      if (err) {
        promise.reject(err);
      } else {
        promise.resolve(token);
      }
    });
    refreshQueue = [];
  };

  return async (error: any) => {
    // Check if error is retryable
    if (!(error instanceof HttpError) || !statusCodes.includes(error.status)) {
      throw error;
    }

    const originalRequest = error.options;
    if (!originalRequest) {
      throw error;
    }

    // Prevent infinite retry loop
    if (originalRequest._refreshAttempt) {
      throw error;
    }

    originalRequest._refreshAttempt = true;

    if (isRefreshing) {
      // Queue requests while token is refreshing
      return new Promise<string | null>((resolve, reject) => {
        refreshQueue.push({ resolve, reject });
      })
        .then((newToken) => {
          if (!newToken) throw error;
          return client.customFetch(originalRequest.url, {
            ...originalRequest,
            headers: {
              ...originalRequest.headers,
              "authorization": `${client.config.auth?.scheme || "Bearer"} ${newToken}`,
            },
          });
        });
    }

    isRefreshing = true;
    refreshAttempts++;

    // Check backoff timing
    const timeSinceLastRefresh = Date.now() - lastRefreshTime;
    if (refreshAttempts > 1 && timeSinceLastRefresh < REFRESH_BACKOFF_MS) {
      await new Promise((resolve) =>
        setTimeout(resolve, REFRESH_BACKOFF_MS - timeSinceLastRefresh)
      );
    }

    // Give up if too many attempts
    if (refreshAttempts > MAX_REFRESH_ATTEMPTS) {
      isRefreshing = false;
      processQueue(new Error("Max refresh attempts exceeded"), null);
      throw new Error("Token refresh failed after maximum attempts");
    }

    try {
      lastRefreshTime = Date.now();
      const newToken = await options.refreshToken();
      
      if (!newToken) {
        throw new Error("No token returned from refresh endpoint");
      }

      if (options.onTokenRefreshed) {
        await options.onTokenRefreshed(newToken);
      }

      // Update client config
      if (client.config.auth) {
        client.config.auth.accessToken = newToken;
      } else {
        client.config.auth = {
          accessToken: newToken,
          scheme: "Bearer",
          forwardCookies: false,
        };
      }

      processQueue(null, newToken);
      isRefreshing = false;
      refreshAttempts = 0; // Reset on success

      // Re-run original request
      return await client.customFetch(originalRequest.url, {
        ...originalRequest,
        headers: {
          ...originalRequest.headers,
          "authorization": `${client.config.auth?.scheme || "Bearer"} ${newToken}`,
        },
      });
    } catch (refreshError) {
      isRefreshing = false;
      processQueue(refreshError, null);
      
      // Don't retry again
      if (refreshAttempts <= MAX_REFRESH_ATTEMPTS) {
        throw refreshError;
      }
      
      throw new Error("Token refresh permanently failed");
    }
  };
}
```

---

## 4. Request Deduplication Key Fix

### Problem
Dedup key doesn't include all relevant request options.

### Fixed Code

```typescript
// In core.ts - performRequestWithAllFeatures function

// OLD (Buggy):
let dedupKey = "";
if (isGet && isDedupEnabled) {
  dedupKey = `${method}:${finalOptions.url}:${JSON.stringify(finalOptions.params ?? {})}`;
}

// NEW (Fixed):
let dedupKey = "";
if (isGet && isDedupEnabled) {
  dedupKey = `${method}:${finalOptions.url}:${JSON.stringify({
    params: finalOptions.params ?? {},
    headers: finalOptions.headers ?? {},
    timeout: finalOptions.timeout,
    cache: finalOptions.cache,
    validateResponse: finalOptions.validateResponse ? "yes" : "no",
  })}`;
}
```

---

## 5. Abort Controller Cleanup Fix

### Problem
AbortControllers not cleaned up in all error paths.

### Fixed Code

```typescript
// In core.ts - request function

async function request<T = any>(url: string, options: any): Promise<HttpResponse<T>> {
  const requestId = resolvedOptions.requestId || generateRequestId();
  const controller = new AbortController();
  abortControllers.set(requestId, controller);

  try {
    responsePromise = circuitBreaker.execute(async () => {
      return requestPool.execute(async () => {
        try {
          if (config.hooks?.onRequest) {
            await config.hooks.onRequest(resolvedOptions.url, resolvedOptions);
          }

          const response = await performRequestWithAllFeatures(resolvedOptions);

          if (config.hooks?.onSuccess) {
            await config.hooks.onSuccess(response);
          }

          return response;
        } catch (error) {
          if (config.hooks?.onError) {
            await config.hooks.onError(error);
          }
          throw error;
        } finally {
          if (config.hooks?.onFinally) {
            await config.hooks.onFinally();
          }
          // Always cleanup, even on error
          abortControllers.delete(requestId);
        }
      });
    });
  } catch (error) {
    // Ensure cleanup on circuit breaker error
    abortControllers.delete(requestId);
    responsePromise = Promise.reject(error);
  }

  return responsePromise;
}
```

---

## 6. Cache Cloning Fix

### Problem
Using JSON.parse/stringify loses Date objects and typed instances.

### Fixed Code

```typescript
// In core.ts

// OLD (Buggy):
function cloneResponse<T>(res: HttpResponse<T>): HttpResponse<T> {
  return {
    ...res,
    data: res.data ? JSON.parse(JSON.stringify(res.data)) : res.data,
    headers: { ...res.headers },
  };
}

// NEW (Fixed):
function cloneResponse<T>(res: HttpResponse<T>): HttpResponse<T> {
  return {
    ...res,
    data: res.data ? structuredCloneIfAvailable(res.data) : res.data,
    headers: { ...res.headers },
  };
}

function structuredCloneIfAvailable<T>(value: T): T {
  // Use structuredClone if available (Chrome 98+, Node 17+)
  if (typeof globalThis.structuredClone === "function") {
    try {
      return globalThis.structuredClone(value);
    } catch {
      // Fallback if structuredClone fails
    }
  }

  // For simple cases, shallow copy might be enough
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (value instanceof Date) {
    return new Date(value.getTime()) as any;
  }

  if (value instanceof Array) {
    return value.map((v) => structuredCloneIfAvailable(v)) as any;
  }

  if (value instanceof Object) {
    return Object.assign(Object.create(Object.getPrototypeOf(value)), value);
  }

  return value;
}
```

---

## Implementation Order

1. **Phase 1 (Critical)**: CSRF token caching + Memory leak
2. **Phase 2 (Important)**: Auth token refresh + Abort cleanup
3. **Phase 3 (Nice-to-have)**: Dedup key + Cache cloning

---

## Testing the Fixes

```typescript
// test-fixes.test.ts

test("CSRF token retries after failure", async () => {
  let attempts = 0;
  installFetch(async () => {
    attempts++;
    if (attempts < 2) {
      return createMockResponse(false, 500, {}) as any;
    }
    return createMockResponse(true, 200, { token: "new-token" }) as any;
  });

  const http = createClientHttp({
    csrf: { enabled: true, fetchEndpoint: "/csrf" },
  });

  // First call fails, second should succeed
  const token = await getCsrfToken();
  expect(token).toBe("new-token");
  expect(attempts).toBe(2);
});

test("Cache doesn't grow unbounded", async () => {
  const http = createHttp({
    cache: { enabled: true, ttl: 60_000, maxSize: 10 },
  });

  // Make 100 requests to different URLs
  for (let i = 0; i < 100; i++) {
    installJsonFetch(createMockResponse(true, 200, { id: i }));
    await http.get(`/item/${i}`);
  }

  // Only 10 should be cached
  expect(http.config.cache?.maxSize).toBe(10);
});

test("Token refresh stops after max attempts", async () => {
  let refreshAttempts = 0;

  const http = createHttp({
    auth: { getToken: async () => "invalid" },
  });

  const interceptor = createRefreshAuthInterceptor(http, {
    refreshToken: async () => {
      refreshAttempts++;
      throw new Error("Refresh failed");
    },
    statusCodes: [401],
  });

  installJsonFetch(createMockResponse(false, 401, {}));

  try {
    await http.get("/protected");
  } catch (error) {
    expect(error.message).toContain("permanent");
    expect(refreshAttempts).toBeLessThanOrEqual(3);
  }
});
```
