# HTTP.io Configuration Guide

Complete guide for configuring rhttp.io for different environments and use cases.

## Environment-Specific Configurations

### 1. Browser Environment

```typescript
import { createClientHttp } from "rhttp.io/client";

const http = createClientHttp({
  baseURL: "https://api.example.com",

  // Browser defaults
  csrf: {
    enabled: true,
    prefetch: true,           // Load CSRF token on init
    fetchEndpoint: "/api/csrf",
    cookieName: "csrf-token",
    headerName: "X-CSRF-Token",
  },

  // Client-side auth
  auth: {
    getToken: () => localStorage.getItem("auth_token"),
    scheme: "Bearer",
    forwardCookies: false,
  },

  // Browser caching
  cache: {
    enabled: true,
    ttl: 300_000,  // 5 minutes
    maxSize: 100,  // Limit memory
  },

  // Less verbose in production
  observability: {
    logger: process.env.NODE_ENV === "development",
    tracing: false,
    metrics: false,
  },
});
```

### 2. Server Environment (Node.js)

```typescript
import { createServerHttp } from "rhttp.io/server";

const http = createServerHttp({
  baseURL: process.env.INTERNAL_API_URL,

  // Server-side auth
  auth: {
    accessToken: process.env.SERVICE_TOKEN,
    scheme: "Bearer",
    forwardCookies: true,  // Forward incoming request cookies
  },

  // Longer cache for server
  cache: {
    enabled: true,
    ttl: 600_000,  // 10 minutes
    maxSize: 500,
  },

  // More detailed logging
  observability: {
    logger: true,
    tracing: true,
    metrics: true,
  },

  // Resilient
  retry: {
    attempts: 5,
    strategy: "exponential",
    delay: 100,
    maxDelay: 10_000,
    statusCodes: [408, 429, 500, 502, 503, 504],
  },

  circuitBreaker: {
    enabled: true,
    failureThreshold: 10,
    successThreshold: 3,
    timeout: 60_000,
  },

  requestPool: {
    enabled: true,
    maxConcurrent: 10,
    queueLimit: 100,
  },
});
```

### 3. Edge Runtime (Vercel, Cloudflare)

```typescript
import { createHttp } from "rhttp.io";

const http = createHttp({
  baseURL: "https://api.example.com",

  // Short timeouts for edge
  timeout: 10_000,

  // No persistent state
  cache: {
    enabled: false,  // Or use in-memory only
  },

  // Minimal logging
  observability: {
    logger: false,
    tracing: true,   // Keep for debugging
    metrics: false,
  },

  // Edge-friendly retry
  retry: {
    attempts: 2,
    strategy: "exponential",
    delay: 50,
    maxDelay: 2_000,
    statusCodes: [429, 500, 502, 503, 504],
  },

  // Custom fetch for edge compatibility
  fetch: globalThis.fetch,
});
```

### 4. React with TanStack Query

```typescript
import { withReact } from "rhttp.io/react";
import { useQuery, useMutation, useInfiniteQuery } from "@tanstack/react-query";

const http = withReact(
  createClientHttp({
    baseURL: "https://api.example.com",

    cache: {
      enabled: true,
      ttl: 60_000,  // 1 minute
      strategy: "stale-while-revalidate",
    },

    retry: {
      attempts: 2,
      strategy: "exponential",
      statusCodes: [408, 429, 500, 502, 503, 504],
    },
  })
);

// Query with TanStack Query
export function Posts() {
  const { data: posts, isLoading } = useQuery({
    ...http.query<Post[]>({
      url: "/posts",
      cache: true,
    }),
  });

  // Mutation
  const createMutation = useMutation({
    ...http.mutation<CreatePostInput, Post>({
      method: "POST",
      url: "/posts",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/posts"] });
    },
  });

  return (
    <div>
      {posts?.map(p => <PostItem key={p.id} post={p} />)}
      <button onClick={() => createMutation.mutate({ title: "New" })}>
        Create
      </button>
    </div>
  );
}
```

### 5. Next.js with SSR

```typescript
// lib/http-server.ts
import { createServerHttp } from "rhttp.io/server";

export const serverHttp = createServerHttp({
  baseURL: process.env.INTERNAL_API_URL,
  auth: {
    accessToken: process.env.SERVICE_TOKEN,
    scheme: "Bearer",
    forwardCookies: true,
  },
});

// lib/http-client.ts
import { createClientHttp } from "rhttp.io/client";

export const clientHttp = createClientHttp({
  baseURL: "https://api.example.com",
  csrf: {
    enabled: true,
    prefetch: true,
  },
});

// app/api/data/route.ts
import { serverHttp } from "@/lib/http-server";

export async function GET(request: Request) {
  try {
    const response = await serverHttp.withRequest(request, () =>
      serverHttp.get("/protected-data")
    );

    return Response.json(response.data);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// app/components/DataComponent.tsx
"use client";

import { clientHttp } from "@/lib/http-client";
import { useEffect, useState } from "react";

export function DataComponent() {
  const [data, setData] = useState(null);

  useEffect(() => {
    clientHttp.get("/data").then((response) => {
      setData(response.data);
    });
  }, []);

  return <div>{JSON.stringify(data)}</div>;
}
```

### 6. TanStack Start

```typescript
// api/client.ts
import { createClientHttp } from "rhttp.io/client";

export const http = createClientHttp({
  baseURL: "https://api.example.com",
});

// api/server.ts
import { createServerHttp, setRequestContextStore } from "rhttp.io/server";

// Setup context store for TanStack Start
if (typeof import.meta.env.SSR !== "undefined") {
  setRequestContextStore(require("@tanstack/start").getRequestContext);
}

export const http = createServerHttp({
  baseURL: process.env.INTERNAL_API_URL,
  auth: {
    forwardCookies: true,
  },
});

// routes/api/data.ts
import { createServerFn } from "@tanstack/start";
import { http } from "@/api/server";

export const fetchData = createServerFn({ method: "GET" }).handler(
  async ({ request }) => {
    return http.withRequest(request, () =>
      http.get("/data")
    );
  }
);

// routes/index.tsx
export default function Home() {
  const data = createQuery(() => ({
    queryFn: () => fetchData(),
  }));

  return <div>{data.data?.data}</div>;
}
```

---

## Feature Configurations

### High-Performance Configuration

```typescript
const http = createHttp({
  baseURL: "https://api.example.com",

  // Aggressive caching
  cache: {
    enabled: true,
    ttl: 300_000,
    maxSize: 1000,
    strategy: "cache-first",
  },

  // Smart deduplication
  requestPool: {
    enabled: true,
    maxConcurrent: 10,
  },

  // Minimal overhead
  observability: {
    logger: false,
    tracing: false,
    metrics: false,
  },

  // No retries to fail fast
  retry: {
    attempts: 0,
  },

  circuitBreaker: {
    enabled: false,
  },
});
```

### Resilient Configuration

```typescript
const http = createHttp({
  baseURL: "https://api.example.com",

  // Retry everything
  retry: {
    attempts: 5,
    strategy: "exponential",
    delay: 100,
    maxDelay: 30_000,
    statusCodes: [408, 429, 500, 502, 503, 504],
    shouldRetry: async (error, attempt) => {
      // Custom retry logic
      if (error instanceof NetworkError) {
        return attempt < 5;
      }
      return false;
    },
  },

  // Protect against cascading failures
  circuitBreaker: {
    enabled: true,
    failureThreshold: 5,
    successThreshold: 3,
    timeout: 60_000,
  },

  // Queue requests
  requestPool: {
    enabled: true,
    maxConcurrent: 5,
    queueLimit: 100,
  },

  // Conservative caching
  cache: {
    enabled: true,
    ttl: 60_000,
    strategy: "network-first",
  },

  // Full observability
  observability: {
    logger: true,
    tracing: true,
    metrics: true,
  },
});
```

### Development Configuration

```typescript
const http = createHttp({
  baseURL: process.env.API_URL || "http://localhost:3000",

  // Disabled cache for fresh data
  cache: {
    enabled: false,
  },

  // Verbose logging
  observability: {
    logger: {
      debug: (msg, ctx) => console.log("[DEBUG]", msg, ctx),
      info: (msg, ctx) => console.log("[INFO]", msg, ctx),
      warn: (msg, ctx) => console.warn("[WARN]", msg, ctx),
      error: (msg, ctx) => console.error("[ERROR]", msg, ctx),
    },
    tracing: true,
    metrics: true,
  },

  // Long timeouts for debugging
  timeout: 60_000,

  // Detailed request info
  defaultHeaders: {
    "x-environment": "development",
    "x-request-source": "development-client",
  },
});

// Log all requests
http.interceptors.request.use(async (config) => {
  console.log(`→ ${config.method} ${config.url}`, config);
  return config;
});

http.interceptors.response.use(async (response) => {
  console.log(`← ${response.status} ${response.request.url} (${response.durationMs}ms)`);
  return response;
});
```

### Production Configuration

```typescript
const http = createHttp({
  baseURL: "https://api.example.com",

  timeout: 30_000,

  cache: {
    enabled: true,
    ttl: 300_000,
    maxSize: 200,
    strategy: "stale-while-revalidate",
  },

  retry: {
    attempts: 3,
    strategy: "exponential",
    delay: 200,
    maxDelay: 10_000,
    statusCodes: [429, 500, 502, 503, 504],
  },

  circuitBreaker: {
    enabled: true,
    failureThreshold: 10,
    successThreshold: 5,
    timeout: 120_000,
  },

  requestPool: {
    enabled: true,
    maxConcurrent: 8,
    queueLimit: 50,
  },

  // Structured logging for monitoring
  observability: {
    logger: (msg, ctx) => {
      // Send to logging service
      logService.log({
        level: ctx.level,
        message: msg,
        context: ctx,
        timestamp: new Date().toISOString(),
      });
    },
    tracing: true,
    metrics: true,
  },

  auth: {
    getToken: async () => {
      // Get from secure storage
      return await secureStorage.get("api_token");
    },
    scheme: "Bearer",
  },

  csrf: {
    enabled: true,
    prefetch: true,
  },
});

// Send metrics periodically
setInterval(() => {
  const metrics = http.getMetrics();
  metricsService.send(metrics);
}, 60_000);
```

---

## Environment Variables

### Example .env

```bash
# API Configuration
VITE_API_URL=https://api.example.com
VITE_API_TIMEOUT=30000

# Auth
VITE_AUTH_SCHEME=Bearer
VITE_CSRF_ENABLED=true
VITE_CSRF_ENDPOINT=/api/csrf

# Cache
VITE_CACHE_ENABLED=true
VITE_CACHE_TTL=300000
VITE_CACHE_MAX_SIZE=200

# Retry
VITE_RETRY_ATTEMPTS=3
VITE_RETRY_STRATEGY=exponential

# Observability
VITE_LOG_LEVEL=info
VITE_METRICS_ENABLED=true
```

### Load from Environment

```typescript
import { createHttp } from "rhttp.io";

function getHttpConfig() {
  const env = import.meta.env;

  return {
    baseURL: env.VITE_API_URL,
    timeout: parseInt(env.VITE_API_TIMEOUT || "30000"),
    cache: {
      enabled: env.VITE_CACHE_ENABLED === "true",
      ttl: parseInt(env.VITE_CACHE_TTL || "300000"),
      maxSize: parseInt(env.VITE_CACHE_MAX_SIZE || "200"),
    },
    retry: {
      attempts: parseInt(env.VITE_RETRY_ATTEMPTS || "3"),
      strategy: env.VITE_RETRY_STRATEGY || "exponential",
      statusCodes: [408, 429, 500, 502, 503, 504],
    },
    observability: {
      logger: env.VITE_LOG_LEVEL !== "silent",
      metrics: env.VITE_METRICS_ENABLED === "true",
      tracing: env.VITE_LOG_LEVEL === "debug",
    },
  };
}

export const http = createHttp(getHttpConfig());
```

---

## Configuration Validation

```typescript
function validateHttpConfig(config: CreateHttpConfig): string[] {
  const errors: string[] = [];

  if (config.timeout && config.timeout < 1000) {
    errors.push("timeout should be at least 1000ms");
  }

  if (config.cache?.ttl && config.cache.ttl < 0) {
    errors.push("cache TTL cannot be negative");
  }

  if (
    config.retry?.strategy === "exponential" &&
    config.retry.delay >= config.retry.maxDelay
  ) {
    errors.push("retry delay should be less than maxDelay");
  }

  if (
    config.circuitBreaker?.failureThreshold &&
    config.circuitBreaker.failureThreshold < 1
  ) {
    errors.push("circuit breaker failure threshold must be >= 1");
  }

  return errors;
}

const errors = validateHttpConfig(config);
if (errors.length > 0) {
  console.error("Invalid HTTP configuration:", errors);
  throw new Error("Configuration validation failed");
}
```
