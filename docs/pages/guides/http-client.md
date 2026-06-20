# HTTP Client

The core `createHttp` function creates a fully-featured, isomorphic HTTP client. This guide covers all the essential features.

## Creating a Client

```typescript
import { createHttp } from "rhttp.io";

const http = createHttp({
  baseURL: "https://api.example.com",
  timeout: 30_000,
  defaultHeaders: {
    "X-App-Version": "1.0.0",
  },
});
```

---

## HTTP Methods

### GET

```typescript
const { data, status, headers, requestId, durationMs } = await http.get<Order[]>("/orders", {
  params: { status: "pending", limit: 10 },
  headers: { "X-Custom": "value" },
  timeout: 5_000,
});
```

### POST

```typescript
const { data: newOrder } = await http.post<CreateOrderInput, Order>("/orders", {
  items: [{ productId: "p1", quantity: 2 }],
  shippingAddress: { city: "Paris", country: "FR" },
});
```

### PUT

Complete resource replacement:

```typescript
await http.put("/items/123", {
  name: "Updated Name",
  description: "New description",
  status: "active",
});
```

### PATCH

Partial resource update:

```typescript
await http.patch("/items/123", { status: "completed" });
```

### DELETE

```typescript
// Simple
await http.delete("/items/123");

// With body (bulk delete)
await http.delete("/items", { ids: ["1", "2", "3"] });
```

### customFetch

For highly customized requests — bypasses body serialization:

```typescript
const { data } = await http.customFetch<SearchResult>("/search", {
  method: "POST",
  body: JSON.stringify({ query: "typescript" }),
  headers: { "Content-Type": "application/json" },
});
```

---

## Query Parameters

Query parameters are automatically serialized and appended to the URL:

```typescript
// Results in: GET /users?role=admin&status=active&ids=1&ids=2&ids=3
const { data } = await http.get("/users", {
  params: {
    role: "admin",
    status: "active",
    ids: ["1", "2", "3"],    // Arrays are supported
  },
});
```

---

## Batch Requests

Execute multiple requests concurrently and collect typed results:

```typescript
const [ordersRes, usersRes, productsRes] = await http.batchRequests([
  () => http.get<Order[]>("/orders"),
  () => http.get<User[]>("/users"),
  () => http.get<Product[]>("/products"),
]);

// All results are typed independently
console.log(ordersRes.data);    // Order[]
console.log(usersRes.data);     // User[]
console.log(productsRes.data);  // Product[]
```

---

## Request Cancellation

Cancel specific or all in-flight requests:

```typescript
const requestId = "my-search-request";

// Start a long-running request with a known ID
const promise = http.get("/slow-search", { requestId });

// Cancel it later (e.g., when user types a new search)
http.cancel(requestId);

// Cancel all in-flight requests
http.cancel();
```

---

## Retry Configuration

Configure automatic retries with exponential backoff:

```typescript
const http = createHttp({
  baseURL: "https://api.example.com",
  retry: {
    attempts: 3,               // Total retry attempts (not counting first)
    strategy: "exponential",   // "exponential" | "linear" | "none"
    delay: 300,                // Initial delay in ms
    maxDelay: 30_000,          // Maximum delay cap
    statusCodes: [408, 429, 500, 502, 503],
    shouldRetry: async (error, attempt) => {
      // Custom logic: don't retry on client errors
      return attempt <= 3;
    },
  },
});

// Override per-request
await http.get("/data", { retry: false });          // Disable retry
await http.get("/data", { retry: { attempts: 1 } }); // Override config
```

:::note
**Exponential backoff**: delay is `delay * 2^attempt`, capped at `maxDelay`.  
**Linear backoff**: delay is `delay * attempt`.
:::

---

## Request Deduplication

By default, identical concurrent GET requests are deduplicated — only one network request is made, and all callers receive the same response:

```typescript
// Both requests are in-flight at the same time
// Only ONE actual HTTP request is made
const [res1, res2] = await Promise.all([
  http.get("/users/1"),
  http.get("/users/1"),
]);

// Opt out per-request
await http.get("/users/1", { deduplicate: false });
```

---

## Response Object

Every HTTP method returns an `HttpResponse<T>`:

```typescript
interface HttpResponse<T> {
  data: T;                           // Parsed response body
  status: number;                    // HTTP status code (e.g., 200, 404)
  statusText: string;                // "OK", "Not Found", etc.
  headers: Record<string, string>;   // Response headers
  response: Response;                // Native fetch() Response object
  requestId: string;                 // Unique request ID (UUID)
  durationMs: number;                // Total round-trip duration in ms
}
```

---

## Error Types

```typescript
import { HttpError, TimeoutError, NetworkError } from "rhttp.io";

try {
  await http.get("/items");
} catch (error) {
  if (error instanceof TimeoutError) {
    // Request exceeded the timeout
    console.error(`Timed out after ${error.durationMs}ms`);

  } else if (error instanceof NetworkError) {
    // Network failure (no internet, DNS failure, etc.)
    console.error(`Network error: ${error.message}`, error.originalError);

  } else if (error instanceof HttpError) {
    // Server responded with an error status (4xx, 5xx)
    console.error(`HTTP ${error.status}: ${error.statusText}`);
    console.log("Body:", error.data);       // Parsed response body
    console.log("Headers:", error.headers);
  }
}
```

---

## Validation & Transformation

### Request Validator (global)

Block requests before they are sent:

```typescript
const http = createHttp({
  baseURL: "https://api.example.com",
  requestValidator: (url, options) => {
    // Block admin requests from the browser
    if (url.includes("/admin") && typeof window !== "undefined") {
      return false; // Throws: "Request validation failed"
    }
    return true;
  },
});
```

### Response Validator (per-request)

Validate the response shape before it reaches your code:

```typescript
const { data } = await http.get<User>("/users/1", {
  validateResponse: (data) => {
    return typeof data.id === "number" && typeof data.name === "string";
  },
});
// Throws HttpError("Response validation failed") if validation returns false
```

### Response Transformer (global + per-request)

Transform response data before it's returned:

```typescript
const http = createHttp({
  baseURL: "https://api.example.com",
  // Global: runs on every response
  responseTransformer: (data, response) => {
    if (data?.createdAt) data.createdAt = new Date(data.createdAt);
    if (data?.updatedAt) data.updatedAt = new Date(data.updatedAt);
    return data;
  },
});

// Per-request: runs after the global transformer
const { data: orders } = await http.get("/orders", {
  transformer: (data) =>
    data.map((order: any) => ({
      ...order,
      total: order.items.reduce((sum: number, item: any) => sum + item.price, 0),
    })),
});
```

---

## Cache Management

```typescript
// Invalidate cache for all URLs starting with /orders
http.invalidateCache("/orders");  // Clears /orders, /orders/123, etc.

// Clear all cached entries
http.clearCache();

// Get performance metrics
const metrics = http.getMetrics();
console.log(metrics.totalRequests, metrics.successfulRequests, metrics.failedRequests);
```

---

## Request History

Inspect recent requests for debugging:

```typescript
await http.get("/api/users");
await http.post("/api/orders", { item: "laptop" });

const history = http.getHistory();
// [
//   { requestId: "...", url: ".../users", method: "GET", status: 200, durationMs: 45, timestamp: 123 },
//   { requestId: "...", url: ".../orders", method: "POST", status: 201, durationMs: 123, timestamp: 456 },
// ]

// Find slowest requests
const slowest = history.sort((a, b) => b.durationMs - a.durationMs);

// Find failed requests
const failed = history.filter(r => r.status >= 400);
```
