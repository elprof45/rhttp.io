# Configuration Examples for rhttp.io

Cette documentation montre comment utiliser `defaultFetchOptions`, `csrf` et `requestContext` en configuration.

## Client Configuration

### Example 1: Override defaultFetchOptions

```typescript
import { createClientHttp } from "rhttp.io/client";

const http = createClientHttp({
  baseURL: "https://api.example.com",
  timeout: 30_000,
  
  // Override defaultFetchOptions
  defaultFetchOptions: {
    credentials: "include",  // Include cookies in all requests
    headers: {
      "Content-Type": "application/json",
      "X-Custom-Header": "value",
    },
  },
});

// Usage: All requests will include credentials and headers
const { data } = await http.get("/protected-data");
```

### Example 2: Custom CSRF Configuration

```typescript
import { createClientHttp } from "rhttp.io/client";

const http = createClientHttp({
  baseURL: "https://api.example.com",
  
  // Override CSRF configuration
  csrf: {
    enabled: true,
    fetchEndpoint: "/api/v1/csrf",  // Custom endpoint
    cookieName: "x-csrf-token",      // Custom cookie name
    headerName: "X-CSRF-Token",      // Custom header name
    methods: ["POST", "PUT", "PATCH", "DELETE"],
    prefetch: true,                  // Prefetch on init
  },
});

// CSRF token will be auto-injected on mutations
await http.post("/data", { name: "test" });
```

### Example 3: Combine Multiple Options

```typescript
import { createClientHttp } from "rhttp.io/client";
import { createRefreshAuthInterceptor } from "rhttp.io";

const http = createClientHttp({
  baseURL: "https://api.example.com",
  timeout: 30_000,
  
  defaultFetchOptions: {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  },
  
  csrf: {
    enabled: true,
    prefetch: true,
  },
  
  // Automatic token from localStorage
  // (already added by createClientHttp interceptor)
});

// Add JWT refresh interceptor
const refreshInterceptor = createRefreshAuthInterceptor(http, {
  refreshToken: async () => {
    const response = await fetch("https://api.example.com/auth/refresh", {
      method: "POST",
      credentials: "include",
    });
    const { accessToken } = await response.json();
    return accessToken;
  },
  onTokenRefreshed: (newToken) => {
    localStorage.setItem("access_token", newToken);
  },
});

http.interceptors.response.use((r) => r, refreshInterceptor);
```

## Server Configuration

### Example 1: With TanStack Start requestContext

```typescript
import { createServerHttp } from "rhttp.io/server";
import { getRequest } from "@tanstack/react-start/server";

const http = createServerHttp({
  baseURL: process.env.INTERNAL_API_URL,
  timeout: 30_000,
  
  // Pass requestContext to auto-forward cookies
  requestContext: () => getRequest(),
  
  observability: {
    logger: true,
    tracing: true,
    metrics: true,
  },
});

// In server function
export const getOrders = createServerFn({ method: "GET" }).handler(async () => {
  // Cookies from getRequest() are automatically forwarded
  const { data } = await http.get("/api/orders");
  return data;
});
```

### Example 2: Without TanStack (plain Node.js context)

```typescript
import { createServerHttp } from "rhttp.io/server";

const http = createServerHttp({
  baseURL: process.env.INTERNAL_API_URL,
  timeout: 30_000,
  
  // No requestContext needed - will try TanStack Start automatically
  // Falls back gracefully if TanStack not available
});

// For non-TanStack usage, you can still use withRequest if needed
export async function fetchData() {
  const { data } = await http.get("/api/data");
  return data;
}
```

### Example 3: Custom requestContext Implementation

```typescript
import { createServerHttp } from "rhttp.io/server";
import type { Request } from "express";

// Using Express or custom context
let currentRequest: Request | null = null;

export function setCurrentRequest(req: Request) {
  currentRequest = req;
}

const http = createServerHttp({
  baseURL: process.env.INTERNAL_API_URL,
  
  // Custom requestContext implementation
  requestContext: () => currentRequest,
});

// Middleware
export const contextMiddleware = (req: Request, res: Response, next: NextFunction) => {
  setCurrentRequest(req);
  next();
};

// Use in route handler
app.get("/api/data", contextMiddleware, async (req, res) => {
  // Cookies from req are automatically forwarded
  const { data } = await http.get("/internal-api/data");
  res.json(data);
});
```

## Core Configuration (Isomorphic)

### Example: Full Configuration

```typescript
import { createHttp } from "rhttp.io";

const http = createHttp({
  baseURL: "https://api.example.com",
  timeout: 30_000,
  
  // Default headers
  defaultHeaders: {
    "X-App-Version": "1.0.0",
  },
  
  // Default fetch options (native Fetch API)
  defaultFetchOptions: {
    credentials: "include",  // Send cookies
    headers: {
      "Content-Type": "application/json",
    },
    // Any other RequestInit options
  },
  
  // CSRF configuration
  csrf: {
    enabled: true,
    fetchEndpoint: "/api/csrf",
    cookieName: "csrf-token",
    headerName: "X-CSRF-Token",
    methods: ["POST", "PUT", "PATCH", "DELETE"],
    prefetch: false,  // Don't prefetch (optional)
  },
  
  // Retry configuration
  retry: {
    attempts: 3,
    strategy: "exponential",
    delay: 300,
    maxDelay: 30_000,
    statusCodes: [408, 429, 500, 502, 503, 504],
  },
  
  // Caching
  cache: {
    enabled: true,
    ttl: 60_000,
  },
  
  // Authentication
  auth: {
    forwardCookies: false,  // Set to true for SSR
    scheme: "Bearer",
    getToken: async () => localStorage.getItem("access_token"),
  },
  
  // Observability
  observability: {
    logger: true,
    tracing: true,
    metrics: true,
  },
  
  // Request context (for SSR)
  requestContext: () => {
    try {
      return getAsyncLocalStorage().getStore();
    } catch {
      return null;
    }
  },
});
```

## Advanced: Conditional Configuration

```typescript
import { createHttp } from "rhttp.io";
import { createClientHttp } from "rhttp.io/client";
import { createServerHttp } from "rhttp.io/server";

// Create different clients based on environment
export function createAppHttp(env: "browser" | "server" = "browser") {
  if (env === "browser") {
    // Browser client with CSRF and token handling
    return createClientHttp({
      baseURL: process.env.REACT_APP_API_URL,
      defaultFetchOptions: {
        credentials: "include",
      },
      csrf: {
        enabled: true,
        prefetch: true,
      },
    });
  } else {
    // Server client with cookie forwarding
    return createServerHttp({
      baseURL: process.env.INTERNAL_API_URL,
      auth: {
        forwardCookies: true,
      },
      observability: {
        logger: true,
        tracing: true,
        metrics: process.env.NODE_ENV === "production",
      },
    });
  }
}
```

## Key Points

1. **defaultFetchOptions**: Can be fully customized. The defaults provided by `createClientHttp` are:
   - `credentials: "include"` - Include cookies
   - `headers: { "Content-Type": "application/json" }` - JSON by default

2. **csrf**: Auto-enabled in `createClientHttp`, auto-disabled elsewhere. Override with:
   - `enabled: boolean` - Enable/disable CSRF
   - `fetchEndpoint: string` - Where to get the CSRF token
   - `cookieName: string` - Name of CSRF cookie
   - `headerName: string` - Header to send token in
   - `prefetch: boolean` - Prefetch token on init

3. **requestContext**: Optional but recommended for SSR:
   - Pass a function that returns the current request context
   - Works with TanStack Start via `getRequest()`
   - Works with other frameworks via custom implementations
   - Gracefully ignored if not in a request context

4. **Backward Compatibility**: All existing code continues to work. The new features are:
   - Optional configuration of defaults
   - Automatic cookie forwarding in server context
   - Automatic token injection from localStorage on client
