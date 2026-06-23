/**
 * QUICK_START_PATTERNS.ts
 *
 * Comprehensive examples of common rhttp.io patterns.
 * All examples are production-ready and can be used as templates.
 *
 * @version 1.0.0
 */

import { createClientHttp, createServerHttp, HttpError } from "rhttp.io";

// ============================================================================
// PATTERN 1: Basic Client Setup
// ============================================================================

export function example_1_1_basic_browser_setup() {
  const http = createClientHttp({
    baseURL: "https://api.example.com",
    timeout: 30_000,
  });
  return http;
}

export function example_1_2_full_browser_setup() {
  const http = createClientHttp({
    baseURL: "https://api.example.com",
    timeout: 30_000,
    auth: {
      scheme: "Bearer",
      getToken: async () => localStorage.getItem("auth_token") || undefined,
    },
    cache: {
      enabled: true,
      ttl: 5 * 60 * 1000,
      strategy: "network-first",
    },
    retry: {
      attempts: 2,
      strategy: "exponential",
    },
    observability: {
      enableLogging: true,
      enableMetrics: true,
    },
  });
  return http;
}

export function example_1_3_server_setup() {
  const http = createServerHttp({
    baseURL: "https://api.example.com",
    timeout: 60_000,
  });
  return http;
}

// ============================================================================
// PATTERN 2: Authentication & Token Management
// ============================================================================

export function example_2_1_static_token() {
  const http = createClientHttp({
    baseURL: "https://api.example.com",
    auth: {
      scheme: "Bearer",
      token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    },
  });
  return http;
}

export function example_2_2_dynamic_token() {
  const http = createClientHttp({
    baseURL: "https://api.example.com",
    auth: {
      scheme: "Bearer",
      getToken: async () => {
        const response = await fetch("/auth/token");
        const { token } = await response.json();
        return token;
      },
    },
  });
  return http;
}

export function example_2_3_token_refresh() {
  const http = createClientHttp({
    baseURL: "https://api.example.com",
    auth: {
      scheme: "Bearer",
      getToken: async () => localStorage.getItem("token") || undefined,
      refreshToken: async (oldToken: string) => {
        const response = await fetch("/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: oldToken }),
        });
        if (!response.ok) throw new Error("Token refresh failed");
        const { token } = await response.json();
        localStorage.setItem("token", token);
        return token;
      },
    },
  });
  return http;
}

// ============================================================================
// PATTERN 3: Caching Strategies
// ============================================================================

export function example_3_1_network_first() {
  const http = createClientHttp({
    baseURL: "https://api.example.com",
    cache: {
      enabled: true,
      strategy: "network-first",
      ttl: 5 * 60 * 1000,
    },
  });
  return http;
}

export function example_3_2_cache_first() {
  const http = createClientHttp({
    baseURL: "https://api.example.com",
    cache: {
      enabled: true,
      strategy: "cache-first",
      ttl: 24 * 60 * 60 * 1000,
    },
  });
  return http;
}

export function example_3_3_smart_caching() {
  const http = createClientHttp({
    baseURL: "https://api.example.com",
    cache: {
      enabled: true,
      strategy: "network-first",
      smartCaching: [
        {
          pattern: /^\/users($|\/)/,
          ttl: 5 * 60 * 1000,
          invalidateOn: ["POST", "PUT", "DELETE"],
          tags: ["users"],
        },
      ],
    },
  });
  return http;
}

// ============================================================================
// PATTERN 4: Error Handling
// ============================================================================

export async function example_4_1_basic_errors() {
  const http = createClientHttp({
    baseURL: "https://api.example.com",
  });

  try {
    const data = await http.get("/users/123");
    console.log("Success:", data);
  } catch (error) {
    if (error instanceof HttpError) {
      console.error("HTTP Error:", error.status);
    }
  }
}

export function example_4_2_error_hooks() {
  const http = createClientHttp({
    baseURL: "https://api.example.com",
  });

  http.on("error", (context) => {
    const { error, status, retryCount } = context;
    if (status === 401) console.error("Unauthorized");
    else console.error(`Failed: ${error.message}`);
  });

  return http;
}

// ============================================================================
// PATTERN 5: Interceptors & Lifecycle Hooks
// ============================================================================

export function example_5_1_request_interceptors() {
  const http = createClientHttp({
    baseURL: "https://api.example.com",
  });

  http.interceptors.request.use((config) => ({
    ...config,
    headers: {
      ...config.headers,
      "X-Custom-Header": "value",
    },
  }));

  return http;
}

export function example_5_3_lifecycle_hooks() {
  const http = createClientHttp({
    baseURL: "https://api.example.com",
  });

  http.on("request", (context) => {
    console.log(`→ ${context.method} ${context.url}`);
  });

  http.on("success", (context) => {
    console.log(
      `← ${context.status} ${context.url} (${context.timing.total}ms)`,
    );
  });

  http.on("error", (context) => {
    console.error(`✗ ${context.status} ${context.url}`);
  });

  return http;
}

// ============================================================================
// PATTERN 6: Advanced Features
// ============================================================================

export async function example_6_1_deduplication() {
  const http = createClientHttp({
    baseURL: "https://api.example.com",
    deduplication: { enabled: true },
  });

  const [users1, users2] = await Promise.all([
    http.get("/users"),
    http.get("/users"),
  ]);

  return { users1 };
}

export function example_6_2_circuit_breaker() {
  const http = createClientHttp({
    baseURL: "https://api.example.com",
    circuitBreaker: {
      enabled: true,
      failureThreshold: 5,
      timeout: 60_000,
    },
  });
  return http;
}

export function example_6_4_request_history() {
  const http = createClientHttp({
    baseURL: "https://api.example.com",
    observability: {
      enableRequestHistory: true,
      requestHistoryMaxSize: 100,
    },
  });

  const history = http.getRequestHistory();
  history.forEach(({ url, method, status, duration }) => {
    console.log(`${method} ${url} → ${status} (${duration}ms)`);
  });

  return http;
}

// ============================================================================
// PATTERN 7: Batch Operations
// ============================================================================

export async function example_9_1_batch_requests() {
  const http = createClientHttp({
    baseURL: "https://api.example.com",
  });

  const [users, posts, comments] = await Promise.all([
    http.get("/users"),
    http.get("/posts"),
    http.get("/comments"),
  ]);

  return { users, posts, comments };
}

export async function example_9_2_sequential_requests() {
  const http = createClientHttp({
    baseURL: "https://api.example.com",
  });

  const user = await http.get("/users/123");
  const userPosts = await http.get(`/users/${user.id}/posts`);
  const firstPostComments = await http.get(
    `/posts/${userPosts[0].id}/comments`,
  );

  return { user, userPosts, firstPostComments };
}

// ============================================================================
// PATTERN 8: Production Setup
// ============================================================================

export function example_10_1_production_config() {
  const http = createClientHttp({
    baseURL: process.env.REACT_APP_API_URL || "https://api.example.com",
    timeout: 30_000,
    auth: {
      scheme: "Bearer",
      getToken: async () => localStorage.getItem("auth_token") || undefined,
    },
    cache: {
      enabled: true,
      strategy: "network-first",
      ttl: 5 * 60 * 1000,
    },
    retry: {
      attempts: 3,
      strategy: "exponential",
    },
    circuitBreaker: {
      enabled: true,
      failureThreshold: 5,
    },
    observability: {
      enableLogging: true,
      enableMetrics: true,
      enableRequestHistory: true,
    },
  });

  http.on("error", (context) => {
    console.error("Request failed", {
      error: context.error.message,
      status: context.status,
    });
  });

  return http;
}

// ============================================================================
// PATTERN 9: TypeScript Types
// ============================================================================

export async function example_11_1_typed_responses() {
  interface User {
    id: number;
    name: string;
    email: string;
  }

  const http = createClientHttp({
    baseURL: "https://api.example.com",
  });

  const response = await http.get<User[]>("/users");
  const user = response.data[0];
  console.log(user.name);

  return response;
}

export async function example_11_2_typed_requests() {
  interface CreateUserRequest {
    name: string;
    email: string;
  }

  interface CreateUserResponse {
    id: number;
    name: string;
  }

  const http = createClientHttp({
    baseURL: "https://api.example.com",
  });

  const request: CreateUserRequest = {
    name: "John",
    email: "john@example.com",
  };

  const response = await http.post<CreateUserResponse>("/users", request);
  return response;
}

// ============================================================================
// Export all patterns
// ============================================================================

export const patterns = {
  "1.1": example_1_1_basic_browser_setup,
  "1.2": example_1_2_full_browser_setup,
  "1.3": example_1_3_server_setup,
  "2.1": example_2_1_static_token,
  "2.2": example_2_2_dynamic_token,
  "2.3": example_2_3_token_refresh,
  "3.1": example_3_1_network_first,
  "3.2": example_3_2_cache_first,
  "3.3": example_3_3_smart_caching,
  "4.1": example_4_1_basic_errors,
  "4.2": example_4_2_error_hooks,
  "5.1": example_5_1_request_interceptors,
  "5.3": example_5_3_lifecycle_hooks,
  "6.1": example_6_1_deduplication,
  "6.2": example_6_2_circuit_breaker,
  "6.4": example_6_4_request_history,
  "9.1": example_9_1_batch_requests,
  "9.2": example_9_2_sequential_requests,
  "10.1": example_10_1_production_config,
  "11.1": example_11_1_typed_responses,
  "11.2": example_11_2_typed_requests,
};
