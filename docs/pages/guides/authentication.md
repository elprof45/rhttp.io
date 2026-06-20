# Authentication

`rhttp.io` supports multiple authentication strategies out of the box. All are configured through the `auth` option.

---

## Pattern 1: Static Token (Service-to-Service)

The simplest pattern — a fixed token, perfect for API key authentication or service-to-service calls:

```typescript
import { createServerHttp } from "rhttp.io/server";

const api = createServerHttp({
  baseURL: "https://internal-api.example.com",
  auth: {
    accessToken: process.env.SERVICE_TOKEN,
    scheme: "Bearer",   // "Bearer" | "Basic" | "ApiKey" | any string
  },
});

// Every request includes: Authorization: Bearer <token>
```

---

## Pattern 2: Dynamic Token with `getToken`

Use a function to resolve the token dynamically before each request. Ideal for tokens that may change:

```typescript
import { createHttp } from "rhttp.io";

const http = createHttp({
  baseURL: "https://api.example.com",
  auth: {
    scheme: "Bearer",
    getToken: async () => {
      // Read from any source: localStorage, memory, a DB, etc.
      const token = localStorage.getItem("access_token");
      return token; // Return null to skip the Authorization header
    },
  },
});
```

:::note
`getToken` takes priority over `accessToken`. If `getToken` returns `null` or `undefined`, no `Authorization` header is added.
:::

---

## Pattern 3: Automatic JWT Refresh on 401

Automatically refresh expired tokens and retry queued requests with the new token:

```typescript
import { createHttp, createRefreshAuthInterceptor } from "rhttp.io";

const http = createHttp({
  baseURL: "https://api.example.com",
  auth: {
    scheme: "Bearer",
    getToken: () => localStorage.getItem("access_token"),
  },
});

// Attach the refresh interceptor to the error path
http.interceptors.response.use(
  (res) => res,
  createRefreshAuthInterceptor(http, {
    // Called when a 401 response is received
    refreshToken: async () => {
      const res = await fetch("/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refreshToken: localStorage.getItem("refresh_token"),
        }),
      });
      const data = await res.json();
      return data.accessToken; // Must return the new token string
    },

    // Called after a successful refresh
    onTokenRefreshed: (newToken) => {
      localStorage.setItem("access_token", newToken);
    },

    // Status codes that trigger the refresh (default: [401])
    statusCodes: [401],
  })
);
```

**What happens behind the scenes:**

1. Request A gets a `401`.
2. `createRefreshAuthInterceptor` detects the 401 and calls `refreshToken()`.
3. While refreshing, Request B (also 401) is queued — **NOT** a second refresh.
4. After refresh succeeds, Request A and B are both retried with the new token.

:::tip
This is the recommended approach for **single-page applications** with JWT authentication.
:::

---

## Pattern 4: Pre-emptive Token Refresh with `getToken`

Check token expiry before each request to avoid 401 errors altogether:

```typescript
const http = createHttp({
  baseURL: "https://api.example.com",
  auth: {
    scheme: "Bearer",
    getToken: async () => {
      let token = localStorage.getItem("access_token");
      const expiresAt = parseInt(localStorage.getItem("token_expires_at") ?? "0", 10);

      // Refresh if token expires in the next 60 seconds
      if (Date.now() > expiresAt - 60_000) {
        const res = await fetch("/auth/refresh", { method: "POST" });
        const data = await res.json();
        localStorage.setItem("access_token", data.accessToken);
        localStorage.setItem("token_expires_at", String(data.expiresAt));
        token = data.accessToken;
      }

      return token;
    },
  },
});
```

---

## Pattern 5: Cookie-Based Sessions (SSR)

For SSR environments where authentication is managed via cookies:

```typescript
import { createServerHttp } from "rhttp.io/server";
import { getRequest } from "@tanstack/react-start/server";

const apiServer = createServerHttp({
  baseURL: process.env.API_URL,
  auth: { forwardCookies: true },
  requestContext: () => getRequest(),
});

// Cookies from the browser request are automatically forwarded
export const fetchDashboard = createServerFn({ method: "GET" }).handler(
  async () => {
    const { data } = await apiServer.get<Dashboard>("/dashboard");
    return data;
  }
);
```

---

## `AuthConfig` Reference

```typescript
interface AuthConfig {
  /** 
   * Forward incoming request cookies (SSR only).
   * Works with TanStack Start auto-detection or explicit requestContext.
   * Default: false
   */
  forwardCookies: boolean;

  /** 
   * Static token string. Used when getToken is not provided.
   */
  accessToken?: string;

  /** 
   * Auth scheme prepended to the token.
   * Values: "Bearer" | "Basic" | "ApiKey" | any string
   * Default: "Bearer"
   */
  scheme: string;

  /**
   * Async function to resolve the token dynamically.
   * Called before each request.
   * Return null to skip the Authorization header.
   */
  getToken?: () => Promise<string | null> | string | null;
}
```

---

## `createRefreshAuthInterceptor` Options

```typescript
interface RefreshAuthOptions {
  /**
   * Called when a 401 (or configured status code) is received.
   * Must return the new access token, or null/throw to propagate the error.
   */
  refreshToken: () => Promise<string | null> | string | null;

  /**
   * Called after a successful refresh. Use to persist the new token.
   */
  onTokenRefreshed?: (newToken: string) => void | Promise<void>;

  /**
   * Status codes that trigger the refresh logic.
   * Default: [401]
   */
  statusCodes?: number[];
}
```
