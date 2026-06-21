import { createHttp, setRequestContextStore } from "./core";
import type { CreateHttpConfig, HttpClientInstance } from "./types";

/**
 * Creates a server-side HTTP client instance configured for SSR frameworks.
 *
 * Features:
 * - Automatically extracts and forwards cookies from incoming request
 * - Supports both explicit getRequest() calls and implicit request context
 * - Enables observability (logging, tracing, metrics) by default
 * - Smart retry and timeout configuration
 * - Pre-configured for server environments
 *
 * Configuration:
 * - `requestContext`: Optional function that returns the current request
 * - `auth.forwardCookies`: Enabled by default for SSR
 * - `observability`: Logger and tracing enabled by default
 *
 * Usage with TanStack Start:
 * ```typescript
 * import { createServerHttp } from "rhttp.io/server";
 * import { getRequest } from "@tanstack/react-start/server";
 *
 * const http = createServerHttp({
 *   baseURL: "https://internal-api.example.com",
 *   timeout: 30_000,
 *   requestContext: () => getRequest(),
 * });
 *
 * export const myServerFn = createServerFn({ method: "GET" }).handler(async () => {
 *   const { data } = await http.get("/protected-api");
 *   return data;
 * });
 * ```
 */
export function createServerHttp(config: CreateHttpConfig = {}): HttpClientInstance {
  // Create base instance with server defaults
  const http = createHttp({
    ...config,

    // ─────────────────────────────────────────────────────────────
    // Server should NOT use credentials (include) by default
    // SSR forwards cookies explicitly via interceptor
    // ─────────────────────────────────────────────────────────────
    defaultFetchOptions: {
      credentials: "omit" as const, // Don't send browser cookies
      ...config.defaultFetchOptions,
    },

    // ─────────────────────────────────────────────────────────────
    // Authentication
    // - forwardCookies: Extract and forward cookies from client request
    // - This works with requestContext
    // ─────────────────────────────────────────────────────────────
    auth: {
      forwardCookies: true,
      ...config.auth,
    },

    // ─────────────────────────────────────────────────────────────
    // Observability - ENABLED by default on server
    // - Logger: Always true (important for debugging)
    // - Tracing: True (for request tracking and debugging)
    // - Metrics: Only in production
    // ─────────────────────────────────────────────────────────────
    observability: {
      logger: true,
      tracing: true,
      metrics: process.env.NODE_ENV === "production",
      ...config.observability,
    },

    // ─────────────────────────────────────────────────────────────
    // Retry policy for server
    // - More aggressive retry on server (internal calls)
    // ─────────────────────────────────────────────────────────────
    retry: {
      attempts: 2,
      strategy: "exponential",
      delay: 500,
      maxDelay: 10000,
      statusCodes: [408, 429, 500, 502, 503, 504],
      ...config.retry,
    },

    // ─────────────────────────────────────────────────────────────
    // Timeout for server requests
    // - Higher timeout for server (internal calls can be slower)
    // ─────────────────────────────────────────────────────────────
    timeout: config.timeout ?? 30000,

    // ─────────────────────────────────────────────────────────────
    // CSRF - DISABLED by default on server
    // - Server to server calls don't need CSRF
    // - Can be enabled for special cases
    // ─────────────────────────────────────────────────────────────
    csrf: {
      enabled: config.csrf?.enabled ?? false,
      ...config.csrf,
    },

    // Pass requestContext to core
    requestContext: config.requestContext,
  });

  // ─────────────────────────────────────────────────────────────────
  // Automatic cookie forwarding interceptor
  // This extracts cookies from the active request context and forwards them
  // ─────────────────────────────────────────────────────────────────

  http.interceptors.request.use(async (options) => {
    try {
      // Try to get request from context
      let request: any = null;

      // Priority 1: Explicit requestContext from config
      if (config.requestContext && !request) {
        try {
          request = config.requestContext();
        } catch {
          // Ignore if requestContext fails
        }
      }

      // Priority 2: Try TanStack Start auto-detection
      if (!request) {
        try {
          // Dynamically import TanStack Start to avoid hard dependency
          // @ts-ignore - TanStack Start is optional
          const module = await import("@tanstack/react-start/server");
          if (module?.getRequest) {
            request = module.getRequest();
          }
        } catch {
          // TanStack Start not available, skip
        }
      }

      // Extract and forward cookies if we have a request
      if (request && typeof request.headers?.get === "function") {
        const cookieHeader = request.headers.get("cookie");
        if (cookieHeader) {
          options.headers = options.headers || {};
          options.headers["cookie"] = cookieHeader;
        }
      }
    } catch (error) {
      // Silently ignore errors during cookie extraction
    }

    return options;
  });

  return http;
}

export { setRequestContextStore } from "./core";
export * from "./core";
export * from "./types";
export * from "./errors";
export { buildUrl, getCookie, parseHeaders, parseResponse, generateRequestId } from "./utils";
