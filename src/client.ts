import { createHttp } from "./core";
import type { CreateHttpConfig, HttpClientInstance } from "./types";
import {
  HybridTokenStorage,
  getTokenStorage,
  getRecommendedTokenStorage,
  type TokenStorage,
} from "./token-storage";

/**
 * Creates a client-side HTTP client instance with secure defaults.
 *
 * Features:
 * - Automatically includes credentials (cookies) in requests
 * - Secure token storage (HttpOnly cookies recommended, fallback to Hybrid storage)
 * - Pre-configured CSRF protection
 * - Pre-configured for browser environments
 * - Automatic observability and compression
 *
 * Usage:
 * ```typescript
 * import { createClientHttp } from "rhttp.io/client";
 *
 * const http = createClientHttp({
 *   baseURL: "https://api.example.com",
 *   tokenStorage: "hybrid", // hybrid, memory, session, indexeddb
 * });
 *
 * // Automatically includes cookies and secure token
 * const response = await http.get("/protected-resource");
 * ```
 *
 * Token Management (SECURE):
 * - RECOMMENDED: Use HttpOnly cookies (set by server on login)
 * - FALLBACK: Hybrid storage (memory + sessionStorage)
 * - DO NOT: Use localStorage for sensitive tokens (XSS vulnerable)
 *
 * CSRF Protection:
 * - CSRF is enabled by default for Client Components
 * - Tokens are fetched from /api/csrf and cached
 * - Can be customized or disabled via config.csrf
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
  const tokenStorage = config.tokenStorageImpl ||
    getTokenStorage(config.tokenStorage || "hybrid");

  // Default secure getToken function
  const defaultGetToken = async () => {
    // Priority 1: HttpOnly cookie (most secure, set by server)
    // This can't be accessed from JS, but fetch includes it automatically
    // Priority 2: Token storage (Hybrid by default)
    if (tokenStorage instanceof HybridTokenStorage || typeof tokenStorage.get === "function") {
      const token = await tokenStorage.get();
      return token;
    }
    return null;
  };

  // Create base instance with client defaults
  const http = createHttp({
    ...config,
    defaultFetchOptions: mergedFetchOptions,

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
      logger: typeof process !== "undefined" && process.env.NODE_ENV === "development",
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
