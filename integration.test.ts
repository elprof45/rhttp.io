import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from "bun:test";

import {
  createHttp,
  createClientHttp,
  createServerHttp,
  withGraphQL,
  HttpError,
  TimeoutError,
  NetworkError,
} from "./dist/index.js";

function createMockResponse(ok = true, status = 200, data: any = {}) {
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

function installFetch(handler: any) {
  globalThis.fetch = handler as typeof fetch;
}

function restoreGlobals() {
  mock.restore();
  (globalThis as any).window = undefined;
  (globalThis as any).document = undefined;
}

beforeEach(() => {
  mock.restore();
});

afterEach(() => {
  restoreGlobals();
});

// ─────────────────────────────────────────────────────────────────────────────
// Client Factory Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("HTTP Client Factories", () => {
  test("createHttp creates universal client", () => {
    const http = createHttp({
      baseURL: "https://api.test",
      timeout: 30000,
    });

    expect(http).toBeDefined();
    expect(http.config.baseURL).toBe("https://api.test");
    expect(http.config.timeout).toBe(30000);
  });

  test("createClientHttp enables CSRF by default", () => {
    (globalThis as any).window = {};

    const http = createClientHttp({
      baseURL: "https://api.test",
    });

    expect(http.config.csrf?.enabled).toBe(true);
    expect(http.config.csrf?.prefetch).toBe(true);
  });

  test("createServerHttp enables cookie forwarding", () => {
    const http = createServerHttp({
      baseURL: "https://api.test",
    });

    expect(http.config.auth?.forwardCookies).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Advanced Configuration Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Advanced HTTP Configuration", () => {
  test("Circuit Breaker integration in HTTP client", async () => {
    let attempt = 0;
    installFetch(async () => {
      attempt++;
      if (attempt <= 3) {
        return createMockResponse(false, 503, { error: "Service Unavailable" }) as any;
      }
      return createMockResponse(true, 200, { success: true }) as any;
    });

    const http = createHttp({
      baseURL: "http://api.test",
      circuitBreaker: {
        enabled: true,
        failureThreshold: 2,
        successThreshold: 1,
        timeout: 1000,
      },
    });

    try {
      await http.get("/test");
    } catch {
      // First failure
    }

    try {
      await http.get("/test");
    } catch {
      // Second failure - should open circuit
    }

    const breaker = http.getCircuitBreaker?.();
    if (breaker) {
      expect(breaker.isOpen()).toBe(true);
    }
  });

  test("Request Pool limits concurrent requests", async () => {
    let concurrentCount = 0;
    let maxConcurrent = 0;

    installFetch(async () => {
      concurrentCount++;
      maxConcurrent = Math.max(maxConcurrent, concurrentCount);

      await new Promise(resolve => setTimeout(resolve, 50));

      concurrentCount--;
      return createMockResponse(true, 200, { id: 1 }) as any;
    });

    const http = createHttp({
      baseURL: "http://api.test",
      requestPool: {
        enabled: true,
        maxConcurrent: 2,
        queueLimit: 10,
      },
    });

    const promises = Array(5).fill(0).map(() => http.get("/test"));
    await Promise.all(promises);

    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  test("Cache strategy configuration works", async () => {
    let callCount = 0;

    installFetch(async () => {
      callCount++;
      return createMockResponse(true, 200, { id: callCount }) as any;
    });

    const http = createHttp({
      baseURL: "http://api.test",
      cache: {
        enabled: true,
        ttl: 10000,
        strategy: "network-first",
      },
    });

    await http.get("/test");
    await http.get("/test");

    expect(callCount).toBe(2);
  });

  test("Observability metrics collection", async () => {
    installFetch(async () =>
      createMockResponse(true, 200, { success: true }) as any
    );

    const http = createHttp({
      baseURL: "http://api.test",
      observability: {
        logger: false,
        tracing: true,
        metrics: true,
      },
    });

    await http.get("/test");
    await http.post("/test", { data: "test" });

    const metrics = http.getMetrics();
    expect(metrics.totalRequests).toBe(2);
    expect(metrics.successfulRequests).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Authentication & Security Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Authentication & Security", () => {
  test("Static token injection", async () => {
    let capturedAuth: string | undefined;

    installFetch(async (_url, init) => {
      const headers = new Headers(init?.headers);
      capturedAuth = headers.get("authorization") || undefined;
      return createMockResponse(true, 200, {}) as any;
    });

    const http = createHttp({
      baseURL: "http://api.test",
      auth: {
        scheme: "Bearer",
        accessToken: "token-123",
      },
    });

    await http.get("/api/data");

    expect(capturedAuth).toBe("Bearer token-123");
  });

  test("Dynamic token retrieval", async () => {
    let capturedAuth: string | undefined;
    let tokenFetchCount = 0;

    installFetch(async (_url, init) => {
      const headers = new Headers(init?.headers);
      capturedAuth = headers.get("authorization") || undefined;
      return createMockResponse(true, 200, {}) as any;
    });

    const http = createHttp({
      baseURL: "http://api.test",
      auth: {
        scheme: "Bearer",
        getToken: async () => {
          tokenFetchCount++;
          return "dynamic-token";
        },
      },
    });

    await http.get("/api/data");

    expect(capturedAuth).toBe("Bearer dynamic-token");
    expect(tokenFetchCount).toBeGreaterThan(0);
  });

  test("CSRF token included in POST requests", async () => {
    let csrfHeaderValue: string | undefined;

    installFetch(async (_url, init) => {
      const headers = new Headers(init?.headers);
      csrfHeaderValue = headers.get("x-csrf-token") || undefined;
      return createMockResponse(true, 200, {}) as any;
    });

    (globalThis as any).window = {};
    (globalThis as any).document = { cookie: "csrf-token=test-csrf-123" };

    const http = createHttp({
      baseURL: "http://api.test",
      csrf: {
        enabled: true,
        headerName: "x-csrf-token",
        cookieName: "csrf-token",
        methods: ["POST"],
      },
    });

    await http.post("/api/data", { data: "test" });

    expect(csrfHeaderValue).toBe("test-csrf-123");
  });

  test("Cookie forwarding on server", async () => {
    let forwardedCookies: string | undefined;

    installFetch(async (_url, init) => {
      const headers = new Headers(init?.headers);
      forwardedCookies = headers.get("cookie") || undefined;
      return createMockResponse(true, 200, {}) as any;
    });

    const http = createServerHttp({
      baseURL: "http://api.test",
      auth: {
        forwardCookies: true,
      },
      requestContext: () => ({
        headers: new Map([["cookie", "session=abc123"]]),
      }),
    });

    await http.get("/api/data");

    expect(forwardedCookies).toBe("session=abc123");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Error Handling & Recovery Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Error Handling & Recovery", () => {
  test("Error includes full context", async () => {
    installFetch(async () =>
      createMockResponse(false, 404, { error: "Not Found" }) as any
    );

    const http = createHttp({ baseURL: "http://api.test" });

    try {
      await http.get("/missing");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      const err = error as HttpError;
      expect(err.status).toBe(404);
      expect(err.url).toBe("http://api.test/missing");
      expect(err.requestId).toBeDefined();
      expect(err.durationMs).toBeDefined();
    }
  });

  test("Timeout errors are TimeoutError instances", async () => {
    installFetch(async (_url, init) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const err = new Error("Aborted");
          (err as any).name = "AbortError";
          reject(err);
        });
      });
    });

    const http = createHttp({
      baseURL: "http://api.test",
      timeout: 50,
    });

    try {
      await http.get("/slow");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(TimeoutError);
    }
  });

  test("Network errors are NetworkError instances", async () => {
    installFetch(async () => {
      throw new Error("Network error");
    });

    const http = createHttp({ baseURL: "http://api.test" });

    try {
      await http.get("/test");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(NetworkError);
    }
  });

  test("Custom error handler in interceptor", async () => {
    installFetch(async () =>
      createMockResponse(false, 500, { error: "Server Error" }) as any
    );

    const http = createHttp({ baseURL: "http://api.test" });
    let errorHandled = false;

    http.interceptors.response.use(
      (res) => res,
      (error) => {
        if (error instanceof HttpError && error.status >= 500) {
          errorHandled = true;
        }
        throw error;
      }
    );

    try {
      await http.get("/error");
    } catch {
      // Expected
    }

    expect(errorHandled).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Request Validation Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Request & Response Validation", () => {
  test("Custom request validator blocks invalid requests", async () => {
    const http = createHttp({
      baseURL: "http://api.test",
      requestValidator: (url) => !url.includes("forbidden"),
    });

    try {
      await http.get("/forbidden-path");
      expect.unreachable();
    } catch (error: any) {
      expect(error.message).toContain("validation failed");
    }
  });

  test("Custom response validator validates shape", async () => {
    installFetch(async () =>
      createMockResponse(true, 200, { id: "string-id" }) as any
    );

    const http = createHttp({ baseURL: "http://api.test" });

    try {
      await http.get("/data", {
        validateResponse: (data) => typeof data.id === "number",
      });
      expect.unreachable();
    } catch (error: any) {
      expect(error.message).toContain("validation failed");
    }
  });

  test("Response transformer modifies data", async () => {
    installFetch(async () =>
      createMockResponse(true, 200, { value: 10 }) as any
    );

    const http = createHttp({
      baseURL: "http://api.test",
      responseTransformer: (data) => ({
        ...data,
        doubled: data.value * 2,
      }),
    });

    const res = await http.get<any>("/data");

    expect(res.data.value).toBe(10);
    expect(res.data.doubled).toBe(20);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Complex Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Complex Integration Scenarios", () => {
  test("Full request lifecycle with cache, retry, and metrics", async () => {
    let attempt = 0;

    installFetch(async () => {
      attempt++;
      if (attempt === 1) {
        return createMockResponse(false, 503, {}) as any;
      }
      return createMockResponse(true, 200, { id: 1, data: "success" }) as any;
    });

    const http = createHttp({
      baseURL: "http://api.test",
      cache: { enabled: true, ttl: 60000 },
      retry: {
        attempts: 2,
        strategy: "exponential",
        delay: 10,
        statusCodes: [503],
      },
      observability: { metrics: true },
    });

    const response = await http.get("/data");

    expect(response.status).toBe(200);
    expect(response.data.id).toBe(1);

    const metrics = http.getMetrics();
    expect(metrics.totalRequests).toBe(1);
  });

  test("Multiple interceptors in pipeline", async () => {
    let interceptorOrder: string[] = [];

    installFetch(async () =>
      createMockResponse(true, 200, { value: "original" }) as any
    );

    const http = createHttp({ baseURL: "http://api.test" });

    http.interceptors.request.use(async (config) => {
      interceptorOrder.push("req-1");
      config.headers = { ...config.headers, "x-first": "true" };
      return config;
    });

    http.interceptors.request.use(async (config) => {
      interceptorOrder.push("req-2");
      config.headers = { ...config.headers, "x-second": "true" };
      return config;
    });

    http.interceptors.response.use(async (res) => {
      interceptorOrder.push("res-1");
      return res;
    });

    await http.get("/data");

    expect(interceptorOrder).toContain("req-1");
    expect(interceptorOrder).toContain("req-2");
    expect(interceptorOrder).toContain("res-1");
  });

  test("Batched requests with mixed success/failure", async () => {
    installFetch(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes("/fail")) {
        return createMockResponse(false, 404, {}) as any;
      }
      return createMockResponse(true, 200, { success: true }) as any;
    });

    const http = createHttp({ baseURL: "http://api.test" });

    const results = await http.batchRequests([
      () => http.get("/success"),
      () => http.get("/fail").catch(() => null),
      () => http.get("/success"),
    ]);

    expect(results[0]?.status).toBe(200);
    expect(results[1]).toBeNull();
    expect(results[2]?.status).toBe(200);
  });
});
