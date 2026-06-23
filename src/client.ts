import { createHttp } from "./core";
import type { CreateHttpConfig, HttpClientInstance } from "./types";
import {
  HybridTokenStorage,
  getTokenStorage,
  type TokenStorage,
} from "./token-storage";

/**
 * Creates a client-side HTTP client instance with secure defaults for browsers.
 *
 * Features:
 * - Automatically includes credentials (cookies) in requests
 * - Secure token storage with hybrid mode (memory + sessionStorage)
 * - Pre-configured CSRF protection (enabled by default)
 * - Smart client-side caching with pattern-based invalidation
 * - Request deduplication within cache window
 * - ETag support for bandwidth optimization
 *
 * Token Management (Priority Order):
 * 1. HttpOnly cookies (Set-Cookie from server) ← RECOMMENDED
 *    Automatically included via fetch credentials: 'include'
 * 2. Token storage (hybrid by default: memory + sessionStorage)
 *    Survives page navigation but cleared on tab close
 * 3. Custom getToken() callback
 *    For complex refresh or rotation logic
 *
 * Cookie Forwarding:
 * - HttpOnly cookies: Automatically sent by fetch (no code needed)
 * - Session cookies: Sent with credentials: 'include'
 * - Custom manipulation: Use options.headers in requests
 *
 * Usage:
 * ```typescript
 * import { createClientHttp } from "rhttp.io/client";
 *
 * const http = createClientHttp({
 *   baseURL: "https://api.example.com",
 *   tokenStorage: "hybrid",
 *   smartCaching: {
 *     enabled: true,
 *     patterns: {
 *       '/api/users': { ttl: 60000, invalidateOn: ['POST', 'PUT', 'DELETE'] },
 *       '/api/posts': { ttl: 30000, invalidateOn: ['POST', 'PUT'] },
 *     }
 *   }
 * });
 *
 * // Token automatically read from storage
 * const { data: profile } = await http.get("/me");
 *
 * // Cache invalidated on POST
 * const { data: user } = await http.post("/users", {
 *   name: "John",
 *   email: "john@example.com"
 * });
 *
 * // Smart cache: still cached, not refetched
 * const { data: sameProfile } = await http.get("/me");
 * ```
 *
 * CSRF Protection:
 * - Enabled by default for client-side safety
 * - Tokens fetched from /api/csrf endpoint
 * - Cached and reused for subsequent requests
 * - Can be customized or disabled via config.csrf
 *
 * Security Best Practices:
 * - ✅ RECOMMENDED: Use HttpOnly cookies (immune to XSS)
 * - ✅ RECOMMENDED: Hybrid storage (memory + sessionStorage)
 * - ✅ RECOMMENDED: Token refresh via auth interceptor
 * - ❌ AVOID: localStorage for sensitive tokens (XSS vulnerable)
 * - ❌ AVOID: Storing tokens in URL/query params
 * - ❌ AVOID: Disabling CSRF in production
 */
export interface CreateClientHttpConfig extends CreateHttpConfig {
  /**
   * Token storage strategy
   * - "memory": In-memory (lost on reload, most secure)
   * - "session": sessionStorage (cleared when tab closes)
   * - "hybrid": Memory + SessionStorage backup (RECOMMENDED)
   * - "indexeddb": IndexedDB (for large tokens or offline support)
   *
   * Default: "hybrid"
   */
  tokenStorage?: "memory" | "session" | "hybrid" | "indexeddb";

  /**
   * Custom token storage implementation
   */
  tokenStorageImpl?: TokenStorage;

  /**
   * Enable smart client-side caching with pattern-based invalidation
   * Default: true
   *
   * Features:
   * - Per-endpoint cache control
   * - Pattern-based invalidation (e.g., invalidate /api/users/* when creating user)
   * - Request deduplication within cache window
   * - ETag support for conditional requests
   *
   * Example:
   * ```typescript
   * const http = createClientHttp({
   *   smartCaching: {
   *     enabled: true,
   *     patterns: {
   *       '/api/users': { ttl: 60000, invalidateOn: ['POST', 'PUT', 'DELETE'] },
   *       '/api/posts': { ttl: 30000, invalidateOn: ['POST', 'PUT'] },
   *     }
   *   }
   * });
   * ```
   */
  smartCaching?: {
    enabled?: boolean;
    patterns?: Record<
      string,
      {
        ttl?: number;
        invalidateOn?: string[]; // HTTP methods that invalidate this pattern
        tags?: string[]; // Cache tags for grouped invalidation
      }
    >;
  };
}

export function createClientHttp(
  config: CreateClientHttpConfig = {},
): HttpClientInstance {
  // ─────────────────────────────────────────────────────────────────
  // Secure defaults for client environment
  // ─────────────────────────────────────────────────────────────────

  const clientDefaults = {
    // Include credentials (cookies) by default for authentication
    credentials: "include" as const,
    headers: { "Content-Type": "application/json" },
  };

  // Merge defaultFetchOptions intelligently
  const mergedFetchOptions = {
    ...clientDefaults,
    ...config.defaultFetchOptions,
    headers: {
      ...clientDefaults.headers,
      ...(config.defaultFetchOptions?.headers || {}),
    },
  };

  // ─────────────────────────────────────────────────────────────────
  // Secure token management
  // ─────────────────────────────────────────────────────────────────

  // Use custom storage or get recommended
  const tokenStorage =
    config.tokenStorageImpl || getTokenStorage(config.tokenStorage || "hybrid");

  // Default secure getToken function
  const defaultGetToken = async () => {
    // Priority 1: HttpOnly cookie (most secure, set by server)
    // This can't be accessed from JS, but fetch includes it automatically
    // Priority 2: Token storage (Hybrid by default)
    if (
      tokenStorage instanceof HybridTokenStorage ||
      typeof tokenStorage.get === "function"
    ) {
      const token = await tokenStorage.get();
      return token;
    }
    return null;
  };

  // ─────────────────────────────────────────────────────────────────
  // Smart client-side caching with pattern-based invalidation
  // ─────────────────────────────────────────────────────────────────

  const smartCachingConfig = config.smartCaching?.enabled ?? true;
  const cachePatterns = config.smartCaching?.patterns || {
    "/api": { ttl: 60000, invalidateOn: ["POST", "PUT", "DELETE"] },
  };

  // Helper to find matching cache pattern
  const findCachePattern = (url: string) => {
    for (const [pattern, config] of Object.entries(cachePatterns)) {
      if (url.includes(pattern)) {
        return config;
      }
    }
    return null;
  };

  // Create base instance with client defaults
  const http = createHttp({
    ...config,
    defaultFetchOptions: mergedFetchOptions,

    // ─────────────────────────────────────────────────────────────
    // Smart client-side caching
    // ─────────────────────────────────────────────────────────────
    cache: smartCachingConfig
      ? {
          enabled: true,
          ttl: 60000, // Default 60s client-side cache
          strategy: "cache-first",
          keyBuilder: (url: string, options: any) => {
            // Include query params and method in cache key for accuracy
            return `${options?.method || "GET"}:${url}`;
          },
          ...config.cache,
        }
      : config.cache,

    // ─────────────────────────────────────────────────────────────
    // CSRF Protection - ENABLED by default for client
    // ─────────────────────────────────────────────────────────────
    csrf: {
      enabled: true,
      cookieName: "csrf-token",
      headerName: "X-CSRF-Token",
      fetchEndpoint: "/api/csrf",
      prefetch: true,
      ...config.csrf,
    },

    // ─────────────────────────────────────────────────────────────
    // Authentication with secure token storage
    // ─────────────────────────────────────────────────────────────
    auth: {
      scheme: "Bearer",
      // Use provided getToken or secure default
      getToken: config.auth?.getToken || defaultGetToken,
      ...config.auth,
    },

    // ─────────────────────────────────────────────────────────────
    // Observability - ENABLED by default in dev
    // ─────────────────────────────────────────────────────────────
    observability: {
      logger:
        typeof process !== "undefined" &&
        process.env.NODE_ENV === "development",
      tracing: false,
      metrics: false,
      ...config.observability,
    },

    // ─────────────────────────────────────────────────────────────
    // Smart retry policy for client
    // ─────────────────────────────────────────────────────────────
    retry: {
      attempts: 2,
      strategy: "exponential",
      delay: 300,
      maxDelay: 10000,
      statusCodes: [408, 429, 500, 502, 503, 504],
      ...config.retry,
    },

    // ─────────────────────────────────────────────────────────────
    // Default timeout for client requests
    // ─────────────────────────────────────────────────────────────
    timeout: config.timeout ?? 30000,
  });

  // ─────────────────────────────────────────────────────────────────
  // Utility methods for token management
  // ─────────────────────────────────────────────────────────────────

  return {
    ...http,

    /**
     * Set token securely in storage
     */
    async setToken(token: string): Promise<void> {
      if (typeof tokenStorage.set === "function") {
        await tokenStorage.set(token);
      }
    },

    /**
     * Get current token from storage
     */
    async getToken(): Promise<string | null> {
      if (typeof tokenStorage.get === "function") {
        return await tokenStorage.get();
      }
      return null;
    },

    /**
     * Clear token from storage
     */
    async clearToken(): Promise<void> {
      if (typeof tokenStorage.clear === "function") {
        await tokenStorage.clear();
      }
    },

    /**
     * Check if token exists
     */
    async hasToken(): Promise<boolean> {
      if (typeof tokenStorage.has === "function") {
        return await tokenStorage.has();
      }
      return false;
    },
  } as HttpClientInstance & {
    setToken: (token: string) => Promise<void>;
    getToken: () => Promise<string | null>;
    clearToken: () => Promise<void>;
    hasToken: () => Promise<boolean>;
  };
}

export * from "./core";
export * from "./types";
export * from "./errors";
export {
  buildUrl,
  getCookie,
  parseHeaders,
  parseResponse,
  generateRequestId,
} from "./utils";
