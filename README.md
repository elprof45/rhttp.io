# rhttp.io

Universal HTTP client. Caching, retries, circuit breaker, JWT, CSRF, Socket.io. Isomorphic for browsers, Node.js, Edge.

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

## 📦 Installation

```bash
npm install rhttp.io
# or
bun add rhttp.io
```

### Entry Points

```typescript
// Core isomorphic client
import { createHttp } from "rhttp.io";

// Browser-optimized client (CSRF prefetch, etc.)
import { createClientHttp } from "rhttp.io/client";

// Server-optimized client (cookie forwarding, logging)
import { createServerHttp } from "rhttp.io/server";

// React + TanStack Query integration
import { withReact } from "rhttp.io/react";
```

## 🚀 Quick Start

### Basic Usage

```typescript
import { createHttp } from "rhttp.io";

const http = createHttp({
  baseURL: "https://api.example.com",
  timeout: 30_000,
});

// GET request
const { data: orders } = await http.get<Order[]>("/orders");

// POST request
const { data: newOrder } = await http.post<CreateOrderInput, Order>(
  "/orders",
  { items: [...], shippingAddress: {...} }
);

// Error handling
try {
  await http.get("/not-found");
} catch (error) {
  if (error instanceof HttpError) {
    console.error(`HTTP ${error.status}: ${error.statusText}`);
  }
}
```

### Browser Client with CSRF

```typescript
import { createClientHttp } from "rhttp.io/client";

const http = createClientHttp({
  baseURL: "https://api.example.com",
});

// CSRF protection is automatically enabled
// Token is prefetched and injected on POST/PUT/PATCH/DELETE
await http.post("/orders", payload); // ✓ CSRF token auto-injected
```

### Server Client with Cookie Forwarding

```typescript
import { createServerHttp } from "rhttp.io/server";

const http = createServerHttp({
  baseURL: process.env.INTERNAL_API_URL,
});

// Use in TanStack Start Server Function
export const fetchUserOrders = createServerFn({ method: "GET" }).handler(
  async ({ request }) => {
    return http.withRequest(request, async () => {
      // Cookies from the incoming request are auto-forwarded
      const { data } = await http.get<Order[]>("/orders");
      return data;
    });
  }
);
```

### React + TanStack Query

```typescript
import { createHttp } from "rhttp.io";
import { withReact } from "rhttp.io/react";
import { useQuery, useMutation } from "@tanstack/react-query";

const baseHttp = createHttp({ baseURL: "https://api.example.com" });
const http = withReact(baseHttp);

// Query builder
function OrdersList() {
  const { queryKey, queryFn } = http.query<Order[]>({
    url: "/orders",
    params: { status: "pending" },
  });

  const { data: orders } = useQuery({ queryKey, queryFn });
  return <>{orders?.map(o => <div key={o.id}>{o.id}</div>)}</>;
}

// Mutation builder
function CreateOrder() {
  const { mutationFn } = http.mutation({
    method: "POST",
    url: "/orders",
  });

  const { mutate } = useMutation({
    mutationFn,
    onSuccess: (newOrder) => console.log("Created:", newOrder),
  });

  return <button onClick={() => mutate({ items: [...] })}>Create</button>;
}
```

## 📚 API Documentation

### `createHttp(config)`

Factory function that creates an HTTP client instance.

```typescript
const http = createHttp({
  // Base URL for all requests
  baseURL: "https://api.example.com",

  // Default headers sent with every request
  defaultHeaders: {
    "X-App-Version": "1.0.0",
  },

  // Global timeout (milliseconds)
  timeout: 30_000,

  // Automatic retry configuration
  retry: {
    attempts: 3,                          // Number of retry attempts
    strategy: "exponential",              // "exponential" | "linear" | "none"
    delay: 300,                           // Initial delay (ms)
    maxDelay: 30_000,                     // Maximum delay between retries
    statusCodes: [408, 429, 500, 502],   // Retryable status codes
    shouldRetry: async (error, attempt) => attempt <= 3,
  },

  // In-memory cache for GET requests
  cache: {
    enabled: true,
    ttl: 60_000,                         // 1 minute TTL
    keyBuilder: (url, opts) => `${url}:${JSON.stringify(opts.params)}`,
  },

  // CSRF protection
  csrf: {
    enabled: true,
    fetchEndpoint: "/api/csrf",
    cookieName: "csrf-token",
    headerName: "X-CSRF-Token",
    methods: ["POST", "PUT", "PATCH", "DELETE"],
    prefetch: true,                      // Prefetch token on init
  },

  // Authentication
  auth: {
    forwardCookies: true,                // For SSR
    accessToken: "secret-token",         // Static token
    scheme: "Bearer",                    // Auth scheme
    getToken: async () => "dynamic-token", // Dynamic token
  },

  // Observability
  observability: {
    logger: true,                        // true | false | custom logger
    tracing: true,                       // Add X-Request-ID header
    metrics: true,                       // Collect metrics
  },

  // Custom fetch implementation
  fetch: globalThis.fetch,

  // SSR context (TanStack Start)
  requestContext: () => getRequest(),
});
```

### HTTP Methods

#### `get(url, options?)`

```typescript
const { data, status, headers, requestId, durationMs } = await http.get<T>(
  "/items",
  {
    params: { status: "active", limit: 10 },
    headers: { "X-Custom": "value" },
    timeout: 5_000,
    cache: false,                    // Bypass cache
    retry: false,                    // No retry
    deduplicate: false,              // Allow concurrent dups
  }
);
```

#### `post(url, body?, options?)`

```typescript
const { data } = await http.post<RequestType, ResponseType>(
  "/items",
  { name: "New Item", description: "..." },
  { timeout: 8_000 }
);
```

#### `put(url, body?, options?)`

Complete resource replacement:

```typescript
await http.put("/items/123", {
  name: "Updated",
  description: "New desc",
  status: "active",
});
```

#### `patch(url, body?, options?)`

Partial resource update:

```typescript
await http.patch("/items/123", {
  status: "completed",
  // Other fields unchanged
});
```

#### `delete(url, body?, options?)`

```typescript
await http.delete("/items/123");

// With body (bulk delete)
await http.delete("/items", { ids: ["1", "2", "3"] });
```

#### `customFetch(url, options?)`

For highly customized requests:

```typescript
const { data } = await http.customFetch<T>("/search", {
  method: "POST",
  body: JSON.stringify({ query: "test" }),
  headers: { "X-Custom": "header" },
});
```

### Batch Requests

```typescript
const [ordersRes, usersRes, productsRes] = await http.batchRequests([
  () => http.get<Order[]>("/orders"),
  () => http.get<User[]>("/users"),
  () => http.get<Product[]>("/products"),
]);

console.log(ordersRes.data, usersRes.data, productsRes.data);
```

### Interceptors

#### Request Interceptor

```typescript
http.interceptors.request.use(async (config) => {
  config.headers = config.headers || {};
  config.headers["X-Request-ID"] = generateId();
  return config;
});
```

#### Response Interceptor

```typescript
http.interceptors.response.use(
  (response) => {
    // Success path
    analytics.track("api_call_success", {
      url: response.response.url,
      status: response.status,
      duration: response.durationMs,
    });
    return response;
  },
  (error) => {
    // Error path
    if (error instanceof HttpError && error.status === 401) {
      // Handle unauthorized
      window.location.href = "/login";
    }
    throw error;
  }
);
```

### Cache Management

```typescript
// Invalidate cache for URLs matching pattern
http.invalidateCache("/orders"); // Clears /orders, /orders/123, etc.

// Clear all cached entries
http.clearCache();

// Get cache metrics
const metrics = http.getMetrics();
console.log(metrics.totalRequests, metrics.successfulRequests);
```

### Response Type

```typescript
interface HttpResponse<T> {
  data: T;                           // Parsed response body
  status: number;                    // HTTP status code
  statusText: string;                // Status text ("OK", "Not Found", etc.)
  headers: Record<string, string>;   // Response headers
  response: Response;                // Native fetch Response
  requestId: string;                 // Unique request ID for tracing
  durationMs: number;                // Total request duration
}
```

### Error Types

```typescript
import { HttpError, TimeoutError, NetworkError } from "rhttp.io";

try {
  await http.get("/items");
} catch (error) {
  if (error instanceof TimeoutError) {
    console.error(`Request timed out after ${error.durationMs}ms`);
  } else if (error instanceof NetworkError) {
    console.error(`Network error: ${error.message}`, error.originalError);
  } else if (error instanceof HttpError) {
    console.error(`HTTP ${error.status}: ${error.statusText}`);
    console.log("Response data:", error.data);
  }
}
```

## 🔒 Authentication Patterns

### Pattern 1: Static Token (Service-to-Service)

```typescript
const apiClient = createServerHttp({
  baseURL: "https://internal-api.example.com",
  auth: {
    accessToken: process.env.SERVICE_TOKEN,
    scheme: "Bearer",
  },
});
```

### Pattern 2: Automatic JWT Refresh Interceptor

Automatically refresh expired tokens on `401` responses and retry all queued requests:

```typescript
import { createHttp, createRefreshAuthInterceptor } from "rhttp.io";

const http = createHttp({
  baseURL: "https://api.example.com",
  auth: { accessToken: localStorage.getItem("access_token") || "" },
});

// Attach the refresh interceptor
http.interceptors.response.use(
  (res) => res,
  createRefreshAuthInterceptor(http, {
    // Called when a 401 is received
    refreshToken: async () => {
      const res = await fetch("/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: localStorage.getItem("refresh_token") }),
      });
      const data = await res.json();
      return data.accessToken; // Return the new token
    },
    // Called after a successful refresh
    onTokenRefreshed: (newToken) => {
      localStorage.setItem("access_token", newToken);
    },
    // Optional: status codes that trigger refresh (default: [401])
    statusCodes: [401],
  })
);

// If two concurrent requests both get 401:
// - Only ONE refresh call is made
// - Both requests are retried with the new token
const [profile, orders] = await Promise.all([
  http.get("/profile"),
  http.get("/orders"),
]);
```

### Pattern 3: Dynamic JWT with `getToken`

```typescript
const apiClient = createHttp({
  baseURL: "https://api.example.com",
  auth: {
    scheme: "Bearer",
    getToken: async () => {
      let token = localStorage.getItem("access_token");
      const expiresIn = parseInt(localStorage.getItem("access_token_expires_at") || "0", 10);

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

### Pattern 4: Cookie-Based Sessions (SSR)

```typescript
import { createServerHttp } from "rhttp.io/server";
import { getRequest } from "@tanstack/react-start/server";

const apiServer = createServerHttp({
  baseURL: process.env.API_URL,
  auth: { forwardCookies: true },
  requestContext: () => getRequest(),
});

export const fetchDashboard = createServerFn({ method: "GET" }).handler(async ({ request }) => {
  return apiServer.withRequest(request, async () => {
    const { data } = await apiServer.get("/dashboard");
    return data;
  });
});
```

## ✅ Request & Response Validation

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

## 🔄 Response Transformers

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
    return data.map(order => ({
      ...order,
      total: order.items.reduce((sum, item) => sum + item.price, 0),
    }));
  },
});
```

## 🔌 Realtime Socket.io Client

### Basic Usage

```typescript
import { createRealtimeClient } from "rhttp.io/socket.io.client";

const client = createRealtimeClient({
  socketUrl: "https://ws.example.com",
  auth: { token: "my-jwt-token" },
  reconnection: true,
  reconnectionAttempts: 10,
});

await client.connect();
client.emit("message", { text: "Hello!" });
client.on("message", (data) => console.log(data));
client.disconnect();
```

### Logging

Enable built-in logging or provide a custom logger:

```typescript
// Built-in console logging
const client = createRealtimeClient({
  socketUrl: "https://ws.example.com",
  logger: true, // Logs connect/disconnect/emit/receive events
});

// Custom logger (e.g., Pino, Winston)
const client = createRealtimeClient({
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
const client = createRealtimeClient({
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
const client = createRealtimeClient({
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
const client = createRealtimeClient({
  socketUrl: "https://ws.example.com",
  rooms: { autoRejoin: true },
  offlineQueue: { enabled: true, maxSize: 100 },
});

// Join rooms (auto-queued if offline, auto-rejoined on reconnect)
await client.joinRoom("chat:general");
await client.joinRoom("notifications");

// Messages are queued when offline and flushed on reconnect
client.emit("message", { text: "Hello" });

console.log(client.getRooms());       // ["chat:general", "notifications"]
console.log(client.getQueueLength()); // 0 if connected, N if offline
```

## 🧪 Testing

Run the included test suite:

```bash
bun run test
```

The test suite validates **21 test cases**:

- ✓ HTTP methods (GET, POST, PUT, PATCH, DELETE)
- ✓ Caching and cache invalidation
- ✓ Request deduplication
- ✓ Timeout handling
- ✓ Retry with backoff strategies
- ✓ Interceptors
- ✓ Error handling
- ✓ Batch requests
- ✓ Query parameter encoding
- ✓ Metrics collection
- ✓ CSRF protection
- ✓ Request validation (blocking invalid requests)
- ✓ Response validation (schema checks)
- ✓ Response transformers (global + per-request)
- ✓ Cache strategies (stale-while-revalidate)
- ✓ JWT refresh token interceptor (auto-retry with queue)
- ✓ Realtime client logger & lifecycle hooks
- ✓ Realtime event validation & transformation
- ✓ Realtime room join & offline queue

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
