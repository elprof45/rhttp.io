# rhttp.io — Production-Ready Universal HTTP Client

[![npm version](https://img.shields.io/npm/v/rhttp.io)](https://www.npmjs.com/package/rhttp.io)
[![npm downloads](https://img.shields.io/npm/dm/rhttp.io)](https://www.npmjs.com/package/rhttp.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

A fully-typed, production-ready HTTP client built on the native Fetch API. Works seamlessly in **browsers**, **Node.js**, and **Edge Runtimes** (Vercel, Cloudflare, Deno).

## ⚡ Key Features

- **🌍 Isomorphic** — Runs everywhere: browsers, Node.js, Edge Runtimes
- **🔒 Security** — CSRF protection, JWT refresh, OAuth support, secure cookies
- **⚡ Performance** — Smart caching (5 strategies), deduplication, circuit breaker
- **🎯 Type-Safe** — Full TypeScript support with perfect inference
- **🔄 Resilient** — Exponential backoff retry, timeout handling, rate limiting
- **📊 Observable** — Request tracing, metrics, structured logging
- **🪝 Extensible** — Interceptors, middleware, plugins
- **✅ Validation** — Request/response validation, schema checking
- **⚙️ SSR-Ready** — Cookie forwarding, request context for Next.js/TanStack Start
- **📦 React** — TanStack Query builder, hooks
- **🔌 Realtime** — Socket.io client with offline queue

## 📦 Installation

```bash
npm install rhttp.io
yarn add rhttp.io
bun add rhttp.io
```

## 🚀 Quick Start

### Basic Usage

```typescript
import { createHttp } from "rhttp.io";

const http = createHttp({
  baseURL: "https://api.example.com",
  timeout: 30_000,
});

// GET
const { data: posts } = await http.get<Post[]>("/posts");

// POST
const { data: newPost } = await http.post<Post>("/posts", {
  title: "Hello",
  content: "World",
});

// PUT
await http.put(`/posts/${newPost.id}`, { title: "Updated" });

// DELETE
await http.delete(`/posts/${newPost.id}`);
```

### Error Handling

```typescript
import { HttpError, TimeoutError, NetworkError } from "rhttp.io";

try {
  await http.get("/api/data");
} catch (error) {
  if (error instanceof HttpError) {
    console.error(`HTTP ${error.status}: ${error.statusText}`);
    console.error("Response:", error.data);
  } else if (error instanceof TimeoutError) {
    console.error("Request timeout");
  } else if (error instanceof NetworkError) {
    console.error("Network error:", error.message);
  }
}
```

## 🔧 Configuration

### Full Configuration Example

```typescript
const http = createHttp({
  // Base URL
  baseURL: "https://api.example.com",

  // Default headers
  defaultHeaders: {
    "Accept": "application/json",
  },

  // Request timeout
  timeout: 30_000,

  // Caching strategy
  cache: {
    enabled: true,
    ttl: 60_000,  // 1 minute
  },

  // Automatic retry
  retry: {
    attempts: 3,
    strategy: "exponential",
    delay: 300,
    maxDelay: 30_000,
    statusCodes: [408, 429, 500, 502, 503, 504],
  },

  // Authentication
  auth: {
    accessToken: "jwt-token",
    scheme: "Bearer",
    forwardCookies: false,
  },

  // CSRF protection
  csrf: {
    enabled: true,
    fetchEndpoint: "/api/csrf",
    cookieName: "csrf-token",
    headerName: "X-CSRF-Token",
    methods: ["POST", "PUT", "PATCH", "DELETE"],
    prefetch: true,
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

  // Observability
  observability: {
    logger: true,        // or custom logger
    tracing: true,
    metrics: true,
  },
});
```

## 📚 Advanced Usage

### Caching Strategies

```typescript
// 1. Cache-first (use cache, fallback to network)
const { data } = await http.get("/items", {
  cache: { strategy: "cache-first" },
});

// 2. Network-first (fetch network, fallback to cache)
const { data } = await http.get("/items", {
  cache: { strategy: "network-first" },
});

// 3. Stale-while-revalidate (return stale, update background)
const { data } = await http.get("/items", {
  cache: { strategy: "stale-while-revalidate" },
});

// Clear cache
http.clearCache();
http.invalidateCache("/items");
```

### Request Deduplication

```typescript
// Prevent concurrent duplicate requests
const [r1, r2, r3] = await Promise.all([
  http.get("/items", { deduplicate: true }),
  http.get("/items", { deduplicate: true }),
  http.get("/items", { deduplicate: true }),
]);
// Only 1 request made, 3 responses returned
```

### Interceptors

```typescript
// Add request interceptor
http.interceptors.request.use(async (config) => {
  config.headers = {
    ...config.headers,
    "x-timestamp": new Date().toISOString(),
  };
  return config;
});

// Add response interceptor
http.interceptors.response.use(
  async (response) => response,
  async (error) => {
    if (error.status === 401) {
      // Handle unauthorized
    }
    throw error;
  }
);
```

### Batch Requests

```typescript
const [posts, users, comments] = await http.batchRequests([
  () => http.get<Post[]>("/posts"),
  () => http.get<User[]>("/users"),
  () => http.get<Comment[]>("/comments"),
]);
```

### Request Polling

```typescript
const response = await http.poll("/status", {
  polling: {
    interval: 5000,
    maxAttempts: 60,
    stopCondition: (result) => result.data.status === "complete",
  },
});
```

### Token Refresh

```typescript
import { createRefreshAuthInterceptor } from "rhttp.io";

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

http.interceptors.response.use(
  (r) => r,
  refreshInterceptor
);
```

## 🎯 Entry Points

### Core (Isomorphic)
```typescript
import { createHttp } from "rhttp.io";

const http = createHttp({/* config */});
```

### Browser Optimized
```typescript
import { createClientHttp } from "rhttp.io/client";

const http = createClientHttp({/* config */});
// Auto-enables: CSRF prefetch, localStorage, client-side logging
```

### Server Optimized
```typescript
import { createServerHttp } from "rhttp.io/server";

const http = createServerHttp({/* config */});
// Auto-enables: cookie forwarding, structured logging, metrics
```

### React Integration
```typescript
import { withReact } from "rhttp.io/react";
import { useQuery, useMutation } from "@tanstack/react-query";

const http = withReact(createHttp({/* config */}));

// Use with TanStack Query
useQuery({
  ...http.query<Post[]>({
    url: "/posts",
    cache: true,
  }),
});
```

### Realtime Socket.io
```typescript
import { createRealtimeClient, RealtimeProvider, useSocketClient } from "rhttp.io/socket.io";

const client = createRealtimeClient({
  url: "https://api.example.com",
  auth: { token: "jwt" },
});

// In React
<RealtimeProvider client={client}>
  <YourApp />
</RealtimeProvider>
```

## 🔐 Security Features

### CSRF Protection
```typescript
const http = createClientHttp({
  csrf: {
    enabled: true,
    fetchEndpoint: "/api/csrf",
    prefetch: true,  // Fetch on init
  },
});

// Token is auto-injected on mutations
await http.post("/items", data);  // ✓ CSRF protected
```

### JWT with Refresh
```typescript
const http = createHttp({
  auth: {
    getToken: async () => localStorage.getItem("token"),
    scheme: "Bearer",
  },
});

// Handle 401 with auto-refresh
http.interceptors.response.use(
  (r) => r,
  createRefreshAuthInterceptor(http, {
    refreshToken: () => fetch("/auth/refresh").then(r => r.json()).then(d => d.token),
  })
);
```

### Cookie Forwarding (SSR)
```typescript
const http = createServerHttp({
  auth: { forwardCookies: true },
});

// Cookies automatically forwarded in TanStack Start
export const getData = createServerFn().handler(async ({ request }) => {
  return http.withRequest(request, () => http.get("/data"));
});
```

## 📊 Observability

### Metrics
```typescript
const http = createHttp({
  observability: { metrics: true },
});

// ... make requests ...

const metrics = http.getMetrics();
console.log({
  total: metrics.totalRequests,
  success: metrics.successfulRequests,
  failed: metrics.failedRequests,
  avgDuration: metrics.durations.reduce((a,b) => a+b) / metrics.durations.length,
});
```

### Request History
```typescript
const history = http.getHistory();
history.forEach(entry => {
  console.log(`${entry.method} ${entry.url} - ${entry.status} (${entry.durationMs}ms)`);
});
```

### Structured Logging
```typescript
const http = createHttp({
  observability: {
    logger: {
      debug: (msg, ctx) => console.log("[DEBUG]", msg, ctx),
      info: (msg, ctx) => console.log("[INFO]", msg, ctx),
      warn: (msg, ctx) => console.warn("[WARN]", msg, ctx),
      error: (msg, ctx) => console.error("[ERROR]", msg, ctx),
    },
  },
});
```

## 🔌 Extensions

### Rate Limiting
```typescript
import { RateLimiter } from "rhttp.io/features";

const limiter = new RateLimiter({
  tokensPerSecond: 10,
  maxBurst: 50,
});

http.interceptors.request.use(async (config) => {
  await limiter.acquire(config.url, config.method);
  return config;
});
```

### Request Profiling
```typescript
import { RequestProfiler } from "rhttp.io/features";

const profiler = new RequestProfiler();

const stats = profiler.getStats();
console.log(`Avg duration: ${stats.averageDuration}ms`);
```

### GraphQL Support
```typescript
import { withGraphQL } from "rhttp.io/extensions";

const graphql = withGraphQL(http, "/graphql");

const posts = await graphql.query<{ posts: Post[] }>({
  query: `query { posts { id title } }`,
});
```

### Schema Validation
```typescript
import { withSchemaValidation } from "rhttp.io/extensions";
import { z } from "zod";

const http = withSchemaValidation(createHttp({/* ... */}));

const PostSchema = z.object({ id: z.string(), title: z.string() });

const { data: posts } = await http.get("/posts", {
  schema: z.array(PostSchema),
});
// posts is guaranteed to match schema
```

## 💡 Examples

### Real-World CRUD App
```typescript
interface Item { id: string; name: string; }

const http = createHttp({
  baseURL: "https://api.example.com",
  cache: { enabled: true, ttl: 60_000 },
  retry: { attempts: 3, strategy: "exponential" },
});

// List
async function getItems() {
  const { data } = await http.get<Item[]>("/items");
  return data;
}

// Create
async function createItem(name: string) {
  const { data } = await http.post<Item>("/items", { name });
  http.invalidateCache("/items");
  return data;
}

// Update
async function updateItem(id: string, updates: Partial<Item>) {
  const { data } = await http.put<Item>(`/items/${id}`, updates);
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

  const { data } = await http.post<{ url: string }>("/upload", formData, {
    timeout: 60_000,
  });

  return data.url;
}
```

### React Hooks
```typescript
import { useQuery, useMutation } from "@tanstack/react-query";
import { withReact } from "rhttp.io/react";

const http = withReact(createHttp({/* ... */}));

function Posts() {
  const { data: posts } = useQuery({
    ...http.query<Post[]>({
      url: "/posts",
      cache: true,
    }),
  });

  const createPost = useMutation({
    ...http.mutation<CreatePostInput, Post>({
      method: "POST",
      url: "/posts",
    }),
    onSuccess: () => {
      http.invalidateCache("/posts");
    },
  });

  return (
    <div>
      {posts?.map(p => <div key={p.id}>{p.title}</div>)}
      <button onClick={() => createPost.mutate({ title: "New Post" })}>
        Create
      </button>
    </div>
  );
}
```

## 🛣️ Roadmap

- [x] Core HTTP client
- [x] Caching strategies
- [x] Retry with backoff
- [x] CSRF protection
- [x] JWT refresh
- [x] Circuit breaker
- [ ] GraphQL client
- [ ] Schema validation
- [ ] Request compression
- [ ] WebSocket enhancement
- [ ] Request tracing integration

## 🤝 Contributing

Contributions welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

## 📄 License

MIT © 2024

## 🔗 Resources

- [Full Documentation](./COMPLETE_DOCUMENTATION.md)
- [API Reference](./src/types.ts)
- [Examples](./examples/)
- [GitHub](https://github.com/elprof45/rhttp.io)
- [npm Package](https://www.npmjs.com/package/rhttp.io)
