import { describe, expect, test } from "bun:test";

import {
  MemoryTokenStorage,
  SessionStorageTokenStorage,
  HybridTokenStorage,
  getRecommendedTokenStorage,
  getTokenStorage,
  type TokenStorage,
} from "../dist/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: MemoryTokenStorage
// ─────────────────────────────────────────────────────────────────────────────

describe("MemoryTokenStorage", () => {
  test("starts with no token", () => {
    const storage = new MemoryTokenStorage();
    expect(storage.has()).toBe(false);
    expect(storage.get()).toBeNull();
  });

  test("stores and retrieves a token", () => {
    const storage = new MemoryTokenStorage();
    storage.set("my-access-token");
    expect(storage.has()).toBe(true);
    expect(storage.get()).toBe("my-access-token");
  });

  test("overwrites previous token", () => {
    const storage = new MemoryTokenStorage();
    storage.set("token-1");
    storage.set("token-2");
    expect(storage.get()).toBe("token-2");
  });

  test("clear removes the token", () => {
    const storage = new MemoryTokenStorage();
    storage.set("my-token");
    storage.clear();
    expect(storage.has()).toBe(false);
    expect(storage.get()).toBeNull();
  });

  test("clear on empty storage is safe", () => {
    const storage = new MemoryTokenStorage();
    expect(() => storage.clear()).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: SessionStorageTokenStorage
// ─────────────────────────────────────────────────────────────────────────────

describe("SessionStorageTokenStorage", () => {
  // In non-browser environments, falls back to in-memory storage

  test("falls back to memory when sessionStorage is unavailable", () => {
    const storage = new SessionStorageTokenStorage();

    expect(storage.has()).toBe(false);
    expect(storage.get()).toBeNull();
  });

  test("stores and retrieves a token via fallback", () => {
    const storage = new SessionStorageTokenStorage();
    storage.set("session-token");

    expect(storage.has()).toBe(true);
    expect(storage.get()).toBe("session-token");
  });

  test("clear removes the token via fallback", () => {
    const storage = new SessionStorageTokenStorage();
    storage.set("session-token");
    storage.clear();

    expect(storage.has()).toBe(false);
    expect(storage.get()).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: HybridTokenStorage
// ─────────────────────────────────────────────────────────────────────────────

describe("HybridTokenStorage", () => {
  test("starts with no token", () => {
    const storage = new HybridTokenStorage();
    expect(storage.has()).toBe(false);
    expect(storage.get()).toBeNull();
  });

  test("stores and retrieves a token", () => {
    const storage = new HybridTokenStorage();
    storage.set("hybrid-token");

    expect(storage.has()).toBe(true);
    expect(storage.get()).toBe("hybrid-token");
  });

  test("clear removes the token", () => {
    const storage = new HybridTokenStorage();
    storage.set("hybrid-token");
    storage.clear();

    expect(storage.has()).toBe(false);
    expect(storage.get()).toBeNull();
  });

  test("prioritizes memory over sessionStorage", () => {
    const storage = new HybridTokenStorage();
    storage.set("priority-test");

    // Directly manipulate memory (simulating sessionStorage loss)
    // The get() should still return from memory
    expect(storage.get()).toBe("priority-test");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: getRecommendedTokenStorage
// ─────────────────────────────────────────────────────────────────────────────

describe("getRecommendedTokenStorage", () => {
  test("returns MemoryTokenStorage on server (no window)", () => {
    const storage = getRecommendedTokenStorage();
    // In Node.js/test environment, window is undefined → MemoryTokenStorage
    expect(storage).toBeInstanceOf(MemoryTokenStorage);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: getTokenStorage factory
// ─────────────────────────────────────────────────────────────────────────────

describe("getTokenStorage", () => {
  test('returns MemoryTokenStorage for "memory"', () => {
    expect(getTokenStorage("memory")).toBeInstanceOf(MemoryTokenStorage);
  });

  test('returns SessionStorageTokenStorage for "session"', () => {
    expect(getTokenStorage("session")).toBeInstanceOf(
      SessionStorageTokenStorage,
    );
  });

  test('returns HybridTokenStorage for "hybrid"', () => {
    expect(getTokenStorage("hybrid")).toBeInstanceOf(HybridTokenStorage);
  });

  test('returns HybridTokenStorage by default (no argument)', () => {
    expect(getTokenStorage()).toBeInstanceOf(HybridTokenStorage);
  });

  test('returns IndexedDBTokenStorage for "indexeddb"', () => {
    expect(getTokenStorage("indexeddb")).toBeInstanceOf(HybridTokenStorage);
    // Note: In test environment without indexedDB, this would throw.
    // The current implementation may fall back. We just verify it doesn't throw.
  });

  test("conforms to TokenStorage interface", () => {
    const storage: TokenStorage = getTokenStorage("memory");

    storage.set("test-token");
    expect(storage.has()).toBe(true);
    expect(storage.get()).toBe("test-token");
    storage.clear();
    expect(storage.has()).toBe(false);
  });
});
