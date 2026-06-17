import { createHttp } from "./dist/index.js";
<<<<<<< HEAD
import type { HttpResponse } from "./dist/index.d.ts";
=======
>>>>>>> 51b5407 (last)

// Mock fetch for testing
const originalFetch = globalThis.fetch;

interface MockResponse {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Map<string, string>;
  json: () => Promise<any>;
  text: () => Promise<string>;
  blob: () => Promise<Blob>;
}

function createMockResponse(
  ok: boolean = true,
  status: number = 200,
  data: any = {}
): MockResponse {
  return {
    ok,
    status,
    statusText: ok ? "OK" : "Error",
    headers: new Map([["content-type", "application/json"]]),
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    blob: () => Promise.resolve(new Blob([JSON.stringify(data)])),
  };
}

let mockFetchCallCount = 0;
function setupMockFetch(response: MockResponse) {
  mockFetchCallCount = 0;
  globalThis.fetch = async () => {
    mockFetchCallCount++;
    return response as any;
  };
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

// Test suite
const tests: Array<{
  name: string;
  run: () => Promise<void>;
}> = [];

function test(name: string, fn: () => Promise<void>) {
  tests.push({ name, run: fn });
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

test("GET request returns HttpResponse with data", async () => {
  const mockResponse = createMockResponse(true, 200, { id: 1, name: "Test" });
  setupMockFetch(mockResponse);

  const http = createHttp({ baseURL: "http://api.test" });
  const response = await http.get<{ id: number; name: string }>("/items");

  if (response.data.id !== 1) throw new Error("Response data mismatch");
  if (response.status !== 200) throw new Error("Status code mismatch");
  if (response.statusText !== "OK") throw new Error("Status text mismatch");
  if (response.requestId === undefined) throw new Error("Missing requestId");
  if (response.durationMs === undefined) throw new Error("Missing durationMs");

  restoreFetch();
});

test("POST request with body", async () => {
  const mockResponse = createMockResponse(true, 201, { id: 2, created: true });
  setupMockFetch(mockResponse);

  const http = createHttp({ baseURL: "http://api.test" });
  const response = await http.post<{ created: boolean }>("/items", { name: "New Item" });

  if (response.status !== 201) throw new Error("POST status code mismatch");
  if (response.data.created !== true) throw new Error("POST response data mismatch");

  restoreFetch();
});

test("Cache stores GET responses and returns cached copy", async () => {
  const mockResponse = createMockResponse(true, 200, { id: 1, name: "Cached" });
  setupMockFetch(mockResponse);

  const http = createHttp({
    baseURL: "http://api.test",
    cache: { enabled: true, ttl: 60000 },
  });

  // First request
  const response1 = await http.get("/items");
  const callCount1 = mockFetchCallCount;

  // Second request (should come from cache)
  const response2 = await http.get("/items");
  const callCount2 = mockFetchCallCount;

  if (callCount2 !== callCount1) throw new Error("Cache was not used");
  if (response1.data.name !== response2.data.name) throw new Error("Cached data mismatch");

  restoreFetch();
});

test("Deduplication prevents concurrent duplicate requests", async () => {
  let delayMs = 100;
  globalThis.fetch = async () => {
    await new Promise((r) => setTimeout(r, delayMs));
    return createMockResponse(true, 200, { id: 1 }) as any;
  };

  const http = createHttp({ baseURL: "http://api.test" });

  // Launch 3 concurrent identical requests
  const promises = [
    http.get("/items", { deduplicate: true }),
    http.get("/items", { deduplicate: true }),
    http.get("/items", { deduplicate: true }),
  ];

  const responses = await Promise.all(promises);

  if (mockFetchCallCount !== 1) {
    throw new Error(`Expected 1 fetch call for deduplicated requests, got ${mockFetchCallCount}`);
  }

  if (responses.some((r) => r.data.id !== 1)) throw new Error("Deduplicated responses differ");

  restoreFetch();
});

test("Timeout error is thrown on request timeout", async () => {
  // Create a class that mimics DOMException for AbortError
  class AbortError extends Error {
    name = "AbortError";
    code = 20;
    constructor(message: string = "The operation was aborted.") {
      super(message);
    }
  }

  globalThis.fetch = async (url, opts) => {
    // Check if abort signal was triggered
    if (opts?.signal?.aborted) {
      throw new AbortError();
    }
    // Simulate timeout by throwing after a delay
    return new Promise((resolve, reject) => {
      if (opts?.signal) {
        opts.signal.addEventListener("abort", () => {
          reject(new AbortError());
        });
      }
      // Keep the promise pending (timeout will occur before this resolves)
      setTimeout(() => resolve(createMockResponse(true, 200) as any), 5000);
    });
  };

  const http = createHttp({ baseURL: "http://api.test", timeout: 50 });

  try {
    await http.get("/items");
    throw new Error("Expected TimeoutError to be thrown");
  } catch (err: any) {
    if (err.name !== "TimeoutError") throw new Error(`Expected TimeoutError, got ${err.name}`);
  }

  restoreFetch();
});

test("Retry with exponential backoff", async () => {
  let attempt = 0;
  globalThis.fetch = async () => {
    attempt++;
    if (attempt < 3) {
      // Fail first 2 attempts
      return createMockResponse(false, 503) as any;
    }
    return createMockResponse(true, 200, { retried: true }) as any;
  };

  const http = createHttp({
    baseURL: "http://api.test",
    retry: {
      attempts: 3,
      strategy: "exponential",
      delay: 10,
      maxDelay: 100,
      statusCodes: [503],
    },
  });

  const response = await http.get("/items");
  if (attempt !== 3) throw new Error(`Expected 3 attempts, got ${attempt}`);
  if (response.data.retried !== true) throw new Error("Retry response data mismatch");

  restoreFetch();
});

test("Interceptors modify requests and responses", async () => {
  setupMockFetch(createMockResponse(true, 200, { value: "original" }));

  const http = createHttp({ baseURL: "http://api.test" });

  // Add request interceptor to add custom header
  let interceptedHeader = "";
  http.interceptors.request.use(async (config) => {
    config.headers = config.headers || {};
    config.headers["x-custom"] = "intercepted";
    return config;
  });

  // Add response interceptor to modify data
  http.interceptors.response.use((response) => {
    response.data.value = "modified";
    return response;
  });

  const response = await http.get("/items");
  if (response.data.value !== "modified") throw new Error("Response interceptor failed");

  restoreFetch();
});

test("Error handling with HttpError", async () => {
  setupMockFetch(createMockResponse(false, 404, { error: "Not Found" }));

  const http = createHttp({ baseURL: "http://api.test" });

  try {
    await http.get("/items");
    throw new Error("Expected HttpError to be thrown");
  } catch (err: any) {
    if (err.name !== "HttpError") throw new Error(`Expected HttpError, got ${err.name}`);
    if (err.status !== 404) throw new Error(`Expected status 404, got ${err.status}`);
    if (err.data?.error !== "Not Found") throw new Error("Error data mismatch");
  }

  restoreFetch();
});

test("Batch requests resolves all in parallel", async () => {
  let requestCount = 0;
  globalThis.fetch = async () => {
    requestCount++;
    return createMockResponse(true, 200, { request: requestCount }) as any;
  };

  const http = createHttp({ baseURL: "http://api.test" });

  const [res1, res2, res3] = await http.batchRequests([
    () => http.get("/a"),
    () => http.get("/b"),
    () => http.get("/c"),
  ]);

  if (requestCount !== 3) throw new Error(`Expected 3 requests, got ${requestCount}`);
  if (![res1, res2, res3].every((r) => r.status === 200)) throw new Error("Some batch requests failed");

  restoreFetch();
});

test("Query string parameters are properly encoded", async () => {
  let capturedUrl = "";
  globalThis.fetch = async (url) => {
    capturedUrl = String(url);
    return createMockResponse(true, 200, { success: true }) as any;
  };

  const http = createHttp({ baseURL: "http://api.test" });
  await http.get("/search", {
    params: {
      q: "hello world",
      category: "test",
      tags: undefined, // Should be excluded
    },
  });

  // Check URL contains the base and path
  if (!capturedUrl.includes("http://api.test/search")) throw new Error(`URL base/path missing: ${capturedUrl}`);
  
  // Check that the query parameters are encoded (could be spaces as %20 or + depending on URLSearchParams)
  if (!capturedUrl.includes("q=hello") || (!capturedUrl.includes("world") && !capturedUrl.includes("%20"))) {
    throw new Error(`Query parameter 'q' not properly encoded: ${capturedUrl}`);
  }
  
  if (!capturedUrl.includes("category=test")) throw new Error("Query parameter 'category' missing");
  if (capturedUrl.includes("tags=")) throw new Error("Undefined parameter 'tags' should be excluded");

  restoreFetch();
});

test("Metrics collection records request statistics", async () => {
  setupMockFetch(createMockResponse(true, 200, { value: "metric" }));

  const http = createHttp({
    baseURL: "http://api.test",
    observability: { metrics: true },
  });

  await http.get("/items");
  await http.get("/items2");

  const metrics = http.getMetrics();
  if (metrics.totalRequests !== 2) throw new Error(`Expected 2 total requests, got ${metrics.totalRequests}`);
  if (metrics.successfulRequests !== 2) throw new Error(`Expected 2 successful requests`);
  if (!metrics.statusCodes[200]) throw new Error("Status code 200 not recorded");

  restoreFetch();
});

test("Cache invalidation clears matching entries", async () => {
  setupMockFetch(createMockResponse(true, 200, { id: 1 }));

  const http = createHttp({
    baseURL: "http://api.test",
    cache: { enabled: true, ttl: 60000 },
  });

  // Prime cache
  await http.get("/items/1");
  await http.get("/items/2");

  const callsBefore = mockFetchCallCount;

  // Invalidate /items/1
  http.invalidateCache("/items/1");

  // This should be cached (not /items/1)
  await http.get("/items/2");
  if (mockFetchCallCount !== callsBefore) throw new Error("Cache invalidation too broad");

  // This should hit the network (cache was invalidated)
  await http.get("/items/1");
  if (mockFetchCallCount === callsBefore) throw new Error("Cache invalidation didn't work");

  restoreFetch();
});

test("CSRF prefetch loads token on initialization", async () => {
  let csrfFetchCount = 0;
  globalThis.fetch = async (url) => {
    if (String(url).includes("/api/csrf")) {
      csrfFetchCount++;
      return createMockResponse(true, 200, { token: "test-token-123" }) as any;
    }
    return createMockResponse(true, 200, { success: true }) as any;
  };

  // Simulate browser environment
  const originalWindow = (globalThis as any).window;
  (globalThis as any).window = {};

  const http = createHttp({
    baseURL: "http://api.test",
    csrf: { enabled: true, prefetch: true },
  });

  // Give prefetch time to complete
  await new Promise((r) => setTimeout(r, 100));

  if (csrfFetchCount === 0) throw new Error("CSRF prefetch did not fetch token");

  (globalThis as any).window = originalWindow;
  restoreFetch();
});

// ─────────────────────────────────────────────────────────────────────────────
// Advanced HTTP Client & Realtime Client Tests
// ─────────────────────────────────────────────────────────────────────────────

test("HTTP Request Validation blocks requests", async () => {
  const http = createHttp({
    baseURL: "http://api.test",
    requestValidator: (url) => {
      return !url.includes("invalid");
    }
  });

  try {
    await http.get("/invalid-path");
    throw new Error("Should have failed request validation");
  } catch (err: any) {
    if (!err.message.includes("Request validation failed")) {
      throw new Error(`Expected request validation error, got: ${err.message}`);
    }
  }

  setupMockFetch(createMockResponse(true, 200, { ok: true }));
  const res = await http.get("/valid-path");
  if (res.data.ok !== true) throw new Error("Valid request failed");
  restoreFetch();
});

test("HTTP Response Validation throws on invalid data shape", async () => {
  setupMockFetch(createMockResponse(true, 200, { id: "not-a-number" }));
  const http = createHttp({ baseURL: "http://api.test" });

  try {
    await http.get("/item", {
      validateResponse: (data) => typeof data.id === "number"
    });
    throw new Error("Should have failed response validation");
  } catch (err: any) {
    if (err.message !== "Response validation failed") {
      throw new Error(`Expected response validation failed error, got: ${err.message}`);
    }
  }

  restoreFetch();
});

test("HTTP Response Transformer modifies response data", async () => {
  setupMockFetch(createMockResponse(true, 200, { value: 10 }));
  const http = createHttp({
    baseURL: "http://api.test",
    responseTransformer: (data) => ({ ...data, multiplied: data.value * 2 })
  });

  const res = await http.get("/number", {
    transformer: (data) => ({ ...data, added: data.multiplied + 5 })
  });

  if (res.data.multiplied !== 20) throw new Error("Global transformer failed");
  if (res.data.added !== 25) throw new Error("Request-level transformer failed");

  restoreFetch();
});

test("HTTP Cache stale-while-revalidate strategy", async () => {
  let callCount = 0;
  globalThis.fetch = async () => {
    callCount++;
    return createMockResponse(true, 200, { count: callCount }) as any;
  };

  const http = createHttp({
    baseURL: "http://api.test",
    cache: { enabled: true, ttl: 50 },
  });

  const res1 = await http.get("/counter", { cacheStrategy: "stale-while-revalidate" });
  if (res1.data.count !== 1) throw new Error(`Expected count 1, got ${res1.data.count}`);

  await new Promise(r => setTimeout(r, 60));

  const res2 = await http.get("/counter", { cacheStrategy: "stale-while-revalidate" });
  if (res2.data.count !== 1) throw new Error(`Expected stale count 1, got ${res2.data.count}`);

  await new Promise(r => setTimeout(r, 50));

  const res3 = await http.get("/counter", { cacheStrategy: "stale-while-revalidate" });
  if (res3.data.count !== 2) throw new Error(`Expected revalidated count 2, got ${res3.data.count}`);

  restoreFetch();
});

import { createRefreshAuthInterceptor } from "./dist/index.js";

test("JWT Refresh Token Interceptor refreshes token and retries requests", async () => {
  let refreshCalled = 0;

  globalThis.fetch = async (url, opts: any) => {
    const authHeader = opts?.headers?.["authorization"] || opts?.headers?.Authorization || "";

    if (authHeader === "Bearer new-token") {
      return createMockResponse(true, 200, { data: "success" }) as any;
    }
    return createMockResponse(false, 401, { error: "Unauthorized" }) as any;
  };

  const http = createHttp({
    baseURL: "http://api.test",
    auth: { accessToken: "old-token" }
  });

  http.interceptors.response.use(
    (res) => res,
    createRefreshAuthInterceptor(http, {
      refreshToken: () => {
        refreshCalled++;
        return "new-token";
      }
    })
  );

  const [res1, res2] = await Promise.all([
    http.get("/data1"),
    http.get("/data2")
  ]);

  if (res1.data.data !== "success" || res2.data.data !== "success") {
    throw new Error("Failed to retry queued requests with new token");
  }

  if (refreshCalled !== 1) {
    throw new Error(`Expected refreshToken to be called exactly 1 time, got ${refreshCalled}`);
  }

  if (http.config.auth?.accessToken !== "new-token") {
    throw new Error("Client access token was not updated");
  }

  restoreFetch();
});

import { mock } from "bun:test";

class MockSocket {
  connected = false;
  listeners: Record<string, Function[]> = {};

  on(event: string, fn: Function) {
    console.log(`[MockSocket] Registering listener for event: ${event}`);
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
    return this;
  }

  once(event: string, fn: Function) {
    console.log(`[MockSocket] Registering once listener for event: ${event}`);
    const wrapper = (...args: any[]) => {
      this.off(event, wrapper);
      fn(...args);
    };
    this.on(event, wrapper);
    return this;
  }

  off(event: string, fn?: Function) {
    console.log(`[MockSocket] Removing listener for event: ${event}`);
    if (!fn) {
      delete this.listeners[event];
    } else if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(l => l !== fn);
    }
    return this;
  }

  emit(event: string, data: any, cb?: Function) {
    console.log(`[MockSocket] Emitting event: ${event}`, data);
    if (cb) {
      setTimeout(() => cb({ success: true }), 10);
    }
  }

  disconnect() {
    console.log(`[MockSocket] Disconnecting`);
    this.connected = false;
    this.trigger("disconnect", "io client disconnect");
  }

  trigger(event: string, ...args: any[]) {
    console.log(`[MockSocket] Triggering event: ${event} with listeners count: ${this.listeners[event]?.length || 0}`);
    if (this.listeners[event]) {
      // Clone listeners to avoid modification during execution
      const list = [...this.listeners[event]];
      list.forEach(fn => fn(...args));
    }
  }
}

const mockSocket = new MockSocket();

mock.module("socket.io-client", () => {
  return {
    io: () => {
      console.log(`[MockSocket] io() called`);
      mockSocket.connected = true;
      setTimeout(() => {
        console.log(`[MockSocket] timeout firing connect trigger`);
        mockSocket.trigger("connect");
      }, 10);
      return mockSocket;
    }
  };
});

(globalThis as any).window = {};
(globalThis as any).document = { cookie: "" };

const { createRealtimeClient } = await import("./dist/socket.io.js");

test("Realtime Client Logger and lifecycle hooks", async () => {
  let connectHookCalled = false;
  let disconnectHookCalled = false;
  let logs: string[] = [];

  const customLogger = {
    debug: (...args: any[]) => console.log("[customLogger] debug:", ...args),
    info: (msg: string) => {
      console.log("[customLogger] info:", msg);
      logs.push(msg);
    },
    warn: (...args: any[]) => console.log("[customLogger] warn:", ...args),
    error: (...args: any[]) => console.log("[customLogger] error:", ...args),
  };

  const client = createRealtimeClient({
    socketUrl: "http://socket.test",
    logger: customLogger,
    hooks: {
      onConnect: () => {
        console.log("[Test] onConnect hook called!");
        connectHookCalled = true;
      },
      onDisconnect: () => {
        console.log("[Test] onDisconnect hook called!");
        disconnectHookCalled = true;
      }
    }
  });

  console.log("[Test] Calling client.connect()...");
  await client.connect();
  console.log("[Test] client.connect() resolved.");

  if (!connectHookCalled) throw new Error("onConnect hook not called");
  if (!logs.some(l => l.includes("Connecting to socket"))) throw new Error("Logger connection start missing");
  if (!logs.some(l => l.includes("Socket connected successfully"))) throw new Error("Logger connect success missing");

  console.log("[Test] Calling client.disconnect()...");
  client.disconnect();
  console.log("[Test] client.disconnect() done.");

  if (!disconnectHookCalled) throw new Error("onDisconnect hook not called");
  if (!logs.some(l => l.includes("Socket disconnected"))) throw new Error("Logger disconnect missing");
});

test("Realtime Client Event Validation & Transformation", async () => {
  let validatedEmitCount = 0;
  let validatedReceiveCount = 0;

  const client = createRealtimeClient({
    socketUrl: "http://socket.test",
    eventValidator: (event, data, direction) => {
      if (direction === "emit") {
        validatedEmitCount++;
        return data.valid === true;
      } else {
        validatedReceiveCount++;
        return data.allow === true;
      }
    },
    eventTransformer: (event, data, direction) => {
      if (direction === "emit") {
        return { ...data, transformed: "emitted" };
      } else {
        return { ...data, transformed: "received" };
      }
    }
  });

  await client.connect();

  let emitMockCalled = false;
  mockSocket.emit = (event: string, data: any) => {
    emitMockCalled = true;
    if (data.transformed !== "emitted") throw new Error("Emit transformer failed");
  };

  client.emit("message", { valid: false });
  await new Promise(r => setTimeout(r, 15));
  if (emitMockCalled) throw new Error("Emit should have been blocked by validation");

  client.emit("message", { valid: true });
  await new Promise(r => setTimeout(r, 15));
  if (!emitMockCalled) throw new Error("Allowed emit was blocked");

  let handlerCalledData: any = null;
  client.on("chat", (data) => {
    handlerCalledData = data;
  });

  mockSocket.trigger("chat", { allow: false });
  await new Promise(r => setTimeout(r, 15));
  if (handlerCalledData !== null) throw new Error("Blocked incoming event was processed");

  mockSocket.trigger("chat", { allow: true });
  await new Promise(r => setTimeout(r, 15));
  if (!handlerCalledData) throw new Error("Allowed incoming event was blocked");
  if (handlerCalledData.transformed !== "received") throw new Error("Receive transformer failed");

  client.disconnect();
});

test("Realtime Client Room Join and Offline Queue", async () => {
  const client = createRealtimeClient({
    socketUrl: "http://socket.test",
    offlineQueue: { enabled: true }
  });

  await client.joinRoom("lobby");

  if (client.getQueueLength() !== 1) {
    throw new Error("Offline room join should be queued");
  }

  let joinedRoomName = "";
  mockSocket.emit = (event: string, data: any, cb: any) => {
    if (event === "join:room") {
      joinedRoomName = data.room;
      cb({ success: true });
    }
  };

  await client.connect();

  await new Promise(r => setTimeout(r, 50));

  if (joinedRoomName !== "lobby") {
    throw new Error("Queued room join was not flushed");
  }

  if (client.getQueueLength() !== 0) {
    throw new Error("Offline queue was not cleared");
  }

  client.disconnect();
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Runner
// ─────────────────────────────────────────────────────────────────────────────

async function runTests() {
  console.log("\n🧪 Running @http-io test suite...\n");

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      await test.run();
      console.log(`✓ ${test.name}`);
      passed++;
    } catch (err: any) {
      console.log(`✗ ${test.name}`);
      console.log(`  Error: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(console.error);
