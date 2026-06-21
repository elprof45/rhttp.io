# rhttp.io — Complete Documentation

Universal HTTP client for modern applications: caching, retries, circuit breaker, JWT, CSRF, Socket.IO, and isomorphic execution across browsers, Node.js, and Edge runtimes.

> This documentation has been rewritten for clarity, consistency, and pedagogy while preserving the original structure and feature set.

---

## Demo

Insert a demo GIF or a live demo link here.

![Logo](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/th5xamgrr6se0x5ro4g6.png)

---

## ✨ Features

- **🌍 Fully Isomorphic** — Works in browsers, Node.js, and Edge runtimes such as Vercel and Cloudflare.
- **🔒 Security** — Built-in CSRF protection, JWT/OAuth support, automatic token refresh, and secure cookie handling.
- **⚡ Performance** — Intelligent caching, automatic request deduplication, and configurable retry logic.
- **🎯 Type-Safe** — Full TypeScript support with strong type inference.
- **🔄 Retry & Timeout** — Exponential backoff, configurable retry status codes, and request timeouts.
- **📊 Observability** — Built-in logging, request tracing, metrics collection, and history tracking.
- **🪝 Interceptors** — Request and response interceptors for cross-cutting concerns.
- **✅ Validation** — Request validation, response validation, and data transformers.
- **⚙️ SSR-Ready** — Cookie forwarding and request context binding for TanStack Start and similar frameworks.
- **📦 React Integration** — Seamless builders for TanStack Query and React applications.
- **🔌 Realtime** — Socket.IO client with logging, validation, transformations, lifecycle hooks, room handling, and offline queue support.

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
14. [Monitoring & Observability](#monitoring--observability)
15. [React Integration](#react-integration)
16. [Socket.IO Realtime](#socketio-realtime)
17. [Extensions](#extensions)
18. [Examples](#examples)
19. [Troubleshooting](#troubleshooting)
20. [Best Practices](#best-practices)
21. [Migration Guide](#migration-guide)
22. [License](#license)
23. [Contributing](#contributing)
24. [Support](#support)

---

## Installation

Install the package with your preferred package manager:

```bash
npm install rhttp.io
# or
bun add rhttp.io
# or
yarn add rhttp.io
```

### Entry Points

Use the entry point that matches your runtime or integration layer:

```typescript
// Core isomorphic client: browsers + Node.js + Edge
import { createHttp } from "rhttp.io";

// Browser-optimized client: CSRF prefetch, browser-oriented behavior
import { createClientHttp } from "rhttp.io/client";

// Server-optimized client: cookie forwarding, structured logging
import { createServerHttp } from "rhttp.io/server";

// React + TanStack Query integration
import { withReact } from "rhttp.io/react";

// Realtime Socket.IO client
import { createRealtimeClient } from "rhttp.io/socket.io.client";

// Error classes
import { HttpError, TimeoutError, NetworkError } from "rhttp.io";
```

---

## Quick Start

### Basic Usage

```typescript
import { createHttp } from "rhttp.io";

const http = createHttp({
  baseURL: "https://api.example.com",
  timeout: 30_000,
});

const { data: posts } = await http.get<Post[]>("/posts");
console.log(posts);
```

### POST with Typed Input and Output

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
  { title: "Hello", content: "World" },
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

Every successful request returns an `HttpResponse<T>` object:

```typescript
interface HttpResponse<T> {
  data: T;                   // Parsed response body
  status: number;            // HTTP status code
  statusText: string;        // HTTP status text
  headers: Record<string, string>; // Normalized response headers
  response: Response;        // Native fetch Response object
  requestId: string;         // Unique request identifier
  durationMs: number;        // Duration in milliseconds
}
```

### Creating an HTTP Client

`createHttp(config)` builds a reusable client instance.

```typescript
const http = createHttp({
  baseURL: "https://api.example.com",
  timeout: 30_000,
  defaultHeaders: {
    Accept: "application/json",
    "User-Agent": "MyApp/1.0",
  },

  cache: {
    enabled: true,
    ttl: 60_000,
    keyBuilder: (url, options) => `${url}:${JSON.stringify(options.params ?? {})}`,
  },

  retry: {
    attempts: 3,
    strategy: "exponential",
    delay: 300,
    maxDelay: 30_000,
    statusCodes: [408, 429, 500, 502, 503, 504],
    shouldRetry: async (error, attempt) => attempt <= 3,
  },

  auth: {
    forwardCookies: false,
    accessToken: "your-jwt-token",
    scheme: "Bearer",
    getToken: async () => "dynamic-token",
  },

  csrf: {
    enabled: true,
    fetchEndpoint: "/api/csrf",
    cookieName: "csrf-token",
    headerName: "X-CSRF-Token",
    methods: ["POST", "PUT", "PATCH", "DELETE"],
    prefetch: true,
  },

  observability: {
    logger: true,
    tracing: true,
    metrics: true,
  },

  circuitBreaker: {
    enabled: true,
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 60_000,
  },

  requestPool: {
    enabled: true,
    maxConcurrent: 5,
  },

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

const typedResponse = await http.post<RequestBody, ResponseType>(
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
const response = await http.delete<T>(
  url: string,
  options?: HttpRequestOptions
): Promise<HttpResponse<T>>

const responseWithBody = await http.delete<ResponseType>(
  url: string,
  body: any,
  options?: HttpRequestOptions
): Promise<HttpResponse<ResponseType>>
```

#### customFetch

For fully customized requests:

```typescript
const response = await http.customFetch<T>(
  url: string,
  options?: HttpRequestOptions
): Promise<HttpResponse<T>>
```

### Common Options

```typescript
interface HttpRequestOptions {
  params?: Record<string, any>;
  headers?: Record<string, string>;

  cache?:
    | boolean
    | {
        enabled: boolean;
        ttl: number;
      };

  retry?:
    | boolean
    | {
        attempts: number;
        strategy: "none" | "linear" | "exponential";
        delay: number;
        maxDelay: number;
        statusCodes: number[];
      };

  timeout?: number;
  deduplicate?: boolean;
  csrf?: boolean;
  requestId?: string;
  transformer?: (data: any, response: HttpResponse<any>) => any;
  validateResponse?: (data: any) => boolean;
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

const response = await http.get("/items");
const freshData = await http.get("/items", { cache: false });

http.invalidateCache("/items");
http.clearCache();
```

### Cache Strategies

```typescript
await http.get("/items", { cache: { strategy: "cache-first" } });
await http.get("/items", { cache: { strategy: "network-first" } });
await http.get("/items", { cache: { strategy: "stale-while-revalidate" } });
await http.get("/items", { cache: { strategy: "cache-only" } });
await http.get("/items", { cache: { strategy: "network-only" } });
```

### Request Deduplication

```typescript
const [r1, r2, r3] = await Promise.all([
  http.get("/items", { deduplicate: true }),
  http.get("/items", { deduplicate: true }),
  http.get("/items", { deduplicate: true }),
]);
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
const response = await http.get("/items");
http.cancel(response.requestId);
http.cancel(); // cancel all active requests
```

### Polling

```typescript
await http.poll("/status", {
  polling: {
    interval: 5000,
    maxAttempts: 60,
    stopCondition: (result) => result.data.status === "complete",
  },
});
```

### Request History

```typescript
const history = http.getHistory();

history.forEach((entry) => {
  console.log(`${entry.method} ${entry.url} - ${entry.status} (${entry.durationMs}ms)`);
});
```

### Metrics Collection

```typescript
const metrics = http.getMetrics();
console.log(`Total: ${metrics.totalRequests}`);
console.log(`Success: ${metrics.successfulRequests}`);
console.log(`Failed: ${metrics.failedRequests}`);
console.log(
  `Avg duration: ${metrics.durations.reduce((a, b) => a + b, 0) / metrics.durations.length}ms`,
);
```

---

## Error Handling

### HttpError

```typescript
import { HttpError } from "rhttp.io";

try {
  await http.get("/endpoint");
} catch (error) {
  if (error instanceof HttpError) {
    console.log(error.status);
    console.log(error.statusText);
    console.log(error.data);
    console.log(error.headers);
    console.log(error.requestId);
    console.log(error.durationMs);
    console.log(error.url);
  }
}
```

### TimeoutError

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

```typescript
import { NetworkError } from "rhttp.io";

try {
  await http.get("/endpoint");
} catch (error) {
  if (error instanceof NetworkError) {
    console.log(error.originalError);
    console.log(error.message);
  }
}
```

### Custom Error Handler

```typescript
http.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error instanceof HttpError && error.status === 401) {
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
    console.log("After response:", response.status);

    analytics.track("api_call_success", {
      url: response.response.url,
      status: response.status,
      duration: response.durationMs,
    });

    if (response.data?.meta) {
      response.data = response.data.data;
    }

    return response;
  },
  async (error) => {
    console.error("Response error:", error);
    if (error instanceof HttpError && error.status === 401) {
      window.location.href = "/login";
    }
    throw error;
  },
);
```

### Ejecting Interceptors

```typescript
const handler = http.interceptors.request.use((config) => config);

handler.eject();
http.interceptors.request.clear();
```

### Multiple Interceptors

```typescript
http.interceptors.request.use(async (config) => {
  config.headers = { ...config.headers, "x-auth": "token" };
  return config;
});

http.interceptors.request.use(async (config) => {
  config.headers = { ...config.headers, "x-app": "myapp" };
  return config;
});
```

---

## Caching Strategies

### In-Depth Cache Configuration

```typescript
const http = createHttp({
  cache: {
    enabled: true,
    ttl: 60_000,
    keyBuilder: (url, options) => `${url}:${JSON.stringify(options.params ?? {})}`,
  },
});

await http.get("/items", {
  cache: {
    enabled: true,
    ttl: 120_000,
    keyBuilder: (url) => `custom-${url}`,
  },
});
```

### Cache Invalidation

```typescript
http.invalidateCache("/api/items");
http.clearCache();

http.interceptors.response.use(async (response) => {
  if (response.status === 201 || response.status === 204) {
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
    scheme: "Bearer",
    forwardCookies: false,
  },
});

await http.get("/protected");
```

### Dynamic Token

```typescript
const http = createHttp({
  auth: {
    getToken: async () => localStorage.getItem("auth_token"),
    scheme: "Bearer",
    forwardCookies: false,
  },
});
```

### Automatic JWT Refresh

```typescript
import { createHttp, createRefreshAuthInterceptor } from "rhttp.io";

const http = createHttp({
  baseURL: "https://api.example.com",
  auth: { accessToken: localStorage.getItem("access_token") || "" },
});

const refreshInterceptor = createRefreshAuthInterceptor(http, {
  refreshToken: async () => {
    const response = await fetch("/auth/refresh", { method: "POST" });
    const data = await response.json();
    return data.accessToken;
  },
  onTokenRefreshed: async (newToken) => {
    localStorage.setItem("auth_token", newToken);
  },
  statusCodes: [401],
});

http.interceptors.response.use((response) => response, refreshInterceptor);

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

### Cookie Forwarding for SSR

```typescript
import { createServerHttp } from "rhttp.io/server";
import { getRequest } from "@tanstack/react-start/server";

const http = createServerHttp({
  baseURL: process.env.API_URL,
  auth: {
    forwardCookies: true,
  },
  requestContext: () => getRequest(),
});

export const fetchProtectedData = createServerFn({ method: "GET" }).handler(
  async () => {
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
    prefetch: true,
  },
});

await http.post("/items", { name: "test" });
```

### Manual CSRF Token

```typescript
const http = createHttp({
  csrf: {
    enabled: true,
    fetchEndpoint: "/api/csrf",
  },
});

await http.post("/items", { name: "test" }, { csrf: false });
```

---

## Retry Logic

### Automatic Retry

```typescript
const http = createHttp({
  retry: {
    attempts: 3,
    strategy: "exponential",
    delay: 300,
    maxDelay: 30_000,
    statusCodes: [408, 429, 500, 502, 503, 504],
  },
});

await http.get("/items", {
  retry: {
    attempts: 5,
    strategy: "exponential",
    delay: 100,
  },
});

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
        if (error.status === 503) return attemptNumber < 3;

        if (error.status === 429) {
          const retryAfter = error.headers["retry-after"];
          if (retryAfter) {
            await sleep(parseInt(retryAfter, 10) * 1000);
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
// Delay formula:
// min(initialDelay * 2^attemptNumber, maxDelay)
//
// Example with delay=300 and maxDelay=30000:
// Attempt 1: 300ms
// Attempt 2: 600ms
// Attempt 3: 1200ms
// Attempt 4: 2400ms
// ...
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

await limiter.acquire(url, method, weight);
const response = await http.get(url);
```

### Integrate with the Client

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

const stats = profiler.getStats();
console.log(`Average request time: ${stats.averageDuration}ms`);

const profiles = profiler.getProfiles({ url: "/api" });
profiles.forEach((p) => {
  console.log(`${p.method} ${p.url}: ${p.duration}ms`);
});
```

---

## Monitoring & Observability

### Metrics Collection

```typescript
const http = createHttp({
  observability: {
    logger: true,
    tracing: true,
    metrics: true,
  },
});

const metrics = http.getMetrics();
```

### Request History

```typescript
const history = http.getHistory();

const userRequests = history.filter((r) => r.url.includes("/users"));
const slowRequests = history.filter((r) => r.durationMs > 1000);
const entry = history.find((r) => r.requestId === "abc-123");
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

## React Integration

### TanStack Query Builder

```typescript
import { withReact } from "rhttp.io/react";
import { useQuery, useMutation } from "@tanstack/react-query";

const http = withReact(
  createHttp({
    baseURL: "https://api.example.com",
  }),
);

function Posts() {
  const { data, isLoading } = useQuery({
    ...http.query<Post[]>({
      url: "/posts",
      params: { page: 1 },
      cache: true,
    }),
  });

  return <div>{data?.map((post) => <div key={post.id}>{post.title}</div>)}</div>;
}

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

## Socket.IO Realtime

### Basic Usage

```typescript
import { createRealtimeClient } from "rhttp.io/socket.io.client";

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

```typescript
const realtimeClient = createRealtimeClient({
  socketUrl: "https://ws.example.com",
  logger: true,
});

const realtimeClientWithLogger = createRealtimeClient({
  socketUrl: "https://ws.example.com",
  logger: {
    debug: (...args) => myLogger.debug(...args),
    info: (...args) => myLogger.info(...args),
    warn: (...args) => myLogger.warn(...args),
    error: (...args) => myLogger.error(...args),
  },
});
```

### Event Validation and Transformation

```typescript
const realtimeClient = createRealtimeClient({
  socketUrl: "https://ws.example.com",

  eventValidator: (event, data, direction) => {
    if (direction === "emit" && event === "message") {
      return typeof data.text === "string" && data.text.length > 0;
    }

    if (direction === "receive" && event === "notification") {
      return data.type !== undefined;
    }

    return true;
  },

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

### Rooms and Offline Queue

```typescript
const realtimeClient = createRealtimeClient({
  socketUrl: "https://ws.example.com",
  rooms: { autoRejoin: true },
  offlineQueue: { enabled: true, maxSize: 100 },
});

await realtimeClient.joinRoom("chat:general");
await realtimeClient.joinRoom("notifications");

realtimeClient.emit("message", { text: "Hello" });

console.log(realtimeClient.getRooms());
console.log(realtimeClient.getQueueLength());
```

### Provider Setup

```typescript
import { createRealtimeClient } from "rhttp.io/socket.io.client";
import { RealtimeProvider, useSocketClient } from "rhttp.io/socket.io.client";

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
      <p>Status: {connected ? "Connected" : "Disconnected"}</p>
      <button onClick={() => sendMessage("Hello")}>Send</button>
    </div>
  );
}
```

---

## Extensions

### GraphQL Support

```typescript
import { withGraphQL } from "rhttp.io/extensions";

const graphql = withGraphQL(http, "/graphql");

const { data: posts } = await graphql.query<{ posts: Post[] }>({
  query: `query { posts { id title } }`,
});

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

const httpWithSchema = withSchemaValidation(
  createHttp({
    baseURL: "https://api.example.com",
  }),
);

const { data: user } = await httpWithSchema.get("/user", {
  schema: UserSchema,
});
```

### Request Compression

```typescript
import { createCompressionMiddleware } from "rhttp.io/extensions";

const compression = createCompressionMiddleware({
  enabled: true,
  algorithm: "gzip",
  threshold: 1024,
  level: 6,
});

http.use(compression);
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

async function getItems() {
  const { data } = await http.get<Item[]>("/items");
  return data;
}

async function createItem(name: string) {
  const { data } = await http.post<{ name: string }, Item>("/items", { name });
  http.invalidateCache("/items");
  return data;
}

async function updateItem(id: string, updates: Partial<Item>) {
  const { data } = await http.put<Partial<Item>, Item>(`/items/${id}`, updates);
  http.invalidateCache("/items");
  return data;
}

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
      timeout: 60_000,
    },
  );

  return data.url;
}
```

### Streaming Response / File Download

```typescript
async function downloadFile(filename: string) {
  const response = await http.customFetch<Blob>(`/files/${filename}`, {
    method: "GET",
  });

  const blob = response.data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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
  timeout: 60_000,
});

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
console.log(status.state); // "closed" | "open" | "half-open"
console.log(status.failures);
console.log(status.rejectedCount);
console.log(status.timeUntilHalfOpen);

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
    logger: true,
    tracing: true,
    metrics: true,
  },
});

const metrics = http.getMetrics();
console.log(metrics);
```

### Request History

```typescript
const history = http.getHistory();
const userRequests = history.filter((req) => req.url.includes("/users"));
const slow = history.filter((req) => req.durationMs > 1000);
const entry = history.find((req) => req.requestId === "abc-123");
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

## Troubleshooting

### Request Hangs

**Problem:** Request never completes.

**Solution:** Set a timeout.

```typescript
const http = createHttp({
  timeout: 30_000,
});

await http.get("/endpoint", { timeout: 10_000 });
```

### CORS Errors

**Problem:** `Access to XMLHttpRequest has been blocked by CORS policy`.

**Solution:** Configure CORS headers on the server.

```typescript
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "https://example.com");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});
```

### Memory Leaks

**Problem:** Cache grows without bounds.

**Solution:** Set TTL and clean up periodically.

```typescript
const http = createHttp({
  cache: {
    enabled: true,
    ttl: 60_000,
  },
});

setInterval(() => {
  http.clearCache();
}, 600_000);
```

### Circuit Breaker Open

**Problem:** `Circuit breaker is OPEN - request blocked`.

**Solution:** Check backend health and reset the breaker if needed.

```typescript
const status = http.getCircuitBreakerStatus();
console.log(status.state);

if (status.state === "open") {
  http.resetCircuitBreaker();
}
```

### 401 Unauthorized Loop

**Problem:** Token refresh triggers an infinite 401 loop.

**Solution:** Ensure the refresh endpoint works independently and guard retries.

```typescript
http.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error instanceof HttpError && error.status === 401) {
      if (error.options?._retry) {
        throw error;
      }

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

1. **Set reasonable timeouts** to avoid hanging requests.
2. **Use cache strategies carefully** to reduce unnecessary network calls.
3. **Handle errors explicitly** and distinguish timeout, network, and HTTP failures.
4. **Monitor metrics** in production.
5. **Use retry logic responsibly** to avoid retry storms.
6. **Attach request IDs** for debugging and tracing.
7. **Validate responses** as early as possible.
8. **Clean up resources** by canceling requests and clearing cache when needed.
9. **Test failure paths**, not only success paths.
10. **Document the API contract** so frontend and backend stay aligned.

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
```

### Benefits

- Automatic JSON parsing
- Built-in error handling
- Retry logic
- Caching
- Type safety

---

## License

MIT

---

## Contributing

Contributions are welcome. Please submit a pull request with clear explanations and examples when possible.

---

## Support

For issues, questions, or feature requests:

- GitHub: https://github.com/elprof45/rhttp.io
- Issues: https://github.com/elprof45/rhttp.io/issues
- Discussions: https://github.com/elprof45/rhttp.io/discussions
