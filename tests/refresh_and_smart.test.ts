import { afterEach, beforeEach, expect, test } from "bun:test";

import { createHttp, createRefreshAuthInterceptor } from "../dist/index.js";

function createMockResponse(ok = true, status = 200, data: any = {}) {
  return {
    ok,
    status,
    statusText: ok ? "OK" : "Error",
    headers: new Map([["content-type", "application/json"]]),
    json: async () => data,
    text: async () => JSON.stringify(data),
    blob: async () => new Blob([JSON.stringify(data)]),
  } as any;
}

const originalFetch = globalThis.fetch;

function installFetch(
  handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
) {
  globalThis.fetch = handler as typeof fetch;
}

function restoreGlobals() {
  globalThis.fetch = originalFetch;
}

beforeEach(() => {
  // noop
});

afterEach(() => {
  restoreGlobals();
});

test("Refresh endpoint uses client.customFetch and retries requests", async () => {
  // Simulate server responses: original requests return 401 unless Authorization: Bearer new-token
  installFetch(async (_url, init) => {
    const headers = init?.headers ? new Headers(init.headers) : new Headers();
    const authHeader =
      headers.get("authorization") || headers.get("Authorization") || "";
    if (authHeader === "Bearer new-token") {
      return createMockResponse(true, 200, { data: "ok" }) as any;
    }
    return createMockResponse(false, 401, { error: "Unauthorized" }) as any;
  });

  const http = createHttp({
    baseURL: "http://api.test",
    auth: { accessToken: "old-token" },
  });

  let refreshCalled = 0;
  let refreshed = false;

  // Override client.customFetch to handle both refreshEndpoint and replayed requests
  http.customFetch = async (url: string | URL, options?: any) => {
    const sUrl = String(url);
    if (sUrl.includes("/api/refresh")) {
      refreshCalled += 1;
      refreshed = true;
      return {
        ...createMockResponse(true, 200, { accessToken: "new-token" }),
        data: { accessToken: "new-token" },
      } as any;
    }

    if (sUrl.includes("/data") && refreshed) {
      return {
        ...createMockResponse(true, 200, { data: "ok" }),
        data: { data: "ok" },
      } as any;
    }

    return createMockResponse(false, 401, { error: "Unauthorized" }) as any;
  };

  http.interceptors.response.use(
    (r) => r,
    createRefreshAuthInterceptor(http, {
      refreshEndpoint: "/api/refresh",
      refreshUsingClient: true,
      onTokenRefreshed: (t) => {
        // no-op
      },
    }),
  );

  const [r1, r2] = await Promise.all([http.get("/data1"), http.get("/data2")]);

  expect(r1.data.data).toBe("ok");
  expect(r2.data.data).toBe("ok");
  expect(refreshCalled).toBe(1);
  expect(http.config.auth?.accessToken).toBe("new-token");
});

test("Smart caching invalidates patterns on POST when enabled in core", async () => {
  let callCount = 0;

  installFetch(async (url) => {
    callCount += 1;
    const s = String(url);
    if (s.includes("/api/users") && s.includes("/1")) {
      return createMockResponse(true, 200, {
        id: 1,
        name: `User1-call${callCount}`,
      }) as any;
    }
    if (s.includes("/api/users") && s.includes("/2")) {
      return createMockResponse(true, 200, {
        id: 2,
        name: `User2-call${callCount}`,
      }) as any;
    }
    if (s.includes("/api/users") && s.endsWith("/api/users")) {
      // POST create user
      return createMockResponse(true, 201, { created: true }) as any;
    }
    return createMockResponse(true, 200, { ok: true }) as any;
  });

  const http = createHttp({
    baseURL: "http://api.test",
    cache: { enabled: true, ttl: 60_000 },
    smartCaching: {
      enabled: true,
      patterns: {
        "/api/users*": { invalidateOn: ["POST"] },
      },
    },
  });

  // Prime caches
  const a1 = await http.get("/api/users/1");
  const a2 = await http.get("/api/users/2");

  const callsBefore = callCount;

  // POST that should trigger invalidation for /api/users*
  await http.post("/api/users", { name: "new" });

  // After invalidation, requests should hit network again
  const b2 = await http.get("/api/users/2");
  const b1 = await http.get("/api/users/1");

  expect(callCount).toBeGreaterThanOrEqual(callsBefore + 2);
  expect(b1.data.name).toMatch(/User1-call/);
  expect(b2.data.name).toMatch(/User2-call/);
});
