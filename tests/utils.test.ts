import { describe, expect, test } from "bun:test";

import {
  buildUrl,
  generateRequestId,
  getCookie,
  parseHeaders,
} from "../dist/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: buildUrl
// ─────────────────────────────────────────────────────────────────────────────

describe("buildUrl", () => {
  test("combines base URL and relative path", () => {
    expect(buildUrl("http://api.test", "/users")).toBe(
      "http://api.test/users",
    );
  });

  test("removes trailing slash from base URL", () => {
    expect(buildUrl("http://api.test/", "/users")).toBe(
      "http://api.test/users",
    );
  });

  test("adds leading slash to relative path", () => {
    expect(buildUrl("http://api.test", "users")).toBe(
      "http://api.test/users",
    );
  });

  test("appends query parameters", () => {
    const result = buildUrl("http://api.test", "/search", {
      q: "hello",
      page: 1,
    });
    expect(result).toContain("q=hello");
    expect(result).toContain("page=1");
  });

  test("encodes query parameter values", () => {
    const result = buildUrl("http://api.test", "/search", {
      q: "hello world",
    });
    expect(result).toMatch(/q=hello(%20|\+)world/);
  });

  test("expands array query parameters", () => {
    const result = buildUrl("http://api.test", "/items", {
      ids: [1, 2, 3],
    });
    expect(result).toContain("ids=1");
    expect(result).toContain("ids=2");
    expect(result).toContain("ids=3");
  });

  test("filters out undefined and null values", () => {
    const result = buildUrl("http://api.test", "/search", {
      q: "test",
      empty: undefined,
      nil: null,
    });
    expect(result).not.toContain("empty");
    expect(result).not.toContain("nil");
    expect(result).toContain("q=test");
  });

  test("filters out undefined/null elements in arrays", () => {
    const result = buildUrl("http://api.test", "/items", {
      ids: [1, undefined, null, 3],
    });
    expect(result).toContain("ids=1");
    expect(result).toContain("ids=3");
  });

  test("passes through absolute URLs without base", () => {
    expect(buildUrl("http://api.test", "https://other.api/v1")).toBe(
      "https://other.api/v1",
    );
  });

  test("passes through absolute URLs with http scheme", () => {
    expect(buildUrl("http://api.test", "http://other.api/v1")).toBe(
      "http://other.api/v1",
    );
  });

  test("handles empty params object", () => {
    expect(buildUrl("http://api.test", "/users", {})).toBe(
      "http://api.test/users",
    );
  });

  test("handles missing params", () => {
    expect(buildUrl("http://api.test", "/users")).toBe(
      "http://api.test/users",
    );
  });

  test("concatenates with & when URL already has query string", () => {
    const result = buildUrl("", "http://api.test/search?existing=true", {
      new: "value",
    });
    expect(result).toContain("existing=true");
    expect(result).toContain("&new=value");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: generateRequestId
// ─────────────────────────────────────────────────────────────────────────────

describe("generateRequestId", () => {
  test("generates a non-empty string", () => {
    const id = generateRequestId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  test("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateRequestId()));
    expect(ids.size).toBe(100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: getCookie
// ─────────────────────────────────────────────────────────────────────────────

describe("getCookie", () => {
  test("parses cookie from header string", () => {
    expect(getCookie("session", "session=abc123; csrf=xyz")).toBe("abc123");
  });

  test("parses last cookie by name from header string", () => {
    expect(getCookie("csrf", "session=abc; csrf=token456")).toBe("token456");
  });

  test("decodes URI-encoded cookie values", () => {
    expect(getCookie("name", "name=hello%20world")).toBe("hello world");
  });

  test("returns null when cookie not found", () => {
    expect(getCookie("missing", "session=abc")).toBeNull();
  });

  test("returns null for empty cookie string", () => {
    expect(getCookie("any", "")).toBeNull();
  });

  test("handles cookies with extra whitespace", () => {
    expect(getCookie("token", "  token=val  ")).toBe("val");
  });

  test("skips cookies without = sign", () => {
    expect(getCookie("csrf", "empty; csrf=abc")).toBe("abc");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: parseHeaders
// ─────────────────────────────────────────────────────────────────────────────

describe("parseHeaders", () => {
  test("converts Headers instance to plain object with lowercase keys", () => {
    const headers = new Headers({
      "Content-Type": "application/json",
      "X-Custom-Header": "value",
    });
    const result = parseHeaders(headers);

    expect(result["content-type"]).toBe("application/json");
    expect(result["x-custom-header"]).toBe("value");
  });

  test("handles empty headers", () => {
    const headers = new Headers();
    const result = parseHeaders(headers);
    expect(Object.keys(result).length).toBe(0);
  });

  test("preserves all header values", () => {
    const headers = new Headers({
      a: "1",
      b: "2",
      c: "3",
    });
    const result = parseHeaders(headers);
    expect(Object.keys(result).length).toBe(3);
  });
});
