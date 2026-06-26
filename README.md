<div align="center">

<div align="center">
  <img src="https://raw.githubusercontent.com/elprof45/rhttp.io/refs/heads/main/public/assets/rhttp-cover.png" alt="rhttp.io cover" width="100%" />
  <br /><br />
  <!-- <img src="./public/assets/rhttp-logo.png" alt="rhttp.io logo" width="220" /> -->
</div>

# rhttp.io

### The HTTP Client for Modern Applications

**Type-safe • Secure • High Performance • Full-stack Ready  
 Universal HTTP client. Caching, retries, circuit breaker, JWT, CSRF, Socket.io.  
 Isomorphic for browsers, Node.js, Edge.  
 From Browser to Server, from REST to Realtime.**

  <br />

[![npm version](https://img.shields.io/npm/v/rhttp.io?color=blue&style=flat-square)](https://www.npmjs.com/package/rhttp.io)
[![license](https://img.shields.io/npm/l/rhttp.io?style=flat-square)](LICENSE)
[![typescript](https://img.shields.io/badge/TypeScript-Ready-blue?style=flat-square)](https://www.typescriptlang.org/)
[![node](https://img.shields.io/badge/Node-%3E%3D18-green?style=flat-square)](https://nodejs.org/)

</div>

rhttp.io exists to replace the pile of small libraries (Axios, a retry wrapper, a cache layer, a CSRF helper, a Socket.io wrapper) that most production apps end up assembling by hand. Instead of gluing those together yourself, you configure one client and get a consistent request pipeline everywhere your code runs: in the browser, on a Node.js server, or in an Edge function.

---

## ✨ Features at a Glance

| Category             | What you get                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 🌍 **Isomorphic**    | One API that works identically in browsers, Node.js, and Edge runtimes (Vercel, Cloudflare Workers)                       |
| 🔒 **Security**      | Built-in CSRF protection, JWT/OAuth support, automatic token refresh, secure cookie forwarding for SSR                    |
| ⚡ **Performance**   | Five cache strategies, automatic request deduplication, ETag support, smart retries with backoff                          |
| 🎯 **Type-safe**     | Full TypeScript inference on request bodies and response payloads                                                         |
| 🔄 **Resilience**    | Exponential/linear backoff, configurable retryable status codes, per-request timeouts, a circuit breaker, request pooling |
| 📊 **Observability** | Logging, distributed tracing headers, metrics collection, request history, request profiling                              |
| 🪝 **Extensibility** | Request/response interceptors, lifecycle hooks, and a plugin system for cross-cutting concerns                            |
| ✅ **Validation**    | Request gatekeeping, response shape validation, Zod schema validation, data transformers                                  |
| ⚙️ **SSR-ready**     | Cookie forwarding and request-context binding for TanStack Start, Next.js, and similar frameworks                         |
| 📦 **React**         | First-class TanStack Query integration for queries and mutations                                                          |
| 🔌 **Realtime**      | A Socket.io client with logging, event validation/transformation, lifecycle hooks, rooms, and an offline queue            |

---

## 1. Getting Started

### 1.1 Installation

```bash
npm install rhttp.io
# or
bun add rhttp.io
# or
yarn add rhttp.io
```

### 1.2 Choosing an Entry Point

rhttp.io ships several entry points instead of a single monolithic import. Pick the one that matches where your code runs — this keeps bundle size down and gives you environment-specific defaults for free.

| Import                                                                                     | Use it when...                                                                                                                 |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `import { createHttp } from "rhttp.io"`                                                    | You want the universal client. Safe default for shared/isomorphic code (e.g. code that runs on both server and client).        |
| `import { createClientHttp } from "rhttp.io/client"`                                       | You're writing browser-only code and want CSRF token prefetching, browser defaults, and built-in React/TanStack Query helpers. |
| `import { createServerHttp } from "rhttp.io/server"`                                       | You're writing server-only code (API routes, server functions) and want cookie forwarding and structured logging by default.   |
| `import { createReactHttp, withReact } from "rhttp.io/react"`                              | You want a React-first client, or to layer TanStack Query builders (`.query()`, `.mutation()`) on top of any existing client.  |
| `import { createRealtimeClient } from "rhttp.io/socket.io.client"`                         | You need a Socket.io connection, not request/response HTTP.                                                                    |
| `import { HttpError, TimeoutError, NetworkError } from "rhttp.io"`                         | You need the error classes for `instanceof` checks.                                                                            |
| `import { RateLimiter, RequestProfiler } from "rhttp.io/features"`                         | You want to use rate limiting or profiling as standalone utilities, outside the main client.                                   |
| `import { CircuitBreaker } from "rhttp.io/advanced"`                                       | You want to manage a circuit breaker manually instead of via the `circuitBreaker` config option.                               |
| `import {  withSchemaValidation, createCompressionMiddleware } from "rhttp.io/extensions"` | You need Zod validation, or compression layered on top of a client.                                                            |

### 1.3 Quick Start

#### A basic GET request

```typescript
import { createHttp } from "rhttp.io";

const http = createHttp({
  baseURL: "https://api.example.com",
  timeout: 30_000,
});

const { data: posts } = await http.get<Post[]>("/posts");
console.log(posts);
```

#### A typed POST request

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

Notice the two generic parameters on `post`: the first is the shape of the body you're sending, the second is the shape of the data you expect back. TypeScript will then check both ends for you.

#### React-ready combo client

```typescript
import { createClientHttp } from "rhttp.io/client";

const http = createClientHttp({
  baseURL: "https://api.example.com",
});

const usersQuery = http.query({
  url: "/users",
  staleTime: 30_000,
});

const createUser = http.mutation({
  method: "POST",
  url: "/users",
  invalidateQueries: ["users"],
});
```

If you prefer a dedicated React factory, `createReactHttp()` is also available from `rhttp.io/react` and offers the same helpers with a React-oriented entry point.

#### Basic error handling

```typescript
import { HttpError, TimeoutError, NetworkError } from "rhttp.io";

try {
  await http.get("/not-found");
} catch (error) {
  if (error instanceof HttpError) {
    console.error(`HTTP ${error.status}: ${error.statusText}`);
    console.error("Response data:", error.data);
  } else if (error instanceof TimeoutError) {
    console.error("Request timed out");
  } else if (error instanceof NetworkError) {
    console.error("Network error:", error.message);
  }
}
```

We cover all three error classes in depth in [Section 11](#11-error-handling).

### 1.4 A More Complete First Example

Once the basics feel familiar, here is a client configured the way most production apps actually use rhttp.io — combining a base URL, a timeout, caching, retries, and authentication in one place:

```typescript
import { createHttp } from "rhttp.io";

const http = createHttp({
  baseURL: "https://api.example.com",
  timeout: 15_000,
  cache: { enabled: true, ttl: 60_000 },
  retry: { attempts: 3, strategy: "exponential", delay: 300, maxDelay: 10_000 },
  auth: { accessToken: () => localStorage.getItem("access_token") ?? "" },
});

const { data: profile } = await http.get<UserProfile>("/me");
```

Every option you see above (`cache`, `retry`, `auth`, and the rest) is documented in full in [Section 3 — Configuration Reference](#3-configuration-reference). The rest of this guide walks through each subsystem one at a time.

---

## 2. Core Concepts

### 2.1 The `HttpResponse` Object

Every successful request — regardless of method — resolves to the same shape. Learning this once means you never have to look up "what does `.get()` return?" again.

```typescript
interface HttpResponse<T> {
  data: T; // Parsed response body
  status: number; // HTTP status code, e.g. 200
  statusText: string; // HTTP status text, e.g. "OK"
  headers: Record<string, string>; // Response headers
  response: Response; // The native fetch Response, for escape hatches
  requestId: string; // Unique ID for this request (for tracing/cancellation)
  durationMs: number; // How long the request took, end to end
}
```

`response` is your escape hatch: if rhttp.io's parsed `data` isn't enough (you need raw headers iteration, a `ReadableStream`, etc.), the underlying `fetch` `Response` is always there.

### 2.2 The `HttpRequestOptions` Object

This is the second argument (or third, for body-carrying methods) accepted by every request method. Anything you set here **overrides** the client-level configuration for that single request only.

```typescript
interface HttpRequestOptions {
  params?: Record<string, any>; // Query parameters
  headers?: Record<string, string>; // Request headers

  cache?:
    | boolean
    | {
        // Cache override for this request
        enabled?: boolean;
        ttl?: number;
        strategy?:
          | "cache-first"
          | "network-first"
          | "stale-while-revalidate"
          | "cache-only"
          | "network-only";
        keyBuilder?: (url: string, options: HttpRequestOptions) => string;
      };

  retry?:
    | boolean
    | {
        // Retry override for this request
        attempts: number;
        strategy: "none" | "linear" | "exponential";
        delay: number;
        maxDelay: number;
        statusCodes: number[];
        shouldRetry?: (
          error: unknown,
          attempt: number,
        ) => Promise<boolean> | boolean;
      };

  timeout?: number; // Timeout override (ms)
  deduplicate?: boolean; // Collapse concurrent identical requests into one
  csrf?: boolean; // Disable CSRF injection for this request
  requestId?: string; // Custom ID, useful for cancellation/tracing

  transformer?: (data: any, response: HttpResponse<any>) => any; // Post-process response data
  validateResponse?: (data: any) => boolean; // Reject responses that don't match

  polling?: Partial<PollingConfig>; // Only used by http.poll()
}
```

> ⚠️ **Boolean shorthand.** Most of these accept either a boolean or an object: `{ cache: false }` disables caching outright, while `{ cache: { ttl: 5000 } }` lets you tweak just one field without restating the rest of the client's cache config.

### 2.3 The Request Pipeline

Understanding the order in which rhttp.io processes a request will save you a lot of debugging time later, especially once you start combining interceptors, caching, retries, and the circuit breaker. Conceptually, a request travels through these stages, in this order:

```
1. Request interceptors run (can mutate config, or throw to abort)
2. requestValidator runs (can reject the request outright)
3. CSRF token is attached, if applicable
4. Cache is checked, according to the active strategy
5. Deduplication check (is an identical request already in flight?)
6. Circuit breaker check (is the target currently considered unhealthy?)
7. Request pool admission (is a concurrency slot available, or do we queue?)
8. The actual network call is made (via fetch)
9. On failure: retry logic decides whether to try again (back to step 6)
10. responseTransformer / per-request transformer run
11. validateResponse runs, if provided
12. Response interceptors run (can mutate the response, or normalize the error)
13. The promise resolves (or rejects) back to your code
```

Keep this order in mind: for example, a response interceptor can already see a _cached_ response (cache hits still flow through step 12), but it will never see a request that the circuit breaker rejected before step 8 — that error short-circuits straight to step 12 from the error path.

---

## 3. Configuration Reference

Everything below can be passed to `createHttp()` (and, where relevant, to `createClientHttp()` / `createServerHttp()`). Every field is optional — rhttp.io works with zero configuration, defaulting to no cache, no retries, and a native `fetch` call.

```typescript
const http = createHttp({
  // ── Basics ────────────────────────────────────────────────
  baseURL: "https://api.example.com",
  timeout: 30_000,
  defaultHeaders: {
    Accept: "application/json",
    "User-Agent": "MyApp/1.0",
  },

  // ── Caching ───────────────────────────────────────────────
  cache: {
    enabled: true,
    ttl: 60_000,
    strategy: "cache-first",
    keyBuilder: (url, opts) => `${url}:${JSON.stringify(opts.params)}`,
  },

  // ── ETag-based revalidation ───────────────────────────────
  etag: {
    enabled: true,
    storage: "memory", // or "localStorage"
  },

  // ── Retries ───────────────────────────────────────────────
  retry: {
    attempts: 3,
    strategy: "exponential",
    delay: 300,
    maxDelay: 30_000,
    statusCodes: [408, 429, 500, 502, 503, 504],
    shouldRetry: async (error, attempt) => attempt <= 3,
  },

  // ── CSRF protection (browser) ─────────────────────────────
  csrf: {
    enabled: true,
    fetchEndpoint: "/api/csrf",
    cookieName: "csrf-token",
    headerName: "X-CSRF-Token",
    methods: ["POST", "PUT", "PATCH", "DELETE"],
    prefetch: true,
  },

  // ── Observability ─────────────────────────────────────────
  observability: {
    logger: true,
    tracing: true,
    metrics: true,
  },

  // ── Resilience ────────────────────────────────────────────
  circuitBreaker: {
    enabled: true,
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 60_000,
  },
  requestPool: {
    enabled: true,
    maxConcurrent: 5,
    queueLimit: 100,
  },

  // ── Validation & transformation ───────────────────────────
  requestValidator: (url, options) => true,
  responseTransformer: (data, response) => data,

  // ── Lifecycle hooks ───────────────────────────────────────
  hooks: {
    onRequest: async (url, options) => {},
    onSuccess: async (response) => {},
    onError: async (error) => {},
    onFinally: async () => {},
  },

  // ── SSR context (TanStack Start, Next.js, etc.) ───────────
  requestContext: () => getRequest(),
});
```

### Field-by-Field Reference

| Option                | Type                         | Default          | Description                                                                                |
| --------------------- | ---------------------------- | ---------------- | ------------------------------------------------------------------------------------------ |
| `baseURL`             | `string`                     | `""`             | Prepended to every relative URL you pass to a request method.                              |
| `timeout`             | `number` (ms)                | `0` (no timeout) | Aborts the request and throws `TimeoutError` if exceeded.                                  |
| `defaultHeaders`      | `Record<string, string>`     | `{}`             | Merged into every outgoing request; per-request `headers` take priority on conflict.       |
| `cache`               | `CacheConfig`                | disabled         | See [Section 5](#5-caching).                                                               |
| `etag`                | `EtagConfig`                 | disabled         | See [5.5 ETag Support](#55-etag-support).                                                  |
| `retry`               | `RetryConfig`                | disabled         | See [Section 6.1](#61-retry-logic).                                                        |
| `auth`                | `AuthConfig`                 | none             | See [Section 7](#7-authentication).                                                        |
| `csrf`                | `CsrfConfig`                 | disabled         | See [Section 8](#8-csrf-protection).                                                       |
| `observability`       | `ObservabilityConfig`        | disabled         | See [Section 12](#12-observability).                                                       |
| `circuitBreaker`      | `CircuitBreakerConfig`       | disabled         | See [Section 6.2](#62-circuit-breaker).                                                    |
| `requestPool`         | `RequestPoolConfig`          | disabled         | See [Section 6.4](#64-request-pooling).                                                    |
| `requestValidator`    | `(url, options) => boolean`  | none             | See [Section 9.1](#91-request-validation).                                                 |
| `responseTransformer` | `(data, response) => any`    | none             | See [Section 9.3](#93-response-transformers).                                              |
| `hooks`               | `HooksConfig`                | none             | See [Section 10.2](#102-lifecycle-hooks).                                                  |
| `requestContext`      | `() => Request \| undefined` | none             | Used with `auth.forwardCookies` for SSR. See [Section 7.4](#74-cookie-based-sessions-ssr). |

---

## 4. API Reference

### 4.1 GET / POST / PUT / PATCH / DELETE

```typescript
http.get<T>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<T>>

http.post<T>(url: string, body?: any, options?: HttpRequestOptions): Promise<HttpResponse<T>>
http.post<Body, T>(url: string, body: Body, options?: HttpRequestOptions): Promise<HttpResponse<T>>

http.put<T>(url: string, body?: any, options?: HttpRequestOptions): Promise<HttpResponse<T>>
http.put<Body, T>(url: string, body: Body, options?: HttpRequestOptions): Promise<HttpResponse<T>>

http.patch<T>(url: string, body?: any, options?: HttpRequestOptions): Promise<HttpResponse<T>>

http.delete<T>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<T>>
http.delete<T>(url: string, body: any, options?: HttpRequestOptions): Promise<HttpResponse<T>>
```

All five behave consistently: the first generic is always the **response** type, except for `post`/`put`, where supplying two generics lets you type the **body** as well (`post<Body, T>`). If you only supply one generic, the body is treated as `any`.

```typescript
// GET with query parameters
const { data: items } = await http.get<Item[]>("/items", {
  params: { page: 1, limit: 20 },
});

// PATCH a single field
const { data: updated } = await http.patch<Partial<Item>, Item>(
  `/items/${id}`,
  { name: "Renamed" },
);

// DELETE that also expects a response body (e.g. a "soft delete" record)
const { data: archived } = await http.delete<Item>(`/items/${id}`, {
  reason: "duplicate",
});
```

### 4.2 `customFetch`

Use `customFetch` when you need full control — custom HTTP methods, streaming bodies, or anything that doesn't fit the convenience methods above. It still benefits from the full pipeline (interceptors, retry, cache, auth headers, etc.).

```typescript
const response = await http.customFetch<T>(
  url: string,
  options?: HttpRequestOptions & { method?: string; body?: any }
): Promise<HttpResponse<T>>
```

```typescript
// A streamed file download
const response = await http.customFetch<Blob>(`/files/${filename}`, {
  method: "GET",
});

const blob = response.data; // already a Blob
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = filename;
a.click();
URL.revokeObjectURL(url);
```

### 4.3 `batchRequests`

Fire several independent requests and await them together. Functionally similar to `Promise.all`, but lets rhttp.io apply pooling/concurrency limits across the whole batch.

```typescript
const [posts, users, comments] = await http.batchRequests([
  () => http.get<Post[]>("/posts"),
  () => http.get<User[]>("/users"),
  () => http.get<Comment[]>("/comments"),
]);
```

### 4.4 Request Cancellation

Every response carries a `requestId` you can use to cancel it later — useful for "abandon this search-as-you-type request" type UX.

```typescript
const response = await http.get("/items");
const { requestId } = response;

http.cancel(requestId); // cancel one specific request
http.cancel(); // cancel every active request
```

You can also assign your own ID up front, which is handy when you want to cancel a request you haven't awaited yet:

```typescript
const requestId = "search-query";
const promise = http.get("/search", { requestId, params: { q: "cats" } });

// User typed something new — abandon the previous search
http.cancel("search-query");
```

### 4.5 Polling

`http.poll()` repeatedly issues the same request until a condition is met, a maximum number of attempts is reached, or it's cancelled — useful for job-status endpoints, async task results, and similar "check back later" APIs.

```typescript
interface PollingConfig {
  interval: number; // Delay between polls (ms)
  maxAttempts: number; // Give up after this many polls
  stopCondition: (response: HttpResponse<any>) => boolean; // Return true to stop
}
```

```typescript
const { data } = await http.poll<JobStatus>("/jobs/123/status", {
  polling: {
    interval: 2_000,
    maxAttempts: 30, // 1 minute total at a 2s interval
    stopCondition: (response) => response.data.status === "completed",
  },
});
```

If `maxAttempts` is reached without `stopCondition` returning `true`, `poll()` rejects with the last received response attached, so you can inspect why it never completed.

---

## 5. Caching

### 5.1 Why Cache?

Caching avoids re-fetching data your app already has and still considers fresh. Used well, it makes an app feel instantaneous and cuts your backend's request volume; used carelessly, it serves stale data to users who expect to see their own changes. The five strategies below exist precisely so you can pick the right trade-off **per endpoint**, not just globally.

### 5.2 The Five Cache Strategies

| Strategy                 | Behavior                                                                                              | Good for                                                                                           |
| ------------------------ | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `cache-first`            | Use the cache if a fresh entry exists; otherwise hit the network and store the result.                | Data that rarely changes (e.g. countries list, app config).                                        |
| `network-first`          | Always try the network first; fall back to the cache only if the network call fails.                  | Data that should be fresh whenever possible, but tolerable stale during an outage.                 |
| `stale-while-revalidate` | Return the cached value immediately (even if stale), then refresh it in the background for next time. | Dashboards/feeds where instant paint matters more than perfect freshness.                          |
| `cache-only`             | Only ever read the cache; never hits the network. Throws/returns an error if nothing is cached.       | Offline-first views, or reading data you know was prefetched elsewhere.                            |
| `network-only`           | Never reads or writes the cache.                                                                      | Mutating reads, or any endpoint where caching would be actively wrong (e.g. a one-time-use token). |

```typescript
const http = createHttp({
  cache: { enabled: true, ttl: 60_000 }, // default strategy is "cache-first"
});

// Use the client-level default strategy
const { data } = await http.get("/items");

// Skip the cache entirely for this one call
const fresh = await http.get("/items", { cache: false });

// Override the strategy for this one call
const dashboard = await http.get("/dashboard", {
  cache: { strategy: "stale-while-revalidate" },
});

const offline = await http.get("/items", {
  cache: { strategy: "cache-only" },
});
```

### 5.3 Cache Keys

By default, the cache key is derived from the full URL plus query parameters. If two requests would collide (or you want them to share a cache entry on purpose), supply a `keyBuilder`:

```typescript
const http = createHttp({
  cache: {
    enabled: true,
    ttl: 60_000,
    keyBuilder: (url, options) => `${url}:${JSON.stringify(options.params)}`,
  },
});

// Per-request override
await http.get("/items", {
  cache: {
    ttl: 120_000,
    keyBuilder: (url) => `custom-${url}`, // e.g. ignore params entirely
  },
});
```

### 5.4 TTL & Invalidation

```typescript
// Invalidate every cache entry whose key matches/starts with this pattern
http.invalidateCache("/items"); // clears "/items", "/items/123", "/items?page=2", etc.

// Wipe the entire cache
http.clearCache();
```

The most common invalidation pattern is to clear a list endpoint's cache right after a mutation that would change it:

```typescript
async function createItem(name: string) {
  const { data } = await http.post<{ name: string }, Item>("/items", { name });
  http.invalidateCache("/items");
  return data;
}
```

You can automate this globally with a response interceptor instead of repeating it in every mutation function:

```typescript
http.interceptors.response.use(async (response) => {
  if (response.status === 201 || response.status === 204) {
    http.invalidateCache("/api/items");
  }
  return response;
});
```

To prevent unbounded cache growth in long-running processes (a Node.js server, a long-lived SPA tab), either rely on `ttl` for automatic expiry, or sweep periodically:

```typescript
setInterval(() => http.clearCache(), 600_000); // every 10 minutes
```

### 5.5 ETag Support

ETags let the _server_ tell you "nothing changed" without sending the body again, saving bandwidth on large, infrequently-changing payloads.

```typescript
const http = createHttp({
  etag: {
    enabled: true,
    storage: "memory", // or "localStorage" for persistence across page reloads
  },
});

// First request: full response downloaded, ETag stored alongside it
const { data: users1 } = await http.get("/users");

// Second request: rhttp.io automatically sends `If-None-Match`
// A 304 from the server means "unchanged" — the stored data is returned to you,
// and no response body is downloaded at all.
const { data: users2 } = await http.get("/users");
```

ETag support and the `cache` option are complementary, not redundant: `cache` avoids the request entirely within its TTL window, while ETags optimize the _bytes transferred_ on requests that do go out (e.g. once your TTL expires, or for `network-first`/`stale-while-revalidate` strategies that always touch the network).

### 5.6 Cache vs. Deduplication

These two features are often confused because they both "avoid extra network calls," but they solve different problems:

- **Caching** avoids re-fetching data **over time** — it answers "did I already have this within the last N seconds?"
- **Deduplication** avoids redundant calls **at the same instant** — it answers "is an identical request already in flight right now?"

```typescript
// Three components mount simultaneously and each request the same resource.
// With deduplicate: true, only ONE network request is made — all three
// callers receive the same resolved response.
const [r1, r2, r3] = await Promise.all([
  http.get("/items", { deduplicate: true }),
  http.get("/items", { deduplicate: true }),
  http.get("/items", { deduplicate: true }),
]);
```

You'll typically want both enabled together: deduplication protects you from request storms during a single render pass; caching protects you across renders and time.

---

## 6. Resilience

### 6.1 Retry Logic

```typescript
const http = createHttp({
  retry: {
    attempts: 3,
    strategy: "exponential", // "exponential" | "linear" | "none"
    delay: 300, // initial delay, in ms
    maxDelay: 30_000, // ceiling for any single delay
    statusCodes: [408, 429, 500, 502, 503, 504],
  },
});

// Per-request override
await http.get("/items", {
  retry: {
    attempts: 5,
    strategy: "exponential",
    delay: 100,
    maxDelay: 5_000,
    statusCodes: [503],
  },
});

// Disable retries for one call (e.g. a non-idempotent POST you never want retried silently)
await http.post("/payments", body, { retry: false });
```

**Backoff formula.** With `strategy: "exponential"`, the delay before attempt _n_ is `min(delay * 2^(n-1), maxDelay)`. With `delay: 300` and `maxDelay: 30_000`:

| Attempt | Delay                          |
| ------- | ------------------------------ |
| 1       | 300ms                          |
| 2       | 600ms                          |
| 3       | 1200ms                         |
| 4       | 2400ms                         |
| ...     | ... up to the 30,000ms ceiling |

> ⚠️ **A note on the name "jitter."** Earlier drafts of this documentation called this "exponential backoff with jitter," but the formula above is pure exponential backoff — it contains no randomness. True jitter staggers retries from many clients so they don't all retry at the exact same moment and hammer your server in synchronized waves. If you need that, add randomness yourself via `shouldRetry`:

```typescript
retry: {
  attempts: 3,
  strategy: "none", // disable the built-in delay; we'll do our own below
  delay: 0,
  maxDelay: 0,
  statusCodes: [],
  shouldRetry: async (error, attempt) => {
    if (attempt > 3) return false;
    const base = 300 * 2 ** (attempt - 1);
    const jitter = Math.random() * base * 0.5; // up to 50% randomness
    await sleep(base + jitter);
    return true;
  },
},
```

**Custom retry conditions.** `shouldRetry` gives you full control, including reading server-provided hints like `Retry-After`:

```typescript
const http = createHttp({
  retry: {
    attempts: 3,
    strategy: "none",
    delay: 0,
    maxDelay: 0,
    statusCodes: [],
    shouldRetry: async (error, attempt) => {
      if (error instanceof HttpError) {
        if (error.status === 503) return attempt < 3;
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

### 6.2 Circuit Breaker

A circuit breaker stops sending requests to a service that is clearly failing, instead of letting every caller individually time out against it. This protects both your app (no pile-up of slow failing requests) and the struggling service (no extra load while it recovers).

The breaker has three states:

- **`closed`** — normal operation. Requests pass through; failures are counted.
- **`open`** — too many consecutive failures (`failureThreshold`) tripped the breaker. Requests are rejected immediately, without touching the network, until `timeout` elapses.
- **`half-open`** — after `timeout`, the breaker allows a trial request through. Enough consecutive successes (`successThreshold`) closes the breaker again; a single failure reopens it.

```typescript
const http = createHttp({
  circuitBreaker: {
    enabled: true,
    failureThreshold: 5, // open after 5 consecutive failures
    successThreshold: 2, // close again after 2 consecutive successes in half-open
    timeout: 60_000, // wait 60s before trying half-open
  },
});

const status = http.getCircuitBreakerStatus();
console.log(status);
// { state: "closed" | "open" | "half-open", failures: 0, successes: 0,
//   rejectedCount: 0, timeUntilHalfOpen: 0 }

if (http.isCircuitOpen()) {
  console.log(`Service unavailable, retrying in ${status.timeUntilHalfOpen}ms`);
}

// Force the breaker closed (e.g. after manually confirming the backend recovered)
http.resetCircuitBreaker();
```

If you'd rather manage a breaker outside of a client entirely (for example, to share one breaker across several unrelated `fetch` calls), use the standalone class and wrap calls in `execute`:

```typescript
import { CircuitBreaker } from "rhttp.io/advanced";

const breaker = new CircuitBreaker({
  enabled: true,
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60_000,
});

const result = await breaker.execute(() =>
  fetch("https://flaky-service.example.com"),
);
```

### 6.3 Rate Limiting

While the circuit breaker reacts to failures, a rate limiter proactively _prevents_ you from exceeding a quota in the first place — useful for respecting a third-party API's rate limits before they ever return a 429.

rhttp.io's rate limiter uses the **token bucket** algorithm: tokens refill at `tokensPerSecond`, the bucket holds at most `maxBurst` tokens, and every request consumes one or more tokens (`weight`) before it's allowed to proceed.

```typescript
import { RateLimiter } from "rhttp.io/features";

const limiter = new RateLimiter({
  enabled: true,
  tokensPerSecond: 100,
  maxBurst: 500,
});

await limiter.acquire(url, method, weight); // waits until a token is available
const response = await http.get(url);
```

To apply it transparently to every request on a client, wire it in as a request interceptor:

```typescript
const limiter = new RateLimiter({ tokensPerSecond: 10, maxBurst: 50 });

http.interceptors.request.use(async (config) => {
  await limiter.acquire(config.url, config.method);
  return config;
});
```

### 6.4 Request Pooling

Request pooling caps how many requests are _in flight at once_ from this client, queueing the rest. This protects a backend (or a rate-limited third-party API) from being overwhelmed by a burst of calls your own code issues all at once — for example, rendering 50 thumbnails on a page.

```typescript
const http = createHttp({
  requestPool: {
    enabled: true,
    maxConcurrent: 5,
    queueLimit: 100, // reject new requests once 100 are already queued
  },
});

// 10 requests fired at once; only 5 run concurrently, the rest queue automatically
const results = await Promise.all(
  Array.from({ length: 10 }, () => http.get("/thumbnail")),
);

const stats = http.getPoolStats();
console.log(`Active: ${stats.activeRequests}/${stats.maxConcurrent}`);
console.log(`Queued: ${stats.queueLength}`);
```

### 6.5 Recommended Resilience Stack

These four mechanisms compose well together, and each solves a distinct problem:

| Mechanism       | Question it answers                                  | Protects                                                             |
| --------------- | ---------------------------------------------------- | -------------------------------------------------------------------- |
| Retry           | "Should I try this exact request again?"             | The current caller, against transient failures.                      |
| Circuit breaker | "Is this service healthy enough to even try?"        | The struggling backend, and your app's own thread/connection budget. |
| Rate limiter    | "Am I about to exceed a quota?"                      | Your relationship with a rate-limited API.                           |
| Request pool    | "Am I sending too many requests at once, right now?" | Both ends, against self-inflicted bursts.                            |

A reasonable production default combines all four:

```typescript
const http = createHttp({
  baseURL: "https://api.example.com",
  timeout: 10_000,
  retry: { attempts: 3, strategy: "exponential", delay: 300, maxDelay: 10_000 },
  circuitBreaker: {
    enabled: true,
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 30_000,
  },
  requestPool: { enabled: true, maxConcurrent: 10 },
});
```

---

## 7. Authentication

### 7.1 Static Token

Use this for service-to-service calls where the token doesn't change during the process's lifetime (e.g. a server using a fixed API key).

```typescript
const http = createHttp({
  auth: {
    accessToken: process.env.SERVICE_TOKEN,
    scheme: "Bearer", // or "Basic", "ApiKey"
  },
});

await http.get("/protected"); // sends: Authorization: Bearer <SERVICE_TOKEN>
```

### 7.2 Dynamic Token

Use `getToken` whenever the token can change between requests — the most common case being a browser app reading from storage:

```typescript
const http = createHttp({
  auth: {
    getToken: async () => localStorage.getItem("auth_token"),
    scheme: "Bearer",
  },
});
```

`getToken` is called fresh before every request that needs auth, so it's also the right place to do an inline "refresh if about to expire" check:

```typescript
const http = createHttp({
  auth: {
    scheme: "Bearer",
    getToken: async () => {
      let token = localStorage.getItem("access_token");
      const expiresAt = parseInt(
        localStorage.getItem("access_token_expires_at") ?? "0",
        10,
      );

      if (Date.now() > expiresAt - 60_000) {
        // refresh 60s before expiry
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

This pattern refreshes proactively, _before_ a request ever fails — which avoids the extra round trip that reactive (401-triggered) refreshing costs. The downside is it can't react to a token being revoked server-side ahead of its stated expiry; combine it with the reactive approach below if that matters to you.

### 7.3 Automatic Token Refresh

The reactive alternative: let requests fail with `401`, then transparently refresh and retry. rhttp.io's built-in helper handles the tricky part — if several requests get a `401` at the same moment, only **one** refresh call is made, and every queued request is retried with the new token once it arrives.

```typescript
import { createHttp, createRefreshAuthInterceptor } from "rhttp.io";

const http = createHttp({
  baseURL: "https://api.example.com",
  auth: { accessToken: localStorage.getItem("access_token") ?? "" },
});

const refreshInterceptor = createRefreshAuthInterceptor(http, {
  refreshToken: async () => {
    const response = await fetch("/auth/refresh", { method: "POST" });
    const data = await response.json();
    return data.accessToken; // the new token
  },
  onTokenRefreshed: async (newToken) => {
    localStorage.setItem("access_token", newToken);
  },
  statusCodes: [401], // which status codes should trigger a refresh (default: [401])
});

http.interceptors.response.use((response) => response, refreshInterceptor);

// If profile and orders both 401 at the same time, only ONE refresh call
// is made, and both requests are transparently retried with the new token.
const [profile, orders] = await Promise.all([
  http.get("/profile"),
  http.get("/orders"),
]);
```

See [Section 19](#19-troubleshooting) for how to avoid an infinite refresh loop if the refresh endpoint itself ever returns a `401`.

### 7.4 Cookie-Based Sessions (SSR)

When your backend issues an `httpOnly` session cookie, your server-rendering layer needs to forward the _incoming_ request's cookies to its own outgoing API calls — the browser never sees this exchange, so it can't do it for you. `createServerHttp` plus `requestContext` handles this:

```typescript
import { createServerHttp } from "rhttp.io/server";
import { getRequest } from "@tanstack/react-start/server";

const http = createServerHttp({
  baseURL: process.env.API_URL,
  auth: {
    forwardCookies: true, // forward cookies from the incoming request
  },
  requestContext: () => getRequest(), // how rhttp.io finds "the incoming request" — enabled by default on TanStack Start
});

export const fetchProtectedData = createServerFn({ method: "GET" }).handler(
  async () => {
    // Cookies from the original browser request are forwarded automatically.
    return http.get("/protected-data");
  },
);
```

The same pattern adapts to other frameworks by changing what `requestContext` returns — for example, in a Next.js Route Handler you'd return the `Request` object passed into your handler.

---

## 8. CSRF Protection

CSRF (Cross-Site Request Forgery) protection here works via the classic double-submit pattern: rhttp.io fetches a CSRF token from your server, stores it (typically mirrored in a cookie by your backend), and automatically attaches it as a header on state-changing requests.

```typescript
const http = createClientHttp({
  baseURL: "https://api.example.com",
  csrf: {
    enabled: true,
    fetchEndpoint: "/api/csrf", // where to GET a fresh token
    cookieName: "csrf-token", // cookie your server sets alongside the token
    headerName: "X-CSRF-Token", // header rhttp.io will attach
    methods: ["POST", "PUT", "PATCH", "DELETE"], // methods that require the token
    prefetch: true, // fetch a token immediately on client creation
  },
});

await http.post("/items", { name: "test" }); // X-CSRF-Token attached automatically
```

`prefetch: true` trades a small amount of startup latency (one extra request) for zero latency on the _first_ mutation; with `prefetch: false`, the token is instead fetched lazily on the first request that needs it.

To bypass CSRF for one call — for instance, an endpoint that's intentionally exempt — override it per request:

```typescript
await http.post("/items", { name: "test" }, { csrf: false });
```

---

## 9. Validation & Data Transformation

### 9.1 Request Validation

`requestValidator` runs before a request is sent and can reject it outright — useful as a safety net against requests that should never happen from a given environment, like an admin endpoint accidentally called from client-side code.

```typescript
const http = createHttp({
  baseURL: "https://api.example.com",
  requestValidator: (url, options) => {
    if (url.includes("/admin") && typeof window !== "undefined") {
      return false; // throws: "Request validation failed"
    }
    return true;
  },
});
```

### 9.2 Response Validation

`validateResponse` runs after parsing but before the promise resolves, letting you assert the response actually has the shape you expect — a lightweight alternative to full schema validation (see 9.4) for simple checks.

```typescript
const { data } = await http.get<User>("/users/123", {
  validateResponse: (data) =>
    data && typeof data.id === "number" && typeof data.name === "string",
});
// Throws HttpError("Response validation failed") if the function returns false
```

### 9.3 Response Transformers

Transformers reshape response data after it's parsed. They can be defined globally (run on every response) and/or per-request (run _after_ the global one, letting you layer endpoint-specific logic on top of app-wide conventions).

```typescript
const http = createHttp({
  baseURL: "https://api.example.com",
  responseTransformer: (data, response) => {
    // App-wide convention: ISO date strings become Date objects everywhere
    if (data?.createdAt) data.createdAt = new Date(data.createdAt);
    if (data?.updatedAt) data.updatedAt = new Date(data.updatedAt);
    return data;
  },
});

const { data } = await http.get("/orders", {
  transformer: (data) => {
    // Endpoint-specific: add a computed field on top of the global transform
    return data.map((order) => ({
      ...order,
      total: order.items.reduce((sum, item) => sum + item.price, 0),
    }));
  },
});
```

### 9.4 Schema Validation with Zod

Where `validateResponse` answers a yes/no question, schema validation **parses** the response into a fully-typed, guaranteed-correct object — and gives you a detailed error about exactly which field failed, instead of a generic boolean rejection.

```typescript
import { withSchemaValidation } from "rhttp.io/extensions";
import { z } from "zod";

const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
});

const http = withSchemaValidation(
  createHttp({ baseURL: "https://api.example.com" }),
);

const { data: user } = await http.get("/user", {
  schema: UserSchema,
  // `user` is now typed as z.infer<typeof UserSchema>, and guaranteed to match it
});
```

> 💡 Prefer `schema` over `validateResponse` whenever you want the response's TypeScript type to be _derived from_ the validation rule itself, rather than asserted separately. Use `validateResponse` for quick one-off sanity checks where pulling in Zod isn't worth it.

---

## 10. Interceptors, Hooks & Plugins

rhttp.io gives you three different extension mechanisms. They overlap in what they let you observe, but differ in power and intended use — picking the right one keeps your code easier to reason about.

### 10.1 Interceptors

Interceptors are the most powerful mechanism: they can **mutate** the request config or response, and can **short-circuit** the pipeline by throwing. They run as a chain, in registration order.

```typescript
// Request interceptor
http.interceptors.request.use(
  async (config) => {
    config.headers = { ...config.headers, "x-request-id": generateId() };
    return config;
  },
  async (error) => {
    console.error("Request error:", error);
    throw error;
  },
);

// Response interceptor
http.interceptors.response.use(
  async (response) => {
    analytics.track("api_call_success", {
      url: response.response.url,
      status: response.status,
      duration: response.durationMs,
    });
    if (response.data?.meta) {
      response.data = response.data.data; // unwrap an envelope
    }
    return response;
  },
  async (error) => {
    if (error instanceof HttpError && error.status === 401) {
      window.location.href = "/login";
    }
    throw error;
  },
);
```

**Ejecting and clearing.** `use()` returns a handle you can eject later — handy in apps that create and tear down clients dynamically (e.g. per-tenant clients):

```typescript
const handler = http.interceptors.request.use((config) => config);
handler.eject();

http.interceptors.request.clear(); // remove all request interceptors at once
```

**Execution order.** Multiple interceptors of the same type run in the order they were registered:

```typescript
http.interceptors.request.use(async (config) => {
  config.headers = { ...config.headers, "x-auth": "token" };
  return config;
});

http.interceptors.request.use(async (config) => {
  config.headers = { ...config.headers, "x-app": "myapp" }; // runs second
  return config;
});
```

### 10.2 Lifecycle Hooks

Hooks are simpler, config-level callbacks for side effects — logging, analytics, spinners. Unlike interceptors, **hooks cannot mutate the config or response and cannot block the request**; treat them as "notify me when X happens," not "let me change X."

```typescript
const http = createHttp({
  hooks: {
    onRequest: async (url, options) => {
      console.log(`Starting request to ${url}`);
    },
    onSuccess: async (response) => {
      console.log(`Request successful: ${response.status}`);
    },
    onError: async (error) => {
      console.error(`Request failed: ${error.message}`);
    },
    onFinally: async () => {
      console.log("Request complete");
    },
  },
});
```

### 10.3 Plugins

A plugin bundles the request/response/error hooks above into a single reusable, named unit — the right choice when you want to ship a piece of behavior (logging, analytics, compression) as something other projects can drop in with one line.

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

const analyticsPlugin = {
  name: "analytics",
  afterResponse: async (response) => {
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

### 10.4 Which One Should I Use?

| You want to...                                          | Use                                                      |
| ------------------------------------------------------- | -------------------------------------------------------- |
| Modify outgoing headers, body, or query params          | Request **interceptor**                                  |
| Unwrap an envelope, normalize an error, redirect on 401 | Response **interceptor**                                 |
| Log/track a request without touching its data           | **Hook**                                                 |
| Ship a reusable bundle of behavior across projects      | **Plugin**                                               |
| Reject specific requests before they're sent            | `requestValidator` ([9.1](#91-request-validation))       |
| Reshape response data, app-wide                         | `responseTransformer` ([9.3](#93-response-transformers)) |

---

## 11. Error Handling

rhttp.io normalizes every failure into one of three error classes, so your `catch` blocks never have to guess what shape an error is.

### `HttpError`

Thrown when the server responds, but with an error status code.

```typescript
import { HttpError } from "rhttp.io";

try {
  await http.get("/endpoint");
} catch (error) {
  if (error instanceof HttpError) {
    console.log(error.status); // 404
    console.log(error.statusText); // "Not Found"
    console.log(error.data); // parsed error response body
    console.log(error.headers); // response headers
    console.log(error.requestId); // for tracing/cancellation
    console.log(error.durationMs); // how long it took to fail
    console.log(error.url); // the request URL
  }
}
```

### `TimeoutError`

Thrown when a request exceeds its timeout without the server responding at all.

```typescript
import { TimeoutError } from "rhttp.io";

try {
  await http.get("/slow", { timeout: 5_000 });
} catch (error) {
  if (error instanceof TimeoutError) {
    console.log(`Timed out after ${error.durationMs}ms`);
  }
}
```

### `NetworkError`

Thrown for connectivity failures — DNS resolution, no internet, the request never reaching a server.

```typescript
import { NetworkError } from "rhttp.io";

try {
  await http.get("/endpoint");
} catch (error) {
  if (error instanceof NetworkError) {
    console.log(error.originalError); // the underlying error (e.g. from fetch)
    console.log(error.message);
  }
}
```

### Centralizing Error Handling

Rather than repeating `instanceof` checks everywhere, most apps centralize the common cases in one response interceptor:

```typescript
http.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error instanceof HttpError) {
      console.error(`[${error.requestId}] ${error.status} ${error.url}`);

      await fetch("/api/errors", {
        method: "POST",
        body: JSON.stringify({
          status: error.status,
          url: error.url,
          message: error.message,
          requestId: error.requestId,
        }),
      });

      if (error.status === 401) {
        window.location.href = "/login";
      } else if (error.status === 429) {
        console.warn("Rate limited. Backing off...");
      }
    }

    throw error; // always re-throw unless you intend to swallow the error
  },
);
```

---

## 12. Observability

### 12.1 Logging

```typescript
const http = createHttp({
  observability: { logger: true }, // built-in console logging
});
```

Or plug in your own logging library (Pino, Winston, etc.) by providing an object matching this shape:

```typescript
const http = createHttp({
  observability: {
    logger: {
      debug: (msg, ctx) => myLogger.debug(msg, ctx),
      info: (msg, ctx) => myLogger.info(msg, ctx),
      warn: (msg, ctx) => myLogger.warn(msg, ctx),
      error: (msg, ctx) => myLogger.error(msg, ctx),
    },
  },
});
```

### 12.2 Tracing

```typescript
const http = createHttp({
  observability: { tracing: true }, // adds an X-Request-ID header to every outgoing request
});
```

This is what lets you correlate a request across your frontend logs, your backend logs, and `http.getHistory()` — they all share the same `requestId`.

### 12.3 Metrics

```typescript
const http = createHttp({
  observability: { metrics: true },
});

// ... your app makes requests ...

const metrics = http.getMetrics();
// {
//   totalRequests: 150,
//   successfulRequests: 145,
//   failedRequests: 5,
//   durations: [12, 45, 23, ...],
//   statusCodes: { 200: 140, 201: 5, 500: 5 },
// }

const avgDuration =
  metrics.durations.reduce((a, b) => a + b, 0) / metrics.durations.length;
console.log(`Average duration: ${avgDuration}ms`);
```

### 12.4 Request History

```typescript
const history = http.getHistory();
// Array<{ requestId, url, method, status, durationMs, timestamp }>

history.forEach((entry) => {
  console.log(
    `${entry.method} ${entry.url} - ${entry.status} (${entry.durationMs}ms)`,
  );
});

const failed = history.filter((r) => r.status >= 400);
const slowest = [...history].sort((a, b) => b.durationMs - a.durationMs);
const entry = history.find((r) => r.requestId === "abc-123");
```

`getHistory()` keeps a rolling window of recent requests in memory — useful for an in-app debug panel, but not a substitute for shipping `getMetrics()`/logs to real monitoring in production.

### 12.5 Request Profiling

For deeper per-endpoint performance analysis than `getMetrics()` provides, use the standalone profiler:

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

const profiles = profiler.getProfiles({ url: "/api" }); // filter by URL substring
profiles.forEach((p) => console.log(`${p.method} ${p.url}: ${p.duration}ms`));
```

---

## 13. React Integration

`withReact` wraps a client with builders that produce TanStack Query-compatible config objects, so you keep using `useQuery`/`useMutation` exactly as you already do — rhttp.io just supplies the `queryFn`/`mutationFn` and a sensible `queryKey`.

```typescript
import { withReact } from "rhttp.io/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const http = withReact(createHttp({ baseURL: "https://api.example.com" }));

function Posts() {
  const { data, isLoading } = useQuery({
    ...http.query<Post[]>({
      url: "/posts",
      params: { page: 1 },
      cache: true,
    }),
  });

  if (isLoading) return <p>Loading…</p>;

  return (
    <div>
      {data?.map((post) => <div key={post.id}>{post.title}</div>)}
    </div>
  );
}

function CreatePost() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    ...http.mutation<CreatePostInput, Post>({
      method: "POST",
      url: "/posts",
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/posts"] }),
  });

  return (
    <button onClick={() => mutation.mutate({ title: "New" })}>
      Create
    </button>
  );
}
```

> ⚠️ **Avoid double caching.** TanStack Query already caches query results in memory. If you also enable rhttp.io's own `cache` option on the same request, you end up with two independent caches that can fall out of sync (e.g. `invalidateQueries` clears TanStack's cache but not rhttp.io's). The simplest rule: when a request goes through `withReact`'s `.query()`, let TanStack Query own caching, and set `cache: false` (or leave it disabled) on the rhttp.io side. Reserve rhttp.io's `cache` config for requests made _outside_ of React Query — e.g. inside server functions, background jobs, or non-React code paths.

---

## 14. Realtime: Socket.io Client

### 14.1 Setup & Connecting

```typescript
import { createRealtimeClient } from "rhttp.io/socket.io.client";

const realtimeClient = createRealtimeClient({
  url: "https://api.example.com",
  auth: { token: "jwt-token" },
  reconnection: true,
  reconnectionDelay: 1_000,
  reconnectionDelayMax: 5_000,
  reconnectionAttempts: 5,
});

await realtimeClient.connect();

realtimeClient.emit("message", { text: "Hello!" });
realtimeClient.on("message", (data) => console.log(data));

realtimeClient.disconnect();
```

### 14.2 Logging

```typescript
// Built-in console logging
const realtimeClient = createRealtimeClient({
  url: "https://ws.example.com",
  logger: true, // logs connect/disconnect/emit/receive events
});

// Custom logger (Pino, Winston, etc.)
const realtimeClient2 = createRealtimeClient({
  url: "https://ws.example.com",
  logger: {
    debug: (...args) => myLogger.debug(...args),
    info: (...args) => myLogger.info(...args),
    warn: (...args) => myLogger.warn(...args),
    error: (...args) => myLogger.error(...args),
  },
});
```

### 14.3 Event Validation & Transformation

Run every outgoing (`emit`) and incoming (`receive`) event through a validator and/or transformer — useful for enforcing a payload contract on both directions of the socket.

```typescript
const realtimeClient = createRealtimeClient({
  url: "https://ws.example.com",

  eventValidator: (event, data, direction) => {
    if (direction === "emit" && event === "message") {
      return typeof data.text === "string" && data.text.length > 0;
    }
    if (direction === "receive" && event === "notification") {
      return data.type !== undefined;
    }
    return true; // allow everything else through
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

A validator returning `false` blocks the event silently (it's never emitted, or never delivered to your `on()` handlers) — pair it with `logger: true` during development so blocked events aren't a total mystery.

### 14.4 Lifecycle Hooks

```typescript
const realtimeClient = createRealtimeClient({
  url: "https://ws.example.com",
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

### 14.5 Rooms & Offline Queue

```typescript
const realtimeClient = createRealtimeClient({
  url: "https://ws.example.com",
  rooms: { autoRejoin: true }, // re-join rooms automatically after a reconnect
  offlineQueue: { enabled: true, maxSize: 100 },
});

await realtimeClient.joinRoom("chat:general"); // queued automatically if currently offline
await realtimeClient.joinRoom("notifications");

// Emitted while offline: queued, then flushed in order once reconnected
realtimeClient.emit("message", { text: "Hello" });

console.log(realtimeClient.getRooms()); // ["chat:general", "notifications"]
console.log(realtimeClient.getQueueLength()); // 0 if connected, N if currently queued
```

### 14.6 React Bindings

```tsx
import {
  createRealtimeClient,
  RealtimeProvider,
  useSocketClient,
  useSocketEvent,
  useConnectionState,
} from "rhttp.io/socket.io.client";

const realtimeClient = createRealtimeClient({
  url: "https://api.example.com",
  auth: { token: "jwt-token" },
  reconnection: true,
  reconnectionDelay: 1_000,
  reconnectionDelayMax: 5_000,
  reconnectionAttempts: 5,
});

function App() {
  return (
    <RealtimeProvider client={realtimeClient}>
      <ChatBox />
    </RealtimeProvider>
  );
}
```

`RealtimeProvider` makes the client available to any descendant via three hooks:

| Hook                             | Returns                                                                                                   |
| -------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `useSocketClient()`              | The raw client instance, for calling `.emit()`, `.joinRoom()`, etc.                                       |
| `useSocketEvent(event, handler)` | Subscribes `handler` to `event` for the lifetime of the component; unsubscribes automatically on unmount. |
| `useConnectionState()`           | `{ connected: boolean }`, re-rendering your component as the socket connects/disconnects.                 |

```tsx
function ChatBox() {
  const { connected } = useConnectionState();
  const client = useSocketClient();
  const [messages, setMessages] = useState<string[]>([]);

  useSocketEvent("message", (data: { text: string }) => {
    setMessages((prev) => [...prev, data.text]);
  });

  const sendMessage = (text: string) => {
    client.emit("message", { text });
  };

  return (
    <div>
      <p>Status: {connected ? "Connected" : "Disconnected"}</p>
      <ul>
        {messages.map((m, i) => (
          <li key={i}>{m}</li>
        ))}
      </ul>
      <button onClick={() => sendMessage("Hello")}>Send</button>
    </div>
  );
}
```

---

## 15. Extensions

### 15.1 GraphQL Support

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

GraphQL requests still flow through the same client pipeline — auth headers, retries, interceptors, and observability all apply exactly as they do for REST calls, since under the hood it's a `POST` to your `/graphql` endpoint.

### 15.2 Schema Validation (Zod)

Covered in depth in [9.4](#94-schema-validation-with-zod).

### 15.3 Request Compression

Compress outgoing request bodies above a size threshold — worth enabling for endpoints that regularly receive large JSON payloads (bulk imports, large form submissions).

```typescript
import { createCompressionMiddleware } from "rhttp.io/extensions";

const compression = createCompressionMiddleware({
  enabled: true,
  algorithm: "gzip",
  threshold: 1024, // only compress bodies larger than 1KB
  level: 6, // 1 (fastest) – 9 (smallest), 6 is a balanced default
});

http.use(compression);
```

Your server must support decompressing the chosen algorithm (most frameworks do this automatically when `Content-Encoding` is set), or requests will fail server-side — test this end to end before enabling it in production.

---

## 16. End-to-End Examples

### 16.1 Full CRUD App

```typescript
interface Item {
  id: string;
  name: string;
  createdAt: string;
}

const http = createHttp({
  baseURL: "https://api.example.com",
  cache: { enabled: true, ttl: 60_000 },
  retry: { attempts: 3, strategy: "exponential", delay: 300, maxDelay: 10_000 },
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

### 16.2 File Upload

```typescript
async function uploadFile(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("description", "My file");

  const { data } = await http.post<FormData, { url: string }>(
    "/upload",
    formData,
    {
      // Don't set Content-Type yourself — the browser sets it (with the correct
      // multipart boundary) when the body is a FormData instance.
      timeout: 60_000, // large files need more time
    },
  );

  return data.url;
}
```

### 16.3 Streaming File Download

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

### 16.4 A Realistic Production Setup

Combining auth, retries, the circuit breaker, caching, and observability — roughly what a hardened production client looks like:

```typescript
import { createHttp, createRefreshAuthInterceptor, HttpError } from "rhttp.io";

const http = createHttp({
  baseURL: process.env.API_URL,
  timeout: 10_000,
  cache: { enabled: true, ttl: 30_000, strategy: "cache-first" },
  retry: { attempts: 3, strategy: "exponential", delay: 300, maxDelay: 10_000 },
  circuitBreaker: {
    enabled: true,
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 30_000,
  },
  observability: { logger: true, tracing: true, metrics: true },
  auth: { getToken: async () => localStorage.getItem("access_token") },
});

const refresh = createRefreshAuthInterceptor(http, {
  refreshToken: async () => {
    const res = await fetch("/auth/refresh", { method: "POST" });
    return (await res.json()).accessToken;
  },
  onTokenRefreshed: (token) => localStorage.setItem("access_token", token),
});

http.interceptors.response.use((res) => res, refresh);

http.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error instanceof HttpError && error.status >= 500) {
      reportToMonitoring(error);
    }
    throw error;
  },
);
```

---

## 17. Migration Guides

### 17.1 From Axios

```typescript
// Before (Axios)
const response = await axios.get("/items");
const data = response.data;

// After (rhttp.io)
const http = createHttp({ baseURL: "https://api.example.com" });
const { data } = await http.get("/items");
```

| Axios                                                 | rhttp.io equivalent                    |
| ----------------------------------------------------- | -------------------------------------- |
| `axios.create({ baseURL })`                           | `createHttp({ baseURL })`              |
| `axios.interceptors.request.use(...)`                 | `http.interceptors.request.use(...)`   |
| `axios-retry` package                                 | Built-in `retry` config                |
| Manual `AbortController` wiring                       | `requestId` + `http.cancel(requestId)` |
| A separate cache wrapper (e.g. `axios-cache-adapter`) | Built-in `cache` config                |
| `error.response.status`                               | `error.status` (on `HttpError`)        |
| `error.response.data`                                 | `error.data` (on `HttpError`)          |

### 17.2 From Native Fetch

```typescript
// Before (fetch)
const response = await fetch("/items");
if (!response.ok) throw new Error(`HTTP ${response.status}`);
const data = await response.json();

// After (rhttp.io)
const http = createHttp({ baseURL: "https://api.example.com" });
const { data } = await http.get("/items");
```

Switching from `fetch` gets you, for free: automatic JSON parsing, errors thrown for non-2xx statuses (no more manually checking `response.ok`), retry logic, caching, and full type safety on both requests and responses.

---

## 18. Best Practices

1. **Set reasonable timeouts.** A request with no `timeout` can hang forever if the server never responds — always set one, even a generous one, as a backstop.
2. **Choose a cache strategy deliberately, per endpoint.** Don't reach for one global setting; rapidly-changing data and rarely-changing data have opposite needs (see [5.2](#52-the-five-cache-strategies)).
3. **Distinguish error types in your `catch` blocks.** `HttpError`, `TimeoutError`, and `NetworkError` usually call for different user-facing messages — "try again," "check your connection," and "this item doesn't exist" are not interchangeable.
4. **Monitor metrics in production**, not just in development. `getHistory()` is great for local debugging; ship `getMetrics()` (or your own analytics plugin) somewhere durable.
5. **Implement retries thoughtfully — and cap them.** Retrying non-idempotent requests (like a payment `POST`) without care can cause duplicate side effects; consider `retry: false` on those, or server-side idempotency keys.
6. **Use request IDs for tracing.** Enable `observability.tracing` so a single `X-Request-ID` ties together your frontend logs, backend logs, and `getHistory()` entries for the same call.
7. **Validate responses you can't fully trust**, especially third-party APIs whose contracts can drift without warning you. Prefer Zod schemas ([9.4](#94-schema-validation-with-zod)) over ad hoc `validateResponse` checks once a response shape matters in more than one place.
8. **Clean up after yourself.** Cancel in-flight requests a component no longer needs (e.g. on unmount), and periodically clear caches in long-running processes.
9. **Test failure paths, not just the happy path.** Specifically test what happens on a `401`, a `timeout`, a `5xx`, and an open circuit breaker — these are the cases users actually hit in production.
10. **Document your API contract for your team.** Share response schemas (Zod or TypeScript interfaces) between frontend and backend so a server-side change surfaces as a type error, not a runtime surprise.

---

## 19. Troubleshooting

### Request Hangs Forever

**Symptom:** a request never resolves or rejects.

**Cause:** no `timeout` was set, and the server (or a proxy in front of it) never responds.

**Fix:**

```typescript
const http = createHttp({ timeout: 30_000 });
await http.get("/endpoint", { timeout: 10_000 }); // per-request override
```

### CORS Errors

**Symptom:** `Access to fetch at '...' has been blocked by CORS policy`.

**Cause:** this is a server-side configuration issue — no client-side option fixes it, since the browser is enforcing a policy the _server_ must opt into.

**Fix:** ensure the server sends the right headers:

```javascript
// Server-side (Node.js / Express example)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "https://example.com");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});
```

### Cache Growing Unbounded (Memory Leak)

**Symptom:** memory usage climbs steadily in a long-running Node.js process or a long-lived browser tab.

**Cause:** caching is enabled with no `ttl`, or `clearCache()`/`invalidateCache()` is never called.

**Fix:**

```typescript
const http = createHttp({ cache: { enabled: true, ttl: 60_000 } });
setInterval(() => http.clearCache(), 600_000); // periodic sweep as a backstop
```

### "Circuit breaker is OPEN — request blocked"

**Symptom:** requests fail immediately, without even hitting the network.

**Cause:** the failure threshold was reached and the breaker is protecting the (presumably struggling) backend.

**Fix:** check the backend's actual health first — don't just reset the breaker reflexively, or you'll re-create the exact load spike it was protecting against.

```typescript
const status = http.getCircuitBreakerStatus();
console.log(status.state); // "open" | "closed" | "half-open"

if (status.state === "open") {
  // Only after confirming the backend has actually recovered:
  http.resetCircuitBreaker();
}
```

### Infinite 401 → Refresh → 401 Loop

**Symptom:** the app gets stuck repeatedly calling the refresh endpoint.

**Cause:** the refresh endpoint itself started returning `401` (e.g. the refresh token expired too), and the retry logic doesn't know to stop.

**Fix:** mark a request as already-retried, and give up after one refresh attempt:

```typescript
http.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error instanceof HttpError && error.status === 401) {
      if (error.options?._retry) {
        throw error; // already tried refreshing once — give up, force logout
      }
      const newToken = await refreshToken();
      error.options._retry = true;
      return http.customFetch(error.url, { ...error.options, _retry: true });
    }
    throw error;
  },
);
```

If you're using `createRefreshAuthInterceptor` ([7.3](#73-automatic-token-refresh)), this loop protection is already handled for you — this manual pattern is for teams rolling their own refresh logic.

### `deduplicate: true` Still Sends Multiple Requests

**Symptom:** several "identical" calls still hit the network separately.

**Cause:** deduplication keys requests by URL + method + body + params. Any difference — including header ordering in some implementations, or a freshly-generated `requestId` per call — breaks the match.

**Fix:** ensure the requests are genuinely identical, and avoid passing a unique `requestId` if you want them deduplicated.

### Stale Data After a Mutation

**Symptom:** a list still shows old data right after creating/updating/deleting an item.

**Cause:** the cache for that list endpoint was never invalidated after the mutation.

**Fix:** call `http.invalidateCache(...)` after the mutation, or automate it via a response interceptor (see [5.4](#54-ttl--invalidation)).

### Socket Reconnects Repeatedly in a Loop

**Symptom:** the realtime client keeps disconnecting and reconnecting.

**Cause:** usually a server-side idle timeout shorter than your reconnection delay, or an `auth.token` that's expired and gets rejected on every reconnect attempt.

**Fix:** make sure the token passed to `createRealtimeClient`'s `auth` option is refreshed the same way your HTTP client's token is, and check server-side ping/pong timeout settings against `reconnectionDelay`.

---

## 20. FAQ

**Does rhttp.io work with React Native?**
Yes — it's built on the standard `fetch` API, which React Native provides. Socket.io's React Native support follows the same constraints as the underlying `socket.io-client` package.

**Can I use rhttp.io without any of the advanced features?**
Yes. `createHttp({ baseURL })` with no other options behaves like a typed wrapper around `fetch` with automatic JSON parsing and normalized errors — every other feature is opt-in.

**Does the cache survive a page reload?**
Not by default — the built-in cache is in-memory. For caching that survives a reload, look at the `etag.storage: "localStorage"` option ([5.5](#55-etag-support)), or pair rhttp.io with a persistence layer like TanStack Query's persisters.

**Can I share one client between server and browser code?**
Yes, that's exactly what `createHttp` (the universal entry point) is for. Use `createServerHttp`/`createClientHttp` only when you specifically need their environment-only behavior (cookie forwarding, CSRF prefetch).

**What happens if both `retry` and `circuitBreaker` are enabled and a request keeps failing?**
Retries happen first, on the current request. If failures accumulate _across_ requests past `failureThreshold`, the breaker opens — at which point _subsequent_ requests are rejected immediately, without exhausting their own retries against an already-known-unhealthy service.

**Is TypeScript required?**
No — rhttp.io works fine from plain JavaScript. You simply lose the compile-time checking on body/response shapes that the generics provide.

---

## 21. License, Contributing & Support

**License:** MIT

**Contributing:** Contributions are welcome — please feel free to submit a Pull Request.

**Support:**

- GitHub: https://github.com/elprof45/rhttp.io
- Issues: https://github.com/elprof45/rhttp.io/issues
- Discussions: https://github.com/elprof45/rhttp.io/discussions
