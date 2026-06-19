import { createHttp, setRequestContextStore } from "./core";
import type { CreateHttpConfig, HttpClientInstance } from "./types";

/**
 * Creates a server-side HTTP client instance configured for TanStack Start and similar frameworks.
 *
 * Features:
 * - Automatically extracts and forwards cookies from incoming request
 * - Supports both explicit getRequest() calls and implicit request context
 * - Enables tracing and logging by default
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
    auth: {
      forwardCookies: true,
      ...config.auth,
    },
    observability: {
      logger: true,
      tracing: true,
      metrics: process.env.NODE_ENV === "production",
      ...config.observability,
    },
  });

  // Add automatic cookie forwarding interceptor for TanStack Start and similar frameworks
  // This intercepts requests and automatically extracts cookies from the active request context
  http.interceptors.request.use(async (options) => {
    try {
      // Try to get request from context
      let request: any = null;

      // Priority 1: Explicit requestContext from config (highest priority)
      if (config.requestContext && !request) {
        try {
          request = config.requestContext();
        } catch {
          // Ignore if requestContext fails
        }
      }

      // Priority 2: Try TanStack Start auto-detection (optional dependency)
      if (!request) {
        try {
          // Dynamically import TanStack Start to avoid hard dependency
          // @ts-ignore - TanStack Start is optional
          const module = await import("@tanstack/react-start/server");
          if (module?.getRequest) {
            request = module.getRequest();
          }
        } catch {
          // TanStack Start not available or failed to load, skip
        }
      }

      // If we have a request, extract and forward cookies
      if (request && typeof request.headers?.get === "function") {
        const cookieHeader = request.headers.get("cookie");
        if (cookieHeader) {
          options.headers = options.headers || {};
          options.headers["cookie"] = cookieHeader;
        }
      }
    } catch {
      // Silently ignore errors during cookie extraction (e.g., outside request context)
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
