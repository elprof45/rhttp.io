# Server Client (SSR)

`createServerHttp` creates a server-side HTTP client with cookie forwarding, logging, and SSR context binding.

**Import:**

```typescript
import { createServerHttp } from "rhttp.io/server";
// or (re-exported from main)
import { createServerHttp } from "rhttp.io";
```

---

## Default Behaviors

| Feature | Default |
|---|---|
| Cookie forwarding | ✅ Enabled (`auth.forwardCookies: true`) |
| Logging | ✅ Enabled (console logger) |
| Request tracing | ✅ Enabled (`X-Request-ID` header) |
| Metrics | Enabled in `production` only |

---

## Usage with TanStack Start

`createServerHttp` automatically detects the active TanStack Start request context using `getRequest()`, so **you don't need to call `withRequest()`** manually in most cases.

```typescript
import { createServerHttp } from "rhttp.io/server";

// Created once, at module level
const http = createServerHttp({
  baseURL: process.env.INTERNAL_API_URL,
  timeout: 30_000,
});

// Server function — cookies are automatically forwarded!
export const fetchUserOrders = createServerFn({ method: "GET" }).handler(
  async () => {
    const { data } = await http.get<Order[]>("/orders");
    return data;
  }
);
```

:::note
Auto-detection works when `@tanstack/react-start` is installed. If it's not available, cookie forwarding falls back to `withRequest()` or is skipped gracefully.
:::

---

## Using `withRequest()` (explicit binding)

For legacy compatibility or frameworks other than TanStack Start, use `withRequest()` to explicitly bind the HTTP client to the incoming request:

```typescript
export const fetchDashboard = createServerFn({ method: "GET" }).handler(
  async ({ request }) => {
    return http.withRequest(request, async () => {
      const { data } = await http.get<Dashboard>("/dashboard");
      return data;
    });
  }
);
```

---

## Next.js App Router

```typescript
// lib/http.ts
import { createServerHttp } from "rhttp.io/server";

export const apiClient = createServerHttp({
  baseURL: process.env.INTERNAL_API_URL!,
});

// app/api/orders/route.ts
import { cookies } from "next/headers";
import { apiClient } from "@/lib/http";

export async function GET() {
  const cookieStore = cookies();
  
  return apiClient.withRequest(
    new Request("internal", {
      headers: { cookie: cookieStore.toString() },
    }),
    async () => {
      const { data } = await apiClient.get("/orders");
      return Response.json(data);
    }
  );
}
```

---

## With Static Token (Service-to-Service)

```typescript
const internalApi = createServerHttp({
  baseURL: "https://internal-api.example.com",
  auth: {
    accessToken: process.env.SERVICE_API_KEY,
    scheme: "Bearer",
    forwardCookies: false, // Don't forward user cookies for S2S
  },
});
```

---

## Custom Logger

Replace the default console logger with Pino or Winston:

```typescript
import pino from "pino";

const logger = pino({ level: "info" });

const http = createServerHttp({
  baseURL: process.env.API_URL,
  observability: {
    logger: {
      debug: (...args) => logger.debug(args.join(" ")),
      info: (...args) => logger.info(args.join(" ")),
      warn: (...args) => logger.warn(args.join(" ")),
      error: (...args) => logger.error(args.join(" ")),
    },
    tracing: true,
    metrics: true,
  },
});
```

---

## Complete Configuration

```typescript
const http = createServerHttp({
  baseURL: process.env.API_URL,
  timeout: 30_000,

  auth: {
    forwardCookies: true,     // Forward user session cookies
  },

  // Optional: explicit request context
  requestContext: () => getRequest(), // @tanstack/react-start/server

  retry: {
    attempts: 2,
    strategy: "exponential",
    statusCodes: [500, 502, 503, 504],
  },

  observability: {
    logger: true,
    tracing: true,
    metrics: true,
  },
});
```

---

## Pattern: Shared Server Client

The recommended pattern is to create a **single instance** at module level and reuse it:

```typescript
// lib/api.ts
import { createServerHttp } from "rhttp.io/server";

export const api = createServerHttp({
  baseURL: process.env.INTERNAL_API_URL!,
  timeout: 30_000,
  retry: { attempts: 2, strategy: "exponential" },
});

// server-functions/users.ts
import { api } from "@/lib/api";

export const getUser = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await api.get<User>("/users/me");
  return data;
});
```

:::warning
**Do not** share an `HttpClientInstance` between requests with stored per-request state. The `withRequest()` helper uses an `AsyncLocalStorage`-based store to isolate request contexts.
:::
