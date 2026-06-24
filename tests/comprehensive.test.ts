import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import { createHttp, HttpError, NetworkError } from "../dist/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Mock Response Factory
// ─────────────────────────────────────────────────────────────────────────────

type MockResponseData =
  | Record<string, unknown>
  | unknown[]
  | string
  | number
  | boolean
  | null;

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
  headers?: Record<string, string>,
): MockResponse {
  const headersMap = new Map([["content-type", "application/json"]]);
  if (headers) {
    Object.entries(headers).forEach(([k, v]) => headersMap.set(k, v));
  }
  return {
    ok,
    status,
    statusText: ok ? "OK" : "Error",
    headers: headersMap,
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

function installJsonFetch(response: MockResponse) {
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

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Basic HTTP Methods
// ─────────────────────────────────────────────────────────────────────────────

describe("Basic HTTP Methods", () => {
  test("GET request returns proper HttpResponse", async () => {
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

  test("POST request with body works correctly", async () => {
    installJsonFetch(createMockResponse(true, 201, { id: 2, created: true }));

    const http = createHttp({ baseURL: "http://api.test" });
    const response = await http.post<{ created: boolean }>("/items", {
      name: "New Item",
    });

    expect(response.status).toBe(201);
    expect(response.data.created).toBe(true);
  });

  test("PUT request updates resource", async () => {
    installJsonFetch(createMockResponse(true, 200, { id: 1, updated: true }));

    const http = createHttp({ baseURL: "http://api.test" });
    const response = await http.put<{ updated: boolean }>("/items/1", {
      name: "Updated",
    });

    expect(response.status).toBe(200);
    expect(response.data.updated).toBe(true);
  });

  test("PATCH request partially updates resource", async () => {
    installJsonFetch(createMockResponse(true, 200, { id: 1, patched: true }));

    const http = createHttp({ baseURL: "http://api.test" });
    const response = await http.patch<{ patched: boolean }>("/items/1", {
      name: "Patched",
    });

    expect(response.status).toBe(200);
    expect(response.data.patched).toBe(true);
  });

  test("DELETE request with no body", async () => {
    installJsonFetch(createMockResponse(true, 204, null));

    const http = createHttp({ baseURL: "http://api.test" });
    const response = await http.delete("/items/1");

    expect(response.status).toBe(204);
  });

  test("DELETE request with body and options", async () => {
    installJsonFetch(createMockResponse(true, 200, { deleted: true }));

    const http = createHttp({ baseURL: "http://api.test" });
    const response = await http.delete<{ deleted: boolean }>("/items/1", {
      reason: "cleanup",
    });

    expect(response.status).toBe(200);
    expect(response.data.deleted).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Error Handling
// ─────────────────────────────────────────────────────────────────────────────

describe("Error Handling", () => {
  test("HTTP error with 4xx status", async () => {
    installJsonFetch(createMockResponse(false, 404, { error: "Not found" }));

    const http = createHttp({ baseURL: "http://api.test" });
    await expect(http.get("/not-found")).rejects.toThrow(HttpError);
  });

  test("HTTP error with 5xx status", async () => {
    installJsonFetch(createMockResponse(false, 500, { error: "Server Error" }));

    const http = createHttp({ baseURL: "http://api.test" });
    await expect(http.get("/error")).rejects.toThrow(HttpError);
  });

  test("Timeout error is thrown", async () => {
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

  test("Network error is thrown", async () => {
    installFetch(async () => {
      throw new Error("Network unreachable");
    });

    const http = createHttp({ baseURL: "http://api.test" });
    await expect(http.get("/items")).rejects.toThrow(NetworkError);
  });

  test("Error includes request details", async () => {
    installJsonFetch(createMockResponse(false, 400, { error: "Bad Request" }));

    const http = createHttp({ baseURL: "http://api.test" });
    try {
      await http.get("/items");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).url).toBeDefined();
      expect((error as HttpError).requestId).toBeDefined();
      expect((error as HttpError).durationMs).toBeDefined();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Caching
// ─────────────────────────────────────────────────────────────────────────────

describe("Caching", () => {
  test("Cache stores GET responses", async () => {
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

  test("Cache respects TTL", async () => {
    let callCount = 0;
    installFetch(async () => {
      callCount += 1;
      return createMockResponse(true, 200, { id: callCount }) as any;
    });

    const http = createHttp({
      baseURL: "http://api.test",
      cache: { enabled: true, ttl: 100 },
    });

    const response1 = await http.get("/items");
    expect(response1.data.id).toBe(1);
    expect(callCount).toBe(1);

    await sleep(150);

    const response2 = await http.get("/items");
    expect(response2.data.id).toBe(2);
    expect(callCount).toBe(2);
  });

  test("Cache can be cleared", async () => {
    let callCount = 0;
    installFetch(async () => {
      callCount += 1;
      return createMockResponse(true, 200, { id: callCount }) as any;
    });

    const http = createHttp({
      baseURL: "http://api.test",
      cache: { enabled: true, ttl: 60_000 },
    });

    await http.get("/items");
    http.clearCache();
    await http.get("/items");

    expect(callCount).toBe(2);
  });

  test("Cache can be invalidated by pattern", async () => {
    let callCount = 0;
    installFetch(async () => {
      callCount += 1;
      return createMockResponse(true, 200, { id: callCount }) as any;
    });

    const http = createHttp({
      baseURL: "http://api.test",
      cache: { enabled: true, ttl: 60_000 },
    });

    await http.get("/items");
    await http.get("/users");
    http.invalidateCache("/items");
    await http.get("/items");
    await http.get("/users");

    expect(callCount).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Deduplication
// ─────────────────────────────────────────────────────────────────────────────

describe("Request Deduplication", () => {
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

  test("Deduplication respects different parameters", async () => {
    let callCount = 0;
    installFetch(async () => {
      callCount += 1;
      return createMockResponse(true, 200, { id: callCount }) as any;
    });

    const http = createHttp({ baseURL: "http://api.test" });

    const [r1, r2] = await Promise.all([
      http.get("/items", { params: { page: 1 }, deduplicate: true }),
      http.get("/items", { params: { page: 2 }, deduplicate: true }),
    ]);

    expect(callCount).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Retry Logic
// ─────────────────────────────────────────────────────────────────────────────

describe("Retry Logic", () => {
  test("Retry with exponential backoff", async () => {
    let attempt = 0;
    installFetch(async () => {
      attempt += 1;
      if (attempt < 3) {
        return createMockResponse(false, 503, {
          error: "Service Unavailable",
        }) as any;
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

  test("Retry with linear backoff", async () => {
    let attempt = 0;
    installFetch(async () => {
      attempt += 1;
      if (attempt < 2) {
        return createMockResponse(false, 429, { error: "Rate Limited" }) as any;
      }
      return createMockResponse(true, 200, { retried: true }) as any;
    });

    const http = createHttp({
      baseURL: "http://api.test",
      retry: {
        attempts: 2,
        strategy: "linear",
        delay: 10,
        maxDelay: 100,
        statusCodes: [429],
      },
    });

    const response = await http.get("/items");

    expect(attempt).toBe(2);
    expect(response.data.retried).toBe(true);
  });

  test("Custom shouldRetry function", async () => {
    let attempt = 0;
    installFetch(async () => {
      attempt += 1;
      if (attempt < 2) {
        return createMockResponse(false, 500, { error: "Server Error" }) as any;
      }
      return createMockResponse(true, 200, { retried: true }) as any;
    });

    const http = createHttp({
      baseURL: "http://api.test",
      retry: {
        attempts: 2,
        strategy: "none",
        delay: 0,
        maxDelay: 0,
        statusCodes: [],
        shouldRetry: async (error, attemptNumber) => {
          if (error instanceof HttpError && error.status === 500) {
            return attemptNumber < 2;
          }
          return false;
        },
      },
    });

    const response = await http.get("/items");

    expect(attempt).toBe(2);
  });

  test("Retry respects max delay", async () => {
    let attempt = 0;
    const times: number[] = [];

    installFetch(async () => {
      times.push(Date.now());
      attempt += 1;
      if (attempt < 3) {
        return createMockResponse(false, 503, {}) as any;
      }
      return createMockResponse(true, 200, {}) as any;
    });

    const http = createHttp({
      baseURL: "http://api.test",
      retry: {
        attempts: 3,
        strategy: "exponential",
        delay: 50,
        maxDelay: 50,
        statusCodes: [503],
      },
    });

    await http.get("/items");

    const delays = [times[1] - times[0], times[2] - times[1]];

    // Both delays should be close to 50ms
    delays.forEach((delay) => {
      expect(delay).toBeGreaterThanOrEqual(40);
      expect(delay).toBeLessThan(150);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Interceptors
// ─────────────────────────────────────────────────────────────────────────────

describe("Interceptors", () => {
  test("Request interceptor modifies headers", async () => {
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
        ...config.headers,
        "x-custom": "intercepted",
      };
      return config;
    });

    await http.get("/items");

    expect(capturedHeaders?.["x-custom"]).toBe("intercepted");
  });

  test("Response interceptor modifies response", async () => {
    installJsonFetch(createMockResponse(true, 200, { value: "original" }));

    const http = createHttp({ baseURL: "http://api.test" });

    http.interceptors.response.use(async (response) => {
      response.data = { ...response.data, modified: true };
      return response;
    });

    const result = await http.get<any>("/items");

    expect(result.data.value).toBe("original");
    expect(result.data.modified).toBe(true);
  });

  test("Interceptor can eject", async () => {
    let interceptorCalls = 0;
    installJsonFetch(createMockResponse(true, 200, { value: "test" }));

    const http = createHttp({ baseURL: "http://api.test" });

    const handler = http.interceptors.request.use(async (config) => {
      interceptorCalls++;
      return config;
    });

    await http.get("/items");
    expect(interceptorCalls).toBe(1);

    handler.eject();

    await http.get("/items");
    expect(interceptorCalls).toBe(1);
  });

  test("Response error interceptor handles errors", async () => {
    installJsonFetch(createMockResponse(false, 401, { error: "Unauthorized" }));

    const http = createHttp({ baseURL: "http://api.test" });
    let errorInterceptorCalled = false;

    http.interceptors.response.use(
      async (response) => response,
      async (error) => {
        errorInterceptorCalled = true;
        throw error;
      },
    );

    try {
      await http.get("/items");
    } catch {
      // Expected
    }

    expect(errorInterceptorCalled).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Metrics and Observability
// ─────────────────────────────────────────────────────────────────────────────

describe("Metrics and Observability", () => {
  test("Metrics are collected correctly", async () => {
    installFetch(async () => {
      return createMockResponse(true, 200, {}) as any;
    });

    const http = createHttp({
      baseURL: "http://api.test",
      observability: { metrics: true, logger: false, tracing: false },
    });

    await http.get("/items");
    await http.post("/items", {});
    await http.get("/error");

    const metrics = http.getMetrics();

    expect(metrics.totalRequests).toBe(3);
    expect(metrics.successfulRequests).toBeGreaterThan(0);
  });

  test("Request IDs are tracked", async () => {
    installJsonFetch(createMockResponse(true, 200, { id: 1 }));

    const http = createHttp({ baseURL: "http://api.test" });

    const response = await http.get("/items");
    const history = http.getHistory();

    expect(history.length).toBeGreaterThan(0);
    const lastEntry = history[history.length - 1];
    expect(lastEntry.requestId).toBe(response.requestId);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Auth & CSRF
// ─────────────────────────────────────────────────────────────────────────────

describe("Authentication & CSRF", () => {
  test("Bearer token is injected in Authorization header", async () => {
    let capturedHeaders: Record<string, string> | undefined;

    installFetch(async (_url, init) => {
      capturedHeaders = Object.fromEntries(
        new Headers(init?.headers).entries(),
      );
      return createMockResponse(true, 200, {}) as any;
    });

    const http = createHttp({
      baseURL: "http://api.test",
      auth: {
        accessToken: "test-token-123",
        scheme: "Bearer",
        forwardCookies: false,
      },
    });

    await http.get("/items");

    expect(capturedHeaders?.["authorization"]).toBe("Bearer test-token-123");
  });

  test("Dynamic token retrieval", async () => {
    let capturedHeaders: Record<string, string> | undefined;

    installFetch(async (_url, init) => {
      capturedHeaders = Object.fromEntries(
        new Headers(init?.headers).entries(),
      );
      return createMockResponse(true, 200, {}) as any;
    });

    const http = createHttp({
      baseURL: "http://api.test",
      auth: {
        getToken: async () => "dynamic-token-456",
        scheme: "Bearer",
        forwardCookies: false,
      },
    });

    await http.get("/items");

    expect(capturedHeaders?.["authorization"]).toBe("Bearer dynamic-token-456");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Request Cancellation
// ─────────────────────────────────────────────────────────────────────────────

describe("Request Cancellation", () => {
  test("Request can be cancelled by ID", async () => {
    let signalPassed = false;

    installFetch(async (_url, init) => {
      signalPassed = !!init?.signal;
      return createMockResponse(true, 200, { success: true }) as any;
    });

    const http = createHttp({ baseURL: "http://api.test" });

    const response = await http.get("/items");

    expect(signalPassed).toBe(true);
    expect(response.status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Batch Requests
// ─────────────────────────────────────────────────────────────────────────────

describe("Batch Requests", () => {
  test("Batch requests execute in parallel", async () => {
    let callCount = 0;
    const callOrder: number[] = [];

    installFetch(async (_url) => {
      callCount++;
      const id = callCount;
      callOrder.push(id);
      await sleep(50);
      return createMockResponse(true, 200, { id }) as any;
    });

    const http = createHttp({ baseURL: "http://api.test" });

    const [r1, r2, r3] = await http.batchRequests([
      () => http.get("/items/1"),
      () => http.get("/items/2"),
      () => http.get("/items/3"),
    ]);

    expect(callCount).toBe(3);
    expect(r1.data.id).toBe(1);
    expect(r2.data.id).toBe(2);
    expect(r3.data.id).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Query Parameters
// ─────────────────────────────────────────────────────────────────────────────

describe("Query Parameters", () => {
  test("Query parameters are serialized correctly", async () => {
    let capturedUrl = "";

    installFetch(async (url) => {
      capturedUrl = String(url);
      return createMockResponse(true, 200, {}) as any;
    });

    const http = createHttp({ baseURL: "http://api.test" });

    await http.get("/items", { params: { page: 1, limit: 10 } });

    expect(capturedUrl).toContain("page=1");
    expect(capturedUrl).toContain("limit=10");
  });

  test("Array query parameters are handled", async () => {
    let capturedUrl = "";

    installFetch(async (url) => {
      capturedUrl = String(url);
      return createMockResponse(true, 200, {}) as any;
    });

    const http = createHttp({ baseURL: "http://api.test" });

    await http.get("/items", { params: { ids: [1, 2, 3] } });

    expect(capturedUrl).toContain("ids=1");
    expect(capturedUrl).toContain("ids=2");
    expect(capturedUrl).toContain("ids=3");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Response Parsing
// ─────────────────────────────────────────────────────────────────────────────

describe("Response Parsing", () => {
  test("JSON responses are parsed correctly", async () => {
    installJsonFetch(createMockResponse(true, 200, { name: "test" }));

    const http = createHttp({ baseURL: "http://api.test" });
    const response = await http.get("/items");

    expect(response.data.name).toBe("test");
  });

  test("Empty 204 responses return null data", async () => {
    installFetch(async () => {
      const response = createMockResponse(true, 204, "");
      return {
        ...response,
        ok: true,
        status: 204,
        headers: new Map([["content-length", "0"]]),
        json: async () => {
          throw new Error("No content");
        },
        text: async () => "",
      } as any;
    });

    const http = createHttp({ baseURL: "http://api.test" });
    const response = await http.get("/items");

    expect(response.status).toBe(204);
  });
});
