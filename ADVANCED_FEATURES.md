# Advanced Features Implementation Guide

This document provides detailed technical information about the advanced features added to `@http-io`.

## Table of Contents

1. [Circuit Breaker](#circuit-breaker)
2. [Request Pooling](#request-pooling)
3. [Polling Manager](#polling-manager)
4. [ETag Manager](#etag-manager)
5. [Cache Strategies](#cache-strategies)
6. [Request History](#request-history)
7. [Plugin System](#plugin-system)
8. [Lifecycle Hooks](#lifecycle-hooks)

## Circuit Breaker

### Overview

The Circuit Breaker pattern prevents cascading failures by automatically disabling requests to unhealthy services.

### States

- **CLOSED**: Normal operation, requests pass through
- **OPEN**: Service failing, requests are immediately rejected
- **HALF_OPEN**: Testing if service recovered, limited requests allowed

### Configuration

```typescript
interface CircuitBreakerConfig {
  failureThreshold: number;    // Consecutive failures to trigger OPEN
  successThreshold: number;    // Consecutive successes to close
  timeout: number;             // ms until HALF_OPEN from OPEN
}
```

### Implementation Details

```typescript
class CircuitBreaker {
  private state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";
  private failures = 0;
  private successes = 0;
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // If OPEN, reject immediately
    // If HALF_OPEN, allow one attempt to test recovery
    // If CLOSED, execute normally
  }
}
```

### Usage

```typescript
const http = createHttp({
  circuitBreaker: {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 30_000,
  },
});

const status = http.getCircuitBreakerStatus();
// { state: "CLOSED"|"OPEN"|"HALF_OPEN", failures: 0, successes: 0 }

http.resetCircuitBreaker(); // Manual reset
```

## Request Pooling

### Overview

Request Pooling limits concurrent requests to prevent overwhelming the server or exhausting resources.

### Configuration

```typescript
interface RequestPoolConfig {
  maxConcurrent: number; // Default: 5
}
```

### Implementation Details

```typescript
class RequestPool {
  private activeRequests = 0;
  private queue: Array<() => Promise<any>> = [];
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // If under limit, execute immediately
    // Otherwise, queue and wait for slot
  }
}
```

### Usage

```typescript
const http = createHttp({
  requestPool: {
    maxConcurrent: 5,
  },
});

// These 10 requests will be queued with max 5 concurrent
const promises = Array(10).fill().map(() => http.get("/data"));
await Promise.all(promises); // Efficiently managed
```

## Polling Manager

### Overview

Automatically poll an endpoint at regular intervals until a condition is met.

### Configuration

```typescript
interface PollingConfig {
  interval: number;                        // ms between polls
  maxAttempts?: number;                    // Maximum polls
  stopCondition?: (result: any) => boolean; // Stop when true
}
```

### Implementation Details

```typescript
class PollingManager {
  private timers: Map<string, NodeJS.Timeout> = new Map();
  
  async poll<T>(
    fn: () => Promise<T>,
    config: PollingConfig,
    requestId: string
  ): Promise<T> {
    // Execute fn at intervals until stopCondition or maxAttempts
  }
  
  stopAll(): void;
}
```

### Usage

```typescript
// Poll for job completion
const { data: job } = await http.poll("/jobs/123", {
  polling: {
    interval: 2_000,
    maxAttempts: 30,
    stopCondition: (response) => response.data.status === "completed",
  },
});

// Cancel all polling
http.cancel();
```

## ETag Manager

### Overview

ETags enable bandwidth-efficient conditional requests using HTTP 304 responses.

### How It Works

1. First request: Server returns response + `ETag` header
2. ETag stored locally (memory or localStorage)
3. Next request: Client sends `If-None-Match` header with ETag
4. Server returns 304 Not Modified if unchanged
5. Client returns cached data

### Configuration

```typescript
interface ETagConfig {
  enabled: boolean;
  storage?: "memory" | "localStorage";
}
```

### Implementation Details

```typescript
class ETagManager {
  private etags: Map<string, string> = new Map();
  
  getHeaders(url: string): Record<string, string> {
    // Return { "If-None-Match": etag } if known
  }
  
  setETag(url: string, etag: string): void;
}
```

### Usage

```typescript
const http = createHttp({
  etag: {
    enabled: true,
    storage: "memory", // or "localStorage"
  },
});

const { data, status } = await http.get("/api/users");
// First request: Full response, ETag stored
// Second request: Conditional, 304 if unchanged, cached data returned
```

## Cache Strategies

### Overview

Five different strategies for balancing freshness and performance.

### Strategies

1. **cache-only**: Return cached data, never fetch network
2. **network-only**: Always fetch, ignore cache
3. **cache-first**: Try cache first, fallback to network
4. **network-first**: Try network first, fallback to cache
5. **stale-while-revalidate**: Return cache immediately, update in background

### Implementation

```typescript
async function executeWithCacheStrategy(
  strategy: CacheStrategy,
  cacheKey: string,
  networkFn: () => Promise<any>
): Promise<any> {
  switch (strategy) {
    case "cache-only":
      return getCached(cacheKey) ?? throw new Error("Not in cache");
    case "network-only":
      return networkFn();
    case "cache-first":
      return getCached(cacheKey) ?? networkFn();
    case "network-first":
      try { return await networkFn(); }
      catch { return getCached(cacheKey); }
    case "stale-while-revalidate":
      const cached = getCached(cacheKey);
      networkFn().then(data => updateCache(cacheKey, data));
      return cached;
  }
}
```

### Usage

```typescript
// Always fresh
const { data } = await http.get("/api/current-user", {
  cacheStrategy: "network-first",
});

// Prefer cached when available
const { data } = await http.get("/api/static-data", {
  cacheStrategy: "cache-first",
});

// Background updates with stale data
const { data } = await http.get("/api/list", {
  cacheStrategy: "stale-while-revalidate",
});
```

## Request History

### Overview

Track all requests for debugging, monitoring, and analytics.

### Data Structure

```typescript
interface RequestHistoryEntry {
  requestId: string;
  url: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  status: number;
  durationMs: number;
  timestamp?: number;
}
```

### Implementation

```typescript
class RequestHistory {
  private entries: RequestHistoryEntry[] = [];
  private maxSize = 100;
  
  add(entry: RequestHistoryEntry): void;
  getAll(): RequestHistoryEntry[];
}
```

### Usage

```typescript
const http = createHttp({});

// Make requests...
await http.get("/users");
await http.post("/orders", data);

// Retrieve history
const history = http.getHistory();
// Last 100 requests

// Analyze
const failed = history.filter(r => r.status >= 400);
const slowest = history.sort((a, b) => b.durationMs - a.durationMs);
```

## Plugin System

### Overview

Extend HTTP client behavior with custom plugins.

### Plugin Interface

```typescript
interface PluginConfig {
  name: string;
  beforeRequest?: (url: string, options: any) => any;
  afterResponse?: (response: HttpResponse<any>) => any;
  onError?: (error: any) => any;
}
```

### Execution Order

```
Request → beforeRequest hooks → Network → afterResponse hooks → Response
           ↓
         [Error] → onError hooks → throw
```

### Example: Logging Plugin

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
    console.error(`✕ ${error.message}`);
    throw error;
  },
};

http.use(loggingPlugin);
```

### Example: Authentication Plugin

```typescript
const authPlugin = {
  name: "auth",
  beforeRequest: async (url, options) => {
    const token = await getAuthToken();
    return {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    };
  },
};

http.use(authPlugin);
```

## Lifecycle Hooks

### Overview

Execute custom logic at specific points in the request lifecycle.

### Hook Types

```typescript
interface RequestHooks {
  onRequest?: (url: string, options: any) => Promise<void> | void;
  onSuccess?: (response: HttpResponse<any>) => Promise<void> | void;
  onError?: (error: any) => Promise<void> | void;
  onFinally?: () => Promise<void> | void;
}
```

### Execution Order

```
onRequest → Request → onSuccess → onFinally
                  ↓
                [Error] → onError → onFinally
```

### Usage

```typescript
const http = createHttp({
  hooks: {
    onRequest: async (url, options) => {
      // Track start time
      // Log request
      // Set loading state
    },
    
    onSuccess: async (response) => {
      // Update cache
      // Track metrics
      // Update UI
    },
    
    onError: async (error) => {
      // Show error notification
      // Log to error tracking
      // Retry logic
    },
    
    onFinally: async () => {
      // Clear loading state
      // Reset UI state
    },
  },
});
```

## Advanced Combinations

### Resilient API Client with Everything Enabled

```typescript
const http = createHttp({
  baseURL: "https://api.example.com",
  timeout: 30_000,
  
  cache: {
    enabled: true,
    ttl: 5 * 60 * 1000, // 5 minutes
  },
  
  retry: {
    attempts: 3,
    strategy: "exponential",
    delay: 1000,
    maxDelay: 10_000,
    statusCodes: [408, 429, 500, 502, 503, 504],
  },
  
  circuitBreaker: {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 30_000,
  },
  
  requestPool: {
    maxConcurrent: 5,
  },
  
  etag: {
    enabled: true,
    storage: "memory",
  },
  
  hooks: {
    onError: async (error) => {
      // Notify user, analytics, etc.
    },
  },
});

// Register plugins
http.use({
  name: "auth",
  beforeRequest: async (url, options) => {
    const token = await getToken();
    return {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${token}` },
    };
  },
});

http.use({
  name: "analytics",
  afterResponse: async (response) => {
    await analytics.track("api_request", {
      endpoint: response.response.url,
      status: response.status,
      duration: response.durationMs,
    });
    return response;
  },
});
```

## Performance Considerations

### Memory Usage

- **RequestHistory**: ~100 entries @ ~200 bytes each = 20KB
- **ETag Storage**: ~1000 URLs @ ~100 bytes each = 100KB
- **Cache Map**: Configurable via TTL and manual invalidation

### Recommendations

1. Use `cache-first` for static data
2. Use `network-first` for real-time data
3. Set reasonable cache TTLs
4. Limit request pooling to 5-10 concurrent max
5. Configure circuit breaker thresholds per use case
6. Use plugins sparingly for critical paths
