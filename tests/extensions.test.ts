import { describe, expect, test } from "bun:test";

import {
  withSchemaValidation,
  calculateRetryDelayWithJitter,
  ValidationError,
  AuthenticationError,
  RateLimitError,
  ConflictError,
  createErrorHandlingMiddleware,
  RequestDeduplicator,
  AdaptiveRetryStrategy,
  createTimeoutMiddleware,
  createETagCacheMiddleware,
  createCompressionMiddlewareExt,
} from "../dist/index.js";

import type { SchemaValidator } from "../dist/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: withSchemaValidation
// ─────────────────────────────────────────────────────────────────────────────

describe("withSchemaValidation", () => {
  const mockSchema: SchemaValidator = {
    parse: (data: any) => {
      if (data.id === undefined) throw new Error("id is required");
      return data;
    },
    safeParse: (data: any) => {
      if (data.id === undefined)
        return { success: false, error: "id is required" };
      return { success: true, data };
    },
  };

  function createMockHttp(overrides: any = {}) {
    return {
      get: async () => ({
        status: 200,
        statusText: "OK",
        data: { id: 1, name: "test" },
        headers: {},
        requestId: "req-1",
        durationMs: 10,
      }),
      post: async () => ({
        status: 201,
        statusText: "Created",
        data: { id: 2, name: "created" },
        headers: {},
        requestId: "req-2",
        durationMs: 10,
      }),
      ...overrides,
    };
  }

  test("validates GET response with schema", async () => {
    const http = withSchemaValidation(createMockHttp());
    const response = await http.get("/items", {
      schema: mockSchema,
    });

    expect(response.data.id).toBe(1);
    expect(response.status).toBe(200);
  });

  test("throws on schema validation failure for GET", async () => {
    const http = withSchemaValidation(
      createMockHttp({
        get: async () => ({
          status: 200,
          statusText: "OK",
          data: { name: "no-id" },
          headers: {},
          requestId: "req-1",
          durationMs: 10,
        }),
      }),
    );

    await expect(
      http.get("/items", { schema: mockSchema }),
    ).rejects.toThrow("Schema validation failed");
  });

  test("passes through GET without schema option", async () => {
    const http = withSchemaValidation(createMockHttp());
    const response = await http.get("/items");

    expect(response.data.id).toBe(1);
  });

  test("validates POST response with schema", async () => {
    const http = withSchemaValidation(createMockHttp());
    const response = await http.post("/items", { name: "new" }, {
      schema: mockSchema,
    });

    expect(response.data.id).toBe(2);
    expect(response.status).toBe(201);
  });

  test("throws on schema validation failure for POST", async () => {
    const http = withSchemaValidation(
      createMockHttp({
        post: async () => ({
          status: 201,
          statusText: "Created",
          data: { name: "no-id" },
          headers: {},
          requestId: "req-2",
          durationMs: 10,
        }),
      }),
    );

    await expect(
      http.post("/items", {}, { schema: mockSchema }),
    ).rejects.toThrow("Schema validation failed");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: calculateRetryDelayWithJitter
// ─────────────────────────────────────────────────────────────────────────────

describe("calculateRetryDelayWithJitter", () => {
  const config = {
    attempts: 5,
    initialDelay: 100,
    maxDelay: 1000,
    jitterFactor: 0.5,
  };

  test("returns non-negative delay", () => {
    for (let i = 1; i <= 5; i++) {
      const delay = calculateRetryDelayWithJitter(i, config);
      expect(delay).toBeGreaterThanOrEqual(0);
    }
  });

  test("increases delay exponentially", () => {
    const delays = Array.from({ length: 5 }, (_, i) =>
      calculateRetryDelayWithJitter(i + 1, { ...config, jitterFactor: 0 }),
    );

    for (let i = 1; i < delays.length; i++) {
      expect(delays[i]).toBeGreaterThan(delays[i - 1]);
    }
  });

  test("respects maxDelay cap", () => {
    const cappedConfig = {
      attempts: 10,
      initialDelay: 100,
      maxDelay: 200,
      jitterFactor: 0,
    };

    for (let i = 1; i <= 10; i++) {
      const delay = calculateRetryDelayWithJitter(i, cappedConfig);
      expect(delay).toBeLessThanOrEqual(200);
    }
  });

  test("applies jitter randomness", () => {
    const delays = Array.from({ length: 50 }, () =>
      calculateRetryDelayWithJitter(2, config),
    );
    const uniqueDelays = new Set(delays);
    // With 0.5 jitter factor, not all 50 calls should return the same value
    expect(uniqueDelays.size).toBeGreaterThan(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Extension Error Classes
// ─────────────────────────────────────────────────────────────────────────────

describe("Extension Error Classes", () => {
  describe("ValidationError", () => {
    test("has correct name and message", () => {
      const err = new ValidationError("is required", "email", undefined);
      expect(err.name).toBe("ValidationError");
      expect(err.message).toBe("Validation error in email: is required");
      expect(err.field).toBe("email");
      expect(err.value).toBeUndefined();
    });

    test("stores field and value", () => {
      const err = new ValidationError("too short", "password", "abc");
      expect(err.field).toBe("password");
      expect(err.value).toBe("abc");
    });

    test("is instanceof Error", () => {
      const err = new ValidationError("test", "f", null);
      expect(err).toBeInstanceOf(Error);
    });
  });

  describe("AuthenticationError", () => {
    test("has correct name and message", () => {
      const err = new AuthenticationError("Invalid credentials");
      expect(err.name).toBe("AuthenticationError");
      expect(err.message).toBe("Invalid credentials");
    });

    test("stores original error", () => {
      const original = new Error("401 response");
      const err = new AuthenticationError("Auth failed", original);
      expect(err.originalError).toBe(original);
    });
  });

  describe("RateLimitError", () => {
    test("has correct name and metadata", () => {
      const err = new RateLimitError("Too many requests", 60, 0);
      expect(err.name).toBe("RateLimitError");
      expect(err.retryAfter).toBe(60);
      expect(err.remainingRequests).toBe(0);
    });
  });

  describe("ConflictError", () => {
    test("has correct name and conflicting resource", () => {
      const err = new ConflictError("Version conflict", { version: 3 });
      expect(err.name).toBe("ConflictError");
      expect(err.conflictingResource).toEqual({ version: 3 });
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: createErrorHandlingMiddleware
// ─────────────────────────────────────────────────────────────────────────────

describe("createErrorHandlingMiddleware", () => {
  const middleware = createErrorHandlingMiddleware();

  test("converts 429 error to RateLimitError", () => {
    const error = {
      status: 429,
      message: "Too many requests",
      headers: { "retry-after": "30", "x-ratelimit-remaining": "5" },
    };

    const result = middleware.onError(error);

    expect(result).toBeInstanceOf(RateLimitError);
    expect((result as RateLimitError).retryAfter).toBe(30);
    expect((result as RateLimitError).remainingRequests).toBe(5);
  });

  test("converts 401 error to AuthenticationError", () => {
    const error = { status: 401, message: "Unauthorized" };
    const result = middleware.onError(error);

    expect(result).toBeInstanceOf(AuthenticationError);
  });

  test("converts 403 error to AuthenticationError", () => {
    const error = { status: 403, message: "Forbidden" };
    const result = middleware.onError(error);

    expect(result).toBeInstanceOf(AuthenticationError);
  });

  test("converts 400 with validationErrors to ValidationError", () => {
    const error = {
      status: 400,
      message: "Bad Request",
      data: {
        validationErrors: [{ message: "required", field: "email", value: "" }],
      },
    };

    const result = middleware.onError(error);

    expect(result).toBeInstanceOf(ValidationError);
    expect((result as ValidationError).field).toBe("email");
  });

  test("converts 409 error to ConflictError", () => {
    const error = {
      status: 409,
      message: "Conflict",
      data: { existingId: 1 },
    };
    const result = middleware.onError(error);

    expect(result).toBeInstanceOf(ConflictError);
    expect((result as ConflictError).conflictingResource).toEqual({
      existingId: 1,
    });
  });

  test("passes through unknown errors unchanged", () => {
    const error = { status: 500, message: "Internal Server Error" };
    const result = middleware.onError(error);

    expect(result).toBe(error);
  });

  test("passes through GraphQL errors unchanged", () => {
    const error = { graphqlErrors: [{ message: "Field error" }] };
    const result = middleware.onError(error);

    expect(result).toBe(error);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: RequestDeduplicator
// ─────────────────────────────────────────────────────────────────────────────

describe("RequestDeduplicator", () => {
  test("executes function and returns result", async () => {
    const dedup = new RequestDeduplicator();
    const result = await dedup.execute("key-1", async () => 42);

    expect(result).toBe(42);
  });

  test("deduplicates concurrent calls with same key", async () => {
    const dedup = new RequestDeduplicator();
    let callCount = 0;

    const factory = async () => {
      callCount++;
      await new Promise((r) => setTimeout(r, 50));
      return callCount;
    };

    const [r1, r2, r3] = await Promise.all([
      dedup.execute("same-key", factory),
      dedup.execute("same-key", factory),
      dedup.execute("same-key", factory),
    ]);

    expect(callCount).toBe(1);
    expect(r1).toBe(1);
    expect(r2).toBe(1);
    expect(r3).toBe(1);
  });

  test("does NOT deduplicate different keys", async () => {
    const dedup = new RequestDeduplicator();
    let callCount = 0;

    const factory = async () => {
      callCount++;
      return callCount;
    };

    const [r1, r2] = await Promise.all([
      dedup.execute("key-a", factory),
      dedup.execute("key-b", factory),
    ]);

    expect(callCount).toBe(2);
    expect(r1).toBe(1);
    expect(r2).toBe(2);
  });

  test("propagates errors and cleans up", async () => {
    const dedup = new RequestDeduplicator();

    const factory = async () => {
      throw new Error("boom");
    };

    await expect(dedup.execute("fail", factory)).rejects.toThrow("boom");

    // After failure, key should be cleaned up so a new call can succeed
    const result = await dedup.execute("fail", async () => "recovered");
    expect(result).toBe("recovered");
  });

  test("clear removes all active entries", async () => {
    const dedup = new RequestDeduplicator();

    dedup.execute("key", async () => {
      await new Promise((r) => setTimeout(r, 200));
      return "done";
    });

    dedup.clear();
    expect(dedup.getActiveRequests()).toHaveLength(0);
  });

  test("getActiveRequests returns list of active keys", async () => {
    const dedup = new RequestDeduplicator();

    const promise = dedup.execute("active-key", async () => {
      await new Promise((r) => setTimeout(r, 200));
      return "done";
    });

    expect(dedup.getActiveRequests()).toContain("active-key");

    await promise;
    expect(dedup.getActiveRequests()).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: AdaptiveRetryStrategy
// ─────────────────────────────────────────────────────────────────────────────

describe("AdaptiveRetryStrategy", () => {
  test("allows retry within normal maxAttempts", () => {
    const strategy = new AdaptiveRetryStrategy();
    expect(strategy.shouldRetry("http://api.test/users", 1, 3)).toBe(true);
  });

  test("blocks retry beyond maxAttempts", () => {
    const strategy = new AdaptiveRetryStrategy();
    expect(strategy.shouldRetry("http://api.test/users", 3, 3)).toBe(false);
  });

  test("allows extra retries when failure rate is high", () => {
    const strategy = new AdaptiveRetryStrategy();

    // Record many failures to push failure rate above 0.5
    for (let i = 0; i < 10; i++) {
      strategy.recordFailure("http://api.test/unstable");
    }
    strategy.recordSuccess("http://api.test/unstable");

    // Now should allow more retries than maxAttempts
    expect(strategy.shouldRetry("http://api.test/unstable", 3, 3)).toBe(true);
    expect(strategy.shouldRetry("http://api.test/unstable", 4, 3)).toBe(true);
    expect(strategy.shouldRetry("http://api.test/unstable", 5, 3)).toBe(false);
  });

  test("records successes and failures", () => {
    const strategy = new AdaptiveRetryStrategy();

    strategy.recordSuccess("http://api.test/users");
    strategy.recordSuccess("http://api.test/users");
    strategy.recordFailure("http://api.test/users");

    const stats = strategy.getStats("http://api.test/users");
    expect(stats).toBeDefined();
    expect(stats!.successes).toBe(2);
    expect(stats!.failures).toBe(1);
  });

  test("reset clears all stats", () => {
    const strategy = new AdaptiveRetryStrategy();

    strategy.recordSuccess("http://api.test/users");
    strategy.recordFailure("http://api.test/users");
    strategy.reset();

    expect(strategy.getStats("http://api.test/users")).toBeUndefined();
  });

  test("uses URL pathname as key", () => {
    const strategy = new AdaptiveRetryStrategy();

    strategy.recordSuccess("http://api.test/users");
    strategy.recordFailure("https://other.api.com/users");

    // Both share the same pathname key "/users"
    const stats = strategy.getStats("http://api.test/users");
    expect(stats!.successes).toBe(1);
    expect(stats!.failures).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: createTimeoutMiddleware
// ─────────────────────────────────────────────────────────────────────────────

describe("createTimeoutMiddleware", () => {
  test("applies timeout matching a RegExp rule", () => {
    const middleware = createTimeoutMiddleware([
      { pattern: /\/api\/slow/, timeout: 10000 },
    ]);

    const config = { url: "/api/slow/data", timeout: 5000 };
    const result = middleware.beforeRequest(config);

    expect(result.timeout).toBe(10000);
  });

  test("applies timeout matching a string pattern rule", () => {
    const middleware = createTimeoutMiddleware([
      { pattern: "/api/upload", timeout: 30000 },
    ]);

    const config = { url: "/api/upload/avatar", timeout: 5000 };
    const result = middleware.beforeRequest(config);

    expect(result.timeout).toBe(30000);
  });

  test("does not override timeout when no rule matches", () => {
    const middleware = createTimeoutMiddleware([
      { pattern: "/api/slow", timeout: 10000 },
    ]);

    const config = { url: "/api/fast/data", timeout: 5000 };
    const result = middleware.beforeRequest(config);

    expect(result.timeout).toBe(5000);
  });

  test("uses first matching rule only", () => {
    const middleware = createTimeoutMiddleware([
      { pattern: "/api/upload", timeout: 30000 },
      { pattern: "/api", timeout: 10000 },
    ]);

    const config = { url: "/api/upload/file", timeout: 5000 };
    const result = middleware.beforeRequest(config);

    expect(result.timeout).toBe(30000);
  });

  test("handles empty rules array", () => {
    const middleware = createTimeoutMiddleware([]);
    const config = { url: "/test", timeout: 5000 };
    const result = middleware.beforeRequest(config);

    expect(result.timeout).toBe(5000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: createETagCacheMiddleware
// ─────────────────────────────────────────────────────────────────────────────

describe("createETagCacheMiddleware", () => {
  test("caches response with ETag header", async () => {
    const middleware = createETagCacheMiddleware();

    const response = {
      status: 200,
      data: { id: 1 },
      headers: { etag: "abc123", "content-type": "application/json" },
      response: { url: "http://api.test/users" },
    };

    await middleware.afterResponse(response);

    // Now check beforeRequest sets If-None-Match
    const config = { url: "http://api.test/users", headers: {} };
    const result = middleware.beforeRequest(config);

    expect(result.headers["If-None-Match"]).toBe("abc123");
  });

  test("does not cache response without ETag", async () => {
    const middleware = createETagCacheMiddleware();

    const response = {
      status: 200,
      data: { id: 1 },
      headers: { "content-type": "application/json" },
      response: { url: "http://api.test/users" },
    };

    await middleware.afterResponse(response);

    const config = { url: "http://api.test/users", headers: {} };
    const result = middleware.beforeRequest(config);

    expect(result.headers["If-None-Match"]).toBeUndefined();
  });

  test("returns cached data on 304 Not Modified", () => {
    const middleware = createETagCacheMiddleware();

    // Pre-populate cache
    const response = {
      status: 200,
      data: { id: 1, name: "cached" },
      headers: { etag: "abc123" },
      response: { url: "http://api.test/users" },
    };
    middleware.afterResponse(response);

    // Simulate 304 response
    const error = { status: 304, url: "http://api.test/users" };
    const result = middleware.onError(error);

    expect(result.status).toBe(200);
    expect(result.data).toEqual({ id: 1, name: "cached" });
  });

  test("does not set If-None-Match for uncached URLs", () => {
    const middleware = createETagCacheMiddleware();

    const config = { url: "http://api.test/unknown", headers: {} };
    const result = middleware.beforeRequest(config);

    expect(result.headers["If-None-Match"]).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: createCompressionMiddleware
// ─────────────────────────────────────────────────────────────────────────────

describe("createCompressionMiddleware", () => {
  test("returns middleware with correct name", () => {
    const middleware = createCompressionMiddlewareExt({ enabled: true });
    expect(middleware.name).toBe("compression");
  });

  test("passes through when disabled", async () => {
    const middleware = createCompressionMiddlewareExt({ enabled: false });
    const config = { body: { data: "large payload" } };
    const result = await middleware.beforeRequest(config);
    expect(result).toBe(config);
  });

  test("passes through when no body", async () => {
    const middleware = createCompressionMiddlewareExt({ enabled: true });
    const config = { body: undefined };
    const result = await middleware.beforeRequest(config);
    expect(result).toBe(config);
  });

  test("passes through when body below threshold", async () => {
    const middleware = createCompressionMiddlewareExt({
      enabled: true,
      threshold: 1024,
    });
    const config = { body: { small: true } };
    const result = await middleware.beforeRequest(config);
    // Body is small, should pass through unchanged
    expect(result).toBe(config);
  });
});
