/**
 * QUICK_START_PATTERNS.ts
 *
 * Comprehensive examples of common rhttp.io patterns.
 * All examples are production-ready and can be used as templates.
 *
 * @version 1.0.0
 */

// ============================================================================
// PATTERN 1: Basic Client Setup
// ============================================================================

import {
  createClientHttp,
  createServerHttp,
  createHttp,
  HttpError,
  TimeoutError,
  NetworkError,
} from "rhttp.io";

/**
 * Example 1.1: Browser Client with Default Configuration
 */
export function example_1_1_basic_browser_setup() {
  const http = createClientHttp({
    baseURL: "https://api.example.com",
    timeout: 30_000,
  });

  return http;
}

/**
 * Example 1.2: Browser Client with Full Configuration
 */
export function example_1_2_full_browser_setup() {
  const http = createClientHttp({
    // Base configuration
    baseURL: "https://api.example.com",
    timeout: 30_000,
    defaultHeaders: {
      "X-Client-Version": "1.0.0",
    },

    // Authentication
    auth: {
      scheme: "Bearer",
      getToken: async () => {
        // Fetch from secure storage
        const token = localStorage.getItem("auth_token");
        return token || undefined;
      },
      forwardCookies: true, // For SSR with cookies
    },

    // Caching
    cache: {
      enabled: true,
      ttl: 5 * 60 * 1000, // 5 minutes
      strategy: "network-first",
    },

    // Retry logic
    retry: {
      attempts: 2,
      strategy: "exponential",
      initialDelay: 1000,
      maxDelay: 30_000,
    },

    // CSRF protection
    csrf: {
      enabled: true,
      headerName: "X-CSRF-Token",
    },

    // Observability
    observability: {
      enableLogging: true,
      enableMetrics: true,
      enableTracing: true,
    },
  });

  return http;
}

/**
 * Example 1.3: Server-Side Client
 */
export function example_1_3_server_setup() {
  const http = createServerHttp({
    baseURL: "https://api.example.com",
    timeout: 60_000, // Longer timeout for server
    requestContext: () => ({
      // Forward headers from request context
      "x-forwarded-for": "127.0.0.1",
      "x-request-id": `req-${Date.now()}`,
    }),
  });

  return http;
}

// ============================================================================
// PATTERN 2: Authentication & Token Management
// ============================================================================

/**
 * Example 2.1: Static Bearer Token
 */
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

/**
 * Example 2.2: Dynamic Token from Function
 */
export function example_2_2_dynamic_token() {
  const http = createClientHttp({
    baseURL: "https://api.example.com",
    auth: {
      scheme: "Bearer",
      getToken: async () => {
        // Example: Fetch from API
        const response = await fetch("/auth/token");
        const { token } = await response.json();
        return token;
      },
    },
  });

  return http;
}

/**
 * Example 2.3: Token Refresh with Request Queue
 */
export function example_2_3_token_refresh() {
  const http = createClientHttp({
    baseURL: "https://api.example.com",
    auth: {
      scheme: "Bearer",
      getToken: async () => localStorage.getItem("token") || undefined,
      refreshToken: async (oldToken: string) => {
        // Call refresh endpoint
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
      // Built-in timeout protection (10 seconds)
      // Prevents indefinite hangs on failed refresh
    },
  });

  return http;
}

/**
 * Example 2.4: Cookie-Based Authentication (SSR)
 */
export function example_2_4_cookie_auth() {
  const http = createClientHttp({
    baseURL: "https://api.example.com",
    auth: {
      // Cookies are automatically handled by browser
      // No token needed, just enable forwarding
      forwardCookies: true,
    },
  });

  return http;
}

/**
 * Example 2.5: HttpOnly Cookie Forwarding (Server)
 */
export function example_2_5_httponly_cookies() {
  // In Next.js or TanStack Start
  const http = createServerHttp({
    baseURL: "https://api.example.com",
    auth: {
      // Forward HttpOnly cookies from incoming request
      requestContext: () => ({
        // Cookie headers from current request
        cookie: "sessionId=abc123; otherId=xyz",
      }),
    },
  });

  return http;
}

// ============================================================================
// PATTERN 3: Caching Strategies
// ============================================================================

/**
 * Example 3.1: Network-First Caching (Recommended for most APIs)
 */
export function example_3_1_network_first() {
  const http = createClientHttp({
    baseURL: "https://api.example.com",
    cache: {
      enabled: true,
      strategy: "network-first", // Try network first, fallback to cache
      ttl: 5 * 60 * 1000, // 5 minutes
    },
  });

  return http;
}

/**
 * Example 3.2: Cache-First Strategy (For static content)
 */
export function example_3_2_cache_first() {
  const http = createClientHttp({
    baseURL: "https://api.example.com",
    cache: {
      enabled: true,
      strategy: "cache-first", // Use cache if available, otherwise fetch
      ttl: 24 * 60 * 60 * 1000, // 24 hours
    },
  });

  return http;
}

/**
 * Example 3.3: Smart Cache with Pattern-Based Invalidation
 */
export function example_3_3_smart_caching() {
  const http = createClientHttp({
    baseURL: "https://api.example.com",
    cache: {
      enabled: true,
      strategy: "network-first",
      ttl: 5 * 60 * 1000,
      smartCaching: [
        // User list: 5min, invalidate on user mutations
        {
          pattern: /^\/users($|\/)/,
          ttl: 5 * 60 * 1000,
          invalidateOn: ["POST", "PUT", "DELETE"],
          tags: ["users"],
        },
        // User details: 10min, invalidate on update
        {
          pattern: /^\/users\/\d+$/,
          ttl: 10 * 60 * 1000,
          invalidateOn: ["PUT", "PATCH"],
          tags: ["user-detail"],
        },
        // Settings: 24h, invalidate on change
        {
          pattern: /^\/settings/,
          ttl: 24 * 60 * 60 * 1000,
          invalidateOn: ["PATCH"],
          tags: ["settings"],
        },
      ],
    },
  });

  // Usage:
  // await http.get('/users'); // Cached
  // await http.post('/users', { name: 'John' }); // Invalidates /users cache
  // await http.patch('/settings', { theme: 'dark' }); // Invalidates settings cache

  return http;
}

/**
 * Example 3.4: Manual Cache Management
 */
export async function example_3_4_manual_cache() {
  const http = createClientHttp({
    baseURL: "https://api.example.com",
    cache: { enabled: true },
  });

  // Fetch and cache
  const users = await http.get("/users");

  // Invalidate specific pattern
  http.cache.invalidate("/users");

  // Invalidate by tag
  http.cache.invalidateByTag("users");

  // Clear all cache
  http.cache.clear();

  return { users };
}

// ============================================================================
// PATTERN 4: Error Handling
// ============================================================================

/**
 * Example 4.1: Basic Error Handling
 */
export async function example_4_1_basic_errors() {
  const http = createClientHttp({
    baseURL: "https://api.example.com",
  });

  try {
    const data = await http.get("/users/123");
    console.log("Success:", data);
  } catch (error) {
    if (error instanceof HttpError) {
      console.error("HTTP Error:", error.status, error.message);
    } else if (error instanceof TimeoutError) {
      console.error("Request timed out");
    } else if (error instanceof NetworkError) {
      console.error("Network error - check your connection");
    } else {
      console.error("Unknown error:", error);
    }
  }
}

/**
 * Example 4.2: Error Hooks with Rich Context
 */
export function example_4_2_error_hooks() {
  const http = createClientHttp({
    baseURL: "https://api.example.com",
  });

  // Error hook provides detailed context
  http.on("error", (context) => {
    const { error, status, headers, retryCount, timing } = context;

    if (status === 429) {
      // Rate limited
      const retryAfter = headers["retry-after"];
      console.warn(`Rate limited. Retry after ${retryAfter}s`);
    } else if (status === 401) {
      // Unauthorized - might need to refresh token or redirect to login
      console.error("Unauthorized");
    } else if (status === 500) {
      // Server error
      console.error("Server error - will be retried");
    } else {
      console.error(`Request failed: ${error.message}`, {
        status,
        retryCount,
        duration: `${timing.total}ms`,
      });
    }
  });

  return http;
}

/**
 * Example 4.3: Custom Error Formatting
 */
export function example_4_3_custom_error_formatting() {
  const http = createClientHttp({
    baseURL: "https://api.example.com",
  });

  // Response interceptor to normalize errors
  http.interceptors.response.use(
    (response) => response,
    (error) => {
      // Format error consistently
      if (error instanceof HttpError) {
        const formatted = {
          type: "http_error",
          status: error.status,
          message: error.message,
          timestamp: new Date().toISOString(),
          requestId: error.headers?.["x-request-id"],
        };
        console.error(JSON.stringify(formatted));
      }
      throw error;
    }
  );

  return http;
}

// ============================================================================
// PATTERN 5: Interceptors & Lifecycle Hooks
// ============================================================================

/**
 * Example 5.1: Request Interceptors
 */
export function example_5_1_request_interceptors() {
  const http = createClientHttp({
    baseURL: "https://api.example.com",
  });

  // Add custom headers to all requests
  http.interceptors.request.use((config) => ({
    ...config,
    headers: {
      ...config.headers,
      "X-Custom-Header": "value",
      "X-Request-ID": `req-${Date.now()}`,
    },
  }));

  return http;
}

/**
 * Example 5.2: Response Interceptors
 */
export function example_5_2_response_interceptors() {
  const http = createClientHttp({
    baseURL: "https://api.example.com",
  });

  // Transform response data
  http.interceptors.response.use((response) => {
    // Example: Unwrap data from API envelope
    if (response.data?.result) {
      return { ...response, data: response.data.result };
    }
    return response;
  });

  return http;
}

/**
 * Example 5.3: Lifecycle Hooks with Rich Context
 */
export function example_5_3_lifecycle_hooks() {
  const http = createClientHttp({
    baseURL: "https://api.example.com",
  });

  // Request hook
  http.on("request", (context) => {
    const { url, method, headers, body, environment } = context;
    console.log(`→ ${method} ${url}`, {
      headers: Object.keys(headers),
      bodySize: body ? JSON.stringify(body).length : 0,
      environment,
    });
  });

  // Success hook
  http.on("success", (context) => {
    const { url, data, status, timing, cached, deduped } = context;
    console.log(`← ${status} ${url}`, {
      duration: `${timing.total}ms`,
      cached,
      deduped,
      dataSize: JSON.stringify(data).length,
    });
  });

  // Error hook
  http.on("error", (context) => {
    const { url, status, retryCount, timing } = context;
    console.error(`✗ ${status} ${url}`, {
      retries: retryCount,
      duration: `${timing.total}ms`,
    });
  });

  // Finally hook
  http.on("finally", (context) => {
    const { url, timing, requestId } = context;
    console.log(`Completed: ${url}`, { duration: `${timing.total}ms`, requestId });
  });

  return http;
}

// ============================================================================
// PATTERN 6: Advanced Features
// ============================================================================

/**
 * Example 6.1: Request Deduplication
 */
export async function example_6_1_deduplication() {
  const http = createClientHttp({
    baseURL: "https://api.example.com",
    deduplication: {
      enabled: true,
    },
  });

  // These three requests will be deduplicated into one
  const [users1, users2, users3] = await Promise.all([
    http.get("/users"),
    http.get("/users"),
    http.get("/users"),
  ]);

  // Only one actual HTTP request is made
  console.assert(users1 === users2 && users2 === users3);

  return { users1 };
}

/**
 * Example 6.2: Circuit Breaker Pattern
 */
export function example_6_2_circuit_breaker() {
  const http = createClientHttp({
    baseURL: "https://api.example.com",
    circuitBreaker: {
      enabled: true,
      failureThreshold: 5, // Open after 5 failures
      successThreshold: 2, // Close after 2 successes
      timeout: 60_000, // Try half-open after 60s
    },
  });

  return http;
}

/**
 * Example 6.3: Request Polling
 */
export async function example_6_3_polling() {
  const http = createClientHttp({
    baseURL: "https://api.example.com",
  });

  // Poll for status updates
  const result = http.poll("/status", {
    interval: 2000, // Poll every 2 seconds
    maxAttempts: 10, // Try up to 10 times
    validator: (data) => data.status === "complete", // Stop when complete
  });

  try {
    const finalData = await result;
    console.log("Polling completed:", finalData);
  } catch (error) {
    console.error("Polling failed or timed out");
  }

  return result;
}

/**
 * Example 6.4: Request History for Debugging
 */
export function example_6_4_request_history() {
  const http = createClientHttp({
    baseURL: "https://api.example.com",
    observability: {
      enableRequestHistory: true,
      requestHistoryMaxSize: 100, // Keep last 100 requests
    },
  });

  // Later, access history for debugging
  const history = http.getRequestHistory();

  history.forEach(({ url, method, status, duration, timestamp, error }) => {
    console.log(
      `[${timestamp}] ${method} ${url} → ${status} (${duration}ms)${error ? ` - ${error.message}` : ""}`
    );
  });

  // Find failed requests
  const failed = history.filter((r) => r.error);
  console.log("Failed requests:", failed);

  return http;
}

// ============================================================================
// PATTERN 7: Real-Time Updates with Socket.io
// ============================================================================

/**
 * Example 7.1: Basic Real-Time Client
 */
export async function example_7_1_realtime_basic() {
  const { createRealtimeClient } = await import("rhttp.io");

  const realtime = createRealtimeClient({
    url: "https://api.example.com",
    auth: {
      token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    },
  });

  // Listen for events
  realtime.on("user:update", (data) => {
    console.log("User updated:", data);
  });

  // Emit events
  realtime.emit("user:create", { name: "John" });

  // Join room for collaboration
  realtime.joinRoom("project-123");

  realtime.on("room:message", (data) => {
    console.log("Room message:", data);
  });

  return realtime;
}

// ============================================================================
// PATTERN 8: React Integration
// ============================================================================

/**
 * Example 8.1: React Hook Usage
 */
export function example_8_1_react_hooks() {
  // In a React component:
  // import { useQuery, useHttp } from "rhttp.io/react";

  // const http = useHttp();
  // const { data, isLoading, error } = useQuery(
  //   ["users"],
  //   () => http.get("/users"),
  //   { staleTime: 5 * 60 * 1000 }
  // );

  // Example function to show pattern:
  return {
    data: null,
    isLoading: false,
    error: null,
  };
}

// ============================================================================
// PATTERN 9: Batch Operations
// ============================================================================

/**
 * Example 9.1: Batch Multiple Requests
 */
export async function example_9_1_batch_requests() {
  const http = createClientHttp({
    baseURL: "https://api.example.com",
  });

  // Execute multiple requests in parallel
  const [users, posts, comments] = await Promise.all([
    http.get("/users"),
    http.get("/posts"),
    http.get("/comments"),
  ]);

  return { users, posts, comments };
}

/**
 * Example 9.2: Sequential Requests with Dependency
 */
export async function example_9_2_sequential_requests() {
  const http = createClientHttp({
    baseURL: "https://api.example.com",
  });

  // First request
  const user = await http.get("/users/123");

  // Second request depends on first
  const userPosts = await http.get(`/users/${user.id}/posts`);

  // Third request depends on second
  const firstPostComments = await http.get(`/posts/${userPosts[0].id}/comments`);

  return { user, userPosts, firstPostComments };
}

// ============================================================================
// PATTERN 10: Production Best Practices
// ============================================================================

/**
 * Example 10.1: Production-Ready Configuration
 */
export function example_10_1_production_config() {
  const http = createClientHttp({
    baseURL: process.env.REACT_APP_API_URL || "https://api.example.com",
    timeout: 30_000,
    defaultHeaders: {
      "X-App-Version": "1.0.0",
      "X-Environment": process.env.NODE_ENV,
    },
    auth: {
      scheme: "Bearer",
      getToken: async () => {
        // Secure token retrieval
        return localStorage.getItem("auth_token") || undefined;
      },
    },
    cache: {
      enabled: true,
      strategy: "network-first",
      ttl: 5 * 60 * 1000,
      smartCaching: [
        {
          pattern: /^\/api\/.*$/,
          invalidateOn: ["POST", "PUT", "DELETE"],
          tags: ["api"],
        },
      ],
    },
    retry: {
      attempts: 3,
      strategy: "exponential",
      initialDelay: 1000,
      maxDelay: 60_000,
    },
    circuitBreaker: {
      enabled: true,
      failureThreshold: 5,
      timeout: 60_000,
    },
    observability: {
      enableLogging: true,
      enableMetrics: true,
      enableTracing: true,
      enableRequestHistory: true,
      requestHistoryMaxSize: 100,
    },
  });

  // Add error tracking
  http.on("error", (context) => {
    const { error, url, status, retryCount } = context;
    console.error("Request failed", {
      error: error.message,
      url,
      status,
      retries: retryCount,
    });

    // In production: Send to error tracking service
    // trackError(error);
  });

  return http;
}

/**
 * Example 10.2: Environment-Specific Setup
 */
export function example_10_2_environment_setup() {
  const isDevelopment = process.env.NODE_ENV === "development";
  const isProduction = process.env.NODE_ENV === "production";

  const http = createClientHttp({
    baseURL: isProduction
      ? "https://api.example.com"
      : "http://localhost:3000",
    timeout: isProduction ? 30_000 : 60_000, // Longer timeout in dev
    retry: {
      attempts: isProduction ? 3 : 1, // More retries in production
      strategy: "exponential",
    },
    observability: {
      enableLogging: isDevelopment, // Only log in development
      enableMetrics: isProduction, // Only metrics in production
      enableRequestHistory: true, // Always keep history
    },
  });

  return http;
}

// ============================================================================
// PATTERN 11: TypeScript Types
// ============================================================================

/**
 * Example 11.1: Typed Responses
 */
export async function example_11_1_typed_responses() {
  interface User {
    id: number;
    name: string;
    email: string;
  }

  interface UserResponse {
    data: User[];
    total: number;
  }

  const http = createClientHttp({
    baseURL: "https://api.example.com",
  });

  // Fully typed response
  const response = await http.get<UserResponse>("/users");

  // TypeScript knows the type
  const user = response.data[0];
  console.log(user.name); // ✓ Type-safe
  // console.log(user.invalid); // ✗ Type error

  return response;
}

/**
 * Example 11.2: Typed Requests
 */
export async function example_11_2_typed_requests() {
  interface CreateUserRequest {
    name: string;
    email: string;
  }

  interface CreateUserResponse {
    id: number;
    name: string;
    email: string;
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
// Export all examples
// ============================================================================

export const patterns = {
  "1.1": example_1_1_basic_browser_setup,
  "1.2": example_1_2_full_browser_setup,
  "1.3": example_1_3_server_setup,
  "2.1": example_2_1_static_token,
  "2.2": example_2_2_dynamic_token,
  "2.3": example_2_3_token_refresh,
  "2.4": example_2_4_cookie_auth,
  "2.5": example_2_5_httponly_cookies,
  "3.1": example_3_1_network_first,
  "3.2": example_3_2_cache_first,
  "3.3": example_3_3_smart_caching,
  "3.4": example_3_4_manual_cache,
  "4.1": example_4_1_basic_errors,
  "4.2": example_4_2_error_hooks,
  "4.3": example_4_3_custom_error_formatting,
  "5.1": example_5_1_request_interceptors,
  "5.2": example_5_2_response_interceptors,
  "5.3": example_5_3_lifecycle_hooks,
  "6.1": example_6_1_deduplication,
  "6.2": example_6_2_circuit_breaker,
  "6.3": example_6_3_polling,
  "6.4": example_6_4_request_history,
  "7.1": example_7_1_realtime_basic,
  "8.1": example_8_1_react_hooks,
  "9.1": example_9_1_batch_requests,
  "9.2": example_9_2_sequential_requests,
  "10.1": example_10_1_production_config,
  "10.2": example_10_2_environment_setup,
  "11.1": example_11_1_typed_responses,
  "11.2": example_11_2_typed_requests,
};
 * QUICK START PATTERNS - rhttp.io v3.0
 * Copy-paste ready examples for common use cases
 */

// ═══════════════════════════════════════════════════════════════════════════
// PATTERN 1: Basic SPA Setup
// ═══════════════════════════════════════════════════════════════════════════

import { createClientHttp } from "rhttp.io/client";
import { createObservabilityMiddleware } from "rhttp.io";

export const createApiClient = () => {
  // Create HTTP client with smart defaults
  const http = createClientHttp({
    baseURL: import.meta.env.VITE_API_URL,
    timeout: 15_000,
  });

  // Add observability in development
  if (import.meta.env.DEV) {
    const obs = createObservabilityMiddleware({
      enableLogging: true,
      enableMetrics: true,
    });
    http.use(obs);
  }

  return http;
};

export const http = createApiClient();

// ═══════════════════════════════════════════════════════════════════════════
// PATTERN 2: Login Flow with Secure Token Storage
// ═══════════════════════════════════════════════════════════════════════════

export async function login(email: string, password: string) {
  try {
    const response = await http.post("/auth/login", {
      email,
      password,
    });

    // ✅ Token stored securely (Hybrid by default)
    await http.setToken(response.data.token);

    return response.data;
  } catch (error) {
    if (error.status === 401) {
      throw new Error("Invalid credentials");
    }
    throw error;
  }
}

export async function logout() {
  try {
    await http.post("/auth/logout");
  } finally {
    // ✅ Clear token securely
    await http.clearToken();
  }
}

export async function isLoggedIn() {
  return await http.hasToken();
}

// ═══════════════════════════════════════════════════════════════════════════
// PATTERN 3: Polling with Proper Handling
// ═══════════════════════════════════════════════════════════════════════════

export async function pollJobStatus(jobId: string) {
  try {
    // ✅ Poll executes immediately, returns actual result
    const response = await http.poll(`/jobs/${jobId}`, {
      polling: {
        interval: 2_000, // Poll every 2 seconds
        maxAttempts: 30, // Max 30 attempts = 1 minute total
        stopCondition: (res) => {
          // Stop when job is completed or failed
          const status = res.data?.status;
          return status === "completed" || status === "failed";
        },
      },
    });

    console.log("Final job status:", response.data.status);
    return response.data;
  } catch (error) {
    console.error("Polling failed:", error);
    throw error;
  }
}

// Usage:
// const job = await pollJobStatus("job-123");
// console.log(job.result); // Job is completed

// ═══════════════════════════════════════════════════════════════════════════
// PATTERN 4: SSR with TanStack Start
// ═══════════════════════════════════════════════════════════════════════════

import { createServerHttp } from "rhttp.io/server";
import { getRequest } from "@tanstack/react-start/server";
import { createServerFn } from "@tanstack/react-start/server";

// Create once at startup
const serverHttp = createServerHttp({
  baseURL: process.env.INTERNAL_API_URL || "http://localhost:3000",
  timeout: 30_000,
  requestContext: () => getRequest(), // Auto-forwards cookies
});

// Server function that uses it
export const getUserProfile = createServerFn({
  method: "GET",
}).handler(async () => {
  try {
    // ✅ Cookies from client request are automatically forwarded
    const response = await serverHttp.get("/user/profile");
    return response.data;
  } catch (error) {
    throw new Error("Failed to fetch profile");
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PATTERN 5: Observability & Monitoring
// ═══════════════════════════════════════════════════════════════════════════

export const setupObservability = (http: any) => {
  const obs = createObservabilityMiddleware({
    enableLogging: true,
    enableTracing: true,
    enableMetrics: true,
    maxTracesStored: 100,

    // Send to your monitoring service
    onTrace: async (trace) => {
      if (import.meta.env.PROD) {
        // Send to Datadog, Sentry, etc.
        await sendToMonitoring({
          type: "request",
          traceId: trace.traceId,
          url: trace.url,
          duration: trace.duration,
          status: trace.status,
          error: trace.error?.message,
        });
      }
    },

    onLog: async (entry) => {
      if (entry.level === "error" && import.meta.env.PROD) {
        await sendToMonitoring({
          type: "error",
          level: entry.level,
          message: entry.message,
          context: entry.context,
        });
      }
    },
  });

  http.use(obs);

  // Export metrics getter
  return {
    getMetrics: () => obs.getMetrics(),
    getTraces: (filter?: any) => obs.getTraces(filter),
    getLogs: (filter?: any) => obs.getLogs(filter),
  };
};

// Usage in component:
// const { getMetrics } = setupObservability(http);
// setInterval(() => {
//   const metrics = getMetrics();
//   console.log(`Avg duration: ${metrics.avgDuration}ms, P95: ${metrics.p95Duration}ms`);
// }, 10_000);

// ═══════════════════════════════════════════════════════════════════════════
// PATTERN 6: Compression for Large Payloads
// ═══════════════════════════════════════════════════════════════════════════

import { createCompressionMiddleware } from "rhttp.io";

export const setupCompression = (http: any) => {
  http.use(
    createCompressionMiddleware({
      enabled: true,
      algorithms: ["gzip", "deflate"],
      minSize: 512, // Compress if > 512 bytes
      level: 6, // Compression level 1-9
    }),
  );
};

// Usage:
// const http = createClientHttp();
// setupCompression(http);

// ═══════════════════════════════════════════════════════════════════════════
// PATTERN 7: HTTP/2 Server Push
// ═══════════════════════════════════════════════════════════════════════════

import { createHttp2PushMiddleware } from "rhttp.io";

export const setupHttp2Push = (http: any) => {
  const pushMiddleware = createHttp2PushMiddleware({
    enabled: true,
    maxPushes: 5,
    cacheManifest: {
      // When /api/user is requested, also push these
      "/api/user": ["/api/user/settings", "/api/user/preferences"],

      // When /api/dashboard is requested, push these
      "/api/dashboard": ["/api/dashboard/stats", "/api/dashboard/charts"],
    },
  });

  http.use(pushMiddleware);

  // Add dynamically
  pushMiddleware.addPushManifest("/api/products", [
    "/api/products/categories",
    "/api/products/filters",
  ]);

  return pushMiddleware;
};

// ═══════════════════════════════════════════════════════════════════════════
// PATTERN 8: Service Worker for Offline Support
// ═══════════════════════════════════════════════════════════════════════════

import { createServiceWorkerMiddleware } from "rhttp.io";

export const setupServiceWorker = async (http: any) => {
  const swMiddleware = createServiceWorkerMiddleware({
    enabled: "serviceWorker" in navigator,
    workerPath: "/sw.js",
    cacheStrategy: "stale-while-revalidate",
    cacheName: "api-cache-v1",
    maxCacheSize: 100,
  });

  // Register service worker
  try {
    await swMiddleware.register();
    console.log("Service Worker registered");
  } catch (error) {
    console.warn("Service Worker registration failed:", error);
  }

  http.use(swMiddleware);

  // Check offline status
  window.addEventListener("offline", () => {
    console.log("App is offline - using cached responses");
  });

  return swMiddleware;
};

// ═══════════════════════════════════════════════════════════════════════════
// PATTERN 9: Error Handling with Custom Errors
// ═══════════════════════════════════════════════════════════════════════════

import { HttpError, TimeoutError, NetworkError } from "rhttp.io";

export async function fetchDataWithErrorHandling(url: string) {
  try {
    const response = await http.get(url);
    return response.data;
  } catch (error) {
    if (error instanceof TimeoutError) {
      console.error("Request timed out after 30 seconds");
      // Show timeout UI
      throw new Error("Request took too long, please try again");
    } else if (error instanceof NetworkError) {
      console.error("Network error:", error.originalError);
      // Handle offline
      throw new Error("Network connection failed");
    } else if (error instanceof HttpError) {
      if (error.status === 401) {
        // Handle unauthorized
        await logout();
        throw new Error("Session expired, please login again");
      } else if (error.status === 404) {
        throw new Error("Resource not found");
      } else if (error.status >= 500) {
        throw new Error("Server error, please try again later");
      }
      throw error;
    }
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PATTERN 10: Complete Setup for Production
// ═══════════════════════════════════════════════════════════════════════════

export async function setupHttpClient() {
  // 1. Create base client
  const http = createClientHttp({
    baseURL: import.meta.env.VITE_API_URL,
    timeout: 30_000,
    tokenStorage: "hybrid", // Secure storage
    retry: { attempts: 2, strategy: "exponential" },
    cache: {
      enabled: true,
      ttl: 5 * 60_000, // 5 minutes
      strategy: "stale-while-revalidate",
    },
  });

  // 2. Add observability
  if (import.meta.env.DEV) {
    setupObservability(http);
  }

  // 3. Add compression
  if (import.meta.env.PROD) {
    setupCompression(http);
  }

  // 4. Add HTTP/2 push
  setupHttp2Push(http);

  // 5. Add Service Worker
  if ("serviceWorker" in navigator) {
    await setupServiceWorker(http);
  }

  // 6. Setup request interceptors
  http.interceptors.request.use((options) => {
    // Add request ID for tracing
    options.headers = options.headers || {};
    options.headers["X-Request-ID"] = generateUUID();
    return options;
  });

  // 7. Setup response interceptors
  http.interceptors.response.use(
    (response) => {
      // Success handling
      return response;
    },
    (error) => {
      // Error handling
      console.error("Request failed:", error);
      throw error;
    },
  );

  return http;
}

// Usage in main app:
// const http = await setupHttpClient();
// window.http = http; // Make available globally for debugging

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function sendToMonitoring(data: any) {
  try {
    await fetch("https://monitoring.example.com/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch {
    // Ignore monitoring errors
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPESCRIPT TYPES (Optional)
// ═══════════════════════════════════════════════════════════════════════════

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Job {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  result?: any;
  error?: string;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Record<string, string>;
}
