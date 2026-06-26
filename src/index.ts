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
  withReact,
  type ReactHttpClientInstance,
  type ReactQueryConfig,
  type ReactMutationConfig,
} from "./react";
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

// Note: Compression and HTTP/2 Push previously from optimization.ts have been removed
// For compression support, use createCompressionMiddleware from extensions.ts

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
  createErrorHandlingMiddleware,
  type SchemaValidator,
} from "./extensions";
