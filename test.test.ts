import {
  afterEach,
  beforeEach,
  expect,
  mock,
  test,
} from "bun:test";

import { createHttp, createRefreshAuthInterceptor } from "./dist/index.js";

type MockResponseData = Record<string, unknown> | unknown[] | string | number | boolean | null;

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
  ok = true,
  status = 200,
  data: MockResponseData = {},
): MockResponse {
  return {
    ok,
    status,
    statusText: ok ? "OK" : "Error",
    headers: new Map([["content-type", "application/json"]]),
    json: async () => data,
    text: async () => JSON.stringify(data),
    blob: async () => new Blob([JSON.stringify(data)]),
  };
}

const originalFetch = globalThis.fetch;
const originalWindow = (globalThis as any).window;
const originalDocument = (globalThis as any).document;

function restoreGlobals() {
  globalThis.fetch = originalFetch;
  (globalThis as any).window = originalWindow;
  (globalThis as any).document = originalDocument;
  mock.restore();
}

function installFetch(
  handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
) {
  globalThis.fetch = handler as typeof fetch;
}

function installJsonFetch(
  response: MockResponse,
) {
  installFetch(async () => response as any);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

beforeEach(() => {
  mock.restore();
});

afterEach(() => {
  restoreGlobals();
});

test("GET request returns HttpResponse with data", async () => {
  installJsonFetch(createMockResponse(true, 200, { id: 1, name: "Test" }));

  const http = createHttp({ baseURL: "http://api.test" });
  const response = await http.get<{ id: number; name: string }>("/items");

  expect(response.data.id).toBe(1);
  expect(response.data.name).toBe("Test");
  expect(response.status).toBe(200);
  expect(response.statusText).toBe("OK");
  expect(response.requestId).toBeDefined();
  expect(response.durationMs).toBeDefined();
});

test("POST request with body", async () => {
  installJsonFetch(createMockResponse(true, 201, { id: 2, created: true }));

  const http = createHttp({ baseURL: "http://api.test" });
  const response = await http.post<{ created: boolean }>("/items", { name: "New Item" });

  expect(response.status).toBe(201);
  expect(response.data.created).toBe(true);
});

test("Cache stores GET responses and returns cached copy", async () => {
  let callCount = 0;
  installFetch(async () => {
    callCount += 1;
    return createMockResponse(true, 200, { id: 1, name: "Cached" }) as any;
  });

  const http = createHttp({
    baseURL: "http://api.test",
    cache: { enabled: true, ttl: 60_000 },
  });

  const response1 = await http.get("/items");
  const response2 = await http.get("/items");

  expect(callCount).toBe(1);
  expect(response1.data.name).toBe("Cached");
  expect(response2.data.name).toBe("Cached");
});

test("Deduplication prevents concurrent duplicate requests", async () => {
  let callCount = 0;
  installFetch(async () => {
    callCount += 1;
    await sleep(100);
    return createMockResponse(true, 200, { id: 1 }) as any;
  });

  const http = createHttp({ baseURL: "http://api.test" });

  const [r1, r2, r3] = await Promise.all([
    http.get("/items", { deduplicate: true }),
    http.get("/items", { deduplicate: true }),
    http.get("/items", { deduplicate: true }),
  ]);

  expect(callCount).toBe(1);
  expect(r1.data.id).toBe(1);
  expect(r2.data.id).toBe(1);
  expect(r3.data.id).toBe(1);
});

test("Timeout error is thrown on request timeout", async () => {
  installFetch(async (_url, init) => {
    const signal = init?.signal;

    return new Promise<Response>((_resolve, reject) => {
      signal?.addEventListener("abort", () => {
        const err = new Error("The operation was aborted.");
        (err as any).name = "AbortError";
        reject(err);
      });
    });
  });

  const http = createHttp({ baseURL: "http://api.test", timeout: 50 });

  await expect(http.get("/items")).rejects.toMatchObject({
    name: "TimeoutError",
  });
});

test("Retry with exponential backoff", async () => {
  let attempt = 0;
  installFetch(async () => {
    attempt += 1;
    if (attempt < 3) {
      return createMockResponse(false, 503, { error: "Service Unavailable" }) as any;
    }
    return createMockResponse(true, 200, { retried: true }) as any;
  });

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

  expect(attempt).toBe(3);
  expect(response.data.retried).toBe(true);
});

test("Interceptors modify requests and responses", async () => {
  let capturedHeaders: Record<string, string> | undefined;

  installFetch(async (_url, init) => {
    capturedHeaders = Object.fromEntries(
      new Headers(init?.headers).entries(),
    );
    return createMockResponse(true, 200, { value: "original" }) as any;
  });

  const http = createHttp({ baseURL: "http://api.test" });

  http.interceptors.request.use(async (config) => {
    config.headers = {
      ...(config.headers ?? {}),
      "x-custom": "intercepted",
    };
    return config;
  });

  http.interceptors.response.use((response) => {
    response.data.value = "modified";
    return response;
  });

  const response = await http.get("/items");

  expect(capturedHeaders?.["x-custom"]).toBe("intercepted");
  expect(response.data.value).toBe("modified");
});

test("Error handling with HttpError", async () => {
  installJsonFetch(createMockResponse(false, 404, { error: "Not Found" }));

  const http = createHttp({ baseURL: "http://api.test" });

  try {
    await http.get("/items");
    throw new Error("Expected HttpError to be thrown");
  } catch (err: any) {
    expect(err.name).toBe("HttpError");
    expect(err.status).toBe(404);
    expect(err.data?.error).toBe("Not Found");
  }
});

test("Batch requests resolves all in parallel", async () => {
  let requestCount = 0;
  installFetch(async () => {
    requestCount += 1;
    return createMockResponse(true, 200, { request: requestCount }) as any;
  });

  const http = createHttp({ baseURL: "http://api.test" });

  const [res1, res2, res3] = await http.batchRequests([
    () => http.get("/a"),
    () => http.get("/b"),
    () => http.get("/c"),
  ]);

  expect(requestCount).toBe(3);
  expect(res1?.status).toBe(200);
  expect(res2?.status).toBe(200);
  expect(res3?.status).toBe(200);
});

test("Query string parameters are properly encoded", async () => {
  let capturedUrl = "";
  installFetch(async (url) => {
    capturedUrl = String(url);
    return createMockResponse(true, 200, { success: true }) as any;
  });

  const http = createHttp({ baseURL: "http://api.test" });

  await http.get("/search", {
    params: {
      q: "hello world",
      category: "test",
      tags: undefined,
    },
  });

  expect(capturedUrl).toContain("http://api.test/search");
  expect(capturedUrl).toContain("category=test");
  expect(capturedUrl).toMatch(/q=hello(\+|%20)world/);
  expect(capturedUrl).not.toContain("tags=");
});

test("Metrics collection records request statistics", async () => {
  installJsonFetch(createMockResponse(true, 200, { value: "metric" }));

  const http = createHttp({
    baseURL: "http://api.test",
    observability: { metrics: true },
  });

  await http.get("/items");
  await http.get("/items2");

  const metrics = http.getMetrics();

  expect(metrics.totalRequests).toBe(2);
  expect(metrics.successfulRequests).toBe(2);
  expect(metrics.statusCodes[200]).toBeTruthy();
});

test("Cache invalidation clears matching entries", async () => {
  let callCount = 0;
  installFetch(async () => {
    callCount += 1;
    return createMockResponse(true, 200, { id: callCount }) as any;
  });

  const http = createHttp({
    baseURL: "http://api.test",
    cache: { enabled: true, ttl: 60_000 },
  });

  await http.get("/items/1");
  await http.get("/items/2");

  const callsBefore = callCount;

  http.invalidateCache("/items/1");

  await http.get("/items/2");
  expect(callCount).toBe(callsBefore);

  await http.get("/items/1");
  expect(callCount).toBe(callsBefore + 1);
});

test("CSRF prefetch loads token on initialization", async () => {
  let csrfFetchCount = 0;
  installFetch(async (url) => {
    if (String(url).includes("/api/csrf")) {
      csrfFetchCount += 1;
      return createMockResponse(true, 200, { token: "test-token-123" }) as any;
    }
    return createMockResponse(true, 200, { success: true }) as any;
  });

  (globalThis as any).window = {};

  createHttp({
    baseURL: "http://api.test",
    csrf: { enabled: true, prefetch: true },
  });

  await sleep(100);

  expect(csrfFetchCount).toBeGreaterThan(0);
});

test("HTTP Request Validation blocks requests", async () => {
  const http = createHttp({
    baseURL: "http://api.test",
    requestValidator: (url) => !url.includes("invalid"),
  });

  try {
    await http.get("/invalid-path");
    throw new Error("Should have failed request validation");
  } catch (err: any) {
    expect(err.message).toContain("Request validation failed");
  }

  installJsonFetch(createMockResponse(true, 200, { ok: true }));
  const res = await http.get("/valid-path");
  expect(res.data.ok).toBe(true);
});

test("HTTP Response Validation throws on invalid data shape", async () => {
  installJsonFetch(createMockResponse(true, 200, { id: "not-a-number" }));
  const http = createHttp({ baseURL: "http://api.test" });

  try {
    await http.get("/item", {
      validateResponse: (data) => typeof data.id === "number",
    });
    throw new Error("Should have failed response validation");
  } catch (err: any) {
    expect(err.message).toBe("Response validation failed");
  }
});

test("HTTP Response Transformer modifies response data", async () => {
  installJsonFetch(createMockResponse(true, 200, { value: 10 }));
  const http = createHttp({
    baseURL: "http://api.test",
    responseTransformer: (data) => ({ ...data, multiplied: data.value * 2 }),
  });

  const res = await http.get("/number", {
    transformer: (data) => ({ ...data, added: data.multiplied + 5 }),
  });

  expect(res.data.multiplied).toBe(20);
  expect(res.data.added).toBe(25);
});

test("HTTP Cache stale-while-revalidate strategy", async () => {
  let callCount = 0;
  installFetch(async () => {
    callCount += 1;
    return createMockResponse(true, 200, { count: callCount }) as any;
  });

  const http = createHttp({
    baseURL: "http://api.test",
    cache: { enabled: true, ttl: 50 },
  });

  const res1 = await http.get("/counter", { cacheStrategy: "stale-while-revalidate" });
  expect(res1.data.count).toBe(1);

  await sleep(60);

  const res2 = await http.get("/counter", { cacheStrategy: "stale-while-revalidate" });
  expect(res2.data.count).toBe(1);

  await sleep(50);

  const res3 = await http.get("/counter", { cacheStrategy: "stale-while-revalidate" });
  expect(res3.data.count).toBe(2);
});

test("JWT Refresh Token Interceptor refreshes token and retries requests", async () => {
  let refreshCalled = 0;

  installFetch(async (_url, init) => {
    const headers = init?.headers ? new Headers(init.headers) : new Headers();
    const authHeader = headers.get("authorization") ?? headers.get("Authorization") ?? "";

    if (authHeader === "Bearer new-token") {
      return createMockResponse(true, 200, { data: "success" }) as any;
    }

    return createMockResponse(false, 401, { error: "Unauthorized" }) as any;
  });

  const http = createHttp({
    baseURL: "http://api.test",
    auth: { accessToken: "old-token" },
  });

  http.interceptors.response.use(
    (res) => res,
    createRefreshAuthInterceptor(http, {
      refreshToken: () => {
        refreshCalled += 1;
        return "new-token";
      },
    }),
  );

  const [res1, res2] = await Promise.all([
    http.get("/data1"),
    http.get("/data2"),
  ]);

  expect(res1.data.data).toBe("success");
  expect(res2.data.data).toBe("success");
  expect(refreshCalled).toBe(1);
  expect(http.config.auth?.accessToken).toBe("new-token");
});

// -----------------------------------------------------------------------------
// Realtime client tests
// -----------------------------------------------------------------------------

class MockSocket {
  connected = false;
  listeners: Record<string, Function[]> = {};

  on(event: string, fn: Function) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
    return this;
  }

  once(event: string, fn: Function) {
    const wrapper = (...args: any[]) => {
      this.off(event, wrapper);
      fn(...args);
    };
    return this.on(event, wrapper);
  }

  off(event: string, fn?: Function) {
    if (!fn) {
      delete this.listeners[event];
    } else if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter((listener) => listener !== fn);
    }
    return this;
  }

  emit(event: string, data: any, cb?: Function) {
    if (cb) {
      setTimeout(() => cb({ success: true }), 10);
    }
  }

  disconnect() {
    this.connected = false;
    this.trigger("disconnect", "io client disconnect");
  }

  trigger(event: string, ...args: any[]) {
    if (this.listeners[event]) {
      [...this.listeners[event]].forEach((fn) => fn(...args));
    }
  }
}

const mockSocket = new MockSocket();

mock.module("socket.io-client", () => {
  return {
    io: () => {
      mockSocket.connected = true;
      setTimeout(() => mockSocket.trigger("connect"), 10);
      return mockSocket;
    },
  };
});

(globalThis as any).window = {};
(globalThis as any).document = { cookie: "" };

const { createRealtimeClient } = await import("./dist/socket.io.js");

test("Realtime Client Logger and lifecycle hooks", async () => {
  let connectHookCalled = false;
  let disconnectHookCalled = false;
  const logs: string[] = [];

  const customLogger = {
    debug: (..._args: any[]) => undefined,
    info: (msg: string) => logs.push(msg),
    warn: (..._args: any[]) => undefined,
    error: (..._args: any[]) => undefined,
  };

  const client = createRealtimeClient({
    socketUrl: "http://socket.test",
    logger: customLogger,
    hooks: {
      onConnect: () => {
        connectHookCalled = true;
      },
      onDisconnect: () => {
        disconnectHookCalled = true;
      },
    },
  });

  await client.connect();

  expect(connectHookCalled).toBe(true);
  expect(logs.some((msg) => msg.includes("Connecting to socket"))).toBe(true);
  expect(logs.some((msg) => msg.includes("Socket connected successfully"))).toBe(true);

  client.disconnect();

  expect(disconnectHookCalled).toBe(true);
  expect(logs.some((msg) => msg.includes("Socket disconnected"))).toBe(true);
});

test("Realtime Client Event Validation & Transformation", async () => {
  let validatedEmitCount = 0;
  let validatedReceiveCount = 0;

  const client = createRealtimeClient({
    socketUrl: "http://socket.test",
    eventValidator: (event, data, direction) => {
      if (direction === "emit") {
        validatedEmitCount += 1;
        return data.valid === true;
      }
      validatedReceiveCount += 1;
      return data.allow === true;
    },
    eventTransformer: (_event, data, direction) => {
      if (direction === "emit") {
        return { ...data, transformed: "emitted" };
      }
      return { ...data, transformed: "received" };
    },
  });

  await client.connect();

  let emitMockCalled = false;
  mockSocket.emit = (event: string, data: any) => {
    if (event === "message") {
      emitMockCalled = true;
      expect(data.transformed).toBe("emitted");
    }
  };

  client.emit("message", { valid: false });
  await sleep(15);
  expect(emitMockCalled).toBe(false);
  expect(validatedEmitCount).toBe(1);

  client.emit("message", { valid: true });
  await sleep(15);
  expect(emitMockCalled).toBe(true);
  expect(validatedEmitCount).toBe(2);

  let handlerCalledData: any = null;
  client.on("chat", (data) => {
    handlerCalledData = data;
  });

  mockSocket.trigger("chat", { allow: false });
  await sleep(15);
  expect(handlerCalledData).toBeNull();
  expect(validatedReceiveCount).toBe(1);

  mockSocket.trigger("chat", { allow: true });
  await sleep(15);
  expect(handlerCalledData).toBeTruthy();
  expect(handlerCalledData.transformed).toBe("received");
  expect(validatedReceiveCount).toBe(2);

  client.disconnect();
});

test("Realtime Client Room Join and Offline Queue", async () => {
  const client = createRealtimeClient({
    socketUrl: "http://socket.test",
    offlineQueue: { enabled: true },
  });

  await client.joinRoom("lobby");
  expect(client.getQueueLength()).toBe(1);

  let joinedRoomName = "";
  mockSocket.emit = (event: string, data: any, cb: any) => {
    if (event === "join:room") {
      joinedRoomName = data.room;
      cb({ success: true });
    }
  };

  await client.connect();
  await sleep(50);

  expect(joinedRoomName).toBe("lobby");
  expect(client.getQueueLength()).toBe(0);

  client.disconnect();
});
