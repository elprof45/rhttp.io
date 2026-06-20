# Entry Points

`rhttp.io` provides multiple entry points, each pre-configured for a specific environment.

## `rhttp.io` — Core isomorphic client

The main package. Works in any JavaScript environment.

```typescript
import { createHttp, HttpError, TimeoutError, NetworkError } from "rhttp.io";
import { createRefreshAuthInterceptor } from "rhttp.io";
```

**What's included:** All HTTP methods, caching, retry, interceptors, circuit breaker, plugins, lifecycle hooks, batch requests, request history, metrics.

---

## `rhttp.io/client` — Browser-optimized client

Pre-configured for browser environments. Extends the core with:

- ✅ `credentials: "include"` — sends cookies automatically
- ✅ CSRF protection enabled by default (fetches token from `/api/csrf`)
- ✅ JWT token auto-injected from `localStorage.getItem("access_token")`

```typescript
import { createClientHttp } from "rhttp.io/client";

const http = createClientHttp({
  baseURL: "https://api.example.com",
  // No auth config needed — reads from localStorage by default
});

// Token is automatically injected as: Authorization: Bearer <token>
const { data } = await http.get("/protected");
```

---

## `rhttp.io/server` — Server-optimized client (SSR)

Pre-configured for server environments. Extends the core with:

- ✅ `auth.forwardCookies: true` — forwards incoming request cookies
- ✅ Logging and tracing enabled by default
- ✅ Auto-detects TanStack Start `getRequest()` context
- ✅ `withRequest(request, fn)` for explicit context binding

```typescript
import { createServerHttp } from "rhttp.io/server";

const http = createServerHttp({
  baseURL: process.env.INTERNAL_API_URL,
});
```

---

## `rhttp.io/react` — React + TanStack Query

Wraps any `HttpClientInstance` with query and mutation builders.

```typescript
import { createHttp } from "rhttp.io";
import { withReact } from "rhttp.io/react";

const http = withReact(createHttp({ baseURL: "..." }));

// Generates { queryKey, queryFn }
const opts = http.query<User[]>({ url: "/users" });

// Generates { mutationFn }
const mutation = http.mutation({ method: "POST", url: "/users" });
```

---

## `rhttp.io/socket.io.client` — Realtime Socket.io client

Full-featured Socket.io client with logging, validation, transformation, rooms, and offline queue.

```typescript
import { createRealtimeClient } from "rhttp.io/socket.io.client";

const client = createRealtimeClient({
  socketUrl: "https://ws.example.com",
  auth: { token: "my-jwt" },
  logger: true,
  offlineQueue: { enabled: true },
});

await client.connect();
client.emit("message", { text: "Hello!" });
```

---

## Package Exports Reference

| Import path | Entry file | Environment |
|---|---|---|
| `rhttp.io` | `dist/index.js` | Universal |
| `rhttp.io/client` | `dist/client.js` | Browser |
| `rhttp.io/server` | `dist/server.js` | Node.js / Edge |
| `rhttp.io/react` | `dist/react.js` | Browser + SSR |
| `rhttp.io/socket.io.client` | `dist/socket.io.js` | Browser |
