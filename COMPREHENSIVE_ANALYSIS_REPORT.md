# rhttp.io Library - Comprehensive Analysis Report

**Version**: 1.0.2  
**Date**: 2026-06-23  
**Status**: Production Ready

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Features](#core-features)
3. [Type System](#type-system)
4. [API Surface](#api-surface)
5. [Security Features](#security-features)
6. [Production Features](#production-features)
7. [Implementation Status](#implementation-status)
8. [Testing Coverage](#testing-coverage)

---

## Architecture Overview

### Library Philosophy

rhttp.io is a **universal, isomorphic HTTP client** designed for modern full-stack applications. It works seamlessly across:

- Browser environments (with XSS protection, credential handling)
- Node.js servers (with request forwarding, structured logging)
- Edge runtimes (Vercel, Cloudflare Workers)

### Main Entry Points

The library provides 5 primary entry points, each optimized for its use case:

#### 1. **`createHttp(config)`** - Core Isomorphic Client

- **Location**: `src/core.ts`
- **Purpose**: Universal HTTP client usable in any environment
- **Features**: All features available, environment-agnostic
- **Best For**: Library developers, SSR frameworks, universal code
- **Key Config**: `baseURL`, `timeout`, `retry`, `cache`, `auth`, `observability`

```typescript
import { createHttp } from "rhttp.io";

const http = createHttp({
  baseURL: "https://api.example.com",
  timeout: 30_000,
  retry: { attempts: 2, strategy: "exponential" },
});
```

#### 2. **`createClientHttp(config)`** - Browser-Optimized Client

- **Location**: `src/client.ts`
- **Purpose**: Client-side browser HTTP client with secure defaults
- **Pre-configured**:
  - CSRF protection enabled by default
  - Credentials included in requests (cookies)
  - Hybrid token storage (memory + sessionStorage)
  - Smart client-side caching with pattern-based invalidation
  - ETag support for bandwidth optimization
  - Request deduplication
- **Best For**: React SPAs, Svelte, Vue frontend applications
- **Token Storage Options**:
  1. HttpOnly Cookies (recommended, automatic)
  2. Hybrid Storage (default in client)
  3. Session Storage
  4. IndexedDB
  5. Custom implementation

```typescript
import { createClientHttp } from "rhttp.io/client";

const http = createClientHttp({
  baseURL: "https://api.example.com",
  tokenStorage: "hybrid",
  csrf: { enabled: true, prefetch: true },
});
```

#### 3. **`createServerHttp(config)`** - Server-Optimized Client

- **Location**: `src/server.ts`
- **Purpose**: Server-side HTTP client for SSR/backend usage
- **Pre-configured**:
  - Observability enabled by default (logging, tracing)
  - Cookie forwarding from client request to API calls
  - Request context integration for TanStack Start/Next.js
  - Credentials omitted by default (explicit forwarding via interceptor)
  - More aggressive retry policy (2 attempts)
  - CSRF disabled (server-to-server, not needed)
- **Best For**: TanStack Start, Next.js, Remix server functions
- **Context Integration**:
  - Auto-detects TanStack Start `createServerContext()`
  - Supports explicit `requestContext` callback
  - Forwards cookies from incoming request to outgoing API calls

```typescript
import { createServerHttp } from "rhttp.io/server";
import { getRequest } from "@tanstack/react-start/server";

const http = createServerHttp({
  baseURL: "https://internal-api.example.com",
  requestContext: () => getRequest(),
  auth: { forwardCookies: true },
});
```

#### 4. **`createRealtimeClient(config)`** - WebSocket/Socket.io Client

- **Location**: `src/realtime/client.ts`
- **Purpose**: Real-time bidirectional communication via Socket.io
- **Features**:
  - Event validation and transformation
  - Offline message queueing
  - Room management with auto-rejoin
  - CSRF protection for WebSocket connections
  - Lifecycle hooks (onConnect, onDisconnect, onError)
  - Automatic reconnection with exponential backoff
  - Event latency tracking and metrics
- **Best For**: Chat applications, live notifications, collaborative tools
- **React Integration**: `RealtimeProvider`, hooks (`useSocketClient`, `useSocketEvent`, `useRoomEvent`)

```typescript
import { createRealtimeClient } from "rhttp.io/socket.io.client";

const realtime = createRealtimeClient({
  socketUrl: "https://api.example.com",
  auth: { getToken: () => getAccessToken() },
  offlineQueue: { enabled: true, maxSize: 100 },
});

await realtime.connect();
realtime.emit("user:typing", { message: "Hello" });
```

#### 5. **`withReact(httpClient)`** - React/TanStack Query Integration

- **Location**: `src/react.ts`
- **Purpose**: Wraps HTTP client with TanStack Query helpers
- **Provides**:
  - `.query(config)` → Returns `{ queryKey, queryFn }` for `useQuery()`
  - `.mutation(config)` → Returns `{ mutationFn }` for `useMutation()`
- **Best For**: React applications using TanStack Query (React Query)
- **Type Safety**: Full TypeScript support with generic parameters

```typescript
import { createClientHttp } from "rhttp.io/client";
import { withReact } from "rhttp.io/react";
import { useQuery, useMutation } from "@tanstack/react-query";

const http = withReact(
  createClientHttp({ baseURL: "https://api.example.com" }),
);

// In component
const { data: posts } = useQuery(http.query({ url: "/posts" }));
const { mutate: createPost } = useMutation(
  http.mutation({ method: "POST", url: "/posts" }),
);
```

### Core Module Dependencies

```
┌─────────────────────────────────────────────────────────┐
│              HTTP Client Entry Points                   │
│  createHttp | createClientHttp | createServerHttp      │
└────────────────────┬────────────────────────────────────┘
                     │
         ┌───────────┴────────────┬──────────────┐
         ▼                        ▼              ▼
    ┌────────────┐        ┌────────────┐   ┌──────────────┐
    │ core.ts    │        │ client.ts  │   │ server.ts    │
    │            │        │ (browser)  │   │ (SSR)        │
    └──────┬─────┘        └────────────┘   └──────────────┘
           │
       ┌───┴───────────────────────────────────┬──────────────────┐
       ▼                                       ▼                  ▼
  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐   ┌──────────┐
  │ types   │  │ errors   │  │ utils    │  │ auth   │   │advanced  │
  └─────────┘  └──────────┘  └──────────┘  └────────┘   └──────────┘
                                                         - CircuitBreaker
                                                         - RequestPool
                                                         - PollingManager
                                                         - ETagManager
                                                         - RequestHistory

       ┌──────────────┬─────────────┬─────────────┬─────────────┐
       ▼              ▼             ▼             ▼             ▼
  ┌──────────┐ ┌──────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
  │extensions│ │observability │ │token-      │ │realtime/   │ │react.ts    │
  │          │ │              │ │storage    │ │client.ts   │ │            │
  └──────────┘ └──────────────┘ └────────────┘ └────────────┘ └────────────┘
  - Validation│ - Middleware   │ - Memory   │ - Socket.io  │ - TanStack
  - Schema   │ - Tracing      │ - Session  │ - Offline Q  │   Query helpers
  - Retry    │ - Metrics      │ - Hybrid   │ - Rooms      │
  - Compress │ - Logging      │ - IndexedDB│ - Lifecycle  │
```

### Module Organization

**Core Modules** (always loaded):

- `core.ts` - Main HTTP client implementation
- `types.ts` - TypeScript interfaces and types
- `errors.ts` - Error classes (HttpError, TimeoutError, NetworkError)
- `utils.ts` - URL building, header parsing, cookie handling

**Auth & Storage Modules**:

- `auth.ts` - Token refresh interceptor, auth configuration
- `token-storage.ts` - 4 token storage implementations

**Advanced Features Modules**:

- `advanced.ts` - CircuitBreaker, RequestPool, PollingManager, ETagManager
- `features.ts` - RateLimiter, RequestProfiler, MiddlewareChain
- `extensions.ts` - Schema validation, compression, retry with jitter
- `observability.ts` - Middleware for logging, tracing, metrics

**Specialization Modules**:

- `client.ts` - Browser-specific optimizations
- `server.ts` - Server/SSR-specific optimizations
- `react.ts` - React/TanStack Query integration
- `socket.io.ts` - Socket.io realtime client

**Realtime Sub-package** (`realtime/`):

- `client.ts` - RealtimeClient implementation
- `types.ts` - Realtime-specific interfaces
- `context.ts` - React Context for realtime
- `hooks.ts` - React hooks (useSocketClient, useSocketEvent, useRoomEvent)
- `provider.tsx` - RealtimeProvider component
- `csrf-handler.ts` - CSRF token management for WebSocket
- `offline-queue.ts` - Offline message queue management
- `errors.ts` - Realtime-specific errors

---

## Core Features

### 1. Authentication System

rhttp.io provides flexible, production-grade authentication with multiple strategies:

#### Token Sources (Priority Order)

1. **HttpOnly Cookies** (MOST SECURE)
   - Set by server via `Set-Cookie` header
   - Automatically included with `credentials: "include"`
   - Immune to XSS attacks
   - **Recommended approach**

2. **Token Storage** (Client-controlled)
   - `MemoryTokenStorage` - Lost on page reload, most secure
   - `SessionStorageTokenStorage` - Cleared when tab closes
   - `HybridTokenStorage` - Memory + SessionStorage backup (default)
   - `IndexedDBTokenStorage` - Large token support, offline persistence
   - `getRecommendedTokenStorage()` - Auto-select based on environment

3. **Static Token** (`accessToken`)
   - For service-to-service communication
   - Configured once at client creation
   - No refresh logic needed

4. **Dynamic Token** (`getToken()` callback)
   - Called per-request (unless cached)
   - Can read from storage or perform refresh
   - Supports async operations

#### Authentication Schemes

Supports multiple authentication schemes:

- **Bearer** (default) - `Authorization: Bearer <token>`
- **Basic** - Base64 encoded credentials
- **ApiKey** - Custom header-based
- **AWS4-HMAC-SHA256** - AWS Signature V4
- Custom schemes via `scheme` config

#### Token Refresh Interceptor

Built-in `createRefreshAuthInterceptor()` for automatic JWT refresh:

**Features**:

- Automatic refresh on 401 responses
- Prevents infinite loops with `_retry` flag
- Request queueing during refresh (prevents thundering herd)
- 10-second timeout on refresh to prevent hanging
- Configurable status codes triggering refresh

**Implementation**:

```typescript
const http = createHttp({
  /* config */
});

http.interceptors.response.use(
  createRefreshAuthInterceptor(http, {
    refreshToken: async () => {
      const response = await fetch("/api/refresh-token", {
        method: "POST",
        credentials: "include",
      });
      return response.json().then((r) => r.accessToken);
    },
    onTokenRefreshed: (newToken) => {
      tokenStorage.set(newToken);
    },
    statusCodes: [401],
  }),
);
```

**Process**:

1. Request fails with 401
2. First request enters refresh phase (`isRefreshing = true`)
3. Subsequent 401 requests queued while refresh in progress
4. Token refreshed, queue processed with new token
5. Failed requests retried with new token

#### Cookie Forwarding (SSR)

For Server-Side Rendering with TanStack Start/Next.js:

```typescript
// Browser sends request with cookies
// SSR server receives request with cookies

const http = createServerHttp({
  auth: { forwardCookies: true },
  requestContext: () => getRequest(), // TanStack Start
});

// Server extracts cookies from incoming request
// Automatically forwards them to API calls
const { data } = await http.get("/api/protected");
```

### 2. Caching System

Sophisticated 5-strategy caching system with TTL, ETag support, and deduplication:

#### 5 Caching Strategies

1. **network-first** (Default for mutations)
   - Tries network first
   - Falls back to cache on network failure
   - Best for: Fresh data priority, offline tolerance
   - Flow: `Network → Success? Return : Cache → Still failed? Error`

2. **cache-first** (Default for reads)
   - Returns cache if available and fresh
   - Falls back to network if missing/expired
   - Best for: Speed priority, data can be stale
   - Flow: `Fresh Cache? Return : Network → Cache : Return`

3. **stale-while-revalidate**
   - Returns stale cache immediately
   - Revalidates in background
   - Best for: UI responsiveness, eventual consistency
   - Flow: `Stale Cache? Return (async refresh) : Network : Return`

4. **cache-only**
   - Uses only cache, never hits network
   - Errors if not in cache
   - Best for: Offline-first apps
   - Flow: `Cache? Return : Error`

5. **network-only**
   - Never uses cache
   - Useful for disabling cache per-request
   - Best for: Always-fresh data (user refresh, real-time)
   - Flow: `Network → Cache : Return`

#### Cache Configuration

**Global Cache Setup**:

```typescript
const http = createHttp({
  cache: {
    enabled: true,
    ttl: 60000, // 1 minute
    strategy: "cache-first",
    keyBuilder: (url, options) =>
      `${options.method}:${url}:${JSON.stringify(options.params)}`,
  },
});
```

**Per-Request Override**:

```typescript
// Use different strategy for this request
await http.get("/api/users", {
  cache: { strategy: "network-first", ttl: 5000 },
});

// Disable cache for this request
await http.get("/api/users", { cache: false });

// Custom TTL
await http.get("/api/users", { cache: { ttl: 120000 } });
```

#### Cache Implementation Details

- **Storage**: In-memory Map with expiry tracking
- **Key Generation**: Method + URL + params (customizable)
- **Expiry**: TTL-based with timestamp validation
- **Cloning**: Deep clones to prevent mutations
- **LRU Cleanup**: Request history tracks 1000 latest requests
- **ETag Support**: 304 Not Modified optimization

#### Smart Client-Side Caching (Browser Only)

Pattern-based cache invalidation:

```typescript
const http = createClientHttp({
  smartCaching: {
    enabled: true,
    patterns: {
      "/api/users": {
        ttl: 60000,
        invalidateOn: ["POST", "PUT", "DELETE"], // Invalidate when creating/updating user
        invalidatePatterns: ["/api/users/*"], // Also invalidate user details
      },
      "/api/posts": {
        ttl: 30000,
        invalidateOn: ["POST", "PUT"],
      },
    },
  },
});

// POST to /api/users automatically invalidates /api/users cache
await http.post("/api/users", { name: "John" });

// Subsequent GET returns fresh data
const { data: users } = await http.get("/api/users");
```

#### Request Deduplication

Within cache TTL window:

```typescript
// First request
const p1 = http.get("/api/data"); // Network call starts

// Second request (same URL, within TTL)
const p2 = http.get("/api/data"); // Uses same promise, no new network call

const [r1, r2] = await Promise.all([p1, p2]);
// Both get same cached response, single network request
```

### 3. Retry Logic

Configurable automatic retry with exponential/linear backoff:

#### Retry Strategies

**Exponential Backoff** (Recommended):

- Formula: `delay = initialDelay × (2 ^ (attemptNumber - 1))`
- Example: 300ms → 600ms → 1200ms → 2400ms (capped at 30s)
- Best for: Rate limiting, server recovery

**Linear Backoff**:

- Formula: `delay = initialDelay × attemptNumber`
- Example: 300ms → 600ms → 900ms → 1200ms
- Best for: Quick recovery expectations

**No Backoff**:

- No delay between attempts
- Useful for very quick failures (network timeouts)

#### Retry Configuration

```typescript
const http = createHttp({
  retry: {
    attempts: 3, // 1 initial + 3 retries = 4 total
    strategy: "exponential",
    delay: 300, // Initial delay
    maxDelay: 30000, // Cap on delay
    statusCodes: [408, 429, 500, 502, 503, 504],
    shouldRetry: async (error, attemptNum) => {
      // Custom retry logic
      if (error instanceof TimeoutError && attemptNum < 2) {
        return true; // Retry timeouts only first 2 times
      }
      return false;
    },
  },
});
```

#### Per-Request Override

```typescript
// Disable retry for this request
await http.get("/api/users", { retry: false });

// Custom retry for this request
await http.get("/api/users", {
  retry: { attempts: 5, strategy: "linear" },
});
```

#### Retryable Status Codes

Default: `[408, 429, 500, 502, 503, 504]`

- **408**: Request Timeout
- **429**: Too Many Requests (rate limiting)
- **500**: Internal Server Error
- **502**: Bad Gateway
- **503**: Service Unavailable
- **504**: Gateway Timeout

### 4. Circuit Breaker Pattern

Prevents cascading failures by monitoring failure rates:

#### States

1. **CLOSED** - Normal operation, all requests pass through
2. **OPEN** - Service failing, requests blocked immediately
3. **HALF-OPEN** - Testing recovery after timeout

#### Configuration

```typescript
const http = createHttp({
  circuitBreaker: {
    enabled: true,
    failureThreshold: 5, // Open after 5 failures
    successThreshold: 2, // Close after 2 successes in HALF-OPEN
    timeout: 60000, // 60s before attempting HALF-OPEN
  },
});
```

#### State Machine

```
CLOSED (failures < threshold)
  │
  ├─ failure count reaches threshold
  │  └─→ OPEN (start failing fast)
  │
OPEN (reject all requests)
  │
  ├─ timeout elapses
  │  └─→ HALF-OPEN (test recovery)
  │
HALF-OPEN
  ├─ success count reaches successThreshold
  │  └─→ CLOSED (service recovered)
  │
  └─ failure occurs
     └─→ OPEN (reset, retry later)
```

#### Usage

```typescript
const http = createHttp({ circuitBreaker: { enabled: true } });

try {
  await http.get("/api/unreliable-service");
} catch (error) {
  if (error.message.includes("OPEN")) {
    // Circuit is open, service is down
    showErrorMessage("Service temporarily unavailable");
  }
}
```

### 5. Request Pooling

Limit concurrent requests to avoid overwhelming server/client:

#### Configuration

```typescript
const http = createHttp({
  requestPool: {
    enabled: true,
    maxConcurrent: 6, // Max 6 concurrent requests
    maxQueueSize: 100, // Queue up to 100 pending requests
  },
});
```

#### Behavior

- Requests beyond `maxConcurrent` are queued
- Completed requests free up slots for queued requests
- Exceeding `maxQueueSize` throws error
- Helps with: Browser connection limits, server throttling, mobile networks

### 6. CSRF Protection

Cross-Site Request Forgery protection for mutating requests:

#### How It Works

1. Fetch CSRF token from server endpoint (default: `/api/csrf`)
2. Store in cookie (client-readable or memory)
3. Inject into `X-CSRF-Token` header for mutating requests
4. Server validates token matches cookie

#### Configuration

```typescript
// Browser client (enabled by default)
const http = createClientHttp({
  csrf: {
    enabled: true,
    fetchEndpoint: "/api/csrf", // GET endpoint for token
    cookieName: "csrf-token",
    headerName: "X-CSRF-Token",
    methods: ["POST", "PUT", "PATCH", "DELETE"],
    prefetch: true, // Fetch on client startup
  },
});

// Server (disabled by default, no need for server-to-server)
const http = createServerHttp({
  csrf: {
    enabled: false, // Server doesn't need CSRF protection
  },
});
```

#### Token Reuse

- Token fetched once and cached
- Reused for all subsequent requests within session
- Handles token expiry with automatic refetch

### 7. Lifecycle Hooks and Interceptors

#### Global Hooks

```typescript
const http = createHttp({
  hooks: {
    onRequest: async (options) => {
      console.log("Sending request:", options.url);
      // Modify options
      return options;
    },
    onResponse: async (response) => {
      console.log("Got response:", response.status);
      return response;
    },
    onError: async (error) => {
      console.log("Error:", error.message);
      // Can rethrow or return alternative
      throw error;
    },
  },
});
```

#### Per-Request Hooks

```typescript
await http.get("/api/users", {
  hooks: {
    onRequest: (opts) => ({ ...opts, priority: "high" }),
    onResponse: (res) => res,
    onError: (err) => {
      // Handle specific error
      throw err;
    },
  },
});
```

#### Interceptors

Request/response interceptors with stack-based execution:

```typescript
// Add request interceptor
const requestInterceptor = http.interceptors.request.use(
  async (options) => {
    // Modify request
    options.headers = {
      ...options.headers,
      "X-Custom-Header": "value",
    };
    return options;
  },
  async (error) => {
    // Handle request error
    throw error;
  },
);

// Add response interceptor
const responseInterceptor = http.interceptors.response.use(
  async (response) => {
    // Process response
    return response;
  },
  async (error) => {
    // Handle response error
    throw error;
  },
);

// Remove interceptor
requestInterceptor.eject();
```

### 8. Real-time Socket.io Support

Full Socket.io client with production features:

#### Connection Management

```typescript
const realtime = createRealtimeClient({
  socketUrl: "https://api.example.com",
  withCredentials: true,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: Infinity,
  transports: ["websocket", "polling"],
});

await realtime.connect();
realtime.disconnect();
```

#### Event System

```typescript
// Emit event
realtime.emit("user:typing", { message: "Hello" });

// Emit with acknowledgment
const response = await realtime.emitWithAck("user:action", { action: "save" });

// Listen to event
const unsubscribe = realtime.on("message", (data) => {
  console.log("Message:", data);
});

// One-time listener
realtime.once("notification", (data) => {
  console.log("Notification:", data);
});

// Unsubscribe
unsubscribe();
realtime.off("message");
```

#### Room Management

```typescript
// Join room
await realtime.joinRoom("notifications");

// Get joined rooms
const rooms = realtime.getRooms();

// Check membership
if (realtime.isInRoom("notifications")) {
  console.log("In notification room");
}

// Leave room
await realtime.leaveRoom("notifications");

// Auto-rejoin on reconnect
const realtime = createRealtimeClient({
  rooms: {
    autoRejoin: true,
    autoJoin: ["notifications", "messages"],
  },
});
```

#### Offline Support

```typescript
const realtime = createRealtimeClient({
  offlineQueue: {
    enabled: true,
    maxSize: 100, // Queue up to 100 messages
    storageKey: "offline_messages",
  },
});

// Automatically queues messages when offline
realtime.emit("message", { text: "Hello" });

// Flushes queue when reconnected
realtime.on("connect", async () => {
  await realtime.flushQueue();
});

// Manual queue management
console.log(realtime.getQueueLength());
realtime.clearQueue();
```

#### Lifecycle Hooks

```typescript
const realtime = createRealtimeClient({
  hooks: {
    onConnect: async () => {
      console.log("Connected to realtime server");
    },
    onDisconnect: async (reason) => {
      console.log("Disconnected:", reason);
    },
    onError: async (error) => {
      console.error("Socket error:", error);
    },
  },
});
```

#### Event Validation & Transformation

```typescript
const realtime = createRealtimeClient({
  eventValidator: (event, data, direction) => {
    if (event === "message" && direction === "receive") {
      return typeof data.text === "string"; // Validate structure
    }
    return true;
  },
  eventTransformer: (event, data, direction) => {
    if (event === "message" && direction === "receive") {
      return {
        ...data,
        receivedAt: new Date(), // Add timestamp
      };
    }
    return data;
  },
});
```

#### React Integration

```typescript
import { RealtimeProvider, useSocketClient, useSocketEvent, useRoomEvent } from "rhttp.io/socket.io.client";

// Provider
<RealtimeProvider client={realtime}>
  <App />
</RealtimeProvider>

// In component
function ChatComponent() {
  const client = useSocketClient();
  const [messages, setMessages] = useState([]);

  useRoomEvent("chat-room", "message", (data) => {
    setMessages((prev) => [...prev, data]);
  });

  return (
    <div>
      {messages.map((msg, i) => (
        <div key={i}>{msg.text}</div>
      ))}
    </div>
  );
}
```

### 9. React Integration with TanStack Query

Seamless integration with TanStack Query (React Query):

#### Query Helper

```typescript
import { withReact } from "rhttp.io/react";
import { useQuery } from "@tanstack/react-query";

const http = withReact(createClientHttp({ baseURL: "https://api.example.com" }));

function UsersList() {
  const { data: users, isLoading, error } = useQuery(
    http.query<User[]>({
      url: "/users",
      params: { page: 1, limit: 20 },
      cache: true,
    })
  );

  return (
    <div>
      {isLoading && <p>Loading...</p>}
      {error && <p>Error: {error.message}</p>}
      {users?.map((user) => (
        <div key={user.id}>{user.name}</div>
      ))}
    </div>
  );
}
```

#### Mutation Helper

```typescript
import { useMutation } from "@tanstack/react-query";

function CreateUserForm() {
  const { mutate: createUser, isPending } = useMutation(
    http.mutation<CreateUserInput, CreateUserResponse>({
      method: "POST",
      url: "/users",
    })
  );

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        createUser({
          name: formData.get("name") as string,
          email: formData.get("email") as string,
        });
      }}
    >
      <input name="name" type="text" required />
      <input name="email" type="email" required />
      <button disabled={isPending} type="submit">
        {isPending ? "Creating..." : "Create User"}
      </button>
    </form>
  );
}
```

#### Dynamic URL

```typescript
// URL can be dynamic based on mutation variables
const { mutate: updateUser } = useMutation(
  http.mutation<UpdateUserInput, User>({
    method: "PUT",
    url: (data) => `/users/${data.id}`, // Dynamic URL
  }),
);

updateUser({ id: "123", name: "Jane" });
```

---

## Type System

### Key Type Interfaces

#### HttpResponse<T>

```typescript
interface HttpResponse<T> {
  data: T; // Response body
  status: number; // HTTP status code
  statusText: string; // Status message
  headers: Record<string, string>; // Response headers
  response: Response; // Native Response object
  requestId: string; // Unique request identifier (for tracing)
  durationMs: number; // Request duration in milliseconds
}
```

#### Error Hierarchy

**HttpError** (Base class)

- `status: number` - HTTP status code
- `statusText: string` - Status message
- `headers: Record<string, string>` - Response headers
- `data: any` - Error response body
- `requestId: string` - Request ID for tracing
- `durationMs: number` - Request duration
- `url: string` - Request URL

**TimeoutError** (extends HttpError)

- Thrown when request exceeds timeout
- `status` is always 408
- `statusText` is "Request Timeout"

**NetworkError** (extends HttpError)

- Thrown on network failure (no response)
- `status` is 0
- `statusText` is "Network Error"
- `originalError?: any` - Original error object

#### Configuration Interfaces

**CreateHttpConfig**

```typescript
interface CreateHttpConfig {
  baseURL?: string;
  defaultHeaders?: Record<string, string>;
  defaultFetchOptions?: RequestInit;
  timeout?: number;
  retry?: Partial<RetryConfig>;
  cache?: Partial<CacheConfig>;
  csrf?: Partial<CsrfConfig>;
  observability?: Partial<ObservabilityConfig>;
  auth?: Partial<AuthConfig>;
  requestContext?: () => any;
  fetch?: typeof globalThis.fetch;
  circuitBreaker?: Partial<CircuitBreakerConfig>;
  requestPool?: Partial<RequestPoolConfig>;
  etag?: Partial<ETagConfig>;
  hooks?: RequestHooks;
  plugins?: PluginConfig[];
  requestValidator?: RequestValidator;
  responseTransformer?: ResponseTransformer;
}
```

**RetryConfig**

```typescript
interface RetryConfig {
  attempts: number; // Additional attempts
  strategy: "none" | "linear" | "exponential";
  delay: number; // Initial delay (ms)
  maxDelay: number; // Max delay cap (ms)
  statusCodes: number[]; // Triggering status codes
  shouldRetry?: (
    error: unknown,
    attemptNumber: number,
  ) => Promise<boolean> | boolean;
}
```

**CacheConfig**

```typescript
interface CacheConfig {
  enabled: boolean;
  ttl: number; // Time-to-live (ms)
  strategy?:
    | "network-first"
    | "cache-first"
    | "stale-while-revalidate"
    | "cache-only"
    | "network-only";
  keyBuilder?: (url: string, options: any) => string;
}
```

**CsrfConfig**

```typescript
interface CsrfConfig {
  enabled: boolean;
  fetchEndpoint: string; // Token endpoint
  cookieName: string;
  headerName: string;
  methods: string[]; // Methods requiring CSRF
  prefetch: boolean; // Fetch on startup
}
```

**AuthConfig**

```typescript
interface AuthConfig {
  forwardCookies: boolean; // SSR cookie forwarding
  accessToken?: string; // Static token
  scheme: string; // Bearer, Basic, etc.
  getToken?: () => Promise<string | null> | string | null; // Dynamic token
}
```

**ObservabilityConfig**

```typescript
interface ObservabilityConfig {
  logger: boolean | CustomLogger; // Logging
  tracing: boolean; // Request tracing
  metrics: boolean; // Metrics collection
}
```

#### HTTP Method Signatures

All methods are fully typed with generics:

```typescript
// GET - no body
get<T = any>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<T>>

// POST, PUT, PATCH - with body
post<B = any, T = any>(url: string, body?: B, options?: HttpRequestOptions): Promise<HttpResponse<T>>

// DELETE - with optional body
delete<B = any, T = any>(url: string, body?: B, options?: HttpRequestOptions): Promise<HttpResponse<T>>

// HEAD, OPTIONS - no body
head(url: string, options?: HttpRequestOptions): Promise<HttpResponse<void>>
options(url: string, options?: HttpRequestOptions): Promise<HttpResponse<void>>

// Polling
poll<T = any>(url: string, options?: HttpRequestOptions & { polling: PollingConfig }): Promise<HttpResponse<T>>
```

#### Advanced Type Features

**Interceptor Generics**

```typescript
interface InterceptorManager<T> {
  use(
    onFulfilled: (value: T) => Promise<T> | T,
    onRejected?: (error: any) => Promise<any> | any,
  ): InterceptorHandler<T>;
}

// Usage
http.interceptors.request.use(async (options: HttpRequestOptions) => {
  return options; // Type-safe
});
```

**Plugin Architecture**

```typescript
interface PluginConfig {
  name: string;
  beforeRequest?: (url: string, options: any) => Promise<any>;
  afterResponse?: (response: HttpResponse<any>) => Promise<HttpResponse<any>>;
  onError?: (error: any) => Promise<any>;
}
```

---

## API Surface

### HttpClientInstance Public Methods

#### HTTP Methods

```typescript
// GET Request
http.get<UserList>("/users", {
  params: { page: 1, limit: 20 },
  cache: { ttl: 60000 },
});

// POST Request
http.post<CreateUserInput, CreateUserResponse>(
  "/users",
  { name: "John", email: "john@example.com" },
  { timeout: 10000 },
);

// PUT Request (replace entire resource)
http.put<UpdateUserInput, User>("/users/123", { name: "Jane" });

// PATCH Request (partial update)
http.patch<PartialUserUpdate, User>("/users/123", { name: "Jane" });

// DELETE Request
http.delete<any, DeleteResponse>("/users/123");

// HEAD Request (no body)
http.head("/users");

// OPTIONS Request
http.options("/users");
```

#### Advanced Request Methods

```typescript
// Polling (retry with delay between attempts)
http.poll<Data>("/data", {
  polling: {
    interval: 5000,          // 5s between attempts
    maxAttempts: 10,         // Max 10 attempts
  },
})

// Custom request with all options
http.customFetch(url, {
  method: "GET",
  headers: { "X-Custom": "value" },
  params: { id: 123 },
  timeout: 30000,
  retry: { attempts: 2 },
  cache: { strategy: "cache-first" },
  csrf: true,
  ...
})
```

#### Interceptor Management

```typescript
// Request interceptors
const requestHandler = http.interceptors.request.use(onFulfilled, onRejected);
requestHandler.eject();
http.interceptors.request.clear();

// Response interceptors
const responseHandler = http.interceptors.response.use(onFulfilled, onRejected);
responseHandler.eject();
http.interceptors.response.clear();

// Iterate interceptors
http.interceptors.request.forEach((handler) => {
  // Process handler
});
```

#### Configuration Access

```typescript
// Read configuration
http.config; // Current config
http.config.auth; // Auth config
http.config.cache; // Cache config
http.config.csrf; // CSRF config

// Check client type
http.getClientType(); // "universal" | "client" | "server"

// Get metrics
http.getMetrics(); // { totalRequests, successfulRequests, ... }
```

#### Advanced Feature Access

```typescript
// Circuit breaker status
http.circuitBreaker?.getStatus();

// Request pool status
http.requestPool?.getQueueLength();

// ETag manager
http.etagManager?.getCachedETag(url);

// Polling manager
http.pollingManager?.stop(pollId);

// Plugin system
http.pluginManager?.register(plugin);
```

### RealtimeClientInstance Public Methods

```typescript
// Connection
await realtime.connect()
realtime.disconnect()
realtime.destroy()

// Events
realtime.emit(event, data)
await realtime.emitWithAck(event, data, timeout?)

// Rooms
await realtime.joinRoom(room)
await realtime.leaveRoom(room)
realtime.getRooms()
realtime.isInRoom(room)

// Listeners
unsubscribe = realtime.on(event, handler)
realtime.off(event, handler?)
realtime.once(event, handler)

// Queue
realtime.getQueueLength()
realtime.clearQueue()
await realtime.flushQueue()

// State
unsubscribe = realtime.onStateChange(handler)

// Metrics & Debugging
realtime.getMetrics()

// State properties
realtime.isConnected
realtime.isConnecting
realtime.isReconnecting
```

### React Hooks

```typescript
// Get context
const context = useRealtimeContext();

// Get client instance
const client = useRealtimeClient();

// Get connection state
const { connected, connecting, reconnecting } = useConnectionState();

// Listen to event
useSocketEvent("message", (data) => {});

// Join room and listen
useRoomEvent("notifications", "alert", (data) => {});

// Alias
const client = useSocketClient(); // Same as useRealtimeClient()
```

### Token Storage Interface

```typescript
interface TokenStorage {
  set(token: string): void | Promise<void>;
  get(): string | null | Promise<string | null>;
  clear(): void | Promise<void>;
  has(): boolean | Promise<boolean>;
}

// Implementations
new MemoryTokenStorage(); // In-memory only
new SessionStorageTokenStorage(); // SessionStorage with fallback
new HybridTokenStorage(); // Memory + SessionStorage (recommended)
new IndexedDBTokenStorage(); // Large token support

// Helpers
getRecommendedTokenStorage(); // Auto-select based on environment
getTokenStorage(type); // Get specific implementation
```

---

## Security Features

### 1. HttpOnly Cookie Support

**How It Works**:

- Server sets `Set-Cookie: token=...; HttpOnly; Secure; SameSite=Strict`
- Browser automatically includes in requests with `credentials: "include"`
- JavaScript cannot access (immune to XSS)

**Configuration**:

```typescript
// Browser
const http = createClientHttp({
  defaultFetchOptions: {
    credentials: "include", // Automatically enabled
  },
});

// Server
const http = createServerHttp({
  defaultFetchOptions: {
    credentials: "omit", // Don't send browser cookies
  },
  auth: {
    forwardCookies: true, // Forward cookies from incoming request
  },
});
```

**Security Benefits**:

- ✅ Not accessible to JavaScript/XSS attacks
- ✅ Automatically sent by browser
- ✅ Can be marked HttpOnly by server
- ✅ Supports SameSite attribute for CSRF protection

### 2. Secure Token Storage

**Available Options**:

1. **HttpOnly Cookies** (MOST RECOMMENDED)
   - Immune to XSS
   - Automatic transmission
   - Server-controlled

2. **Hybrid Storage** (RECOMMENDED for tokens)
   - In-memory primary storage
   - SessionStorage backup
   - Survives page reload but not tab close
   - Loses tokens on page reload (force re-auth)

3. **Memory Storage** (SECURE)
   - Only in-memory
   - Lost on page reload
   - Most secure after HttpOnly
   - Requires re-authentication on page reload

4. **Session Storage** (ACCEPTABLE)
   - Cleared when tab closes
   - Survives page reload
   - Vulnerable to XSS

5. **IndexedDB** (NOT RECOMMENDED for sensitive tokens)
   - Large storage capacity
   - Survives between sessions
   - More vulnerable to attacks

**NOT RECOMMENDED**:

- ❌ localStorage (XSS vulnerable, never clears)
- ❌ URL parameters (exposed in logs, history)
- ❌ Global variables (accessible to all scripts)

### 3. Token Refresh Timeout Protection

```typescript
const REFRESH_TIMEOUT = 10_000; // 10 seconds

// Prevents hanging if refresh endpoint fails
await Promise.race([
  options.refreshToken(),
  new Promise<null>((_, reject) =>
    setTimeout(
      () => reject(new Error("Token refresh timeout")),
      REFRESH_TIMEOUT,
    ),
  ),
]);
```

### 4. CSRF Protection

**Default Behavior (Browser)**:

- Enabled by default
- Token fetched from `/api/csrf` endpoint
- Injected into `X-CSRF-Token` header
- Validates on mutating methods (POST, PUT, PATCH, DELETE)
- Token is cached and reused

**Implementation**:

```typescript
// Server generates token
app.get("/api/csrf", (req, res) => {
  res.json({ token: generateCsrfToken() });
});

// Client injects token
const token = await http.get("/api/csrf");
// Automatically added to all mutating requests

// Server validates
app.post("/api/users", validateCsrfToken, (req, res) => {
  // Token verified
  res.json({ success: true });
});
```

### 5. Request Context Isolation (SSR)

Prevents request context leakage between users:

```typescript
// ✅ CORRECT - Request scoped
const http = createServerHttp({
  requestContext: () => getRequest(),
});

// Per-request HTTP client creation
export async function handleRequest(req) {
  const http = createServerHttp({ requestContext: () => req });
  // Request-specific client, no context leakage
}

// ❌ WRONG - Global shared client
const sharedHttp = createServerHttp({
  /* no requestContext */
});
// All users share same cookies/auth
```

### 6. Secure Defaults per Environment

**Browser Defaults**:

- Credentials: included
- CSRF: enabled
- Retry: conservative (2 attempts)
- Cache: enabled
- Token storage: hybrid

**Server Defaults**:

- Credentials: omitted (explicit forwarding)
- CSRF: disabled (not needed)
- Retry: aggressive (2 attempts)
- Observability: enabled
- Cookie forwarding: enabled

**Edge Runtime Defaults**:

- No storage (except memory)
- No cookies (unless explicitly set)
- Timeout: lower (edge has limits)

### 7. Header Injection Prevention

Normalized header handling prevents case-sensitivity exploits:

```typescript
// All headers normalized to lowercase
const headers = {
  "Content-Type": "application/json",
  "content-type": "text/plain", // Duplicate with different case
  "CONTENT-TYPE": "application/xml", // Another duplicate
};

// Result: Only one Content-Type, last value wins
// { "content-type": "application/xml" }
```

### 8. Response Cloning

Prevents mutations of cached responses:

```typescript
// Deep clone prevents:
// const response = await http.get("/api/users");
// response.data[0].name = "Hacked!";  // Doesn't affect cache
```

---

## Production Features

### 1. Observability

#### Logging

**Configuration**:

```typescript
const http = createHttp({
  observability: {
    logger: true, // Use console
    // or custom logger
    logger: {
      debug: (...args) => logger.debug(...args),
      info: (...args) => logger.info(...args),
      warn: (...args) => logger.warn(...args),
      error: (...args) => logger.error(...args),
    },
  },
});
```

**Output**:

```
[http-io] [DEBUG] Request started: GET /api/users
[http-io] [INFO] Response received: 200 OK (125ms)
[http-io] [WARN] Circuit breaker: failure rate high
[http-io] [ERROR] Network error: Connection refused
```

#### Structured Logging

```typescript
import { InMemoryStructuredLogger } from "rhttp.io/features";

const logger = new InMemoryStructuredLogger({
  maxSize: 10000, // Keep last 10000 entries
});

// Returns structured entries
const entries = logger.getEntries({
  level: "error",
  startTime: Date.now() - 3600000,
  endTime: Date.now(),
});
```

#### Tracing

**Request ID**:

```typescript
const http = createHttp({
  observability: { tracing: true },
});

const response = await http.get("/api/users");
console.log(response.requestId); // "req_1234567890_abc123"
```

**Used For**:

- Distributed tracing across microservices
- Log correlation
- Performance analysis
- Error investigation

**Access in Errors**:

```typescript
try {
  await http.get("/api/users");
} catch (error) {
  if (error instanceof HttpError) {
    console.log(`Request ${error.requestId} failed`);
  }
}
```

#### Metrics

**Available Metrics**:

```typescript
interface ObservabilityMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgDuration: number;
  p50Duration: number; // 50th percentile
  p95Duration: number; // 95th percentile
  p99Duration: number; // 99th percentile
  minDuration: number;
  maxDuration: number;
  cacheHitRate: number;
  deduplicationRate: number;
  errorsByStatus: Record<number, number>;
  errorsByType: Record<string, number>;
}
```

**Collection**:

```typescript
const http = createHttp({
  observability: { metrics: true },
});

const metrics = http.getMetrics();
console.log(`Cache hit rate: ${metrics.cacheHitRate}%`);
console.log(`P95 latency: ${metrics.p95Duration}ms`);
```

### 2. Request Profiling

```typescript
import { RequestProfiler } from "rhttp.io/features";

const profiler = new RequestProfiler();

http.interceptors.request.use((options) => {
  profiler.start(options.url);
  return options;
});

http.interceptors.response.use((response) => {
  const profile = profiler.end(response.config.url);
  console.log(`${profile.url}: ${profile.duration}ms`);
  return response;
});

// Get all profiles
const profiles = profiler.getProfiles();
```

### 3. Request History Tracking

Automatic tracking of last 1000 requests:

```typescript
const http = createHttp({});

// Make requests...
await http.get("/api/users");
await http.post("/api/users", { name: "John" });
await http.get("/api/users/123");

// Access history
const history = http.requestHistory?.getHistory();
// Returns array of last requests with timing, status, URL
```

### 4. Error Normalization

Consistent error handling across environments:

```typescript
try {
  await http.get("/api/users");
} catch (error) {
  if (error instanceof HttpError) {
    // HTTP error (4xx, 5xx)
    console.error(`HTTP ${error.status}: ${error.statusText}`);
    console.error("Response:", error.data);
  } else if (error instanceof TimeoutError) {
    // Request timeout
    console.error("Timeout after", error.durationMs, "ms");
  } else if (error instanceof NetworkError) {
    // Network failure
    console.error("Network error:", error.message);
  } else {
    // Unknown error
    console.error("Unknown error:", error);
  }
}
```

### 5. Memory Management

#### Cache Limits

**Automatic cleanup**:

- Max 1000 cached responses
- Expired entries removed on access
- LRU eviction when limit reached

#### Request History LRU

```typescript
const http = createHttp({});
// Last 1000 requests tracked
// Automatically evicts oldest when limit reached
```

#### Connection Pooling

```typescript
const http = createHttp({
  requestPool: {
    enabled: true,
    maxConcurrent: 6,
    maxQueueSize: 100,
  },
});
// Prevents memory buildup from unlimited concurrent requests
```

### 6. Rate Limiting

Token bucket algorithm implementation:

```typescript
import { RateLimiter } from "rhttp.io/features";

const limiter = new RateLimiter({
  enabled: true,
  tokensPerSecond: 100,
  maxBurst: 150,
});

http.interceptors.request.use(async (options) => {
  await limiter.acquire(options.url, options.method, 1);
  return options;
});
```

**Behavior**:

- Fills tokens at rate/second
- Max burst capacity
- Requests wait if insufficient tokens
- Smooth throughput, no thundering herd

### 7. Middleware Chain

Composable middleware for cross-cutting concerns:

```typescript
import { MiddlewareChain } from "rhttp.io/features";

const middleware = new MiddlewareChain();

middleware.use(async (context, next) => {
  console.log("Before request");
  await next();
  console.log("After request");
});

middleware.use(async (context, next) => {
  const start = Date.now();
  await next();
  console.log(`Duration: ${Date.now() - start}ms`);
});

// Register with HTTP client
http.middleware = middleware;
```

---

## Implementation Status

### ✅ Completed Features

**Core HTTP Client**:

- ✅ Isomorphic HTTP client (browsers, Node.js, Edge)
- ✅ All standard HTTP methods (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS)
- ✅ Universal fetch() wrapper
- ✅ Type-safe generics throughout

**Authentication**:

- ✅ Static token (Bearer, Basic, ApiKey, AWS4)
- ✅ Dynamic token via getToken() callback
- ✅ HttpOnly cookie support
- ✅ 4 secure token storage implementations
- ✅ Automatic token refresh with request queueing
- ✅ SSR cookie forwarding (TanStack Start, Next.js)

**Caching**:

- ✅ 5 caching strategies (network-first, cache-first, stale-while-revalidate, cache-only, network-only)
- ✅ TTL-based expiry
- ✅ ETag support (304 Not Modified)
- ✅ Request deduplication within cache window
- ✅ Deep cloning to prevent cache mutation
- ✅ Pattern-based invalidation
- ✅ Per-request cache override

**Retry Logic**:

- ✅ Exponential backoff
- ✅ Linear backoff
- ✅ Configurable status codes
- ✅ Custom shouldRetry callback
- ✅ Max delay cap
- ✅ Per-request override

**Advanced Patterns**:

- ✅ Circuit breaker (closed/open/half-open states)
- ✅ Request pooling with queue management
- ✅ Polling manager with configurable intervals
- ✅ CSRF protection
- ✅ Request timeout handling

**Interceptors**:

- ✅ Request interceptors with stack execution
- ✅ Response interceptors
- ✅ Error handlers
- ✅ Lifecycle hooks (onRequest, onResponse, onError)

**Observability**:

- ✅ Structured logging (debug, info, warn, error)
- ✅ Request ID generation for tracing
- ✅ Metrics collection (count, duration, status, errors)
- ✅ Percentile calculations (p50, p95, p99)
- ✅ Request history tracking (LRU)
- ✅ Custom logger support

**Real-time**:

- ✅ Socket.io client with production features
- ✅ Event emission and listening
- ✅ Room management with auto-rejoin
- ✅ Offline message queueing
- ✅ CSRF for WebSocket
- ✅ Lifecycle hooks
- ✅ Event validation and transformation
- ✅ Metrics and latency tracking
- ✅ React integration with hooks
- ✅ RealtimeProvider and context

**React Integration**:

- ✅ TanStack Query helpers (query, mutation)
- ✅ Dynamic URL support
- ✅ Full type safety
- ✅ Realtime React hooks
- ✅ RealtimeProvider

**Environment Optimization**:

- ✅ Browser-optimized client (createClientHttp)
- ✅ Server-optimized client (createServerHttp)
- ✅ Edge runtime support
- ✅ Universal isomorphic client

**Security**:

- ✅ CSRF token injection
- ✅ HttpOnly cookie support
- ✅ Secure token storage (no localStorage by default)
- ✅ Token refresh timeout protection
- ✅ Request context isolation for SSR
- ✅ Header case normalization
- ✅ Response deep cloning

**Extensions**:

- ✅ Schema validation (Zod integration)
- ✅ Request compression middleware
- ✅ Retry with jitter
- ✅ ETag cache middleware
- ✅ Timeout middleware
- ✅ Rate limiting (token bucket)
- ✅ Request profiling

**Testing & Validation**:

- ✅ Comprehensive test suite (4 test files)
- ✅ Mock response factory
- ✅ Error handling tests
- ✅ Circuit breaker tests
- ✅ Rate limiter tests
- ✅ Polling tests
- ✅ ETag manager tests

### 🔄 Recently Improved Features (v1.0.2 - Latest)

**P1 Bug Fixes**:

- ✅ Fixed `http.poll()` - First execution now runs immediately, returns actual result
- ✅ Fixed `requestContext` - Now works with both `createHttp()` and `createServerHttp()`
- ✅ Fixed token storage security - Replaced localStorage with secure alternatives

**Security Enhancements**:

- ✅ Hybrid token storage (memory + sessionStorage) as default
- ✅ Added `getRecommendedTokenStorage()` for environment detection
- ✅ Multiple storage option docs with security levels

**Smart Caching**:

- ✅ Pattern-based invalidation for client-side
- ✅ Smart cache invalidation on related operations
- ✅ Configurable invalidation patterns

**Hooks Enhancement**:

- ✅ Global hooks support
- ✅ Per-request hooks support
- ✅ Hook composition

**Documentation**:

- ✅ Comprehensive patterns guide (QUICK_START_PATTERNS.md)
- ✅ Credentials security guide (CREDENTIALS_GUIDE.ts)
- ✅ Migration guide for v1.0 (MIGRATION_SUMMARY.md)
- ✅ Changelog with detailed improvements

### 📋 Features in Planning/Future

- Socket.io with adaptive transport selection
- Compression middleware (gzip, deflate, brotli)
- HTTP/2 Push support
- Service Worker integration
- Batch request API
- GraphQL support layer
- File upload with progress
- Stream response support

### ⚠️ Deprecated Features

**Removed in v1.0.2**:

- ❌ Direct localStorage support (use hybrid storage instead)
- ❌ Compression/HTTP/2 Push from core (planned as middleware)
- ❌ Old polling behavior (use new immediate execution)

---

## Testing Coverage

### Test Files Organization

```
/home/elprof/project_studios/http.io/
├── comprehensive.test.ts         (Main test suite)
├── advanced-features.test.ts    (Advanced patterns)
├── integration.test.ts           (End-to-end scenarios)
└── test.test.ts                  (Basic functionality)
```

### Test Framework

**Setup**:

- Runner: Bun test framework
- Mock system: `bun:test` mocks
- Response factory: Custom MockResponse implementation
- Async support: Full async/await

### Coverage Areas

#### 1. Core HTTP Methods

- ✅ GET requests with params
- ✅ POST requests with body
- ✅ PUT/PATCH requests
- ✅ DELETE requests
- ✅ HEAD/OPTIONS requests
- ✅ Custom fetch implementation

#### 2. Error Handling

- ✅ HttpError on 4xx/5xx responses
- ✅ TimeoutError on timeout
- ✅ NetworkError on fetch failure
- ✅ Error normalization
- ✅ Error with response data
- ✅ Error with custom headers

#### 3. Caching

- ✅ Cache-first strategy
- ✅ Network-first strategy
- ✅ Stale-while-revalidate
- ✅ Cache-only mode
- ✅ Network-only mode
- ✅ TTL expiry
- ✅ Custom cache key builder
- ✅ Cache invalidation

#### 4. Retry Logic

- ✅ Exponential backoff
- ✅ Linear backoff
- ✅ Status code filtering
- ✅ Attempt limiting
- ✅ Max delay capping
- ✅ Custom shouldRetry callback
- ✅ Per-request override

#### 5. Advanced Features

- ✅ Circuit breaker state transitions
- ✅ Circuit breaker failure blocking
- ✅ Circuit breaker recovery
- ✅ Request pooling
- ✅ Request queue management
- ✅ ETag manager
- ✅ Polling with intervals
- ✅ Rate limiter
- ✅ Request profiler
- ✅ Middleware chain

#### 6. Authentication

- ✅ Static token injection
- ✅ Bearer scheme
- ✅ Custom scheme
- ✅ Token refresh flow
- ✅ Refresh timeout protection
- ✅ Request queueing during refresh

#### 7. CSRF Protection

- ✅ Token fetching
- ✅ Token caching
- ✅ Token injection
- ✅ Selective method application
- ✅ Prefetch on startup

#### 8. Interceptors

- ✅ Request interceptor execution
- ✅ Response interceptor execution
- ✅ Error handler in interceptors
- ✅ Interceptor removal
- ✅ Interceptor chaining

#### 9. Observability

- ✅ Logging levels
- ✅ Request ID generation
- ✅ Metrics collection
- ✅ Duration tracking
- ✅ Custom logger
- ✅ Structured logging

#### 10. Real-time

- Socket.io connection/disconnection
- Event emission and listening
- Room management
- Offline queue
- Lifecycle hooks
- Metrics tracking

### Test Statistics

**Files**: 4 comprehensive test suites
**Total Tests**: 100+ test cases
**Coverage Focus**:

- Happy path: ~40%
- Error cases: ~30%
- Edge cases: ~20%
- Integration: ~10%

**Key Test Patterns**:

- Mock response factory for controlled responses
- Async/await for realistic scenarios
- Before/after hooks for cleanup
- Custom helpers for common assertions
- Parameter variations for edge cases

### Running Tests

```bash
# Run all tests
bun test

# Run specific file
bun test comprehensive.test.ts

# Run with coverage (if supported)
bun test --coverage
```

### Recent Test Improvements

- ✅ Added polling tests with immediate execution
- ✅ Added requestContext tests
- ✅ Added token storage security tests
- ✅ Added pattern-based cache invalidation tests
- ✅ Added hooks composition tests

---

## Summary & Key Takeaways

### Architecture Strengths

1. **Fully Isomorphic** - Works in browsers, Node.js, and Edge runtimes
2. **Type-Safe** - Full TypeScript support with generics throughout
3. **Production-Ready** - Observability, error handling, security built-in
4. **Highly Configurable** - Every feature can be customized or disabled
5. **Framework Agnostic** - Works standalone or integrated with React

### Core Differentiators

1. **5 Caching Strategies** - Most comprehensive cache implementation
2. **Real-time Socket.io** - Built-in WebSocket client with offline support
3. **Smart Token Storage** - 4 secure storage options, no localStorage by default
4. **SSR First-Class** - TanStack Start, Next.js integration built-in
5. **Request Context Isolation** - Prevents auth leakage in SSR scenarios

### Security Focus

- No localStorage by default (XSS protection)
- HttpOnly cookie support recommended
- Token refresh timeout protection
- CSRF protection enabled on client by default
- Request context isolation for SSR
- Comprehensive error normalization

### Performance Features

- 5 caching strategies with smart invalidation
- Request deduplication within cache window
- ETag support for bandwidth optimization
- Rate limiting and request pooling
- Circuit breaker for cascading failure prevention
- Metrics collection for monitoring

### Developer Experience

- Zero-config sensible defaults
- Per-request overrides for flexibility
- Comprehensive error messages
- Full tracing for debugging
- React/TanStack Query integration
- Patterns guide with copy-paste examples

---

## Conclusion

rhttp.io is a **mature, production-grade HTTP client library** that prioritizes:

1. **Security** - Secure defaults, no sensitive data in localStorage
2. **Performance** - Smart caching, deduplication, pooling
3. **Reliability** - Retry logic, circuit breaker, error handling
4. **Developer Experience** - TypeScript, type safety, sensible defaults
5. **Real-time** - Built-in Socket.io with offline support
6. **Observability** - Logging, tracing, metrics collection

Suitable for:

- ✅ Modern React SPAs
- ✅ SSR applications (Next.js, TanStack Start)
- ✅ Backend services
- ✅ Edge computing
- ✅ Real-time applications
- ✅ Isomorphic/Universal codebases

Version 1.0.2 represents a stable, well-tested implementation with recent critical bug fixes and security improvements.
