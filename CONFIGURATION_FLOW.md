# Configuration Flow: defaultFetchOptions, csrf, and requestContext

This document clarifies how configuration options flow through the three entry points: `createHttp()` (core), `createClientHttp()` (client), and `createServerHttp()` (server).

## Overview

The rhttp.io library provides three factory functions:

1. **`createHttp(config)`** (core.ts) - Base isomorphic client with all features
2. **`createClientHttp(config)`** (client.ts) - Browser-optimized with secure defaults
3. **`createServerHttp(config)`** (server.ts) - Server-optimized for SSR

Each entry point accepts configuration and applies intelligent defaults while allowing user overrides.

---

## Configuration Option 1: `defaultFetchOptions`

### What is it?

Native Fetch API options that apply to all HTTP requests made by the client.

### Where it flows

```
User Config
    ↓
Client/Server Factory
    ↓
Smart Merge (defaults + user config)
    ↓
Core createHttp()
    ↓
Every request execution
```

### Browser Client (`createClientHttp`)

**Default values:**
```typescript
{
  credentials: "include",           // Always send cookies
  headers: {
    "Content-Type": "application/json"
  }
}
```

**User can override:**
```typescript
const http = createClientHttp({
  defaultFetchOptions: {
    credentials: "omit",            // Override default
    headers: {
      "X-Custom-Header": "value"    // Merged with defaults
    }
  }
});
```

**Smart merging:**
- Default headers: `{ "Content-Type": "application/json" }`
- User headers: `{ "X-Custom-Header": "value" }`
- Result: `{ "Content-Type": "application/json", "X-Custom-Header": "value" }`

**Implementation in client.ts:**
```typescript
const clientDefaults = {
  credentials: "include" as const,
  headers: { "Content-Type": "application/json" },
};

const mergedFetchOptions = {
  ...clientDefaults,
  ...config.defaultFetchOptions,
  headers: {
    ...clientDefaults.headers,
    ...(config.defaultFetchOptions?.headers || {}),
  },
};

const http = createHttp({
  ...config,
  defaultFetchOptions: mergedFetchOptions,
  // ...
});
```

### Server Client (`createServerHttp`)

**Default values:**
- No specific defaults (inherits from core)
- Enables cookie forwarding via `auth: { forwardCookies: true }`

**User can override:**
```typescript
const http = createServerHttp({
  defaultFetchOptions: {
    headers: {
      "X-API-Key": process.env.API_KEY,
      "X-Service-Name": "my-app"
    }
  }
});
```

### Core Client (`createHttp`)

**No specific defaults** for `defaultFetchOptions`, accepts any user configuration.

**Passes directly to Fetch API:**
```typescript
const http = createHttp({
  defaultFetchOptions: {
    headers: { "Authorization": "Bearer token" },
    // ... any valid RequestInit options
  }
});
```

---

## Configuration Option 2: `csrf`

### What is it?

Configuration for CSRF (Cross-Site Request Forgery) token management.

### Where it flows

```
User Config
    ↓
Client/Server Factory
    ↓
Config merging (defaults + user config)
    ↓
Core createHttp()
    ↓
Request interceptor
    ↓
Auto-inject token header
```

### Browser Client (`createClientHttp`)

**Default values:**
```typescript
{
  enabled: true,                         // CSRF auto-enabled
  cookieName: "csrf-token",              // Where to find token in cookies
  headerName: "X-CSRF-Token",            // Header to send token in
  fetchEndpoint: "/api/csrf",            // Where to fetch token from
  prefetch: true,                        // Fetch token on init
  methods: ["POST", "PUT", "PATCH", "DELETE"]
}
```

**User can override:**
```typescript
const http = createClientHttp({
  csrf: {
    enabled: false,                      // Disable CSRF entirely
    // or customize:
    fetchEndpoint: "/api/v1/csrf-token",
    cookieName: "x-csrf-token",
    headerName: "X-CSRF-Token",
    prefetch: false
  }
});
```

**Implementation in client.ts:**
```typescript
const http = createHttp({
  ...config,
  csrf: {
    enabled: true,
    cookieName: "csrf-token",
    headerName: "X-CSRF-Token",
    fetchEndpoint: "/api/csrf",
    prefetch: true,
    ...config.csrf,  // User config overrides defaults
  },
});
```

### Server Client (`createServerHttp`)

**Default values:**
- CSRF disabled (no user input to protect)

**User can override:**
```typescript
const http = createServerHttp({
  csrf: {
    enabled: true,  // If needed for server-to-server requests
    headerName: "X-CSRF-Token"
  }
});
```

### Core Client (`createHttp`)

**Default values:**
```typescript
{
  enabled: false,  // CSRF disabled by default
  // ... other defaults
}
```

**User can enable:**
```typescript
const http = createHttp({
  csrf: {
    enabled: true,
    fetchEndpoint: "/api/csrf",
    cookieName: "csrf-token",
    headerName: "X-CSRF-Token"
  }
});
```

---

## Configuration Option 3: `requestContext`

### What is it?

A function that returns the current request context (needed for SSR to access cookies).

### Where it flows

```
User Config
    ↓
Server Factory
    ↓
Stored in config
    ↓
Request interceptor
    ↓
Calls requestContext()
    ↓
Extracts cookies
    ↓
Injects into headers
```

### Server Client (`createServerHttp`)

**Default behavior:**
- Attempts to auto-detect TanStack Start via dynamic import
- Falls back to `config.requestContext()` if provided
- Silently fails if neither is available

**User can explicitly provide:**
```typescript
// Option 1: Pass explicit requestContext
const http = createServerHttp({
  requestContext: () => getRequest(),  // Your context getter
});

// Option 2: Let it auto-detect TanStack Start
const http = createServerHttp({
  // No requestContext needed, will try getRequest() automatically
});

// Option 3: Custom context implementation
const http = createServerHttp({
  requestContext: () => {
    try {
      return getAsyncLocalStorage().getStore();
    } catch {
      return null;
    }
  }
});
```

**Implementation in server.ts:**
```typescript
http.interceptors.request.use(async (options) => {
  try {
    let request: any = null;

    // Try TanStack Start first (auto-detect)
    try {
      const module = await import("@tanstack/react-start/server");
      request = module?.getRequest?.();
    } catch {
      // Skip if TanStack not available
    }

    // Fall back to config.requestContext
    if (!request && config.requestContext) {
      try {
        request = config.requestContext();
      } catch {
        // Ignore if fails
      }
    }

    // Extract and forward cookies if we have a request
    if (request && typeof request.headers?.get === "function") {
      const cookieHeader = request.headers.get("cookie");
      if (cookieHeader) {
        options.headers = options.headers || {};
        options.headers["cookie"] = cookieHeader;
      }
    }
  } catch {
    // Silently ignore errors (e.g., outside request context)
  }

  return options;
});
```

---

## Complete Configuration Examples

### Browser Client with All Customizations

```typescript
import { createClientHttp } from "rhttp.io/client";

const http = createClientHttp({
  baseURL: "https://api.example.com",
  timeout: 30_000,
  
  // Override default fetch options
  defaultFetchOptions: {
    credentials: "include",  // Keep default
    headers: {
      "Content-Type": "application/json",  // Merged with default
      "X-App-Version": "1.0.0",           // Custom header
    },
  },
  
  // Customize CSRF
  csrf: {
    enabled: true,
    fetchEndpoint: "/api/v1/csrf-token",
    cookieName: "x-csrf",
    prefetch: true,
  },
  
  // Other config
  retry: { attempts: 3 },
  cache: { enabled: true, ttl: 60000 },
});
```

### Server Client with Custom Context

```typescript
import { createServerHttp } from "rhttp.io/server";
import { getAsyncLocalStorage } from "my-framework";

const http = createServerHttp({
  baseURL: process.env.INTERNAL_API_URL,
  timeout: 30_000,
  
  // Provide custom request context
  requestContext: () => {
    try {
      const store = getAsyncLocalStorage().getStore();
      return store?.request;
    } catch {
      return null;
    }
  },
  
  // Custom headers
  defaultFetchOptions: {
    headers: {
      "X-Service": "my-app",
      "X-Environment": process.env.NODE_ENV,
    },
  },
  
  // Observability
  observability: {
    logger: true,
    tracing: true,
    metrics: process.env.NODE_ENV === "production",
  },
});
```

### Core Client with Manual Configuration

```typescript
import { createHttp } from "rhttp.io";

const http = createHttp({
  baseURL: "https://api.example.com",
  
  // Explicit fetch options (no smart defaults)
  defaultFetchOptions: {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer token",
    },
  },
  
  // Manual CSRF setup
  csrf: {
    enabled: true,
    fetchEndpoint: "/csrf-token",
    headerName: "X-CSRF-Token",
  },
  
  // Manual auth
  auth: {
    scheme: "Bearer",
    getToken: async () => localStorage.getItem("token"),
  },
});
```

---

## Key Takeaways

1. **`defaultFetchOptions`**
   - Client defaults: `credentials: "include"`, `headers: { "Content-Type": "application/json" }`
   - Headers are **merged** (not replaced) when user provides custom headers
   - Other Fetch API options are fully customizable

2. **`csrf`**
   - Auto-enabled in `createClientHttp()`, disabled elsewhere
   - User can disable/customize with `csrf: { enabled: false, ... }`
   - Token auto-injected in request headers (default: `X-CSRF-Token`)

3. **`requestContext`**
   - Optional function for SSR environments
   - Server automatically tries TanStack Start first
   - Falls back gracefully if not in request context
   - User can provide custom implementation

4. **Configuration Merging**
   - Defaults are applied intelligently
   - User config overrides defaults
   - Special handling for nested objects (headers, csrf, auth)
   - Backward compatible with existing code

5. **Backward Compatibility**
   - All changes are additive
   - Existing `createHttp()` calls still work
   - No breaking changes to API surface
   - Optional parameters with sensible defaults
