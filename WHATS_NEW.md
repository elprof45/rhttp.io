# What's New: Configuration Improvements

## Overview

The latest improvements to rhttp.io make it easier to configure HTTP clients with smart defaults and flexible customization options. All changes are backward compatible.

## For Browser Users

### Smart Header Merging

You can now add custom headers without losing the default `Content-Type: application/json`:

```typescript
import { createClientHttp } from "rhttp.io/client";

// Before: Custom headers would overwrite Content-Type
// Now: Headers are intelligently merged
const http = createClientHttp({
  defaultFetchOptions: {
    headers: {
      "X-App-Version": "1.0.0",
      "X-Request-ID": generateId()
    }
  }
});

// Result: Both default and custom headers are present
// - Content-Type: application/json (from default)
// - X-App-Version: 1.0.0 (from user)
// - X-Request-ID: ... (from user)
```

### CSRF Configuration

Control CSRF token handling per instance:

```typescript
// Disable CSRF protection (if you handle it elsewhere)
const http = createClientHttp({
  csrf: { enabled: false }
});

// Use custom CSRF endpoint
const http = createClientHttp({
  csrf: {
    fetchEndpoint: "/api/v2/csrf-token",
    headerName: "X-CSRF-Token",
    prefetch: true
  }
});

// Or mix defaults with custom options
const http = createClientHttp({
  csrf: {
    enabled: true,
    cookieName: "x-csrf-custom"
    // Other options use defaults
  }
});
```

### Automatic Token Injection

Set your token once, it's automatically injected in all requests:

```typescript
import { createClientHttp } from "rhttp.io/client";

const http = createClientHttp();

// Set your token in localStorage
function login(token) {
  localStorage.setItem("access_token", token);
}

// Token is automatically injected
// Authorization: Bearer <token>
const { data } = await http.get("/protected-data");

// No need to manually add headers
```

---

## For Server Users (SSR/TanStack Start)

### Simpler Configuration

Cookie forwarding is now automatic:

```typescript
import { createServerHttp } from "rhttp.io/server";

// Option 1: Auto-detect TanStack Start (simplest)
const http = createServerHttp({
  baseURL: "https://internal-api.example.com"
});

// Option 2: Explicitly pass context (explicit)
import { getRequest } from "@tanstack/react-start/server";
const http = createServerHttp({
  baseURL: "https://internal-api.example.com",
  requestContext: () => getRequest()
});

// Option 3: Custom context (for other frameworks)
const http = createServerHttp({
  baseURL: "https://internal-api.example.com",
  requestContext: () => getAsyncLocalStorage().getStore()
});

// All cookies from incoming request are automatically forwarded
// No need for `withRequest()` wrapper
```

### Custom Headers

Add service-to-service headers:

```typescript
const http = createServerHttp({
  defaultFetchOptions: {
    headers: {
      "X-Service": "my-app",
      "X-Environment": process.env.NODE_ENV,
      "X-API-Key": process.env.INTERNAL_API_KEY
    }
  }
});
```

---

## For Advanced Users

### Core Client with Full Control

When you need maximum flexibility:

```typescript
import { createHttp } from "rhttp.io";

const http = createHttp({
  baseURL: "https://api.example.com",
  timeout: 30_000,
  
  // Configuration that works in browser or server
  defaultFetchOptions: {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-Custom": "value"
    }
  },
  
  // CSRF configuration
  csrf: {
    enabled: true,
    fetchEndpoint: "/api/csrf",
    prefetch: true
  },
  
  // Authentication
  auth: {
    scheme: "Bearer",
    getToken: async () => {
      if (typeof window !== "undefined") {
        return localStorage.getItem("token");
      } else {
        return process.env.API_TOKEN;
      }
    }
  },
  
  // Retry logic
  retry: {
    attempts: 3,
    strategy: "exponential",
    statusCodes: [408, 429, 500, 502, 503, 504]
  },
  
  // Caching
  cache: {
    enabled: true,
    ttl: 60_000,
    strategy: "LRU"
  },
  
  // Observability
  observability: {
    logger: true,
    tracing: true,
    metrics: true
  }
});
```

---

## Configuration Reference

### Browser Client (`createClientHttp`)

```typescript
interface BrowserClientConfig {
  // Basic
  baseURL?: string;
  timeout?: number;
  
  // Fetch options (smart-merged)
  defaultFetchOptions?: {
    credentials?: "include" | "omit" | "same-origin";  // defaults to "include"
    headers?: Record<string, string>;  // merged with { "Content-Type": "application/json" }
    // ... other RequestInit options
  };
  
  // CSRF (enabled by default)
  csrf?: {
    enabled?: boolean;  // true by default
    fetchEndpoint?: string;  // "/api/csrf" by default
    cookieName?: string;  // "csrf-token" by default
    headerName?: string;  // "X-CSRF-Token" by default
    methods?: string[];
    prefetch?: boolean;  // true by default
  };
  
  // Token (auto-injected from localStorage)
  auth?: {
    getToken?: () => string | Promise<string>;
    scheme?: string;  // "Bearer" by default
  };
  
  // ... and all other core options
}
```

### Server Client (`createServerHttp`)

```typescript
interface ServerClientConfig {
  // Basic
  baseURL?: string;
  timeout?: number;
  
  // Request context (auto-detects TanStack Start)
  requestContext?: () => Request | null;
  
  // Fetch options
  defaultFetchOptions?: {
    headers?: Record<string, string>;
    // ... other RequestInit options
  };
  
  // Authentication (forwardCookies enabled by default)
  auth?: {
    forwardCookies?: boolean;  // true by default
    scheme?: string;
    getToken?: () => string | Promise<string>;
  };
  
  // Observability (enabled by default)
  observability?: {
    logger?: boolean;  // true by default
    tracing?: boolean;  // true by default
    metrics?: boolean;  // true in production by default
  };
  
  // ... and all other core options
}
```

### Core Client (`createHttp`)

Supports all options from above plus:
- All retry configurations
- All cache configurations
- All CSRF configurations
- Interceptors
- Request cancellation
- Batch requests
- ... and more

---

## Migration Guide

### From old to new patterns

All old code continues to work. Here are common upgrades:

#### Browser Client

```typescript
// Old way (still works)
import { createClientHttp } from "rhttp.io/client";
const http = createClientHttp();

// Add custom headers (now merged better)
// Old: Needed to keep existing headers
// New: Just pass your headers, defaults are preserved
const http = createClientHttp({
  defaultFetchOptions: {
    headers: { "X-Custom": "value" }  // Content-Type still present!
  }
});
```

#### Server Client

```typescript
// Old way with withRequest (still works)
import { withRequest } from "rhttp.io";
const data = await withRequest(async () => {
  return http.get("/data");
});

// New way (no wrapper needed)
const data = await http.get("/data");  // Cookies auto-forwarded
```

#### Token Management

```typescript
// Old way (still works)
const http = createClientHttp({
  auth: {
    getToken: () => localStorage.getItem("token")
  }
});

// New way (even simpler)
// Just set localStorage
localStorage.setItem("access_token", token);
const http = createClientHttp();
// Token auto-injected
```

---

## Benefits

### For Developers

✅ **Simpler Code**: Less boilerplate, sensible defaults
✅ **More Control**: Easy to customize when needed  
✅ **Type Safety**: Full TypeScript support
✅ **Smart Defaults**: Different defaults for browser vs server
✅ **Auto-Detection**: TanStack Start auto-detected when available
✅ **Clear Errors**: Better error messages when misconfigured

### For Applications

✅ **Smaller Bundle**: Less code to write means smaller bundles
✅ **Better Security**: Secure defaults by default
✅ **Better Performance**: Smart caching and retry defaults
✅ **Better DX**: Intuitive configuration
✅ **Better Maintainability**: Clear intent in configuration

---

## Examples

### React Query with Automatic Auth

```typescript
import { createClientHttp } from "rhttp.io/client";
import { useQuery } from "@tanstack/react-query";

const http = createClientHttp({
  baseURL: process.env.REACT_APP_API_URL
});

export function useGetUser() {
  return useQuery({
    queryKey: ["user"],
    queryFn: () => http.get("/user").then(r => r.data)
    // Token automatically injected ✓
    // CSRF token automatically injected ✓
  });
}

// Login stores token
export function useLogin() {
  return useMutation({
    mutationFn: (credentials) => http.post("/login", credentials),
    onSuccess: (data) => {
      localStorage.setItem("access_token", data.token);
      queryClient.invalidateQueries({ queryKey: ["user"] });
    }
  });
}
```

### TanStack Start Server Function

```typescript
import { createServerHttp } from "rhttp.io/server";
import { createServerFn } from "@tanstack/react-start/server";

const http = createServerHttp({
  baseURL: process.env.INTERNAL_API_URL
});

export const getOrdersData = createServerFn({ method: "GET" })
  .handler(async () => {
    // Cookies from browser automatically forwarded ✓
    // CSRF token can be validated ✓
    const { data } = await http.get("/api/orders");
    return data;
  });
```

### Express with Custom Context

```typescript
import { createServerHttp } from "rhttp.io/server";
import { AsyncLocalStorage } from "async_hooks";

const asyncLocalStorage = new AsyncLocalStorage();

export const http = createServerHttp({
  baseURL: process.env.API_URL,
  requestContext: () => {
    try {
      const store = asyncLocalStorage.getStore();
      return store?.request;
    } catch {
      return null;
    }
  }
});

app.use((req, res, next) => {
  asyncLocalStorage.run({ request: req }, next);
});
```

---

## Troubleshooting

### Token Not Being Injected

```typescript
// Make sure to set localStorage first
localStorage.setItem("access_token", "your-token");

// Client should be created after
const http = createClientHttp();

// Then token will be injected
```

### CSRF Token Not Being Sent

```typescript
// Make sure CSRF is enabled (default for browser)
const http = createClientHttp({
  csrf: { enabled: true }
});

// Make sure mutation method is in the list (POST, PUT, PATCH, DELETE)
// GET requests don't need CSRF
```

### Cookies Not Forwarded on Server

```typescript
// Make sure requestContext is provided or TanStack Start is available
const http = createServerHttp({
  requestContext: () => getRequest()  // TanStack Start
});

// Or custom context
const http = createServerHttp({
  requestContext: () => getAsyncLocalStorage().getStore()
});

// If neither, cookies won't be forwarded (but no error)
```

---

## Need Help?

- 📖 See `CONFIGURATION_FLOW.md` for technical details
- 📚 See `CONFIGURATION_EXAMPLES.md` for more examples
- ✅ See `CONFIGURATION_VALIDATION.md` for feature verification

---

## What's Coming Next?

- Performance optimization guides
- Video tutorials
- Type inference improvements
- Plugin system enhancements

Thank you for using rhttp.io!
