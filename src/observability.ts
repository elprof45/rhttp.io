/**
 * Advanced Observability Middleware
 *
 * Features:
 * - Structured logging with context
 * - Distributed tracing support
 * - Metrics collection (p50, p95, p99)
 * - Performance profiling
 * - Request/Response inspection
 * - Error tracking
 */

import type { HttpResponse } from "./types";

export interface ObservabilityMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgDuration: number;
  p50Duration: number;
  p95Duration: number;
  p99Duration: number;
  minDuration: number;
  maxDuration: number;
  cacheHitRate: number;
  deduplicationRate: number;
  errorsByStatus: Record<number, number>;
  errorsByType: Record<string, number>;
}

export interface RequestTrace {
  requestId: string;
  traceId: string;
  spanId: string;
  url: string;
  method: string;
  timestamp: number;
  duration: number;
  status: number;
  cached: boolean;
  deduplicated: boolean;
  error?: {
    type: string;
    message: string;
    stack?: string;
  };
  headers?: Record<string, string>;
  size?: {
    request: number;
    response: number;
  };
}

export interface LogEntry {
  level: "debug" | "info" | "warn" | "error";
  timestamp: number;
  message: string;
  context?: Record<string, any>;
  requestId?: string;
  traceId?: string;
}

/**
 * Percentile calculator for performance metrics
 */
export function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)] ?? 0;
}

/**
 * Advanced observability middleware
 */
export function createObservabilityMiddleware(config?: {
  enableLogging?: boolean;
  enableTracing?: boolean;
  enableMetrics?: boolean;
  onTrace?: (trace: RequestTrace) => void;
  onLog?: (entry: LogEntry) => void;
  maxTracesStored?: number;
}) {
  const finalConfig = {
    enableLogging: config?.enableLogging ?? true,
    enableTracing: config?.enableTracing ?? true,
    enableMetrics: config?.enableMetrics ?? true,
    onTrace: config?.onTrace,
    onLog: config?.onLog,
    maxTracesStored: config?.maxTracesStored ?? 1000,
  };

  const traces: RequestTrace[] = [];
  const logs: LogEntry[] = [];
  const durations: number[] = [];
  const cacheHits = { count: 0, total: 0 };
  const dedupCount = { count: 0, total: 0 };
  const errorStats: Record<number, number> = {};
  const errorTypes: Record<string, number> = {};

  /**
   * Generate trace ID (could integrate with distributed tracing systems)
   */
  function generateTraceId(): string {
    return `trace_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`;
  }

  /**
   * Generate span ID
   */
  function generateSpanId(): string {
    return Math.random().toString(36).substring(2, 10);
  }

  /**
   * Log message
   */
  function log(
    level: "debug" | "info" | "warn" | "error",
    message: string,
    context?: Record<string, any>
  ) {
    if (!finalConfig.enableLogging) return;

    const entry: LogEntry = {
      level,
      timestamp: Date.now(),
      message,
      context,
    };

    logs.push(entry);
    if (logs.length > finalConfig.maxTracesStored) {
      logs.shift();
    }

    if (finalConfig.onLog) {
      finalConfig.onLog(entry);
    }

    // Also log to console in development
    if (typeof console !== "undefined") {
      const prefix = `[${level.toUpperCase()}] [rhttp.io]`;
      if (level === "error") {
        console.error(prefix, message, context);
      } else if (level === "warn") {
        console.warn(prefix, message, context);
      } else if (level === "debug") {
        console.debug(prefix, message, context);
      } else {
        console.log(prefix, message, context);
      }
    }
  }

  /**
   * Record a request trace
   */
  function recordTrace(trace: RequestTrace) {
    if (!finalConfig.enableTracing) return;

    traces.push(trace);
    if (traces.length > finalConfig.maxTracesStored) {
      traces.shift();
    }

    if (finalConfig.onTrace) {
      finalConfig.onTrace(trace);
    }

    // Record metrics
    if (finalConfig.enableMetrics) {
      durations.push(trace.duration);

      if (trace.cached) {
        cacheHits.count++;
      }
      cacheHits.total++;

      if (trace.deduplicated) {
        dedupCount.count++;
      }
      dedupCount.total++;

      if (trace.error) {
        errorStats[trace.status] = (errorStats[trace.status] || 0) + 1;
        errorTypes[trace.error.type] = (errorTypes[trace.error.type] || 0) + 1;
      }
    }
  }

  /**
   * Get collected metrics
   */
  function getMetrics(): ObservabilityMetrics {
    const successful = Object.values(errorStats).reduce((a, b) => a + b, 0);
    const failed = traces.length - successful;

    return {
      totalRequests: traces.length,
      successfulRequests: successful,
      failedRequests: failed,
      avgDuration: durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0,
      p50Duration: calculatePercentile(durations, 50),
      p95Duration: calculatePercentile(durations, 95),
      p99Duration: calculatePercentile(durations, 99),
      minDuration: Math.min(...durations, 0),
      maxDuration: Math.max(...durations, 0),
      cacheHitRate: cacheHits.total > 0
        ? (cacheHits.count / cacheHits.total) * 100
        : 0,
      deduplicationRate: dedupCount.total > 0
        ? (dedupCount.count / dedupCount.total) * 100
        : 0,
      errorsByStatus: { ...errorStats },
      errorsByType: { ...errorTypes },
    };
  }

  /**
   * Get collected traces
   */
  function getTraces(filter?: { url?: string; method?: string; statusCode?: number }) {
    if (!filter) return traces;

    return traces.filter((trace) => {
      if (filter.url && !trace.url.includes(filter.url)) return false;
      if (filter.method && trace.method !== filter.method) return false;
      if (filter.statusCode && trace.status !== filter.statusCode) return false;
      return true;
    });
  }

  /**
   * Get collected logs
   */
  function getLogs(filter?: { level?: string; requestId?: string }) {
    if (!filter) return logs;

    return logs.filter((entry) => {
      if (filter.level && entry.level !== filter.level) return false;
      if (filter.requestId && entry.requestId !== filter.requestId) return false;
      return true;
    });
  }

  /**
   * Clear all data
   */
  function clear() {
    traces.length = 0;
    logs.length = 0;
    durations.length = 0;
    cacheHits.count = 0;
    cacheHits.total = 0;
    dedupCount.count = 0;
    dedupCount.total = 0;
    Object.keys(errorStats).forEach((key) => delete errorStats[Number(key)]);
    Object.keys(errorTypes).forEach((key) => delete errorTypes[key]);
  }

  /**
   * Export data for external analysis
   */
  function exportData() {
    return {
      traces,
      logs,
      metrics: getMetrics(),
    };
  }

  return {
    name: "observability",
    config: finalConfig,
    log,
    recordTrace,
    getMetrics,
    getTraces,
    getLogs,
    clear,
    exportData,

    /**
     * Middleware integration
     */
    async beforeRequest(url: string, options: any) {
      const traceId = options._traceId || generateTraceId();
      const spanId = generateSpanId();

      options._traceId = traceId;
      options._spanId = spanId;
      options._startTime = performance.now();

      log("debug", `Request started`, {
        url,
        method: options.method,
        traceId,
        spanId,
      });

      return options;
    },

    async afterResponse(response: HttpResponse<any>) {
      // `options` is attached by some integrations; fall back to response fields otherwise.
      const options = (response as HttpResponse<any> & { options?: any }).options ?? {};
      const startTime: number | undefined = options._startTime;
      const duration =
        typeof startTime === "number" ? performance.now() - startTime : response.durationMs;
      const cached = response.headers?.["x-cache"] === "HIT";
      const deduplicated = response.headers?.["x-deduplicated"] === "true";

      const trace: RequestTrace = {
        requestId: response.requestId,
        traceId: options._traceId ?? "",
        spanId: options._spanId ?? "",
        url: options.url ?? "",
        method: options.method ?? "UNKNOWN",
        timestamp: Date.now(),
        duration,
        status: response.status,
        cached,
        deduplicated,
        headers: response.headers,
      };

      recordTrace(trace);

      log("info", `Request completed`, {
        url: options.url,
        status: response.status,
        duration: `${duration.toFixed(2)}ms`,
        cached,
      });

      return response;
    },

    async onError(error: any) {
      const duration = error.durationMs || 0;

      const trace: RequestTrace = {
        requestId: error.requestId,
        traceId: error.options?._traceId || "",
        spanId: error.options?._spanId || "",
        url: error.url,
        method: error.options?.method || "UNKNOWN",
        timestamp: Date.now(),
        duration,
        status: error.status || 0,
        cached: false,
        deduplicated: false,
        error: {
          type: error.constructor?.name || "Unknown",
          message: error.message,
          stack: error.stack,
        },
      };

      recordTrace(trace);

      log("error", `Request failed`, {
        url: error.url,
        status: error.status,
        error: error.message,
      });

      throw error;
    },
  };
}
