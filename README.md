<div align="center">

<div align="center">
  <img src="./public/assets/rhttp-cover.png" alt="rhttp.io cover" width="100%" />
  <br /><br />
  <!-- <img src="./public/assets/rhttp-logo.png" alt="rhttp.io logo" width="220" /> -->
</div>

  # rhttp.io

  ### The HTTP Client for Modern Applications

  Type-safe • Secure • High Performance • Full-stack Ready  
  Universal HTTP client. Caching, retries, circuit breaker, JWT, CSRF, Socket.io.  
  Isomorphic for browsers, Node.js, Edge.  
  From Browser to Server, from REST to Realtime.

  <br />

  [![npm version](https://img.shields.io/npm/v/rhttp.io?color=blue&style=flat-square)](https://www.npmjs.com/package/rhttp.io)
  [![license](https://img.shields.io/npm/l/rhttp.io?style=flat-square)](LICENSE)
  [![typescript](https://img.shields.io/badge/TypeScript-Ready-blue?style=flat-square)](https://www.typescriptlang.org/)
  [![node](https://img.shields.io/badge/Node-%3E%3D18-green?style=flat-square)](https://nodejs.org/)

</div>

## ✨ Features

- **🌍 Fully Isomorphic** — Works in browsers, Node.js, and Edge Runtimes (Vercel, Cloudflare)
- **🔒 Security** — Built-in CSRF protection, JWT/OAuth support, automatic token refresh, secure cookie handling
- **⚡ Performance** — Intelligent caching (5 strategies), automatic request deduplication, smart retry logic
- **🎯 Type-Safe** — Complete TypeScript support with full type inference
- **🔄 Retry & Timeout** — Exponential backoff, configurable status codes, request timeouts
- **📊 Observability** — Built-in logging, request tracing, and metrics collection
- **🪝 Interceptors** — Request and response interceptors for cross-cutting concerns
- **✅ Validation** — Request validation, response schema validation, and data transformers
- **⚙️ SSR-Ready** — Cookie forwarding, request context binding for TanStack Start/Next.js
- **📦 React Integration** — Seamless TanStack Query builders
- **🔌 Realtime** — Socket.io client with logging, event validation/transformation, lifecycle hooks, offline queue

---

## Table of Contents

1. [Installation](#installation)
2. [Quick Start](#quick-start)
3. [Core Concepts](#core-concepts)
4. [API Reference](#api-reference)
5. [Advanced Features](#advanced-features)
6. [Error Handling](#error-handling)
7. [Interceptors](#interceptors)
8. [Caching Strategies](#caching-strategies)
9. [Authentication](#authentication)
10. [CSRF Protection](#csrf-protection)
11. [Retry Logic](#retry-logic)
12. [Rate Limiting](#rate-limiting)
13. [Request Profiling](#request-profiling)
14. [React Integration](#react-integration)
15. [Socket.io Realtime](#socketio-realtime)
16. [Examples](#examples)
17. [Troubleshooting](#troubleshooting)

---

## Installation

```bash
npm install rhttp.io
# or
bun add rhttp.io
# or
yarn add rhttp.io
```

### Entry Points

```typescript
// Core isomorphic client (universal, browsers + Node.js + Edge)
import { createHttp } from "rhttp.io";

// Browser-optimized client (CSRF prefetch,etc)
import { createClientHttp } from "rhttp.io/client";

// Server-optimized client (cookie forwarding, structured logging)
import { createServerHttp } from "rhttp.io/server";

// React + TanStack Query integration
import { withReact } from "rhttp.io/react";

// Realtime Socket.io client
import { createRealtimeClient } from "rhttp.io/socket.io.client";

// Error classes
import { HttpError, TimeoutError, NetworkError } from "rhttp.io";
```

---

## 🚀 Quick Start

### Basic Usage

```typescript
import { createHttp } from "rhttp.io";

const http = createHttp({
  baseURL: "https://api.example.com",
  timeout: 30_000,
});
// GET request
const { data: posts } = await http.get<Post[]>("/posts");
console.log(posts);
```

### POST with Validation

```typescript
interface CreatePostInput {
  title: string;
  content: string;
}

interface CreatePostResponse {
  id: string;
  createdAt: string;
}
// POST request
const { data: newPost } = await http.post<CreatePostInput, CreatePostResponse>(
  "/posts",
  { title: "Hello", content: "World" },
);
```

### Error Handling

```typescript
// Error handling
try {
  await http.get("/not-found");
} catch (error) {
  if (error instanceof HttpError) {
    console.error(`HTTP ${error.status}: ${error.statusText}`);
    console.error("Response data:", error.data);
  } else if (error instanceof TimeoutError) {
    console.error("Request timeout");
  } else if (error instanceof NetworkError) {
    console.error("Network error:", error.message);
  }
}
```

---

## Core Concepts

### HttpResponse

Every successful request returns an `HttpResponse` object:

```typescript
interface HttpResponse<T> {
  data: T; // Parsed response body
  status: number; // HTTP status code
  statusText: string; // HTTP status text (e.g., "OK")
  headers: Record<string, string>; // Response headers
  response: Response; // Native fetch Response object
  requestId: string; // Unique request identifier
  durationMs: number; // Request duration in milliseconds
}
```

### Creating an HTTP Client `createHttp(config)`

Factory function that creates an HTTP client instance.

```typescript
const http = createHttp({
  // Base URL for all requests
  baseURL: "https://api.example.com",
  // Global timeout (milliseconds)
  timeout: 30_000,
  // Default headers for all requests
  defaultHeaders: {
    Accept: "application/json",
    "User-Agent": "MyApp/1.0",
  },

  // Cache configuration
  cache: {
    enabled: true,
    ttl: 60_000, // 1 minute TTL
    keyBuilder: (url, opts) => `${url}:${JSON.stringify(opts.params)}`,
  },

  // Retry configuration
  retry: {
    attempts: 3, // Number of retry attempts
    strategy: "exponential", // "exponential" | "linear" | "none"
    delay: 300, // Initial delay (ms)
    maxDelay: 30_000, // Maximum delay between retries
    statusCodes: [408, 429, 500, 502, 503, 504], // Retryable status codes
    shouldRetry: async (error, attempt) => attempt <= 3,
  },

  // Authentication
  auth: {
    forwardCookies: false, // For SSR
    accessToken: "your-jwt-token", // Static token
    scheme: "Bearer", // Auth scheme
    getToken: async () => "dynamic-token", // Dynamic token
  },

  // CSRF protection (browser)
  csrf: {
    enabled: true,
    fetchEndpoint: "/api/csrf",
    cookieName: "csrf-token",
    headerName: "X-CSRF-Token",
    methods: ["POST", "PUT", "PATCH", "DELETE"],
    prefetch: true, // Prefetch token on init
  },

  // Observability
  observability: {
    logger: true, // true | false | custom logger
    tracing: true, // Add X-Request-ID header
    metrics: true, // Collect metrics
  },

  // Circuit breaker
  circuitBreaker: {
    enabled: true,
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 60_000,
  },

  // Request pooling
  requestPool: {
    enabled: true,
    maxConcurrent: 5,
  },
  // SSR context (TanStack Start)
  requestContext: () => getRequest(),
});
```

---

## API Reference

### HTTP Methods

#### GET

```typescript
const response = await http.get<T>(
  url: string,
  options?: HttpRequestOptions
): Promise<HttpResponse<T>>
```

#### POST

```typescript
const response = await http.post<T>(
  url: string,
  body?: any,
  options?: HttpRequestOptions
): Promise<HttpResponse<T>>

// With typed body and response
const response = await http.post<RequestBody, ResponseType>(
  url: string,
  body: RequestBody,
  options?: HttpRequestOptions
): Promise<HttpResponse<ResponseType>>
```

#### PUT

```typescript
const response = await http.put<T>(
  url: string,
  body?: any,
  options?: HttpRequestOptions
): Promise<HttpResponse<T>>
```

#### PATCH

```typescript
const response = await http.patch<T>(
  url: string,
  body?: any,
  options?: HttpRequestOptions
): Promise<HttpResponse<T>>
```

#### DELETE

```typescript
// Without body
const response = await http.delete<T>(
  url: string,
  options?: HttpRequestOptions
): Promise<HttpResponse<T>>

// With body
const response = await http.delete<ResponseType>(
  url: string,
  body: any,
  options?: HttpRequestOptions
): Promise<HttpResponse<ResponseType>>
```

#### CUSTOMFETCH `customFetch(url, options?)`

For highly customized requests:

```typescript
const response = await http.customFetch<T>(
  url: string,
  body?: any,
  options?: HttpRequestOptions
): Promise<HttpResponse<T>>
```

### Common Options

```typescript
interface HttpRequestOptions {
  // Query parameters
  params?: Record<string, any>;

  // Request headers
  headers?: Record<string, string>;

  // Cache override
  cache?:
    | boolean
    | {
        enabled: boolean;
        ttl: number;
      };

  // Retry override
  retry?:
    | boolean
    | {
        attempts: number;
        strategy: "none" | "linear" | "exponential";
        delay: number;
        maxDelay: number;
        statusCodes: number[];
      };

  // Timeout override (ms)
  timeout?: number;

  // Prevent concurrent duplicate requests
  deduplicate?: boolean;

  // Disable CSRF for this request
  csrf?: boolean;

  // Custom request ID for tracing
  requestId?: string;

  // Transform response data
  transformer?: (data: any, response: HttpResponse<any>) => any;

  // Validate response before returning
  validateResponse?: (data: any) => boolean;

    // Polling configuration
  polling?: Partial<PollingConfig>;
}
```

---

## Advanced Features

### Cache Management

```typescript
const http = createHttp({
  cache: {
    enabled: true,
    ttl: 60_000,
  },
});

// Get from cache (if fresh)
const response = await http.get("/items");

// Skip cache for this request
const freshData = await http.get("/items", { cache: false });

// Invalidate cache for URLs matching pattern
http.invalidateCache("/items"); // Clears /items, /items/123, etc.

// Clear all cached entries
http.clearCache();
```

### Cache Strategies

```typescript
// 1. cache-first: Use cache if available, fallback to network
const response = await http.get("/items", {
  cache: { strategy: "cache-first" },
});

// 2. network-first: Fetch from network, fallback to cache if error
const response = await http.get("/items", {
  cache: { strategy: "network-first" },
});

// 3. stale-while-revalidate: Return stale cache, update in background
const response = await http.get("/items", {
  cache: { strategy: "stale-while-revalidate" },
});

// 4. cache-only: Return cache or error, never fetch
const response = await http.get("/items", {
  cache: { strategy: "cache-only" },
});

// 5. network-only: Never use cache
const response = await http.get("/items", {
  cache: { strategy: "network-only" },
});
```

### Request Deduplication

```typescript
// Prevent concurrent duplicate requests
const [r1, r2, r3] = await Promise.all([
  http.get("/items", { deduplicate: true }),
  http.get("/items", { deduplicate: true }),
  http.get("/items", { deduplicate: true }),
]);
// Only 1 request made, 3 responses received
```

### Batch Requests

```typescript
const [posts, users, comments] = await http.batchRequests([
  () => http.get<Post[]>("/posts"),
  () => http.get<User[]>("/users"),
  () => http.get<Comment[]>("/comments"),
]);
```

### Request Cancellation

```typescript
// Get response with requestId
const response = await http.get("/items");
const { requestId } = response;

// Cancel specific request
http.cancel(requestId);

// Cancel all active requests
http.cancel();
```

### Polling

```typescript
const response = await http.poll("/status", {
  polling: {
    interval: 5000, // Poll every 5 seconds
    maxAttempts: 60, // Maximum 60 polls
    stopCondition: (result) => result.data.status === "complete",
  },
});
```

### Request History

```typescript
const history = http.getHistory();
// Returns: Array of { requestId, url, method, status, durationMs, timestamp }

history.forEach((entry) => {
  console.log(
    `${entry.method} ${entry.url} - ${entry.status} (${entry.durationMs}ms)`,
  );
});
```

### Metrics Collection

```typescript
const http = createHttp({
  observability: {
    metrics: true,
  },
});

// ... make requests ...

const metrics = http.getMetrics();
console.log(`Total: ${metrics.totalRequests}`);
console.log(`Success: ${metrics.successfulRequests}`);
console.log(`Failed: ${metrics.failedRequests}`);
console.log(
  `Avg duration: ${metrics.durations.reduce((a, b) => a + b) / metrics.durations.length}ms`,
);
```

---

## Error Handling

### HttpError

The main error class for HTTP errors:

```typescript
import { HttpError } from "rhttp.io";
try {
  await http.get("/endpoint");
} catch (error) {
  if (error instanceof HttpError) {
    console.log(error.status); // 404
    console.log(error.statusText); // "Not Found"
    console.log(error.data); // Error response body
    console.log(error.headers); // Response headers
    console.log(error.requestId); // Unique request ID
    console.log(error.durationMs); // Request duration
    console.log(error.url); // Request URL
  }
}
```

### TimeoutError

Thrown when request exceeds timeout:

```typescript
import { TimeoutError } from "rhttp.io";
try {
  await http.get("/slow", { timeout: 5000 });
} catch (error) {
  if (error instanceof TimeoutError) {
    console.log(`Timeout after ${error.durationMs}ms`);
  }
}
```

### NetworkError

Thrown for network connectivity issues:

```typescript
import { NetworkError } from "rhttp.io";
try {
  await http.get("/endpoint");
} catch (error) {
  if (error instanceof NetworkError) {
    console.log(error.originalError); // Underlying error
    console.log(error.message);
  }
}
```

### Custom Error Handler

```typescript
http.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Transform error
    if (error instanceof HttpError && error.status === 401) {
      // Handle unauthorized
      console.log("Session expired, redirecting to login");
    }
    throw error;
  },
);
```

---

## Interceptors

### Request Interceptor

```typescript
http.interceptors.request.use(
  async (config) => {
    console.log("Before request:", config.url);
    config.headers = {
      ...config.headers,
      "x-request-id": generateId(),
    };
    return config;
  },
  async (error) => {
    console.error("Request error:", error);
    throw error;
  },
);
```

### Response Interceptor

```typescript
http.interceptors.response.use(
  async (response) => {
    // Success path
    console.log("After response:", response.status);
    analytics.track("api_call_success", {
      url: response.response.url,
      status: response.status,
      duration: response.durationMs,
    });
    // Transform response
    if (response.data?.meta) {
      response.data = response.data.data; // Unwrap
    }
    return response;
  },
  async (error) => {
    // Error path
    console.error("Response error:", error);
    if (error instanceof HttpError && error.status === 401) {
      // Handle unauthorized
      window.location.href = "/login";
    }
    // Handle specific errors
    throw error;
  },
);
```

### Ejecting Interceptors

```typescript
const handler = http.interceptors.request.use((config) => {
  return config;
});

// Later, remove it
handler.eject();

// Clear all interceptors
http.interceptors.request.clear();
```

### Multiple Interceptors

```typescript
// Add multiple interceptors - they execute in order
http.interceptors.request.use(async (config) => {
  config.headers = { ...config.headers, "x-auth": "token" };
  return config;
});

http.interceptors.request.use(async (config) => {
  config.headers = { ...config.headers, "x-app": "myapp" };
  return config;
});

// Both interceptors will execute
```

---

## Caching Strategies

### In-Depth Cache Configuration

```typescript
const http = createHttp({
  cache: {
    enabled: true,
    ttl: 60_000, // 1 minute
    keyBuilder: (url, options) => {
      // Custom cache key generation
      return `${url}:${JSON.stringify(options.params)}`;
    },
  },
});

// Override per-request
await http.get("/items", {
  cache: {
    enabled: true,
    ttl: 120_000, // 2 minutes
    keyBuilder: (url, options) => `custom-${url}`,
  },
});
```

### Cache Invalidation

```typescript
// Invalidate specific pattern
http.invalidateCache("/api/items");

// Clear all cache
http.clearCache();

// Custom invalidation in interceptor
http.interceptors.response.use(async (response) => {
  if (response.status === 201 || response.status === 204) {
    // Invalidate list after create/delete
    http.invalidateCache("/api/items");
  }
  return response;
});
```

---

## Authentication

### Static Token

```typescript
const http = createHttp({
  auth: {
    accessToken: process.env.SERVICE_TOKEN,
    scheme: "Bearer", // or "Basic", "ApiKey"
    forwardCookies: false,
  },
});

// Token is automatically injected
await http.get("/protected"); // Authorization: Bearer SERVICE_TOKEN
```

### Dynamic Token

```typescript
const http = createHttp({
  auth: {
    getToken: async () => {
      const token = await localStorage.getItem("auth_token");
      return token;
    },
    scheme: "Bearer",
    forwardCookies: false,
  },
});
```

### Token Refresh Automatic JWT Refresh Interceptor

Automatically refresh expired tokens on `401` responses and retry all queued requests:

```typescript
import { createHttp, createRefreshAuthInterceptor } from "rhttp.io";

const http = createHttp({
  baseURL: "https://api.example.com",
  auth: { accessToken: localStorage.getItem("access_token") || "" },
});

// Create refresh interceptor
const refreshInterceptor = createRefreshAuthInterceptor(http, {
  // Called when a 401 is received
  refreshToken: async () => {
    const response = await fetch("/auth/refresh", { method: "POST" });
    const data = await response.json();
    return data.accessToken; // Return the new token
  },
  onTokenRefreshed: async (newToken) => {
    // Update token in your store/context
    await localStorage.setItem("auth_token", newToken);
  },
  // Optional: status codes that trigger refresh (default: [401])
  statusCodes: [401], // Refresh on 401
});

// Add to interceptors
http.interceptors.response.use((response) => response, refreshInterceptor);

// If two concurrent requests both get 401:
// - Only ONE refresh call is made
// - Both requests are retried with the new token
const [profile, orders] = await Promise.all([
  http.get("/profile"),
  http.get("/orders"),
]);
```

### Dynamic JWT with `getToken`

```typescript
const apiClient = createHttp({
  baseURL: "https://api.example.com",
  auth: {
    scheme: "Bearer",
    getToken: async () => {
      let token = localStorage.getItem("access_token");
      const expiresIn = parseInt(
        localStorage.getItem("access_token_expires_at") || "0",
        10,
      );

      if (Date.now() > expiresIn - 60_000) {
        const refreshToken = localStorage.getItem("refresh_token");
        const response = await fetch("/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        const data = await response.json();
        localStorage.setItem("access_token", data.accessToken);
        token = data.accessToken;
      }

      return token;
    },
  },
});
```

### Cookie Forwarding (SSR) Cookie-Based Sessions (SSR)

#### With Explicit Context
```typescript
import { createServerHttp } from "rhttp.io/server";
import { getRequest } from "@tanstack/react-start/server";

const http = createServerHttp({
  baseURL: process.env.API_URL,
  auth: {
    forwardCookies: true, // Forward incoming request cookies
  },
  requestContext: () => getRequest(), /// Enabled by default on Tanstack start 
});

// In TanStack Start
export const fetchProtectedData = createServerFn({ method: "GET" }).handler(
  async () => {
    // Cookies from request are automatically forwarded
    return http.get("/protected-data");
  },
);
```

---

## CSRF Protection

### Browser Client with CSRF

```typescript
const http = createClientHttp({
  baseURL: "https://api.example.com",
  csrf: {
    enabled: true,
    fetchEndpoint: "/api/csrf",
    cookieName: "csrf-token",
    headerName: "X-CSRF-Token",
    methods: ["POST", "PUT", "PATCH", "DELETE"],
    prefetch: true, // Fetch token on load
  },
});

// Token is automatically injected on mutations
await http.post("/items", { name: "test" }); // CSRF token auto-injected
```

### Manual CSRF Token

```typescript
const http = createHttp({
  csrf: {
    enabled: true,
    fetchEndpoint: "/api/csrf",
  },
});

// Override for specific request
await http.post("/items", { name: "test" }, { csrf: false });
```

---

## Retry Logic

### Automatic Retry

```typescript
const http = createHttp({
  retry: {
    attempts: 3, // Retry up to 3 times
    strategy: "exponential", // exponential | linear | none
    delay: 300, // Initial delay (ms)
    maxDelay: 30_000, // Max delay between retries (ms)
    statusCodes: [408, 429, 500, 502, 503, 504], // Retryable status codes
  },
});

// Override per-request
await http.get("/items", {
  retry: {
    attempts: 5,
    strategy: "exponential",
    delay: 100,
  },
});

// Disable retry
await http.get("/items", { retry: false });
```

### Custom Retry Logic

```typescript
const http = createHttp({
  retry: {
    attempts: 3,
    strategy: "none",
    delay: 0,
    maxDelay: 0,
    statusCodes: [],
    shouldRetry: async (error, attemptNumber) => {
      if (error instanceof HttpError) {
        // Custom logic: retry on 503 or rate limit
        if (error.status === 503) return attemptNumber < 3;
        if (error.status === 429) {
          const retryAfter = error.headers["retry-after"];
          if (retryAfter) {
            await sleep(parseInt(retryAfter) * 1000);
            return true;
          }
        }
      }
      return false;
    },
  },
});
```

### Exponential Backoff with Jitter

```typescript
// Built-in exponential backoff
// Delay formula: min(initialDelay * 2^attemptNumber, maxDelay)
// Example with delay=300, maxDelay=30000:
// Attempt 1: 300ms
// Attempt 2: 600ms
// Attempt 3: 1200ms
// Attempt 4: 2400ms
// ... up to 30000ms
```

---

## ✅Request & Response Validation

### Global Request Validation

Block requests that don't match your criteria:

```typescript
const http = createHttp({
  baseURL: "https://api.example.com",
  requestValidator: (url, options) => {
    // Block requests to admin endpoints from the client
    if (url.includes("/admin") && typeof window !== "undefined") {
      return false; // Throws: "Request validation failed"
    }
    return true;
  },
});
```

### Global Error Handler

```typescript
http.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error instanceof HttpError) {
      // Log error
      console.error(`[${error.requestId}] ${error.status} ${error.url}`);

      // Send to monitoring
      await fetch("/api/errors", {
        method: "POST",
        body: JSON.stringify({
          status: error.status,
          url: error.url,
          message: error.message,
          requestId: error.requestId,
        }),
      });

      // Handle specific status codes
      if (error.status === 401) {
        // Redirect to login
        window.location.href = "/login";
      } else if (error.status === 429) {
        // Rate limited
        console.warn("Rate limited. Backing off...");
      }
    }

    throw error;
  }
);
```

---

### Per-Request Response Validation

Validate response data shape before it reaches your code:

```typescript
const { data } = await http.get<User>("/users/123", {
  validateResponse: (data) => {
    // Ensure the response has the expected shape
    return data && typeof data.id === "number" && typeof data.name === "string";
  },
});
// Throws HttpError with message "Response validation failed" if validation returns false
```

## Response Transformers

Transform response data at the global or per-request level:

```typescript
const http = createHttp({
  baseURL: "https://api.example.com",
  // Global transformer: runs on every response
  responseTransformer: (data, response) => {
    // Convert ISO date strings to Date objects
    if (data.createdAt) data.createdAt = new Date(data.createdAt);
    if (data.updatedAt) data.updatedAt = new Date(data.updatedAt);
    return data;
  },
});

// Per-request transformer: runs after the global one
const { data } = await http.get("/orders", {
  transformer: (data) => {
    // Add computed fields
    return data.map((order) => ({
      ...order,
      total: order.items.reduce((sum, item) => sum + item.price, 0),
    }));
  },
});
```

---

## Rate Limiting

### Token Bucket Algorithm

```typescript
import { RateLimiter } from "rhttp.io/features";

const limiter = new RateLimiter({
  enabled: true,
  tokensPerSecond: 100,
  maxBurst: 500,
});

// Acquire tokens before request
await limiter.acquire(url, method, weight);
const response = await http.get(url);
```

### Integrate with Client

```typescript
const limiter = new RateLimiter({
  tokensPerSecond: 10,
  maxBurst: 50,
});

http.interceptors.request.use(async (config) => {
  await limiter.acquire(config.url, config.method);
  return config;
});
```

---

## Request Profiling

### Performance Metrics

```typescript
import { RequestProfiler } from "rhttp.io/features";

const profiler = new RequestProfiler();

http.interceptors.request.use(async (config) => {
  profiler.start(config.requestId, config.url, config.method);
  return config;
});

http.interceptors.response.use(async (response) => {
  profiler.end(response.requestId, response.status);
  return response;
});

// Get profiling data
const stats = profiler.getStats();
console.log(`Average request time: ${stats.averageDuration}ms`);

const profiles = profiler.getProfiles({ url: "/api" });
profiles.forEach((p) => {
  console.log(`${p.method} ${p.url}: ${p.duration}ms`);
});
```

---

## React Integration

### TanStack Query Builder

```typescript
import { withReact } from "rhttp.io/react";
import { useQuery, useMutation } from "@tanstack/react-query";

const http = withReact(createHttp({
  baseURL: "https://api.example.com",
}));

// Query
function Posts() {
  const { data, isLoading } = useQuery({
    ...http.query<Post[]>({
      url: "/posts",
      params: { page: 1 },
      cache: true,
    }),
  });

  return <div>{data?.map(p => <div key={p.id}>{p.title}</div>)}</div>;
}

// Mutation
function CreatePost() {
  const mutation = useMutation({
    ...http.mutation<CreatePostInput, Post>({
      method: "POST",
      url: "/posts",
    }),
  });

  return (
    <button onClick={() => mutation.mutate({ title: "New" })}>
      Create
    </button>
  );
}
```

---

## Realtime Socket.io Client

### Basic Usage

```typescript
import { createRealtimeClient } from "rhttp.io/socket.io.client";

// Create client
const realtimeClient = createRealtimeClient({
  url: "https://api.example.com",
  auth: {
    token: "jwt-token",
  },
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
});

await realtimeClient.connect();
realtimeClient.emit("message", { text: "Hello!" });
realtimeClient.on("message", (data) => console.log(data));
realtimeClient.disconnect();
```

### Logging

Enable built-in logging or provide a custom logger:

```typescript
// Built-in console logging
const realtimeClient = createRealtimeClient({
  socketUrl: "https://ws.example.com",
  logger: true, // Logs connect/disconnect/emit/receive events
});

// Custom logger (e.g., Pino, Winston)
const realtimeClient = createRealtimeClient({
  socketUrl: "https://ws.example.com",
  logger: {
    debug: (...args) => myLogger.debug(...args),
    info: (...args) => myLogger.info(...args),
    warn: (...args) => myLogger.warn(...args),
    error: (...args) => myLogger.error(...args),
  },
});
```

### Event Validation & Transformation

Validate and transform events before they are emitted or processed:

```typescript
const realtimeClient = createRealtimeClient({
  socketUrl: "https://ws.example.com",

  // Validate events (return false to block)
  eventValidator: (event, data, direction) => {
    if (direction === "emit" && event === "message") {
      return typeof data.text === "string" && data.text.length > 0;
    }
    if (direction === "receive" && event === "notification") {
      return data.type !== undefined;
    }
    return true;
  },

  // Transform event payloads
  eventTransformer: (event, data, direction) => {
    if (direction === "emit") {
      return { ...data, timestamp: Date.now() };
    }
    if (direction === "receive" && event === "message") {
      return { ...data, receivedAt: new Date() };
    }
    return data;
  },
});
```

### Lifecycle Hooks

```typescript
const realtimeClient = createRealtimeClient({
  socketUrl: "https://ws.example.com",
  hooks: {
    onConnect: () => {
      console.log("Connected! Syncing data...");
      showToast("Connected");
    },
    onDisconnect: (reason) => {
      console.log(`Disconnected: ${reason}`);
      showToast("Connection lost", "warning");
    },
    onError: (error) => {
      reportError(error);
    },
  },
});
```

### Rooms & Offline Queue

```typescript
const realtimeClient = createRealtimeClient({
  socketUrl: "https://ws.example.com",
  rooms: { autoRejoin: true },
  offlineQueue: { enabled: true, maxSize: 100 },
});

// Join rooms (auto-queued if offline, auto-rejoined on reconnect)
await realtimeClient.joinRoom("chat:general");
await realtimeClient.joinRoom("notifications");

// Messages are queued when offline and flushed on reconnect
realtimeClient.emit("message", { text: "Hello" });

console.log(realtimeClient.getRooms()); // ["chat:general", "notifications"]
console.log(realtimeClient.getQueueLength()); // 0 if connected, N if offline
```

### Setup

```typescript
import { createRealtimeClient } from "rhttp.io/socket.io.client";
import { RealtimeProvider, useSocketClient } from "rhttp.io/socket.io.client";

// Create client
const realtimeClient = createRealtimeClient({
  url: "https://api.example.com",
  auth: {
    token: "jwt-token",
  },
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
});

// Wrap app
function App() {
  return (
    <RealtimeProvider client={realtimeClient}>
      <YourComponents />
    </RealtimeProvider>
  );
}
```

### Using Realtime Events

```typescript
function ChatBox() {
  const { connected } = useConnectionState();
  const client = useSocketClient();

  useSocketEvent("message", (data) => {
    console.log("New message:", data);
  });

  const sendMessage = (text: string) => {
    client.emit("message", { text });
  };

  return (
    <div>
      Status: {connected ? "Connected" : "Disconnected"}
      <button onClick={() => sendMessage("Hello")}> Send
      <button>
    </div>
  );
}
```

---

## Examples

### Full CRUD App

```typescript
interface Item {
  id: string;
  name: string;
  createdAt: string;
}

const http = createHttp({
  baseURL: "https://api.example.com",
  cache: { enabled: true, ttl: 60_000 },
  retry: { attempts: 3, strategy: "exponential" },
  auth: { accessToken: "jwt-token", scheme: "Bearer" },
});

// Read
async function getItems() {
  const { data } = await http.get<Item[]>("/items");
  return data;
}

// Create
async function createItem(name: string) {
  const { data } = await http.post<{ name: string }, Item>("/items", { name });
  http.invalidateCache("/items"); // Refresh list
  return data;
}

// Update
async function updateItem(id: string, updates: Partial<Item>) {
  const { data } = await http.put<Partial<Item>, Item>(`/items/${id}`, updates);
  http.invalidateCache("/items");
  return data;
}

// Delete
async function deleteItem(id: string) {
  await http.delete(`/items/${id}`);
  http.invalidateCache("/items");
}
```

### File Upload

```typescript
async function uploadFile(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("description", "My file");

  const { data } = await http.post<FormData, { url: string }>(
    "/upload",
    formData,
    {
      headers: {
        // Omit Content-Type, browser will set it with boundary
      },
      timeout: 60_000, // Longer timeout for large files
    },
  );

  return data.url;
}
```

### Streaming Response

```typescript
async function downloadFile(filename: string) {
  const response = await http.customFetch(`/files/${filename}`, {
    method: "GET",
  });

  const blob = response.data; // Response is already Blob
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}
```

---
## Circuit Breaker Pattern

### Implementation

```typescript
import { CircuitBreaker } from "rhttp.io/advanced";

const breaker = new CircuitBreaker({
  enabled: true,
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60000,
});

// Use in interceptor
http.interceptors.request.use(async (options) => {
  try {
    return await breaker.execute(async () => options);
  } catch (error) {
    console.error("Circuit breaker blocked request:", error);
    throw error;
  }
});
```

### Monitor Circuit State

```typescript
const status = breaker.getStatus();
console.log(status.state);              // "closed" | "open" | "half-open"
console.log(status.failures);
console.log(status.rejectedCount);
console.log(status.timeUntilHalfOpen);

// Check state
if (breaker.isOpen()) {
  console.log("Service unavailable, retrying in", status.timeUntilHalfOpen, "ms");
}
```

---

## Request Pooling

### Configuration

```typescript
const http = createHttp({
  requestPool: {
    enabled: true,
    maxConcurrent: 5,
    queueLimit: 100,
  },
});
```

### Monitor Pool

```typescript
const stats = http.getPoolStats?.();
console.log(`Active: ${stats.activeRequests}/${stats.maxConcurrent}`);
console.log(`Queued: ${stats.queueLength}`);
```

---

## Monitoring & Observability

### Metrics Collection

```typescript
const http = createHttp({
  observability: {
    logger: true,      // Console logging
    tracing: true,     // X-Request-ID headers
    metrics: true,     // Metrics collection
  },
});

// Get metrics
const metrics = http.getMetrics();
{
  totalRequests: 150,
  successfulRequests: 145,
  failedRequests: 5,
  durations: [12, 45, 23, ...],
  statusCodes: {
    200: 140,
    201: 5,
    500: 5,
  }
}
```

### Request History

```typescript
// Get all requests
const history = http.getHistory();

// Filter by URL
const userRequests = history.filter(r => r.url.includes("/users"));

// Find slow requests
const slow = history.filter(r => r.durationMs > 1000);

// Get request details
const entry = history.find(r => r.requestId === "abc-123");
```

### Custom Logger

```typescript
const http = createHttp({
  observability: {
    logger: {
      debug: (msg, ctx) => console.debug(msg, ctx),
      info: (msg, ctx) => console.info(msg, ctx),
      warn: (msg, ctx) => console.warn(msg, ctx),
      error: (msg, ctx) => console.error(msg, ctx),
    },
  },
});
```

---

## Extensions

### GraphQL Support

```typescript
import { withGraphQL } from "rhttp.io/extensions";

const graphql = withGraphQL(http, "/graphql");

// Query
const { data: posts } = await graphql.query<{ posts: Post[] }>({
  query: `query { posts { id title } }`,
});

// Mutation
const { data: newPost } = await graphql.mutation<{ createPost: Post }>({
  query: `mutation CreatePost($title: String!) { 
    createPost(title: $title) { id title }
  }`,
  variables: { title: "Hello" },
});
```

### Schema Validation (Zod)

```typescript
import { withSchemaValidation } from "rhttp.io/extensions";
import { z } from "zod";

const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
});

const http = withSchemaValidation(createHttp({
  baseURL: "https://api.example.com",
}));

// Automatic validation
const { data: user } = await http.get("/user", {
  schema: UserSchema,
  // Guaranteed to match schema or throw
});
```

### Request Compression

```typescript
import { createCompressionMiddleware } from "rhttp.io/extensions";

const compression = createCompressionMiddleware({
  enabled: true,
  algorithm: "gzip",
  threshold: 1024,  // Compress bodies > 1KB
  level: 6,
});

http.use(compression);
```

---
## Troubleshooting

### Request Hangs

**Problem**: Request never completes.

**Solution**: Set timeout.

```typescript
const http = createHttp({
  timeout: 30_000, // 30 seconds
});

await http.get("/endpoint", { timeout: 10_000 }); // Override
```

### CORS Errors

**Problem**: "Access to XMLHttpRequest has been blocked by CORS policy".

**Solution**: Server must include CORS headers.

```typescript
// Server-side (Node.js/Express example)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "https://example.com");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});
```

### Memory Leaks

**Problem**: Cache grows unbounded.

**Solution**: Set TTL, clear cache periodically.

```typescript
const http = createHttp({
  cache: {
    enabled: true,
    ttl: 60_000, // Auto-expire after 1 minute
  },
});

// Periodic cleanup
setInterval(() => {
  http.clearCache();
}, 600_000); // Every 10 minutes
```

### Circuit Breaker Open

**Problem**: "Circuit breaker is OPEN - request blocked".

**Solution**: Check backend health, reset breaker.

```typescript
const status = http.getCircuitBreakerStatus();
console.log(status.state); // "open" | "closed" | "half-open"

if (status.state === "open") {
  http.resetCircuitBreaker();
}
```

### 401 Unauthorized Loop

**Problem**: Token refresh causes infinite 401 loop.

**Solution**: Ensure refresh endpoint works independently.

```typescript
http.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error instanceof HttpError && error.status === 401) {
      // Only retry once
      if (error.options?._retry) {
        throw error; // Give up
      }
      // Try refresh
      const newToken = await refreshToken();
      error.options._retry = true;
      return http.customFetch(error.url, error.options);
    }
    throw error;
  },
);
```

---

## Best Practices

1. **Set Reasonable Timeouts**: Prevents hanging requests.
2. **Use Cache Strategy**: Don't spam endpoints unnecessarily.
3. **Handle Errors Properly**: Distinguish between error types.
4. **Monitor Metrics**: Track performance in production.
5. **Implement Retry Logic**: But avoid retry storms.
6. **Use Request IDs**: For debugging and tracing.
7. **Validate Responses**: Catch errors early.
8. **Clean Up Resources**: Cancel requests, clear cache when needed.
9. **Test Error Cases**: Don't just test happy path.
10. **Document API Contract**: Share response schemas with frontend team.

---

## Migration Guide

### From Axios

```typescript
// Before (Axios)
const response = await axios.get("/items");

// After (rhttp.io)
const http = createHttp({ baseURL: "https://api.example.com" });
const { data } = await http.get("/items");
```

### From Native Fetch

```typescript
// Before (Fetch)
const response = await fetch("/items");
const data = await response.json();

// After (rhttp.io)
const http = createHttp({ baseURL: "https://api.example.com" });
const { data } = await http.get("/items");

// Advantages:
// - Automatic JSON parsing
// - Built-in error handling
// - Retry logic
// - Caching
// - Type safety
```

---
## 🚀 Advanced Features

### Circuit Breaker Pattern

Prevent cascading failures by automatically stopping requests when a service becomes unhealthy.

```typescript
const http = createHttp({
  circuitBreaker: {
    enabled: true,
    failureThreshold: 5,        // Fail after 5 consecutive errors
    successThreshold: 2,        // Recover after 2 successes
    timeout: 30_000,            // Time until half-open state (30s)
  },
});

// Check status
const status = http.getCircuitBreakerStatus();
console.log(status); // { state: "closed", failures: 0, successes: 0 }

// Manual reset if needed
http.resetCircuitBreaker();
```

### Request Pooling

Limit concurrent requests to prevent overwhelming the server.

```typescript
const http = createHttp({
  requestPool: {
    enabled: true,
    maxConcurrent: 5,           // Max 5 concurrent requests
  },
});

// 10 requests will be queued, max 5 running at a time
const promises = Array(10).fill().map(() => http.get("/endpoint"));
await Promise.all(promises); // ✓ Efficiently queued
```

### Automatic Polling

Poll an endpoint until a condition is met.

```typescript
const { data } = await http.poll<JobStatus>("/jobs/123/status", {
  polling: {
    interval: 2_000,             // Poll every 2 seconds
    maxAttempts: 30,             // Stop after 30 polls (1 minute total)
    stopCondition: (response) => response.data.status === "completed",
  },
});
```

### ETag Support for Bandwidth Optimization

Automatically use ETags to avoid re-downloading unchanged responses.

```typescript
const http = createHttp({
  etag: {
    enabled: true,
    storage: "memory",           // or "localStorage" for persistence
  },
});

// First request: downloads full response, stores ETag
const { data: users1 } = await http.get("/users");

// Second request: sends If-None-Match header with ETag
// If unchanged, server returns 304 Not Modified
// Cached data is automatically returned
const { data: users2 } = await http.get("/users");
```

### Advanced Cache Strategies

Choose the perfect cache strategy for your use case.

```typescript
// cache-first: Always use cache if available, fallback to network
await http.get("/data", { cacheStrategy: "cache-first" });

// network-first: Try network first, fallback to cache on failure
await http.get("/data", { cacheStrategy: "network-first" });

// cache-only: Only use cache, never network
const cached = await http.get("/data", { cacheStrategy: "cache-only" });

// network-only: Always fetch fresh, ignore cache
const fresh = await http.get("/data", { cacheStrategy: "network-only" });

// stale-while-revalidate: Return cache immediately, update in background
const { data } = await http.get("/data", { 
  cacheStrategy: "stale-while-revalidate" 
});
```

### Plugin System for Extensibility

Create custom plugins to extend HTTP client behavior.

```typescript
const loggingPlugin = {
  name: "logging",
  beforeRequest: async (url, options) => {
    console.log(`→ ${options.method} ${url}`);
    return options;
  },
  afterResponse: async (response) => {
    console.log(`← ${response.status} in ${response.durationMs}ms`);
    return response;
  },
  onError: async (error) => {
    console.error(`✕ Error: ${error.message}`);
    throw error;
  },
};

const http = createHttp({});
http.use(loggingPlugin);

// Analytics plugin
const analyticsPlugin = {
  name: "analytics",
  afterResponse: async (response) => {
    // Send to analytics service
    await fetch("/api/analytics", {
      method: "POST",
      body: JSON.stringify({
        endpoint: response.response.url,
        status: response.status,
        duration: response.durationMs,
      }),
    });
    return response;
  },
};

http.use(analyticsPlugin);
```

### Request History & Debugging

Track recent requests for debugging and monitoring.

```typescript
const http = createHttp({});

// Make some requests
await http.get("/api/users");
await http.post("/api/orders", { item: "laptop" });
await http.get("/api/orders/123");

// Get request history
const history = http.getHistory();
// [
//   { requestId: "uuid-1", url: "https://api.../users", method: "GET", status: 200, durationMs: 45 },
//   { requestId: "uuid-2", url: "https://api.../orders", method: "POST", status: 201, durationMs: 123 },
//   { requestId: "uuid-3", url: "https://api.../orders/123", method: "GET", status: 200, durationMs: 32 },
// ]

// Filter by status code
const failed = history.filter(req => req.status >= 400);

// Find slowest requests
const slowest = history.sort((a, b) => b.durationMs - a.durationMs);
```

### Lifecycle Hooks

Execute custom logic at specific points in the request lifecycle.

```typescript
const http = createHttp({
  hooks: {
    onRequest: async (url, options) => {
      console.log(`Starting request to ${url}`);
      // Track request start time, add custom headers, etc.
    },
    
    onSuccess: async (response) => {
      console.log(`Request successful: ${response.status}`);
      // Update UI, cache results, analytics, etc.
    },
    
    onError: async (error) => {
      console.error(`Request failed: ${error.message}`);
      // Show user notification, retry logic, etc.
    },
    
    onFinally: async () => {
      console.log("Request complete");
      // Cleanup, close loading spinners, etc.
    },
  },
});
```

### Request Cancellation

Cancel ongoing requests at any time.

```typescript
const http = createHttp({});

const requestId = generateRequestId();

// Start a long-running request
const promise = http.get("/slow-endpoint", { requestId });

// Cancel after 5 seconds
setTimeout(() => {
  http.cancel(requestId); // Cancel specific request
  // Or: http.cancel(); // Cancel all ongoing requests
}, 5_000);
```
## 📄 License

MIT

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## Support

For issues, questions, or feature requests, visit:

- GitHub: https://github.com/elprof45/rhttp.io
- Issues: https://github.com/elprof45/rhttp.io/issues
- Discussions: https://github.com/elprof45/rhttp.io/discussions
