import { createHttp } from "./core";
import type { CreateHttpConfig, HttpClientInstance } from "./types";

/**
 * Creates a client-side HTTP client instance with secure defaults.
 *
 * Features:
 * - Automatically includes credentials (cookies) in requests
 * - Automatically injects Authorization token from localStorage
 * - Pre-configured CSRF protection
 * - Pre-configured for browser environments
 *
 * Usage:
 * ```typescript
 * import { createClientHttp } from "rhttp.io/client";
 *
 * const http = createClientHttp({
 *   baseURL: "https://api.example.com",
 * });
 *
 * // Automatically includes cookies and token from localStorage
 * const response = await http.get("/protected-resource");
 * ```
 *
 * Token Management:
 * - Tokens are read from localStorage under the key "access_token"
 * - To update token: localStorage.setItem("access_token", "new-token")
 * - Tokens are injected as: Authorization: Bearer <token>
 */
export function createClientHttp(
  config: CreateHttpConfig = {},
): HttpClientInstance {
  // Client defaults for secure handling
  const clientDefaults = {
    credentials: "include" as const,
    headers: { "Content-Type": "application/json" },
  };

  // Merge defaultFetchOptions intelligently
  const mergedFetchOptions = {
    ...clientDefaults,
    ...config.defaultFetchOptions,
    // Merge headers instead of replacing them
    headers: {
      ...clientDefaults.headers,
      ...(config.defaultFetchOptions?.headers || {}),
    },
  };

  // Create base instance with client defaults
  const http = createHttp({
    ...config,
    defaultFetchOptions: mergedFetchOptions,
    csrf: {
      enabled: true,
      cookieName: "csrf-token",
      headerName: "X-CSRF-Token",
      fetchEndpoint: "/api/csrf",
      prefetch: true,
      ...config.csrf,
    },
  });

  // Add automatic token injection from localStorage
  // This interceptor runs for every request and injects the access token if present
  http.interceptors.request.use((options) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("access_token");
      if (token) {
        options.headers = options.headers || {};
        options.headers["authorization"] = `Bearer ${token}`;
      }
    }
    return options;
  });

  return http;
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
