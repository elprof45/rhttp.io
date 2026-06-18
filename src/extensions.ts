/**
 * HTTP.io Extensions - Additional Features
 * 
 * These extensions add functionality to the core HTTP client:
 * - GraphQL support
 * - Schema validation (Zod)
 * - Request compression
 * - Enhanced error handling
 */

// ─────────────────────────────────────────────────────────────────────────────
// GraphQL Extension
// ─────────────────────────────────────────────────────────────────────────────

export interface GraphQLRequest {
  query: string;
  variables?: Record<string, any>;
  operationName?: string;
}

export interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
    extensions?: Record<string, any>;
  }>;
  extensions?: Record<string, any>;
}

/**
 * Create a GraphQL client wrapper
 * 
 * @example
 * ```typescript
 * const graphqlClient = withGraphQL(http, "/graphql");
 * 
 * const { data } = await graphqlClient.query<{ posts: Post[] }>({
 *   query: `query { posts { id title } }`,
 * });
 * ```
 */
export function withGraphQL(http: any, endpoint: string = "/graphql") {
  return {
    async query<T = any>(request: GraphQLRequest) {
      const response = await http.post<GraphQLRequest, GraphQLResponse<T>>(
        endpoint,
        request
      );

      if (response.data.errors && response.data.errors.length > 0) {
        const error = new Error(response.data.errors[0].message);
        (error as any).graphqlErrors = response.data.errors;
        throw error;
      }

      return response.data.data;
    },

    async mutation<T = any>(request: GraphQLRequest) {
      return this.query<T>(request);
    },

    async subscribe<T = any>(request: GraphQLRequest, onData: (data: T) => void) {
      // WebSocket implementation
      console.warn("GraphQL subscriptions require WebSocket setup");
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Schema Validation Extension
// ─────────────────────────────────────────────────────────────────────────────

export interface SchemaValidator {
  parse: (data: any) => any;
  safeParse: (data: any) => { success: boolean; data?: any; error?: any };
}

/**
 * Add schema validation to requests
 * 
 * @example
 * ```typescript
 * import { z } from "zod";
 * 
 * const PostSchema = z.object({ id: z.string(), title: z.string() });
 * 
 * const { data: posts } = await http.get("/posts", {
 *   schema: z.array(PostSchema),
 * });
 * // posts is guaranteed to match schema
 * ```
 */
export function withSchemaValidation(http: any) {
  return {
    ...http,
    
    async get<T = any>(url: string, options?: any) {
      const response = await http.get(url, options);
      
      if (options?.schema) {
        try {
          response.data = options.schema.parse(response.data);
        } catch (error) {
          throw new Error(`Schema validation failed: ${(error as any).message}`);
        }
      }
      
      return response;
    },

    async post<B = any, T = any>(url: string, body?: B, options?: any) {
      const response = await http.post(url, body, options);
      
      if (options?.schema) {
        try {
          response.data = options.schema.parse(response.data);
        } catch (error) {
          throw new Error(`Schema validation failed: ${(error as any).message}`);
        }
      }
      
      return response;
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Request Compression Extension
// ─────────────────────────────────────────────────────────────────────────────

export interface CompressionConfig {
  enabled: boolean;
  algorithm: "gzip" | "deflate" | "br";
  threshold: number;  // Minimum body size to compress (bytes)
  level?: number;     // Compression level (1-9)
}

/**
 * Compress request bodies to reduce bandwidth
 */
export function createCompressionMiddleware(config: Partial<CompressionConfig> = {}) {
  const fullConfig: CompressionConfig = {
    enabled: config.enabled ?? false,
    algorithm: config.algorithm ?? "gzip",
    threshold: config.threshold ?? 1024,
    level: config.level,
  };

  return {
    name: "compression",
    
    async beforeRequest(requestConfig: any) {
      if (!fullConfig.enabled || !requestConfig.body) {
        return requestConfig;
      }

      // Check body size
      const bodyString = typeof requestConfig.body === "string" 
        ? requestConfig.body 
        : JSON.stringify(requestConfig.body);

      if (bodyString.length < fullConfig.threshold) {
        return requestConfig;
      }

      // Note: Actual compression would require a compression library
      // This is a placeholder for the structure
      console.log(`[Compression] Would compress body of ${bodyString.length} bytes using ${fullConfig.algorithm}`);

      // In real implementation:
      // const compressed = await compress(bodyString, fullConfig.algorithm, fullConfig.level);
      // requestConfig.body = compressed;
      // requestConfig.headers = {
      //   ...requestConfig.headers,
      //   "Content-Encoding": fullConfig.algorithm,
      // };

      return requestConfig;
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Retry with Jitter
// ─────────────────────────────────────────────────────────────────────────────

export interface RetryWithJitterConfig {
  attempts: number;
  initialDelay: number;
  maxDelay: number;
  jitterFactor: number;  // 0-1, adds randomness to backoff
}

/**
 * Calculate retry delay with jitter to prevent thundering herd
 */
export function calculateRetryDelayWithJitter(
  attemptNumber: number,
  config: RetryWithJitterConfig
): number {
  // Exponential backoff
  const exponentialDelay = Math.min(
    config.initialDelay * Math.pow(2, attemptNumber - 1),
    config.maxDelay
  );

  // Add random jitter: delay * (1 - jitterFactor/2 to 1 + jitterFactor/2)
  const jitterRange = exponentialDelay * config.jitterFactor;
  const jitter = (Math.random() - 0.5) * jitterRange;

  return Math.max(0, exponentialDelay + jitter);
}

// ─────────────────────────────────────────────────────────────────────────────
// Enhanced Error Handling
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Specific error types for better error handling
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public value: any
  ) {
    super(`Validation error in ${field}: ${message}`);
    this.name = "ValidationError";
  }
}

export class AuthenticationError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class RateLimitError extends Error {
  constructor(
    message: string,
    public retryAfter: number,
    public remainingRequests: number
  ) {
    super(message);
    this.name = "RateLimitError";
  }
}

export class ConflictError extends Error {
  constructor(message: string, public conflictingResource?: any) {
    super(message);
    this.name = "ConflictError";
  }
}

/**
 * Create error handling middleware for common error patterns
 */
export function createErrorHandlingMiddleware() {
  return {
    name: "error-handler",
    
    onError(error: any) {
      // Handle GraphQL errors
      if (error.graphqlErrors) {
        return error;  // Pass through, will be handled by GraphQL wrapper
      }

      // Handle rate limiting
      if (error.status === 429) {
        const retryAfter = parseInt(error.headers?.["retry-after"] || "60");
        const remaining = parseInt(error.headers?.["x-ratelimit-remaining"] || "0");
        return new RateLimitError(
          "Rate limit exceeded",
          retryAfter,
          remaining
        );
      }

      // Handle authentication errors
      if (error.status === 401 || error.status === 403) {
        return new AuthenticationError(error.message, error);
      }

      // Handle validation errors
      if (error.status === 400 && error.data?.validationErrors) {
        const firstError = error.data.validationErrors[0];
        return new ValidationError(
          firstError.message,
          firstError.field,
          firstError.value
        );
      }

      // Handle conflicts
      if (error.status === 409) {
        return new ConflictError(error.message, error.data);
      }

      return error;
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Request Deduplication per URL
// ─────────────────────────────────────────────────────────────────────────────

export class RequestDeduplicator {
  private activeRequests = new Map<string, Promise<any>>();

  async execute<T>(
    key: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const existing = this.activeRequests.get(key);
    if (existing) {
      return existing;
    }

    const promise = fn()
      .then(
        (result) => {
          this.activeRequests.delete(key);
          return result;
        },
        (error) => {
          this.activeRequests.delete(key);
          throw error;
        }
      );

    this.activeRequests.set(key, promise);
    return promise;
  }

  clear(): void {
    this.activeRequests.clear();
  }

  getActiveRequests(): string[] {
    return Array.from(this.activeRequests.keys());
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Adaptive Retry
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Track request success rates and adapt retry strategy
 */
export class AdaptiveRetryStrategy {
  private stats = new Map<string, {
    successes: number;
    failures: number;
    lastChecked: number;
  }>();

  private windowMs = 60_000;  // 1 minute window

  shouldRetry(
    url: string,
    attemptNumber: number,
    maxAttempts: number
  ): boolean {
    const key = new URL(url, "http://localhost").pathname;
    let stat = this.stats.get(key);

    // Clean up old stats
    if (stat && Date.now() - stat.lastChecked > this.windowMs) {
      stat = undefined;
    }

    if (!stat) {
      stat = { successes: 0, failures: 0, lastChecked: Date.now() };
      this.stats.set(key, stat);
    }

    stat.lastChecked = Date.now();

    // If endpoint has high failure rate, retry more aggressively
    const failureRate = stat.failures / (stat.successes + stat.failures + 1);
    
    if (failureRate > 0.5) {
      // High failure rate: allow more retries
      return attemptNumber < maxAttempts + 2;
    }

    // Normal retry logic
    return attemptNumber < maxAttempts;
  }

  recordSuccess(url: string): void {
    const key = new URL(url, "http://localhost").pathname;
    let stat = this.stats.get(key);
    if (!stat) {
      stat = { successes: 0, failures: 0, lastChecked: Date.now() };
    }
    stat.successes++;
    stat.lastChecked = Date.now();
    this.stats.set(key, stat);
  }

  recordFailure(url: string): void {
    const key = new URL(url, "http://localhost").pathname;
    let stat = this.stats.get(key);
    if (!stat) {
      stat = { successes: 0, failures: 0, lastChecked: Date.now() };
    }
    stat.failures++;
    stat.lastChecked = Date.now();
    this.stats.set(key, stat);
  }

  getStats(url: string) {
    const key = new URL(url, "http://localhost").pathname;
    return this.stats.get(key);
  }

  reset(): void {
    this.stats.clear();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Request Timeout Middleware
// ─────────────────────────────────────────────────────────────────────────────

export interface TimeoutRule {
  pattern: RegExp | string;
  timeout: number;
}

export function createTimeoutMiddleware(rules: TimeoutRule[] = []) {
  return {
    name: "timeout-override",

    beforeRequest(config: any) {
      for (const rule of rules) {
        const pattern = typeof rule.pattern === "string"
          ? new RegExp(rule.pattern)
          : rule.pattern;

        if (pattern.test(config.url)) {
          config.timeout = rule.timeout;
          break;
        }
      }

      return config;
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Response Caching with Etag
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Implement HTTP caching with ETags
 */
export function createETagCacheMiddleware() {
  const cache = new Map<string, {
    etag: string;
    data: any;
    headers: Record<string, string>;
  }>();

  return {
    name: "etag-cache",

    async afterResponse(response: any) {
      const etag = response.headers.etag;
      if (etag && response.status === 200) {
        cache.set(response.response.url, {
          etag,
          data: response.data,
          headers: response.headers,
        });
      }
      return response;
    },

    beforeRequest(config: any) {
      const cached = cache.get(config.url);
      if (cached) {
        config.headers = {
          ...config.headers,
          "If-None-Match": cached.etag,
        };
      }
      return config;
    },

    onError(error: any) {
      if (error.status === 304) {
        // Not modified - return cached data
        const cached = cache.get(error.url);
        if (cached) {
          return {
            status: 200,
            data: cached.data,
            headers: cached.headers,
          };
        }
      }
      return error;
    },
  };
}
