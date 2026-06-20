import type { CircuitBreakerConfig, RequestPoolConfig, PollingConfig, CacheStrategy } from "./types";
import { HttpError } from "./errors";

/**
 * Circuit Breaker State
 * - CLOSED: Normal operation, all requests pass through
 * - OPEN: Service failing, requests are blocked immediately
 * - HALF_OPEN: Testing recovery, limited requests allowed
 */
export type CircuitBreakerState = "closed" | "open" | "half-open";

/**
 * Circuit Breaker Implementation
 * Prevents cascading failures by detecting patterns and failing fast.
 *
 * @example
 * ```typescript
 * const http = createHttp({
 *   circuitBreaker: {
 *     enabled: true,
 *     failureThreshold: 5,
 *     successThreshold: 2,
 *     timeout: 60000
 *   }
 * });
 * ```
 */
// ─────────────────────────────────────────────────────────────────────────────
// Circuit Breaker Implementation
// ─────────────────────────────────────────────────────────────────────────────

export class CircuitBreaker {
  private state: "closed" | "open" | "half-open" = "closed";
  private failures = 0;
  private successes = 0;
  private lastFailureTime = 0;
  private rejectedCount = 0;
  private config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      failureThreshold: config.failureThreshold ?? 5,
      successThreshold: config.successThreshold ?? 2,
      timeout: config.timeout ?? 60000,
    };
  }

  isOpen() {
    if (this.state === "open") {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.config.timeout) {
        this.state = "half-open";
        this.successes = 0;
        return false;
      }
      return true;
    }
    return false;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.config.enabled) {
      return fn();
    }

    if (this.state === "open") {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.config.timeout) {
        this.state = "half-open";
        this.successes = 0;
      } else {
        this.rejectedCount++;
        throw new Error("Circuit breaker is OPEN - request blocked");
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    if (this.state === "half-open") {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        this.state = "closed";
        this.successes = 0;
      }
    }
  }

  private onFailure() {
    this.lastFailureTime = Date.now();
    this.failures++;
    if (this.failures >= this.config.failureThreshold) {
      this.state = "open";
    }
  }

  getStatus() {
    let timeUntilHalfOpen = 0;
    if (this.state === "open") {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.config.timeout) {
        this.state = "half-open";
        this.successes = 0;
      } else {
        timeUntilHalfOpen = Math.max(0, this.config.timeout - elapsed);
      }
    }
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      rejectedCount: this.rejectedCount,
      timeUntilHalfOpen,
    };
  }

  reset() {
    this.state = "closed";
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = 0;
    this.rejectedCount = 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Request Pool Implementation
// ─────────────────────────────────────────────────────────────────────────────

export class RequestPool {
  private config: RequestPoolConfig;
  private activeRequests = 0;
  private queue: Array<{
    fn: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }> = [];

  constructor(config: Partial<RequestPoolConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? false,
      maxConcurrent: config.maxConcurrent ?? 5,
      queueLimit: config.queueLimit,
    };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.config.enabled || this.activeRequests < this.config.maxConcurrent) {
      return this.runRequest(fn);
    }

    if (this.config.queueLimit && this.queue.length >= this.config.queueLimit) {
      throw new Error("Request pool queue limit exceeded");
    }

    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
    });
  }

  private async runRequest<T>(fn: () => Promise<T>): Promise<T> {
    this.activeRequests++;
    try {
      return await fn();
    } finally {
      this.activeRequests--;
      this.processQueue();
    }
  }

  private processQueue() {
    while (
      this.queue.length > 0 &&
      this.activeRequests < this.config.maxConcurrent
    ) {
      const { fn, resolve, reject } = this.queue.shift()!;
      this.runRequest(fn).then(resolve, reject);
    }
  }

  getStats() {
    return {
      activeRequests: this.activeRequests,
      queueLength: this.queue.length,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Polling Manager
// ─────────────────────────────────────────────────────────────────────────────

export class PollingManager {
  private defaultOptions: Partial<PollingConfig>;
  private timers: Map<string, { timer: NodeJS.Timeout; resolve: (value: any) => void }> = new Map();

  constructor(defaultOptions: Partial<PollingConfig> = {}) {
    this.defaultOptions = defaultOptions;
  }

  async poll<T>(
    fn: () => Promise<T>,
    config?: Partial<PollingConfig>,
    requestId: string = "default"
  ): Promise<T> {
    const mergedConfig = {
      interval: 1000,
      maxAttempts: Infinity,
      ...this.defaultOptions,
      ...config,
    };

    let attempt = 0;
    const maxAttempts = mergedConfig.maxAttempts ?? Infinity;

    return new Promise((resolve, reject) => {
      const executePoll = async () => {
        try {
          if (attempt >= maxAttempts) {
            this.timers.delete(requestId);
            resolve(undefined as any);
            return;
          }

          attempt++;
          const result = await fn();

          if (mergedConfig.stopCondition?.(result)) {
            this.timers.delete(requestId);
            resolve(result);
          } else {
            const timer = setTimeout(executePoll, mergedConfig.interval);
            this.timers.set(requestId, { timer, resolve });
          }
        } catch (error) {
          this.timers.delete(requestId);
          reject(error);
        }
      };

      const timer = setTimeout(executePoll, mergedConfig.interval);
      this.timers.set(requestId, { timer, resolve });
    });
  }

  stop(requestId: string = "default") {
    const entry = this.timers.get(requestId);
    if (entry) {
      clearTimeout(entry.timer);
      entry.resolve(undefined);
      this.timers.delete(requestId);
    }
  }

  stopAll() {
    for (const entry of this.timers.values()) {
      clearTimeout(entry.timer);
      entry.resolve(undefined);
    }
    this.timers.clear();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ETag Manager
// ─────────────────────────────────────────────────────────────────────────────

export class ETagManager {
  private etags: Map<string, string> = new Map();

  getETag(url: string): string | undefined {
    return this.etags.get(url);
  }

  setETag(url: string, etag: string) {
    this.etags.set(url, etag);
  }

  getHeaders(url: string): Record<string, string> {
    const etag = this.getETag(url);
    if (etag) {
      return { "If-None-Match": etag };
    }
    return {};
  }

  clear() {
    this.etags.clear();
  }

  clearUrl(url: string) {
    this.etags.delete(url);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cache Strategy Manager
// ─────────────────────────────────────────────────────────────────────────────

export function determineCacheStrategy(
  strategy: CacheStrategy | undefined,
  defaultStrategy: CacheStrategy
): CacheStrategy {
  return strategy ?? defaultStrategy;
}

export async function executeWithCacheStrategy<T>(
  strategy: CacheStrategy,
  {
    fetchFromNetwork,
    getFromCache,
    saveToCache,
  }: {
    fetchFromNetwork: () => Promise<T>;
    getFromCache: () => T | null;
    saveToCache: (data: T) => void;
  }
): Promise<T> {
  switch (strategy) {
    case "cache-only": {
      const cached = getFromCache();
      if (!cached) {
        throw new Error("No cached data available for cache-only strategy");
      }
      return cached;
    }

    case "network-only": {
      const data = await fetchFromNetwork();
      saveToCache(data);
      return data;
    }

    case "cache-first": {
      const cached = getFromCache();
      if (cached) return cached;
      const data = await fetchFromNetwork();
      saveToCache(data);
      return data;
    }

    case "network-first": {
      try {
        const data = await fetchFromNetwork();
        saveToCache(data);
        return data;
      } catch (error) {
        const cached = getFromCache();
        if (cached) return cached;
        throw error;
      }
    }

    case "stale-while-revalidate": {
      const cached = getFromCache();
      // Return stale cache immediately
      if (cached) {
        // Revalidate in background (fire and forget)
        fetchFromNetwork()
          .then(saveToCache)
          .catch(() => {
            // Silently fail on background revalidation
          });
        return cached;
      }
      // If no cache, fetch from network
      const data = await fetchFromNetwork();
      saveToCache(data);
      return data;
    }

    default:
      throw new Error(`Unknown cache strategy: ${strategy}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Request History Logger
// ─────────────────────────────────────────────────────────────────────────────

export class RequestHistory {
  private history: Array<{
    requestId: string;
    url: string;
    method: string;
    status: number;
    durationMs: number;
    timestamp: number;
  }> = [];
  private maxSize = 100;

  add(record: {
    requestId: string;
    url: string;
    method: string;
    status: number;
    durationMs: number;
  }) {
    this.history.push({
      ...record,
      timestamp: Date.now(),
    });

    if (this.history.length > this.maxSize) {
      this.history.shift();
    }
  }

  getAll() {
    return [...this.history];
  }

  getByRequestId(requestId: string) {
    return this.history.find((r) => r.requestId === requestId);
  }

  getByUrl(url: string) {
    return this.history.filter((r) => r.url.includes(url));
  }

  clear() {
    this.history = [];
  }

  setMaxSize(size: number) {
    this.maxSize = size;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Plugin System
// ─────────────────────────────────────────────────────────────────────────────

export class PluginManager {
  private plugins: Array<{
    name: string;
    beforeRequest?: (url: string, options: any) => any;
    afterResponse?: (response: any) => any;
    onError?: (error: any) => any;
  }> = [];

  register(plugin: any) {
    this.plugins.push(plugin);
  }

  async executeBeforeRequest(url: string, options: any) {
    let result = { url, options };
    for (const plugin of this.plugins) {
      if (plugin.beforeRequest) {
        const pluginResult = await plugin.beforeRequest(result.url, result.options);
        if (pluginResult) {
          result = { ...result, ...pluginResult };
        }
      }
    }
    return result;
  }

  async executeAfterResponse(response: any) {
    let result = response;
    for (const plugin of this.plugins) {
      if (plugin.afterResponse) {
        const pluginResult = await plugin.afterResponse(result);
        if (pluginResult) {
          result = pluginResult;
        }
      }
    }
    return result;
  }

  async executeOnError(error: any) {
    for (const plugin of this.plugins) {
      if (plugin.onError) {
        const pluginResult = await plugin.onError(error);
        if (pluginResult) {
          return pluginResult;
        }
      }
    }
    return error;
  }

  getPlugins() {
    return this.plugins;
  }
}
