/**
 * Advanced HTTP Client Features
 *
 * This module provides production-grade observability and rate limiting:
 * - **RateLimiter**: Token bucket algorithm for rate limiting
 * - **RequestProfiler**: Performance metrics and timing analysis
 * - **InMemoryStructuredLogger**: JSON-structured logging with context
 * - **MiddlewareChain**: Composable middleware pipeline
 * - **AutoCleanup**: Automatic lifecycle management
 *
 * @example
 * ```typescript
 * import { RateLimiter, RequestProfiler } from \"rhttp.io/features\";\n *\n * const limiter = new RateLimiter({ tokensPerSecond: 100 });\n * const profiler = new RequestProfiler();\n * ```
 */

// ─────────────────────────────────────────────────────────────────────────────
// Rate Limiting - Token Bucket Algorithm
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuration for rate limiting
 * Implements the Token Bucket algorithm for smooth rate limiting.
 * Prevents thundering herd and burst requests.
 *
 * @example
 * ```typescript
 * const limiter = new RateLimiter({\n *   enabled: true,\n *   tokensPerSecond: 100,      // 100 requests/second\n *   maxBurst: 150,              // Allow 150 in burst\n * });\n * ```
 */
export interface RateLimitConfig {
  enabled: boolean;
  tokensPerSecond: number;
  maxBurst?: number;
  keyBuilder?: (url: string, method: string) => string;
}

/**
 * Token Bucket Rate Limiter
 *
 * Implements smooth rate limiting using the Token Bucket algorithm.
 * Tokens are refilled at `tokensPerSecond` rate, with a maximum of `maxBurst`.
 * Each request consumes tokens; if insufficient, the request waits.
 *
 * **Use Cases:**
 * - API quota management (100 requests/second)
 * - Prevent thundering herd
 * - Graceful degradation under load
 * - Per-endpoint rate limiting
 *
 * @example
 * ```typescript
n * const limiter = new RateLimiter({\n *   tokensPerSecond: 100,\n *   maxBurst: 150,\n * });\n *\n * // In interceptor\n * http.interceptors.request.use(async (options) => {\n *   await limiter.acquire(options.url, options.method, 1);\n *   return options;\n * });\n * ```
 */
export class RateLimiter {
  private buckets = new Map<string, { tokens: number; lastRefill: number }>();
  private config: Required<RateLimitConfig>;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? false,
      tokensPerSecond: Math.max(1, config.tokensPerSecond ?? 100),
      maxBurst: Math.max(1, config.maxBurst ?? config.tokensPerSecond ?? 100),
      keyBuilder: config.keyBuilder || ((url, method) => `${method}:${new URL(url, 'http://localhost').pathname}`),
    };
  }

  /**
   * Acquire tokens from bucket, waiting if necessary
   * @param url Request URL
   * @param method HTTP method
   * @param weight Number of tokens to acquire (default: 1)
   * @throws Never throws - waits indefinitely if needed
   */
  async acquire(url: string, method: string, weight: number = 1): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const key = this.config.keyBuilder(url, method);
    let bucket = this.buckets.get(key);
    const now = Date.now();

    if (!bucket) {
      bucket = { tokens: this.config.maxBurst, lastRefill: now };
      this.buckets.set(key, bucket);
    }

    // Refill tokens based on elapsed time
    const elapsedSeconds = (now - bucket.lastRefill) / 1000;
    const tokensToAdd = elapsedSeconds * this.config.tokensPerSecond;
    bucket.tokens = Math.min(bucket.tokens + tokensToAdd, this.config.maxBurst);
    bucket.lastRefill = now;

    // Wait if not enough tokens
    while (bucket.tokens < weight) {
      const waitTime = ((weight - bucket.tokens) / this.config.tokensPerSecond) * 1000;
      await new Promise((resolve) => setTimeout(resolve, Math.min(waitTime, 100)));

      const now = Date.now();
      const elapsedSeconds = (now - bucket.lastRefill) / 1000;
      const tokensToAdd = elapsedSeconds * this.config.tokensPerSecond;
      bucket.tokens = Math.min(bucket.tokens + tokensToAdd, this.config.maxBurst);
      bucket.lastRefill = now;
    }

    bucket.tokens -= weight;
  }

  /**
   * Reset rate limit bucket(s)
   * @param key Optional specific key to reset. If omitted, resets all buckets.
   */
  reset(key?: string): void {
    if (key) {
      this.buckets.delete(key);
    } else {
      this.buckets.clear();
    }
  }

  /**
   * Get bucket status for a specific key
   * @returns Bucket state or undefined if not found
   */
  getStatus(key: string) {
    return this.buckets.get(key);
  }

  /**
   * Get all tracked buckets
   */
  getAllBuckets() {
    return new Map(this.buckets);
  }

  /**
   * Get limiter config
   */
  getConfig() {
    return { ...this.config };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Request Profiler - Performance Metrics
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Performance and timing metrics for a single request
 *
 * Tracks full lifecycle of HTTP request from start to finish,
 * including network timing, caching, and error information.
 */
export interface RequestProfile {
  requestId: string;
  url: string;
  method: string;
  timestamp: number;

  // Timing breakdown
  startTime: number;
  endTime: number;
  duration: number;

  // Size metrics
  requestSize?: number;
  responseSize?: number;

  // Status
  status: number;
  cached: boolean;
  deduplicated: boolean;

  // Error info
  error?: string;
}

/**
 * Request Performance Profiler
 *
 * Collects and analyzes request performance metrics.
 * Maintains history of profiles with automatic cleanup when limit exceeded.
 */
export class RequestProfiler {
  private profiles: Map<string, RequestProfile> = new Map();
  private maxProfiles = 1000;

  /**
   * Start profiling a request
   * @param requestId Unique request identifier
   * @param url Request URL
   * @param method HTTP method
   * @returns Profile object to be updated with response data
   */
  start(requestId: string, url: string, method: string): RequestProfile {
    const profile: RequestProfile = {
      requestId,
      url,
      method,
      timestamp: Date.now(),
      startTime: Date.now(),
      endTime: 0,
      duration: 0,
      status: 0,
      cached: false,
      deduplicated: false,
    };

    this.profiles.set(requestId, profile);

    // Cleanup old profiles if limit exceeded
    if (this.profiles.size > this.maxProfiles) {
      const entries = Array.from(this.profiles.entries());
      if (entries.length > 0) {
        const sorted = entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        const oldestKey = sorted[0]?.[0];
        if (oldestKey) {
          this.profiles.delete(oldestKey);
        }
      }
    }

    return profile;
  }

  /**
   * End profiling and record result
   * @param requestId Request identifier
   * @param status HTTP status code
   * @param error Optional error message
   * @returns Updated profile or undefined if not found
   */
  end(requestId: string, status: number, error?: string): RequestProfile | undefined {
    const profile = this.profiles.get(requestId);
    if (!profile) return undefined;

    profile.endTime = Date.now();
    profile.duration = profile.endTime - profile.startTime;
    profile.status = status;
    if (error) profile.error = error;

    return profile;
  }

  /**
   * Get profile by request ID
   */
  getProfile(requestId: string): RequestProfile | undefined {
    return this.profiles.get(requestId);
  }

  /**
   * Query profiles with optional filtering
   * @param filter Filter by URL or method
   */
  getProfiles(filter?: { url?: string; method?: string }): RequestProfile[] {
    const profiles = Array.from(this.profiles.values());
    if (!filter) return profiles;

    return profiles.filter(
      (p) =>
        (!filter.url || p.url.includes(filter.url)) &&
        (!filter.method || p.method === filter.method)
    );
  }

  /**
   * Get aggregate performance statistics
   */
  getStats(): {
    totalRequests: number;
    averageDuration: number;
    maxDuration: number;
    minDuration: number;
  } {
    const profiles = Array.from(this.profiles.values());
    if (profiles.length === 0) {
      return {
        totalRequests: 0,
        averageDuration: 0,
        maxDuration: 0,
        minDuration: 0,
      };
    }

    const durations = profiles.map((p) => p.duration);
    return {
      totalRequests: profiles.length,
      averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      maxDuration: Math.max(...durations),
      minDuration: Math.min(...durations),
    };
  }

  /**
   * Clear all profiles
   */
  clear(): void {
    this.profiles.clear();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Structured Logger
// ─────────────────────────────────────────────────────────────────────────────

export interface LogEntry {
  timestamp: number;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  context?: Record<string, any>;
  requestId?: string;
}

export interface StructuredLogger {
  debug(message: string, context?: Record<string, any>): void;
  info(message: string, context?: Record<string, any>): void;
  warn(message: string, context?: Record<string, any>): void;
  error(message: string, context?: Record<string, any>): void;
  getLogs(): LogEntry[];
  clear(): void;
}

export class InMemoryStructuredLogger implements StructuredLogger {
  private logs: LogEntry[] = [];
  private maxLogs = 500;

  private log(level: "debug" | "info" | "warn" | "error", message: string, context?: Record<string, any>) {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      context,
    };

    this.logs.push(entry);

    // Keep only last N logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Also output to console for debugging
    const prefix = `[${new Date(entry.timestamp).toISOString()}] [${level.toUpperCase()}]`;
    const args = context ? [prefix, message, context] : [prefix, message];

    // Use switch to ensure type safety
    switch (level) {
      case "debug":
        console.debug(...args);
        break;
      case "info":
        console.info(...args);
        break;
      case "warn":
        console.warn(...args);
        break;
      case "error":
        console.error(...args);
        break;
      default:
        console.log(...args);
    }
  }

  debug(message: string, context?: Record<string, any>) {
    this.log("debug", message, context);
  }

  info(message: string, context?: Record<string, any>) {
    this.log("info", message, context);
  }

  warn(message: string, context?: Record<string, any>) {
    this.log("warn", message, context);
  }

  error(message: string, context?: Record<string, any>) {
    this.log("error", message, context);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clear(): void {
    this.logs = [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Request Middleware Chain
// ─────────────────────────────────────────────────────────────────────────────

export interface Middleware {
  name: string;
  beforeRequest?: (config: any) => Promise<any> | any;
  afterResponse?: (response: any, config: any) => Promise<any> | any;
  onError?: (error: any, config: any) => Promise<any> | any;
}

export class MiddlewareChain {
  private middlewares: Middleware[] = [];

  add(middleware: Middleware): void {
    this.middlewares.push(middleware);
  }

  remove(name: string): void {
    this.middlewares = this.middlewares.filter((m) => m.name !== name);
  }

  async executeBeforeRequest(config: any): Promise<any> {
    let currentConfig = config;
    for (const middleware of this.middlewares) {
      if (middleware.beforeRequest) {
        currentConfig = await middleware.beforeRequest(currentConfig);
      }
    }
    return currentConfig;
  }

  async executeAfterResponse(response: any, config: any): Promise<any> {
    let currentResponse = response;
    for (const middleware of this.middlewares) {
      if (middleware.afterResponse) {
        currentResponse = await middleware.afterResponse(currentResponse, config);
      }
    }
    return currentResponse;
  }

  async executeOnError(error: any, config: any): Promise<any> {
    let currentError = error;
    for (const middleware of this.middlewares) {
      if (middleware.onError) {
        try {
          currentError = await middleware.onError(currentError, config);
        } catch (err) {
          currentError = err;
        }
      }
    }
    return currentError;
  }

  clear(): void {
    this.middlewares = [];
  }

  getAll(): Middleware[] {
    return [...this.middlewares];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Automatic Cleanup Manager
// ─────────────────────────────────────────────────────────────────────────────

export class AutoCleanup {
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  setTimeout(id: string, callback: () => void, ms: number): void {
    const timer = setTimeout(() => {
      this.timers.delete(id);
      callback();
    }, ms);
    this.timers.set(id, timer);
  }

  setInterval(id: string, callback: () => void, ms: number): void {
    const interval = setInterval(callback, ms);
    this.intervals.set(id, interval);
  }

  clearTimeout(id: string): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }

  clearInterval(id: string): void {
    const interval = this.intervals.get(id);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(id);
    }
  }

  clear(): void {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.intervals.forEach((interval) => clearInterval(interval));
    this.timers.clear();
    this.intervals.clear();
  }

  destroy(): void {
    this.clear();
  }
}
