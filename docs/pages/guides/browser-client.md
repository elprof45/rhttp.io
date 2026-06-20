# Browser Client

`createClientHttp` is a factory that wraps `createHttp` with secure, browser-optimized defaults.

**Import:**

```typescript
import { createClientHttp } from "rhttp.io/client";
// or (re-exported from main)
import { createClientHttp } from "rhttp.io";
```

---

## Default Behaviors

| Feature | Default |
|---|---|
| `credentials` | `"include"` — sends cookies with every request |
| CSRF | Enabled — fetches token from `/api/csrf` |
| Auth token | Read from `localStorage.getItem("access_token")` |
| `Content-Type` | `application/json` |

---

## Basic Usage

```typescript
import { createClientHttp } from "rhttp.io/client";

const http = createClientHttp({
  baseURL: "https://api.example.com",
});

// ✅ Cookies automatically included
// ✅ CSRF token injected on POST/PUT/PATCH/DELETE
// ✅ Authorization header from localStorage
const { data } = await http.get<UserProfile>("/user/profile");
```

---

## Token Management

By default, the client reads the JWT from `localStorage`:

```typescript
// Set the token (e.g., after login)
localStorage.setItem("access_token", "eyJhbGci...");

// All subsequent requests automatically include:
// Authorization: Bearer eyJhbGci...

// Update the token (e.g., after refresh)
localStorage.setItem("access_token", newToken);
```

To use a custom token source:

```typescript
const http = createClientHttp({
  baseURL: "https://api.example.com",
  auth: {
    getToken: async () => {
      // Read from a cookie, a React context, a store, etc.
      return sessionStorage.getItem("token");
    },
  },
});
```

---

## CSRF Protection

CSRF protection is **enabled by default** for state-mutating methods (`POST`, `PUT`, `PATCH`, `DELETE`).

### How it works

1. On initialization (or first mutation), `rhttp.io` fetches a CSRF token from `GET /api/csrf`.
2. The token is stored in memory and the `X-CSRF-Token` header is automatically injected.
3. The token is transparently refreshed when it expires.

### Server-side: CSRF endpoint

Your backend must expose a `GET /api/csrf` endpoint that returns a token. Here's a Next.js example:

```typescript
// app/api/csrf/route.ts
import { generateCsrfToken } from "your-csrf-library";

export async function GET() {
  const token = generateCsrfToken();
  return Response.json({ token });
}
```

### Customizing CSRF

```typescript
const http = createClientHttp({
  baseURL: "https://api.example.com",
  csrf: {
    fetchEndpoint: "/api/auth/csrf",   // Custom endpoint
    cookieName: "XSRF-TOKEN",          // Cookie name
    headerName: "X-XSRF-TOKEN",        // Header name to inject
    methods: ["POST", "PUT", "DELETE"], // Methods to protect
    prefetch: true,                     // Prefetch token on init
  },
});

// Disable CSRF for a specific request
await http.post("/webhook", payload, { csrf: false });
```

### Disabling CSRF

```typescript
const http = createClientHttp({
  baseURL: "https://api.example.com",
  csrf: { enabled: false },
});
```

---

## Complete Configuration

```typescript
const http = createClientHttp({
  baseURL: "https://api.example.com",
  timeout: 15_000,

  // Override default CSRF settings
  csrf: {
    enabled: true,
    fetchEndpoint: "/api/csrf",
    cookieName: "csrf-token",
    headerName: "X-CSRF-Token",
    prefetch: true,
  },

  // Override token source
  auth: {
    scheme: "Bearer",
    getToken: async () => myAuthStore.getToken(),
  },

  // Retry on transient errors
  retry: {
    attempts: 2,
    strategy: "exponential",
    statusCodes: [500, 502, 503],
  },

  // Enable logging in development
  observability: {
    logger: process.env.NODE_ENV === "development",
    tracing: true,
  },
});
```

---

## Automatic JWT Refresh

For automatic token refresh on 401 responses, use `createRefreshAuthInterceptor`:

```typescript
import { createClientHttp } from "rhttp.io/client";
import { createRefreshAuthInterceptor } from "rhttp.io";

const http = createClientHttp({ baseURL: "https://api.example.com" });

http.interceptors.response.use(
  (res) => res,
  createRefreshAuthInterceptor(http, {
    refreshToken: async () => {
      const res = await fetch("/auth/refresh", { method: "POST" });
      const { accessToken } = await res.json();
      return accessToken;
    },
    onTokenRefreshed: (newToken) => {
      localStorage.setItem("access_token", newToken);
    },
  })
);
```

:::note
If two concurrent requests both receive a `401`, only **one** refresh call is made. The second request is queued and automatically retried with the new token.
:::
