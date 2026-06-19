export * from "./core";
export * from "./types";
export * from "./errors";
export { buildUrl, getCookie, parseHeaders, parseResponse, generateRequestId } from "./utils";
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
  type LogEntry,
  type StructuredLogger,
} from "./features";

export {
  withGraphQL,
  withSchemaValidation,
  createCompressionMiddleware,
  calculateRetryDelayWithJitter,
  ValidationError,
  AuthenticationError,
  RateLimitError,
  ConflictError,
  RequestDeduplicator,
  AdaptiveRetryStrategy,
  createTimeoutMiddleware,
  createETagCacheMiddleware,
  type GraphQLRequest,
  type GraphQLResponse,
  type GraphQLError,
  type CompressionConfig,
  type SchemaValidator,
} from "./extensions";
