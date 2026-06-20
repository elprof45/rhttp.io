# Getting Started

## Installation

:::code-group

```bash [npm]
npm install rhttp.io
```

```bash [bun]
bun add rhttp.io
```

```bash [pnpm]
pnpm add rhttp.io
```

```bash [yarn]
yarn add rhttp.io
```

:::

:::note
**Node.js ≥ 18** is required. `rhttp.io` uses the native `fetch` API.
:::

## Optional peer dependencies

Some features require peer dependencies. Install only what you need:

```bash
# For React + TanStack Query integration
npm install @tanstack/react-query react react-dom

# For Socket.io realtime client
npm install socket.io-client
```

---

## Quick Start

### Minimal client

```typescript twoslash
import { createHttp } from "rhttp.io";

const http = createHttp({
  baseURL: "https://api.example.com",
  timeout: 30_000,
});

// GET request — fully typed response
const { data: orders } = await http.get<Order[]>("/orders");
//          ^? Order[]
```

### With retry and cache

```typescript
import { createHttp } from "rhttp.io";

const http = createHttp({
  baseURL: "https://api.example.com",
  retry: {
    attempts: 3,
    strategy: "exponential",
    delay: 300,
    statusCodes: [408, 429, 500, 502, 503],
  },
  cache: {
    enabled: true,
    ttl: 60_000,           // 1 minute
  },
  observability: {
    logger: true,          // Enable console logging
    tracing: true,         // Inject X-Request-ID header
    metrics: true,
  },
});
```

---

## Your first request

```typescript
import { createHttp, HttpError } from "rhttp.io";

interface Todo {
  id: number;
  title: string;
  completed: boolean;
}

const http = createHttp({ baseURL: "https://jsonplaceholder.typicode.com" });

// GET
const { data: todos, durationMs } = await http.get<Todo[]>("/todos");
console.log(`Loaded ${todos.length} todos in ${durationMs}ms`);

// POST
const { data: newTodo } = await http.post<Omit<Todo, "id">, Todo>("/todos", {
  title: "Buy groceries",
  completed: false,
});

// Error handling
try {
  await http.get("/not-found");
} catch (error) {
  if (error instanceof HttpError) {
    console.error(`HTTP ${error.status}: ${error.statusText}`);
    // error.data contains the parsed response body
  }
}
```

---

## Next steps

- **Browser apps** → [Browser Client](/guides/browser-client) (CSRF, localStorage token)
- **Server / SSR** → [Server Client](/guides/server-client) (TanStack Start, cookie forwarding)
- **React integration** → [React & TanStack Query](/guides/react)
- **Realtime** → [Socket.io Client](/guides/realtime)
- **Full config reference** → [createHttp API](/api/create-http)
