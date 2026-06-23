export * from "./core";
export * from "./types";
export * from "./errors";
export {
  buildUrl,
  getCookie,
  parseHeaders,
  parseResponse,
  generateRequestId,
} from "./utils";
export { createClientHttp } from "./client";
export { createServerHttp } from "./server";
export {
  CircuitBreaker,
  RequestPool,
  PollingManager,
  ETagManager,
  RequestHistory,
  PluginManager,
  executeWithCacheStrategy,
  determineCacheStrategy,
} from "./advanced";
export * from "./auth";

// Secure token management
export {
  MemoryTokenStorage,
  SessionStorageTokenStorage,
  HybridTokenStorage,
  IndexedDBTokenStorage,
  getRecommendedTokenStorage,
  getTokenStorage,
  type TokenStorage,
} from "./token-storage";

// Advanced observability
export {
  createObservabilityMiddleware,
  calculatePercentile,
  type ObservabilityMetrics,
  type RequestTrace,
  type LogEntry,
} from "./observability";

// Optimization: Compression and HTTP/2 Push
export {
  createCompressionMiddleware,
  createHttp2PushMiddleware,
  type CompressionConfig,
  type Http2PushConfig,
} from "./optimization";

// Advanced features and extensions
export {
  RateLimiter,
  RequestProfiler,
  MiddlewareChain,
  InMemoryStructuredLogger,
  AutoCleanup,
  type RateLimitConfig,
  type RequestProfile,
  type Middleware,
  type LogEntry as FeatureLogEntry,
  type StructuredLogger,
} from "./features";

export {
  withSchemaValidation,
  createCompressionMiddleware as createCompressionMiddlewareExt,
  calculateRetryDelayWithJitter,
  ValidationError,
  AuthenticationError,
  RateLimitError,
  ConflictError,
  RequestDeduplicator,
  AdaptiveRetryStrategy,
  createTimeoutMiddleware,
  createETagCacheMiddleware,
  type SchemaValidator,
} from "./extensions";
