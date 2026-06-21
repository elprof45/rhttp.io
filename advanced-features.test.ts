import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from "bun:test";

import {
  CircuitBreaker,
  RateLimiter,
  RequestPool,
  PollingManager,
  ETagManager,
  RequestProfiler,
  MiddlewareChain,
  InMemoryStructuredLogger,
  AutoCleanup,
  createHttp,
  withGraphQL,
} from "./dist/index.js";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

beforeEach(() => {
  mock.restore();
});

afterEach(() => {
  mock.restore();
});

// ─────────────────────────────────────────────────────────────────────────────
// Circuit Breaker Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Circuit Breaker", () => {
  test("Circuit Breaker starts in CLOSED state", () => {
    const breaker = new CircuitBreaker({
      enabled: true,
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 1000,
    });

    const status = breaker.getStatus();
    expect(status.state).toBe("closed");
  });

  test("Circuit Breaker opens after failure threshold", async () => {
    const breaker = new CircuitBreaker({
      enabled: true,
      failureThreshold: 2,
      successThreshold: 1,
      timeout: 1000,
    });

    try {
      await breaker.execute(async () => {
        throw new Error("Failure 1");
      });
    } catch {
      // Expected
    }

    try {
      await breaker.execute(async () => {
        throw new Error("Failure 2");
      });
    } catch {
      // Expected
    }

    const status = breaker.getStatus();
    expect(status.state).toBe("open");
  });

  test("Circuit Breaker blocks requests when OPEN", async () => {
    const breaker = new CircuitBreaker({
      enabled: true,
      failureThreshold: 1,
      successThreshold: 1,
      timeout: 1000,
    });

    try {
      await breaker.execute(async () => {
        throw new Error("Failure");
      });
    } catch {
      // Expected
    }

    let blocked = false;
    try {
      await breaker.execute(async () => {
        return "success";
      });
    } catch (error: any) {
      blocked = error.message.includes("OPEN");
    }

    expect(blocked).toBe(true);
  });

  test("Circuit Breaker transitions to HALF_OPEN after timeout", async () => {
    const breaker = new CircuitBreaker({
      enabled: true,
      failureThreshold: 1,
      successThreshold: 1,
      timeout: 100,
    });

    try {
      await breaker.execute(async () => {
        throw new Error("Failure");
      });
    } catch {
      // Expected
    }

    let status = breaker.getStatus();
    expect(status.state).toBe("open");

    await sleep(150);

    status = breaker.getStatus();
    expect(status.state).toBe("half-open");
  });

  test("Circuit Breaker closes after successes in HALF_OPEN state", async () => {
    const breaker = new CircuitBreaker({
      enabled: true,
      failureThreshold: 1,
      successThreshold: 2,
      timeout: 100,
    });

    try {
      await breaker.execute(async () => {
        throw new Error("Failure");
      });
    } catch {
      // Expected
    }

    await sleep(150);

    await breaker.execute(async () => {
      return "success 1";
    });

    await breaker.execute(async () => {
      return "success 2";
    });

    const status = breaker.getStatus();
    expect(status.state).toBe("closed");
  });

  test("Circuit Breaker can be manually reset", async () => {
    const breaker = new CircuitBreaker({
      enabled: true,
      failureThreshold: 1,
    });

    try {
      await breaker.execute(async () => {
        throw new Error("Failure");
      });
    } catch {
      // Expected
    }

    breaker.reset();

    const status = breaker.getStatus();
    expect(status.state).toBe("closed");
  });

  test("Circuit Breaker disabled allows all requests", async () => {
    const breaker = new CircuitBreaker({
      enabled: false,
      failureThreshold: 1,
    });

    for (let i = 0; i < 5; i++) {
      try {
        await breaker.execute(async () => {
          throw new Error("Failure");
        });
      } catch {
        // Expected
      }
    }

    const status = breaker.getStatus();
    expect(status.state).toBe("closed");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Rate Limiter Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Rate Limiter (Token Bucket)", () => {
  test("Rate Limiter initializes with default config", () => {
    const limiter = new RateLimiter();
    const config = limiter.getConfig();

    expect(config.enabled).toBe(false);
    expect(config.tokensPerSecond).toBe(100);
  });

  test("Rate Limiter allows requests within rate", async () => {
    const limiter = new RateLimiter({
      enabled: true,
      tokensPerSecond: 10,
      maxBurst: 10,
    });

    const start = Date.now();

    for (let i = 0; i < 5; i++) {
      await limiter.acquire("test", "GET", 1);
    }

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(100);
  });

  test("Rate Limiter waits when tokens depleted", async () => {
    const limiter = new RateLimiter({
      enabled: true,
      tokensPerSecond: 2,
      maxBurst: 2,
    });

    const start = Date.now();

    await limiter.acquire("test", "GET", 2);
    await limiter.acquire("test", "GET", 1);

    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThan(400);
  });

  test("Rate Limiter can be reset", async () => {
    const limiter = new RateLimiter({
      enabled: true,
      tokensPerSecond: 1,
      maxBurst: 1,
    });

    await limiter.acquire("test", "GET", 1);
    limiter.reset("test");

    const bucket = limiter.getStatus("test");
    expect(bucket).toBeUndefined();
  });

  test("Rate Limiter tracks multiple buckets", async () => {
    const limiter = new RateLimiter({
      enabled: true,
      tokensPerSecond: 10,
      maxBurst: 10,
    });

    await limiter.acquire("GET:/users", "GET", 1);
    await limiter.acquire("POST:/users", "POST", 1);

    const buckets = limiter.getAllBuckets();
    expect(buckets.size).toBe(2);
  });

  test("Rate Limiter respects weight parameter", async () => {
    const limiter = new RateLimiter({
      enabled: true,
      tokensPerSecond: 10,
      maxBurst: 10,
    });

    const start = Date.now();

    await limiter.acquire("test", "GET", 5);
    await limiter.acquire("test", "GET", 10);

    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThan(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Request Profiler Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Request Profiler", () => {
  test("Request Profiler tracks request timing", async () => {
    const profiler = new RequestProfiler();

    const profile = profiler.start("req-1", "/users", "GET");
    expect(profile.requestId).toBe("req-1");
    expect(profile.url).toBe("/users");
    expect(profile.method).toBe("GET");

    await sleep(50);

    const ended = profiler.end("req-1", 200);
    expect(ended?.duration).toBeGreaterThanOrEqual(50);
    expect(ended?.status).toBe(200);
  });

  test("Request Profiler collects statistics", async () => {
    const profiler = new RequestProfiler();

    profiler.start("req-1", "/users", "GET");
    await sleep(20);
    profiler.end("req-1", 200);

    profiler.start("req-2", "/users", "POST");
    await sleep(40);
    profiler.end("req-2", 201);

    const stats = profiler.getStats();
    expect(stats.totalRequests).toBe(2);
    expect(stats.averageDuration).toBeGreaterThan(25);
    expect(stats.maxDuration).toBeGreaterThan(35);
    expect(stats.minDuration).toBeGreaterThan(15);
  });

  test("Request Profiler filters profiles", async () => {
    const profiler = new RequestProfiler();

    profiler.start("req-1", "/users", "GET");
    profiler.end("req-1", 200);

    profiler.start("req-2", "/posts", "POST");
    profiler.end("req-2", 201);

    const userProfiles = profiler.getProfiles({ url: "/users" });
    expect(userProfiles.length).toBe(1);
    expect(userProfiles[0].requestId).toBe("req-1");
  });

  test("Request Profiler limits history", async () => {
    const profiler = new RequestProfiler();

    for (let i = 0; i < 1010; i++) {
      profiler.start(`req-${i}`, "/test", "GET");
      profiler.end(`req-${i}`, 200);
    }

    const profiles = profiler.getProfiles();
    expect(profiles.length).toBeLessThanOrEqual(1000);
  });

  test("Request Profiler can be cleared", () => {
    const profiler = new RequestProfiler();

    profiler.start("req-1", "/test", "GET");
    profiler.end("req-1", 200);

    profiler.clear();

    const stats = profiler.getStats();
    expect(stats.totalRequests).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Middleware Chain Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Middleware Chain", () => {
  test("Middleware Chain executes before request middleware", async () => {
    const chain = new MiddlewareChain();
    let headerAdded = false;

    chain.add({
      name: "auth",
      beforeRequest: async (config) => {
        headerAdded = true;
        config.headers = { ...config.headers, "x-auth": "token" };
        return config;
      },
    });

    const config = { headers: {} };
    const result = await chain.executeBeforeRequest(config);

    expect(headerAdded).toBe(true);
    expect(result.headers["x-auth"]).toBe("token");
  });

  test("Middleware Chain executes after response middleware", async () => {
    const chain = new MiddlewareChain();
    let responseModified = false;

    chain.add({
      name: "transformer",
      afterResponse: async (response) => {
        responseModified = true;
        response.data = { ...response.data, transformed: true };
        return response;
      },
    });

    const response = { data: { value: 1 } };
    const result = await chain.executeAfterResponse(response, {});

    expect(responseModified).toBe(true);
    expect(result.data.transformed).toBe(true);
  });

  test("Middleware Chain can remove middleware", async () => {
    const chain = new MiddlewareChain();

    chain.add({
      name: "test",
      beforeRequest: async (config) => {
        config.headers = { ...config.headers, "x-test": "value" };
        return config;
      },
    });

    chain.remove("test");

    const config = { headers: {} };
    const result = await chain.executeBeforeRequest(config);

    expect(result.headers["x-test"]).toBeUndefined();
  });

  test("Middleware Chain can be cleared", () => {
    const chain = new MiddlewareChain();

    chain.add({ name: "m1" });
    chain.add({ name: "m2" });

    chain.clear();

    expect(chain.getAll().length).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Structured Logger Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Structured Logger", () => {
  test("Logger records debug messages", () => {
    const logger = new InMemoryStructuredLogger();

    logger.debug("Debug message", { data: "test" });

    const logs = logger.getLogs();
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[logs.length - 1].level).toBe("debug");
    expect(logs[logs.length - 1].message).toBe("Debug message");
  });

  test("Logger records info messages", () => {
    const logger = new InMemoryStructuredLogger();

    logger.info("Info message");

    const logs = logger.getLogs();
    expect(logs[logs.length - 1].level).toBe("info");
  });

  test("Logger records error messages", () => {
    const logger = new InMemoryStructuredLogger();

    logger.error("Error occurred", { code: "ERR_001" });

    const logs = logger.getLogs();
    expect(logs[logs.length - 1].level).toBe("error");
    expect(logs[logs.length - 1].context?.code).toBe("ERR_001");
  });

  test("Logger limits history", () => {
    const logger = new InMemoryStructuredLogger();

    for (let i = 0; i < 600; i++) {
      logger.info(`Message ${i}`);
    }

    const logs = logger.getLogs();
    expect(logs.length).toBeLessThanOrEqual(500);
  });

  test("Logger can be cleared", () => {
    const logger = new InMemoryStructuredLogger();

    logger.info("Message");
    logger.clear();

    const logs = logger.getLogs();
    expect(logs.length).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Auto Cleanup Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Auto Cleanup", () => {
  test("Auto Cleanup manages timeouts", async () => {
    const cleanup = new AutoCleanup();
    let callCount = 0;

    cleanup.setTimeout("timer1", () => {
      callCount++;
    }, 50);

    await sleep(100);

    expect(callCount).toBe(1);
  });

  test("Auto Cleanup can clear specific timeout", async () => {
    const cleanup = new AutoCleanup();
    let callCount = 0;

    cleanup.setTimeout("timer1", () => {
      callCount++;
    }, 50);

    cleanup.clearTimeout("timer1");

    await sleep(100);

    expect(callCount).toBe(0);
  });

  test("Auto Cleanup manages intervals", async () => {
    const cleanup = new AutoCleanup();
    let callCount = 0;

    cleanup.setInterval("interval1", () => {
      callCount++;
    }, 30);

    await sleep(100);

    cleanup.clearInterval("interval1");

    expect(callCount).toBeGreaterThanOrEqual(2);
  });

  test("Auto Cleanup clears all timers", async () => {
    const cleanup = new AutoCleanup();
    let callCount = 0;

    cleanup.setTimeout("t1", () => {
      callCount++;
    }, 50);

    cleanup.setInterval("i1", () => {
      callCount++;
    }, 30);

    cleanup.clear();

    await sleep(100);

    expect(callCount).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Polling Manager Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Polling Manager", () => {
  test("Polling Manager polls endpoint until condition met", async () => {
    let attemptCount = 0;

    const poller = new PollingManager({
      enabled: true,
      interval: 50,
      maxAttempts: 5,
    });

    const result = await poller.poll(async () => {
      attemptCount++;
      return {
        status: attemptCount >= 3 ? "completed" : "pending",
        attempt: attemptCount,
      };
    }, {
      stopCondition: (data: any) => data.status === "completed",
    });

    expect(attemptCount).toBe(3);
    expect(result?.attempt).toBe(3);
  });

  test("Polling Manager respects maxAttempts", async () => {
    let attemptCount = 0;

    const poller = new PollingManager({
      enabled: true,
      interval: 20,
      maxAttempts: 3,
    });

    const result = await poller.poll(async () => {
      attemptCount++;
      return { status: "pending" };
    }, {
      stopCondition: (data: any) => data.status === "completed",
    });

    expect(attemptCount).toBe(3);
    // When maxAttempts is exhausted without meeting stopCondition,
    // poll() resolves with the last result (not undefined) so callers
    // can inspect the final state.
    expect(result).toEqual({ status: "pending" });
  });

  test("Polling Manager can be stopped", async () => {
    let attemptCount = 0;
    let stopped = false;

    const poller = new PollingManager({
      enabled: true,
      interval: 30,
      maxAttempts: 10,
    });

    setTimeout(() => {
      poller.stop();
      stopped = true;
    }, 80);

    await poller.poll(async () => {
      attemptCount++;
      return { status: "pending" };
    }, {
      stopCondition: () => false,
    });

    expect(stopped).toBe(true);
    expect(attemptCount).toBeLessThan(10);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ETag Manager Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("ETag Manager", () => {
  test("ETag Manager stores and retrieves ETags", () => {
    const manager = new ETagManager();

    manager.setETag("/users/1", "etag-123");

    expect(manager.getETag("/users/1")).toBe("etag-123");
  });

  test("ETag Manager detects missing ETags", () => {
    const manager = new ETagManager();

    expect(manager.getETag("/users/1")).toBeUndefined();
  });

  test("ETag Manager can be cleared", () => {
    const manager = new ETagManager();

    manager.setETag("/users/1", "etag-123");
    manager.clear();

    expect(manager.getETag("/users/1")).toBeUndefined();
  });

  test("ETag Manager handles multiple URLs", () => {
    const manager = new ETagManager();

    manager.setETag("/users/1", "etag-1");
    manager.setETag("/users/2", "etag-2");
    manager.setETag("/posts/1", "etag-3");

    expect(manager.getETag("/users/1")).toBe("etag-1");
    expect(manager.getETag("/users/2")).toBe("etag-2");
    expect(manager.getETag("/posts/1")).toBe("etag-3");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GraphQL Extension Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("GraphQL Extension", () => {
  test("GraphQL client makes successful queries", async () => {
    const mockHttp = {
      post: async (url: string, data: any) => ({
        data: {
          data: { posts: [{ id: "1", title: "Test" }] },
          errors: undefined,
        },
        status: 200,
      }),
    };

    const graphql = withGraphQL(mockHttp, "/graphql");

    const result = await graphql.query({
      query: "query { posts { id title } }",
    });

    expect(result).toEqual([{ id: "1", title: "Test" }]);
  });

  test("GraphQL client handles errors", async () => {
    const mockHttp = {
      post: async () => ({
        data: {
          data: undefined,
          errors: [
            {
              message: "Authentication required",
              extensions: { code: "UNAUTHENTICATED" },
            },
          ],
        },
        status: 200,
      }),
    };

    const graphql = withGraphQL(mockHttp, "/graphql");

    try {
      await graphql.query({ query: "query { protected { data } }" });
      expect.unreachable();
    } catch (error: any) {
      expect(error.name).toBe("GraphQLError");
      expect(error.message).toBe("Authentication required");
      expect(error.errors.length).toBe(1);
    }
  });

  test("GraphQL client sends variables", async () => {
    let sentData: any = null;

    const mockHttp = {
      post: async (url: string, data: any) => {
        sentData = data;
        return {
          data: { data: { user: { id: "1" } }, errors: undefined },
          status: 200,
        };
      },
    };

    const graphql = withGraphQL(mockHttp, "/graphql");

    await graphql.query({
      query: "query GetUser($id: ID!) { user(id: $id) { id } }",
      variables: { id: "1" },
    });

    expect(sentData.variables).toEqual({ id: "1" });
  });
});
