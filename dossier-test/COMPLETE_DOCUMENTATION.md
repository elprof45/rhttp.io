# rhttp.io - Complete Documentation

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
yarn add rhttp.io
# or
bun add rhttp.io
```

### Entry Points

```typescript
// Core isomorphic client (universal, browsers + Node.js + Edge)
import { createHttp } from "rhttp.io";

// Browser-optimized client (CSRF prefetch, localStorage)
import { createClientHttp } from "rhttp.io/client";

// Server-optimized client (cookie forwarding, structured logging)
import { createServerHttp } from "rhttp.io/server";

// React + TanStack Query integration
import { withReact } from "rhttp.io/react";

// Realtime Socket.io client
import { createRealtimeClient } from "rhttp.io/socket.io";

// Error classes
import { HttpError, TimeoutError, NetworkError } from "rhttp.io";
```

---

## Quick Start

### Basic GET Request

```typescript
import { createHttp } from "rhttp.io";

const http = createHttp({
  baseURL: "https://api.example.com",
  timeout: 30_000,
});

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

const { data: newPost } = await http.post<CreatePostInput, CreatePostResponse>(
  "/posts",
  { title: "Hello", content: "World" }
);
```

### Error Handling

```typescript
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
  data: T;                    // Parsed response body
  status: number;             // HTTP status code
  statusText: string;         // HTTP status text (e.g., "OK")
  headers: Record<string, string>;  // Response headers
  response: Response;         // Native fetch Response object
  requestId: string;          // Unique request identifier
  durationMs: number;         // Request duration in milliseconds
}
```

### Creating an HTTP Client

```typescript
const http = createHttp({
  baseURL: "https://api.example.com",
  timeout: 30_000,
  
  // Default headers for all requests
  defaultHeaders: {
    "Accept": "application/json",
    "User-Agent": "MyApp/1.0",
  },

  // Cache configuration
  cache: {
    enabled: true,
    ttl: 60_000,  // 1 minute
  },

  // Retry configuration
  retry: {
    attempts: 3,
    strategy: "exponential",
    delay: 300,
    maxDelay: 30_000,
    statusCodes: [408, 429, 500, 502, 503, 504],
  },

  // Authentication
  auth: {
    accessToken: "your-jwt-token",
    scheme: "Bearer",
    forwardCookies: false,
  },

  // CSRF protection (browser)
  csrf: {
    enabled: true,
    fetchEndpoint: "/api/csrf",
    cookieName: "csrf-token",
    headerName: "X-CSRF-Token",
    methods: ["POST", "PUT", "PATCH", "DELETE"],
  },

  // Observability
  observability: {
    logger: true,
    tracing: true,
    metrics: true,
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

### Common Options

```typescript
interface HttpRequestOptions {
  // Query parameters
  params?: Record<string, any>;

  // Request headers
  headers?: Record<string, string>;

  // Cache override
  cache?: boolean | {
    enabled: boolean;
    ttl: number;
  };

  // Retry override
  retry?: boolean | {
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

// Clear all cache
http.clearCache();

// Invalidate specific URLs
http.invalidateCache("/items");
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
    interval: 5000,           // Poll every 5 seconds
    maxAttempts: 60,          // Maximum 60 polls
    stopCondition: (result) => result.data.status === "complete",
  },
});
```

### Request History

```typescript
const history = http.getHistory();
// Returns: Array of { requestId, url, method, status, durationMs, timestamp }

history.forEach((entry) => {
  console.log(`${entry.method} ${entry.url} - ${entry.status} (${entry.durationMs}ms)`);
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
console.log(`Avg duration: ${metrics.durations.reduce((a,b) => a+b) / metrics.durations.length}ms`);
```

---

## Error Handling

### HttpError

The main error class for HTTP errors:

```typescript
try {
  await http.get("/endpoint");
} catch (error) {
  if (error instanceof HttpError) {
    console.log(error.status);        // 404
    console.log(error.statusText);    // "Not Found"
    console.log(error.data);          // Error response body
    console.log(error.headers);       // Response headers
    console.log(error.requestId);     // Unique request ID
    console.log(error.durationMs);    // Request duration
    console.log(error.url);           // Request URL
  }
}
```

### TimeoutError

Thrown when request exceeds timeout:

```typescript
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
try {
  await http.get("/endpoint");
} catch (error) {
  if (error instanceof NetworkError) {
    console.log(error.originalError);  // Underlying error
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
  }
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
  }
);
```

### Response Interceptor

```typescript
http.interceptors.response.use(
  async (response) => {
    console.log("After response:", response.status);
    // Transform response
    if (response.data?.meta) {
      response.data = response.data.data;  // Unwrap
    }
    return response;
  },
  async (error) => {
    console.error("Response error:", error);
    // Handle specific errors
    throw error;
  }
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
    ttl: 60_000,  // 1 minute
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
    ttl: 120_000,  // 2 minutes
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
    accessToken: "my-jwt-token",
    scheme: "Bearer",  // or "Basic", "ApiKey"
    forwardCookies: false,
  },
});

// Token is automatically injected
await http.get("/protected");  // Authorization: Bearer my-jwt-token
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

### Token Refresh

```typescript
const http = createHttp({
  baseURL: "https://api.example.com",
});

// Create refresh interceptor
const refreshInterceptor = createRefreshAuthInterceptor(http, {
  refreshToken: async () => {
    const response = await fetch("/auth/refresh", { method: "POST" });
    const data = await response.json();
    return data.accessToken;
  },
  onTokenRefreshed: async (newToken) => {
    // Update token in your store/context
    await localStorage.setItem("auth_token", newToken);
  },
  statusCodes: [401],  // Refresh on 401
});

// Add to interceptors
http.interceptors.response.use(
  (response) => response,
  refreshInterceptor
);
```

### Cookie Forwarding (SSR)

```typescript
const http = createServerHttp({
  auth: {
    forwardCookies: true,  // Forward incoming request cookies
  },
});

// In TanStack Start
export const fetchProtectedData = createServerFn({ method: "GET" }).handler(
  async ({ request }) => {
    // Cookies from request are automatically forwarded
    return http.withRequest(request, async () => {
      return http.get("/protected-data");
    });
  }
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
    prefetch: true,  // Fetch token on load
  },
});

// Token is automatically injected on mutations
await http.post("/items", { name: "test" });  // CSRF token auto-injected
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
    attempts: 3,                          // Retry up to 3 times
    strategy: "exponential",              // exponential | linear | none
    delay: 300,                           // Initial delay (ms)
    maxDelay: 30_000,                     // Max delay between retries (ms)
    statusCodes: [408, 429, 500, 502, 503, 504],  // Retryable status codes
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

## Socket.io Realtime

### Setup

```typescript
import { createRealtimeClient } from "rhttp.io/socket.io";
import { RealtimeProvider, useSocketClient } from "rhttp.io/socket.io";

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
      <button onClick={() => sendMessage("Hello")}>Send</button>
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
  const { data } = await http.post<{ name: string }, Item>(
    "/items",
    { name }
  );
  http.invalidateCache("/items");  // Refresh list
  return data;
}

// Update
async function updateItem(id: string, updates: Partial<Item>) {
  const { data } = await http.put<Partial<Item>, Item>(
    `/items/${id}`,
    updates
  );
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
      timeout: 60_000,  // Longer timeout for large files
    }
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

  const blob = response.data;  // Response is already Blob
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}
```

---

## Troubleshooting

### Request Hangs

**Problem**: Request never completes.

**Solution**: Set timeout.

```typescript
const http = createHttp({
  timeout: 30_000,  // 30 seconds
});

await http.get("/endpoint", { timeout: 10_000 });  // Override
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
    ttl: 60_000,  // Auto-expire after 1 minute
  },
});

// Periodic cleanup
setInterval(() => {
  http.clearCache();
}, 600_000);  // Every 10 minutes
```

### Circuit Breaker Open

**Problem**: "Circuit breaker is OPEN - request blocked".

**Solution**: Check backend health, reset breaker.

```typescript
const status = http.getCircuitBreakerStatus();
console.log(status.state);  // "open" | "closed" | "half-open"

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
        throw error;  // Give up
      }
      // Try refresh
      const newToken = await refreshToken();
      error.options._retry = true;
      return http.customFetch(error.url, error.options);
    }
    throw error;
  }
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

## License

MIT

---

## Support

For issues, questions, or feature requests, visit:
- GitHub: https://github.com/elprof45/rhttp.io
- Issues: https://github.com/elprof45/rhttp.io/issues
- Discussions: https://github.com/elprof45/rhttp.io/discussions
