# rhttp.io - Complete Reference Guide

**Universal HTTP client for browsers, Node.js, and Edge Runtimes with production-grade features.**

## 📋 Table of Contents

1. [Installation](#installation)
2. [Quick Start](#quick-start)
3. [Core API](#core-api)
4. [Advanced Features](#advanced-features)
5. [Authentication & Security](#authentication--security)
6. [Caching Strategies](#caching-strategies)
7. [Error Handling](#error-handling)
8. [Interceptors & Middleware](#interceptors--middleware)
9. [Rate Limiting & Throttling](#rate-limiting--throttling)
10. [Circuit Breaker Pattern](#circuit-breaker-pattern)
11. [Request Pooling](#request-pooling)
12. [Monitoring & Observability](#monitoring--observability)
13. [Extensions](#extensions)
14. [React Integration](#react-integration)
15. [Realtime Sockets](#realtime-sockets)
16. [Performance Best Practices](#performance-best-practices)
17. [Troubleshooting](#troubleshooting)

---

## Installation

```bash
npm install rhttp.io
# or
yarn add rhttp.io
# or
bun add rhttp.io
```

### Entry Points

```typescript
// 🌍 Universal - works everywhere
import { createHttp } from "rhttp.io";

// 🌐 Browser-optimized (CSRF prefetch, localStorage)
import { createClientHttp } from "rhttp.io/client";

// 🖥️ Server-optimized (cookie forwarding, logging)
import { createServerHttp } from "rhttp.io/server";

// ⚛️ React + TanStack Query integration
import { withReact } from "rhttp.io/react";

// 🔌 Realtime Socket.io
import { createRealtimeClient } from "rhttp.io/socket.io";

// 🛠️ Error classes
import { HttpError, TimeoutError, NetworkError } from "rhttp.io";

// 📊 Advanced features
import {
  CircuitBreaker,
  RequestPool,
  RateLimiter,
  RequestProfiler,
} from "rhttp.io/advanced";
```

---

## Quick Start

### Basic Usage

```typescript
import { createHttp } from "rhttp.io";

// Create client
const http = createHttp({
  baseURL: "https://api.example.com",
  timeout: 30_000,
});

// GET
const { data: users } = await http.get<User[]>("/users");

// POST
const { data: newUser } = await http.post<CreateUserInput, User>(
  "/users",
  { name: "Alice", email: "alice@example.com" }
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

### Browser Client (Automatic CSRF & Auth)

```typescript
import { createClientHttp } from "rhttp.io/client";

const http = createClientHttp({
  baseURL: "https://api.example.com",
});

// ✅ CSRF token auto-injected
await http.post("/orders", payload);

// ✅ Bearer token auto-injected from localStorage
// (Set via: localStorage.setItem("access_token", "your-token"))
const { data: profile } = await http.get("/profile");

// ✅ Cookies auto-included
const { data: session } = await http.get("/session");
```

### Server Client (Automatic Cookie Forwarding)

```typescript
import { createServerHttp } from "rhttp.io/server";

const http = createServerHttp({
  baseURL: process.env.INTERNAL_API_URL,
});

// ✅ Cookies auto-forwarded from incoming request
// Works with TanStack Start, Next.js, etc.
export const getUserData = createServerFn().handler(async () => {
  const { data } = await http.get("/user");
  return data;
});
```

---

## Core API

### HTTP Methods

#### GET
```typescript
const response = await http.get<T>(
  url: string,
  options?: HttpRequestOptions
): Promise<HttpResponse<T>>

// With query parameters
await http.get("/users", { 
  params: { limit: 10, offset: 0 } 
});
```

#### POST
```typescript
const response = await http.post<RequestBody, ResponseType>(
  url: string,
  body?: RequestBody,
  options?: HttpRequestOptions
): Promise<HttpResponse<ResponseType>>

await http.post("/users", { name: "Alice" });
```

#### PUT / PATCH
```typescript
// Complete replacement
await http.put("/users/123", { name: "Bob", active: true });

// Partial update
await http.patch("/users/123", { name: "Bob" });
```

#### DELETE
```typescript
// Without body
await http.delete("/users/123");

// With body
await http.delete("/users", { ids: ["123", "456"] });
```

### Response Structure

```typescript
interface HttpResponse<T> {
  data: T;                    // Parsed response body
  status: number;             // HTTP status code
  statusText: string;         // HTTP status text
  headers: Record<string, string>;  // Response headers
  response: Response;         // Native Response object
  requestId: string;          // Unique request ID for tracing
  durationMs: number;         // Request duration in milliseconds
}
```

### Common Options

```typescript
interface HttpRequestOptions {
  // Query parameters
  params?: Record<string, any>;

  // Custom headers (merged intelligently)
  headers?: Record<string, string>;

  // Timeout override (ms)
  timeout?: number;

  // Cache configuration (per-request override)
  cache?: boolean | Partial<CacheConfig> | { strategy?: CacheStrategy };

  // Retry override
  retry?: boolean | Partial<RetryConfig>;

  // Request deduplication
  deduplicate?: boolean;

  // CSRF protection (POST/PUT/PATCH/DELETE only)
  csrf?: boolean;

  // Request ID (for tracing)
  requestId?: string;

  // Response validation
  validateResponse?: (data: any) => boolean;

  // Response transformation
  transformer?: (data: any, response: HttpResponse<any>) => any;

  // Polling configuration
  polling?: Partial<PollingConfig>;
}
```

---

## Advanced Features

### Circuit Breaker Pattern

Prevents cascading failures by detecting patterns and failing fast.

```typescript
const http = createHttp({
  circuitBreaker: {
    enabled: true,
    failureThreshold: 5,   // Open after 5 failures
    successThreshold: 2,   // Close after 2 successes in half-open
    timeout: 60000,        // Try recovery after 60s
  },
});

// Monitor circuit breaker
const status = http.getCircuitBreakerStatus();
console.log(status.state); // "closed" | "open" | "half-open"
console.log(status.failures);
console.log(status.timeUntilHalfOpen);

// Manual reset if needed
http.resetCircuitBreaker();
```

**States:**
- **CLOSED**: Normal operation, all requests pass through
- **OPEN**: Service failing, requests blocked immediately with fast-fail
- **HALF-OPEN**: Testing recovery, limited requests allowed

### Request Pooling

Limit concurrent requests to prevent resource exhaustion.

```typescript
const http = createHttp({
  requestPool: {
    enabled: true,
    maxConcurrent: 5,      // Max 5 concurrent requests
    queueLimit: 100,       // Queue up to 100 more
  },
});

// Make 100 requests - only 5 at a time
const requests = Array(100).fill().map((_, i) => 
  http.get(`/items/${i}`)
);
await Promise.all(requests); // Efficiently managed
```

### Rate Limiting (Token Bucket)

```typescript
import { RateLimiter } from "rhttp.io/advanced";

const limiter = new RateLimiter({
  enabled: true,
  tokensPerSecond: 100,  // 100 requests/second
  maxBurst: 200,         // Allow 200 in a burst
});

// In interceptor
http.interceptors.request.use(async (options) => {
  await limiter.acquire(options.url, options.method);
  return options;
});
```

### Polling

```typescript
// Poll endpoint until condition is met
const result = await http.poll("/job-status/123", {
  polling: {
    interval: 1000,           // Poll every 1s
    maxAttempts: 60,          // Max 60 attempts = 60s total
    stopCondition: (data) => data.status === "completed",
  },
});
```

### Request History & Profiling

```typescript
const http = createHttp({
  observability: {
    logger: true,   // Enable console logging
    tracing: true,  // Add X-Request-ID headers
    metrics: true,  // Collect metrics
  },
});

// Get history
const history = http.getHistory();
history.forEach(entry => {
  console.log(`${entry.method} ${entry.url} - ${entry.status} (${entry.durationMs}ms)`);
});

// Get metrics
const metrics = http.getMetrics();
console.log(`Success rate: ${metrics.successfulRequests / metrics.totalRequests * 100}%`);
```

---

## Authentication & Security

### Token Management

#### Static Token (Service-to-Service)
```typescript
const http = createHttp({
  auth: {
    scheme: "Bearer",
    accessToken: process.env.API_KEY,
  },
});
```

#### Dynamic Token (OAuth, JWT)
```typescript
const http = createClientHttp({
  auth: {
    scheme: "Bearer",
    getToken: async () => {
      // Read from localStorage (browser)
      if (typeof window !== "undefined") {
        return localStorage.getItem("access_token");
      }
      // Or from environment (server)
      return process.env.API_TOKEN;
    },
  },
});
```

#### Auto Token Refresh
```typescript
import { createRefreshAuthInterceptor } from "rhttp.io";

const http = createHttp({
  auth: { accessToken: currentToken },
});

// Attach refresh interceptor
http.interceptors.response.use(
  (res) => res,
  createRefreshAuthInterceptor(http, {
    refreshToken: async () => {
      const response = await fetch("/auth/refresh", {
        method: "POST",
        credentials: "include",
      });
      const { token } = await response.json();
      return token;
    },
    onTokenRefreshed: (newToken) => {
      localStorage.setItem("access_token", newToken);
    },
  })
);
```

### CSRF Protection

#### Browser (Client)
```typescript
const http = createClientHttp({
  csrf: {
    enabled: true,           // Enabled by default
    fetchEndpoint: "/csrf",
    cookieName: "csrf-token",
    headerName: "X-CSRF-Token",
    methods: ["POST", "PUT", "PATCH", "DELETE"],
    prefetch: true,          // Fetch on init
  },
});

// CSRF token auto-injected on mutations
await http.post("/orders", payload); // ✅ Token included
```

#### Custom CSRF Header
```typescript
const http = createHttp({
  csrf: {
    enabled: true,
    headerName: "X-CSRF-Token",
    cookieName: "csrftoken",
    fetchEndpoint: "/api/csrf-token",
  },
});
```

### Cookie Forwarding (SSR)

#### Server Client
```typescript
const http = createServerHttp({
  auth: {
    forwardCookies: true,  // Enabled by default
  },
});

// Cookies automatically extracted and forwarded
await http.get("/protected-data");
```

#### With Explicit Context
```typescript
import { getRequest } from "@tanstack/react-start/server";

const http = createServerHttp({
  baseURL: process.env.INTERNAL_API_URL,
  requestContext: () => getRequest(),
  auth: { forwardCookies: true },
});
```

---

## Caching Strategies

### Five Built-in Strategies

```typescript
// 1. cache-first - Use cache if available, fallback to network
await http.get("/static-data", {
  cache: { strategy: "cache-first", ttl: 3600000 },
});

// 2. network-first - Try network first, fallback to cache
await http.get("/current-user", {
  cache: { strategy: "network-first", ttl: 60000 },
});

// 3. stale-while-revalidate - Return stale cache, update in background
await http.get("/list", {
  cache: { strategy: "stale-while-revalidate", ttl: 300000 },
});

// 4. cache-only - Use cache only, never fetch
await http.get("/offline-data", {
  cache: { strategy: "cache-only", ttl: 86400000 },
});

// 5. network-only - Never use cache
await http.get("/realtime-data", {
  cache: { strategy: "network-only" },
});
```

### Global Cache Configuration

```typescript
const http = createHttp({
  cache: {
    enabled: true,
    ttl: 60000,                    // 60 seconds default
    strategy: "network-first",     // Default strategy
    keyBuilder: (url, opts) => `${url}:${JSON.stringify(opts.params)}`,
  },
});
```

### Cache Management

```typescript
// Invalidate specific URLs
http.invalidateCache("/users");  // Clears /users and /users/*

// Clear all cache
http.clearCache();

// Get cache metrics
const metrics = http.getMetrics();
```

---

## Error Handling

### Error Types

```typescript
import { HttpError, TimeoutError, NetworkError } from "rhttp.io";

try {
  await http.get("/endpoint");
} catch (error) {
  if (error instanceof TimeoutError) {
    console.error(`Request timed out after ${error.durationMs}ms`);
  } else if (error instanceof NetworkError) {
    console.error("Network error:", error.originalError);
  } else if (error instanceof HttpError) {
    console.error(`HTTP ${error.status}: ${error.statusText}`);
    console.log("Response data:", error.data);
  }
}
```

### Error Details

```typescript
interface HttpError {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;                    // Parsed response body
  requestId: string;
  durationMs: number;
  url: string;
  options: HttpRequestOptions;
}
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

## Interceptors & Middleware

### Request Interceptor

```typescript
http.interceptors.request.use(
  async (options) => {
    // Modify request
    options.headers = options.headers || {};
    options.headers["X-Timestamp"] = new Date().toISOString();
    return options;
  },
  (error) => {
    console.error("Request preparation failed:", error);
    throw error;
  }
);
```

### Response Interceptor

```typescript
http.interceptors.response.use(
  (response) => {
    // Transform response
    console.log(`✓ ${response.status} in ${response.durationMs}ms`);
    return response;
  },
  (error) => {
    // Handle errors
    if (error instanceof HttpError && error.status === 401) {
      // Handle 401 Unauthorized
    }
    throw error;
  }
);
```

### Eject Interceptor

```typescript
const handler = http.interceptors.request.use((options) => {
  // ...
});

// Remove interceptor
handler.eject();
```

---

## Rate Limiting & Throttling

### Token Bucket Algorithm

```typescript
import { RateLimiter } from "rhttp.io/advanced";

const limiter = new RateLimiter({
  enabled: true,
  tokensPerSecond: 100,
  maxBurst: 150,
  keyBuilder: (url, method) => `${method}:${url.split("?")[0]}`,
});

// In request interceptor
http.interceptors.request.use(async (options) => {
  await limiter.acquire(options.url, options.method, 1);
  return options;
});

// Reset specific bucket
limiter.reset("GET:/users");

// Get bucket status
const status = limiter.getStatus("GET:/users");
console.log(status.tokens);
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

## React Integration

### TanStack Query Integration

```typescript
import { createHttp } from "rhttp.io";
import { withReact } from "rhttp.io/react";
import { useQuery, useMutation } from "@tanstack/react-query";

const baseHttp = createHttp({ baseURL: "https://api.example.com" });
const http = withReact(baseHttp);

function UsersList() {
  // Built-in query builder
  const { queryKey, queryFn } = http.query<User[]>({
    key: "users",
    url: "/users",
    options: { params: { limit: 10 } },
  });

  const { data: users } = useQuery({ queryKey, queryFn });

  return (
    <ul>
      {users?.map(user => <li key={user.id}>{user.name}</li>)}
    </ul>
  );
}

function CreateUserForm() {
  // Built-in mutation builder
  const { mutationFn } = http.mutation({
    key: "createUser",
    url: "/users",
    method: "POST",
  });

  const { mutate } = useMutation({ mutationFn });

  return (
    <button onClick={() => mutate({ name: "Alice" })}>
      Create User
    </button>
  );
}
```

---

## Realtime Sockets

### Socket.io Integration

```typescript
import { createRealtimeClient } from "rhttp.io/socket.io";

const socket = createRealtimeClient({
  url: process.env.SOCKET_URL || "http://localhost:3000",
  auth: {
    token: localStorage.getItem("access_token"),
  },
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
});

// Events
socket.on("connect", () => console.log("Connected"));
socket.on("disconnect", () => console.log("Disconnected"));

// Room management
socket.join("orders");
socket.on("order:created", (data) => {
  console.log("New order:", data);
});

// Send events
socket.emit("order:subscribe", { orderId: "123" });
```

---

## Performance Best Practices

### 1. Use Caching Strategically

```typescript
// Static/slowly changing data
cache: { strategy: "cache-first", ttl: 3600000 }

// Real-time data
cache: { strategy: "network-first", ttl: 30000 }

// Background updates
cache: { strategy: "stale-while-revalidate", ttl: 300000 }
```

### 2. Implement Circuit Breaker

```typescript
circuitBreaker: {
  enabled: true,
  failureThreshold: 5,
  timeout: 60000,
}
```

### 3. Use Request Pooling

```typescript
requestPool: {
  enabled: true,
  maxConcurrent: 5,
}
```

### 4. Enable Rate Limiting

```typescript
// For external APIs with rate limits
const limiter = new RateLimiter({
  tokensPerSecond: 100,
  maxBurst: 150,
});
```

### 5. Monitor Performance

```typescript
observability: {
  logger: process.env.NODE_ENV === "development",
  tracing: true,
  metrics: true,
}
```

### 6. Batch Related Requests

```typescript
const [users, posts, comments] = await http.batchRequests([
  () => http.get("/users"),
  () => http.get("/posts"),
  () => http.get("/comments"),
]);
```

### 7. Deduplication for Concurrent Requests

```typescript
// Prevent duplicate concurrent requests
const response = await http.get("/users", { deduplicate: true });
```

---

## Troubleshooting

### Circuit Breaker Too Aggressive

**Problem:** Circuit breaker opens too quickly

**Solution:** Adjust thresholds
```typescript
circuitBreaker: {
  failureThreshold: 10,    // Increase threshold
  timeout: 120000,          // Longer recovery time
}
```

### Rate Limiting Blocking Requests

**Problem:** Legitimate requests are blocked

**Solution:** Increase token rate
```typescript
const limiter = new RateLimiter({
  tokensPerSecond: 200,     // Increase rate
  maxBurst: 300,
});
```

### Cache Not Invalidating

**Problem:** Stale data being served

**Solution:** Use network-first strategy for mutable data
```typescript
cache: { strategy: "network-first", ttl: 30000 }
```

### CSRF Token Errors

**Problem:** CSRF protection failing

**Solution:** Verify configuration
```typescript
csrf: {
  enabled: true,
  fetchEndpoint: "/api/csrf",    // Check endpoint
  cookieName: "csrf-token",
  headerName: "X-CSRF-Token",
}
```

### Server Cookie Forwarding Not Working

**Problem:** Cookies not forwarded on server

**Solution:** Ensure proper configuration
```typescript
const http = createServerHttp({
  auth: { forwardCookies: true },  // Enable
  requestContext: () => getRequest(),  // Provide context
});
```

---

## Examples

### Complete Production Setup

```typescript
import { createHttp } from "rhttp.io";
import { createRefreshAuthInterceptor } from "rhttp.io";

const http = createHttp({
  baseURL: process.env.API_URL,
  timeout: 30_000,

  // Resilience
  retry: {
    attempts: 3,
    strategy: "exponential",
    statusCodes: [408, 429, 500, 502, 503, 504],
  },
  
  circuitBreaker: {
    enabled: true,
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 60000,
  },

  requestPool: {
    enabled: true,
    maxConcurrent: 5,
  },

  // Caching
  cache: {
    enabled: true,
    ttl: 60000,
    strategy: "network-first",
  },

  // Security
  csrf: { enabled: true, prefetch: true },
  auth: {
    scheme: "Bearer",
    getToken: () => localStorage.getItem("token"),
  },

  // Observability
  observability: {
    logger: true,
    tracing: true,
    metrics: true,
  },
});

// Token refresh
http.interceptors.response.use(
  (res) => res,
  createRefreshAuthInterceptor(http, {
    refreshToken: async () => {
      const res = await fetch("/auth/refresh", {
        method: "POST",
        credentials: "include",
      });
      const { token } = await res.json();
      return token;
    },
  })
);

// Error handling
http.interceptors.response.use(
  (res) => res,
  (error) => {
    console.error(`Error: ${error.status} ${error.url}`);
    throw error;
  }
);

export default http;
```

---

## API Compatibility

- ✅ Browsers (all modern versions)
- ✅ Node.js 16+
- ✅ Edge Runtimes (Vercel, Cloudflare)
- ✅ Deno
- ✅ Bun

## License

MIT - See LICENSE file for details
