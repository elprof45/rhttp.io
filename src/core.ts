import { HttpError, TimeoutError, NetworkError } from "./errors";
import type {
  CreateHttpConfig,
  HttpClientInstance,
  HttpRequestOptions,
  HttpResponse,
  RetryConfig,
  CacheConfig,
  CacheStrategy,
  CsrfConfig,
  ObservabilityConfig,
  AuthConfig,
  InterceptorManager,
  InterceptorHandler,
  HttpMetrics,
} from "./types";
import { buildUrl, generateRequestId, getCookie, parseHeaders, parseResponse } from "./utils";
import {
  CircuitBreaker,
  RequestPool,
  PollingManager,
  ETagManager,
  executeWithCacheStrategy,
  RequestHistory,
  PluginManager,
  determineCacheStrategy,
} from "./advanced";

// Interceptor manager implementation
class InterceptorManagerImpl<T> implements InterceptorManager<T> {
  private handlers: Array<{
    onFulfilled: (value: T) => Promise<T> | T;
    onRejected?: (error: any) => Promise<any> | any;
  } | null> = [];

  use(
    onFulfilled: (value: T) => Promise<T> | T,
    onRejected?: (error: any) => Promise<any> | any
  ): InterceptorHandler<T> {
    this.handlers.push({ onFulfilled, onRejected });
    const id = this.handlers.length - 1;
    return {
      id,
      eject: () => this.eject(id),
    };
  }

  eject(id: number): void {
    if (this.handlers[id]) {
      this.handlers[id] = null;
    }
  }

  clear(): void {
    this.handlers = [];
  }

  forEach(fn: (handler: { onFulfilled: (value: T) => Promise<T> | T; onRejected?: (error: any) => Promise<any> | any }) => void): void {
    this.handlers.forEach((handler) => {
      if (handler !== null) {
        fn(handler);
      }
    });
  }
}

// Request context store for SSR/frameworks (dynamically set by server entry point)
let requestContextStore: { getStore: () => any; run: (store: any, callback: () => any) => any } | null = null;

export function setRequestContextStore(store: any) {
  requestContextStore = store;
}

function getActiveRequest(configRequestContext?: () => any) {
  if (requestContextStore) {
    const req = requestContextStore.getStore();
    if (req) return req;
  }
  if (configRequestContext) {
    try {
      return configRequestContext();
    } catch {
      return null;
    }
  }
  return null;
}

export function createHttp(config: CreateHttpConfig = {}): HttpClientInstance {
  // Default values
  const retryConfig: RetryConfig = {
    attempts: config.retry?.attempts ?? 0,
    strategy: config.retry?.strategy ?? "none",
    delay: config.retry?.delay ?? 300,
    maxDelay: config.retry?.maxDelay ?? 30000,
    statusCodes: config.retry?.statusCodes ?? [408, 429, 500, 502, 503, 504],
    shouldRetry: config.retry?.shouldRetry,
  };

  const cacheConfig: CacheConfig = {
    enabled: config.cache?.enabled ?? false,
    ttl: config.cache?.ttl ?? 60000,
    strategy: config.cache?.strategy ?? "cache-first",
    keyBuilder: config.cache?.keyBuilder,
  };

  const csrfConfig: CsrfConfig = {
    enabled: config.csrf?.enabled ?? false,
    fetchEndpoint: config.csrf?.fetchEndpoint ?? "/api/csrf",
    cookieName: config.csrf?.cookieName ?? "csrf-token",
    headerName: config.csrf?.headerName ?? "X-CSRF-Token",
    methods: config.csrf?.methods ?? ["POST", "PUT", "PATCH", "DELETE"],
    prefetch: config.csrf?.prefetch ?? false,
  };

  const observabilityConfig: ObservabilityConfig = {
    logger: config.observability?.logger ?? false,
    tracing: config.observability?.tracing ?? false,
    metrics: config.observability?.metrics ?? false,
  };

  const authConfig: Partial<AuthConfig> = {
    forwardCookies: config.auth?.forwardCookies ?? false,
    accessToken: config.auth?.accessToken,
    scheme: config.auth?.scheme ?? "Bearer",
    getToken: config.auth?.getToken,
  };

  // Setup logging helper
  const createLogger = (loggerSetting: boolean | any) => {
    if (loggerSetting === true) {
      return {
        debug: (...args: any[]) => console.debug("[http-io] [DEBUG]", ...args),
        info: (...args: any[]) => console.info("[http-io] [INFO]", ...args),
        warn: (...args: any[]) => console.warn("[http-io] [WARN]", ...args),
        error: (...args: any[]) => console.error("[http-io] [ERROR]", ...args),
      };
    } else if (loggerSetting && typeof loggerSetting === "object") {
      return loggerSetting;
    }
    const noop = () => {};
    return { debug: noop, info: noop, warn: noop, error: noop };
  };

  const logger = createLogger(observabilityConfig.logger);

  // In-memory cache & deduplication stores
  const cacheMap = new Map<string, { expiry: number; response: HttpResponse<any> }>();
  const dedupMap = new Map<string, Promise<HttpResponse<any>>>();

  // Advanced features initialization
  const circuitBreaker = new CircuitBreaker(config.circuitBreaker);
  const requestPool = new RequestPool(config.requestPool);
  const pollingManager = new PollingManager();
  const etagManager = new ETagManager();
  const requestHistory = new RequestHistory();
  const pluginManager = new PluginManager();

  // Register plugins
  if (config.plugins) {
    for (const plugin of config.plugins) {
      pluginManager.register(plugin);
    }
  }

  // Abort controller for tracking active requests
  const abortControllers = new Map<string, AbortController>();

  // Metrics collection
  const metrics: HttpMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    durations: [],
    statusCodes: {},
  };

  function recordMetric(status: number, durationMs: number, success: boolean) {
    metrics.totalRequests++;
    if (success) {
      metrics.successfulRequests++;
    } else {
      metrics.failedRequests++;
    }
    metrics.durations.push(durationMs);
    metrics.statusCodes[status] = (metrics.statusCodes[status] || 0) + 1;
  }

  // CSRF fetch sharing promise
  let csrfTokenPromise: Promise<string> | null = null;

  async function getCsrfToken(): Promise<string> {
    // Try to read from cookie first (browser only)
    if (typeof document !== "undefined") {
      const cookieVal = getCookie(csrfConfig.cookieName);
      if (cookieVal) return cookieVal;
    }

    // Otherwise, fetch from endpoint
    if (!csrfTokenPromise) {
      csrfTokenPromise = (async () => {
        try {
          const fetchFn = config.fetch || globalThis.fetch;
          const url = buildUrl(config.baseURL || "", csrfConfig.fetchEndpoint);
          const res = await fetchFn(url);
          if (res.ok) {
            const data = (await res.json()) as Record<string, any>;
            const token = data?.token || data?.csrfToken || "";
            return token;
          }
        } catch (err) {
          logger.error("Failed to fetch CSRF token", err);
        }
        return "";
      })();
    }
    return csrfTokenPromise;
  }

  // Prefetch CSRF token if active & browser context
  if (csrfConfig.enabled && csrfConfig.prefetch && typeof window !== "undefined") {
    getCsrfToken().catch(() => {});
  }

  // Interceptors managers
  const requestInterceptors = new InterceptorManagerImpl<any>();
  const responseInterceptors = new InterceptorManagerImpl<HttpResponse<any>>();

  // Helper to merge headers case-insensitively from multiple sources
  // Priority (lowest to highest): defaultFetchOptions.headers -> defaultHeaders -> request headers
  function mergeHeaders(
    fetchOptionsHeaders?: Record<string, string>,
    defaultHeaders?: Record<string, string>,
    reqHeaders?: Record<string, string>
  ): Record<string, string> {
    const merged: Record<string, string> = {};

    // 1. Start with defaultFetchOptions.headers (lowest priority)
    if (fetchOptionsHeaders) {
      for (const [key, val] of Object.entries(fetchOptionsHeaders)) {
        merged[key.toLowerCase()] = val;
      }
    }

    // 2. Merge defaultHeaders (medium priority)
    if (defaultHeaders) {
      for (const [key, val] of Object.entries(defaultHeaders)) {
        merged[key.toLowerCase()] = val;
      }
    }

    // 3. Merge request headers (highest priority)
    if (reqHeaders) {
      for (const [key, val] of Object.entries(reqHeaders)) {
        merged[key.toLowerCase()] = val;
      }
    }

    return merged;
  }

  // Cloning helper to safely return copy of response cache entries
  function cloneResponse<T>(res: HttpResponse<T>): HttpResponse<T> {
    return {
      ...res,
      data: res.data ? JSON.parse(JSON.stringify(res.data)) : res.data,
      headers: { ...res.headers },
    };
  }

  // Sleep utility for retry mechanism
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // Main HTTP requester function wrapped with cache, deduplication, and retries
  async function performRequestWithAllFeatures(options: any): Promise<HttpResponse<any>> {
    const method = options.method.toUpperCase();
    const isGet = method === "GET";

    // Plugin: beforeRequest hook
    const pluginResult = await pluginManager.executeBeforeRequest(options.url, options);
    const finalOptions = { ...options, ...pluginResult };

    // Caching configuration resolution
    const cacheOverride = finalOptions.cache;
    const isCacheEnabled = cacheOverride !== false &&
      (typeof cacheOverride === "object" ? (cacheOverride.enabled ?? true) : (cacheConfig.enabled));

    const resolvedTtl = (typeof cacheOverride === "object" && cacheOverride.ttl !== undefined)
      ? cacheOverride.ttl
      : (cacheConfig.ttl);

    const resolvedKeyBuilder = (typeof cacheOverride === "object" && cacheOverride.keyBuilder)
      ? cacheOverride.keyBuilder
      : (cacheConfig.keyBuilder || ((u, opts) => `GET:${u}:${JSON.stringify(opts.params ?? {})}`));

    // Determine cache strategy
    // Priority: request override > global config > default
    const cacheStrategy: CacheStrategy =
      finalOptions.cacheStrategy ||
      (typeof cacheOverride === "object" && cacheOverride.strategy) ||
      cacheConfig.strategy ||
      "network-first";

    let cacheKey = "";
    if (isGet && isCacheEnabled) {
      cacheKey = resolvedKeyBuilder(finalOptions.url, finalOptions);

      if (cacheStrategy !== "network-first" && cacheStrategy !== "network-only") {
        const cached = cacheMap.get(cacheKey);
        if (cached && cached.expiry > Date.now()) {
          logger.debug(`Cache hit (fresh) for ${finalOptions.url}`);
          return cloneResponse(cached.response);
        }
      }
    }

    // Deduplication resolution
    const isDedupEnabled = finalOptions.deduplicate !== false;
    let dedupKey = "";
    if (isGet && isDedupEnabled) {
      dedupKey = `${method}:${finalOptions.url}:${JSON.stringify(finalOptions.params ?? {})}`;
    }

    // Single request execution with retry wrapper
    const executeOperation = async () => {
      const startTime = Date.now();
      const run = async () => {
        const activeRetry = finalOptions.retry;
        if (activeRetry === false) {
          return executeSingleRequest(finalOptions);
        }

        const retryOpts: RetryConfig = {
          attempts: typeof activeRetry === "object" && activeRetry.attempts !== undefined
            ? activeRetry.attempts
            : (retryConfig.attempts),
          strategy: typeof activeRetry === "object" && activeRetry.strategy !== undefined
            ? activeRetry.strategy
            : (retryConfig.strategy),
          delay: typeof activeRetry === "object" && activeRetry.delay !== undefined
            ? activeRetry.delay
            : (retryConfig.delay),
          maxDelay: typeof activeRetry === "object" && activeRetry.maxDelay !== undefined
            ? activeRetry.maxDelay
            : (retryConfig.maxDelay),
          statusCodes: typeof activeRetry === "object" && activeRetry.statusCodes !== undefined
            ? activeRetry.statusCodes
            : (retryConfig.statusCodes),
          shouldRetry: typeof activeRetry === "object" && activeRetry.shouldRetry !== undefined
            ? activeRetry.shouldRetry
            : retryConfig.shouldRetry,
        };

        let attempt = 1;
        while (true) {
          try {
            return await executeSingleRequest(finalOptions);
          } catch (err: any) {
            attempt++;
            if (attempt > retryOpts.attempts) {
              throw err;
            }

            // Check if retryable - either by status code or custom shouldRetry logic
            const status = err instanceof HttpError ? err.status : 0;
            const isRetryableStatus = status === 0 || retryOpts.statusCodes.includes(status);

            // If no custom shouldRetry, check status codes
            if (!retryOpts.shouldRetry && !isRetryableStatus) {
              throw err;
            }

            // If custom shouldRetry exists, use it (regardless of status)
            if (retryOpts.shouldRetry) {
              const check = await retryOpts.shouldRetry(err, attempt - 1);
              if (!check) {
                throw err;
              }
            } else if (!isRetryableStatus) {
              // No custom logic and not retryable status
              throw err;
            }

            // Compute delay
            let waitTime = 0;
            if (retryOpts.strategy === "linear") {
              waitTime = retryOpts.delay * attempt;
            } else if (retryOpts.strategy === "exponential") {
              waitTime = retryOpts.delay * Math.pow(2, attempt);
            } else if (retryOpts.strategy === "none") {
              waitTime = 0;
            }
            waitTime = Math.min(waitTime, retryOpts.maxDelay);

            logger.warn(`Attempt ${attempt} failed for ${finalOptions.url}. Retrying in ${waitTime}ms... Error: ${err.message}`);
            if (waitTime > 0) {
              await sleep(waitTime);
            }
          }
        }
      };

      try {
        const res = await run();
        if (observabilityConfig.metrics) {
          recordMetric(res.status, res.durationMs, true);
        }
        return res;
      } catch (err: any) {
        if (observabilityConfig.metrics) {
          const status = err.status || 0;
          const duration = err.durationMs || (Date.now() - startTime);
          recordMetric(status, duration, false);
        }
        throw err;
      }
    };

    // Handle deduplication independently of cache
    if (isGet && isDedupEnabled && dedupKey) {
      const existingPromise = dedupMap.get(dedupKey);
      if (existingPromise) {
        logger.debug(`Deduplicating concurrent request for ${finalOptions.url}`);
        return existingPromise;
      }
    }

    // Create the main promise for this request (with dedup if needed)
    const responsePromise = (async () => {
      let response: HttpResponse<any>;

      if (isGet && isCacheEnabled) {
      const fetchFromNetwork = async () => {
        let promise: Promise<HttpResponse<any>>;
        promise = executeOperation();
        return promise;
      };

      const getFromCache = () => {
        const cached = cacheMap.get(cacheKey);
        if (!cached) return null;

        const isFresh = cached.expiry > Date.now();
        if (isFresh) {
          return cloneResponse(cached.response);
        }

        // Return stale cache only if the strategy permits it
        if (cacheStrategy === "stale-while-revalidate" || cacheStrategy === "network-first") {
          return cloneResponse(cached.response);
        }

        return null;
      };

      const saveToCache = (res: HttpResponse<any>) => {
        cacheMap.set(cacheKey, {
          expiry: Date.now() + resolvedTtl,
          response: cloneResponse(res),
        });
      };

      response = await executeWithCacheStrategy(cacheStrategy, {
        fetchFromNetwork,
        getFromCache,
        saveToCache,
      });
    } else {
      // Non-cached flow (POST/PUT/etc or cache disabled)
      response = await executeOperation();
    }

    // Plugin: afterResponse hook
    const pluginResponse = await pluginManager.executeAfterResponse(response);

    // Record in history
    requestHistory.add({
      requestId: response.requestId,
      url: response.response.url,
      method,
      status: response.status,
      durationMs: response.durationMs,
    });

    return pluginResponse;
    })();

    // Store dedup promise if enabled
    if (isGet && isDedupEnabled && dedupKey) {
      dedupMap.set(dedupKey, responsePromise);
      try {
        return await responsePromise;
      } finally {
        dedupMap.delete(dedupKey);
      }
    }

    return await responsePromise;
  }

  // Execution of a single native fetch call
  async function executeSingleRequest(options: any): Promise<HttpResponse<any>> {
    const method = options.method.toUpperCase();
    const startTime = Date.now();

    // 1. Trace ID / Request ID
    const requestId = options.requestId || options.headers?.["x-request-id"] || generateRequestId();
    const finalHeaders = mergeHeaders(
      (config.defaultFetchOptions?.headers as Record<string, string>) || {},
      config.defaultHeaders,
      options.headers
    );
    if (observabilityConfig.tracing) {
      finalHeaders["x-request-id"] = requestId;
    }

    // 2. Cookie forwarding
    const currentAuth = config.auth || {};
    const forwardCookies = currentAuth.forwardCookies ?? false;
    const accessToken = currentAuth.accessToken;
    const scheme = currentAuth.scheme ?? "Bearer";
    const getToken = currentAuth.getToken;

    const activeReq = getActiveRequest(config.requestContext);
    if (forwardCookies && activeReq) {
      const cookies = activeReq.headers?.get?.("cookie") || activeReq.headers?.cookie || "";
      if (cookies) {
        finalHeaders["cookie"] = cookies;
      }
    }

    // 3. Final URL (needed before ETag check)
    const finalUrl = buildUrl(config.baseURL || "", options.url, options.params);

    // ETag support
    if (config.etag?.enabled !== false && method === "GET") {
      const etagHeaders = etagManager.getHeaders(finalUrl);
      Object.assign(finalHeaders, etagHeaders);
    }

    // 4. Authorization headers (static or dynamic)
    if (accessToken) {
      finalHeaders["authorization"] = `${scheme} ${accessToken}`;
    }

    if (getToken) {
      try {
        const token = await getToken();
        if (token) {
          finalHeaders["authorization"] = `${scheme} ${token}`;
        }
      } catch (err) {
        logger.error("Failed to fetch dynamic authentication token", err);
      }
    }

    // 5. CSRF protection injection
    const isCsrfRequired = options.csrf !== false &&
      csrfConfig.enabled &&
      csrfConfig.methods.map((m) => m.toUpperCase()).includes(method);

    if (isCsrfRequired) {
      const token = await getCsrfToken();
      if (token) {
        finalHeaders[csrfConfig.headerName.toLowerCase()] = token;
      }
    }

    // 6. Native fetch configurations
    const fetchFn = config.fetch || globalThis.fetch;
    const controller = new AbortController();
    const requestTimeout = options.timeout !== undefined ? options.timeout : (config.timeout ?? 30000);

    let timeoutId: any = null;
    if (requestTimeout > 0) {
      timeoutId = setTimeout(() => {
        controller.abort();
      }, requestTimeout);
    }

    if (options.signal) {
      options.signal.addEventListener("abort", () => controller.abort());
    }

    // Parse / format JSON bodies
    let finalBody = options.body;
    if (finalBody !== undefined && finalBody !== null) {
      const isRawBody = finalBody instanceof Blob ||
                        finalBody instanceof FormData ||
                        finalBody instanceof URLSearchParams ||
                        typeof finalBody === "string";
      if (!isRawBody && typeof finalBody === "object") {
        finalBody = JSON.stringify(finalBody);
        if (!finalHeaders["content-type"]) {
          finalHeaders["content-type"] = "application/json";
        }
      }
    }

    const nativeFetchOptions: RequestInit = {
      ...config.defaultFetchOptions,
      ...options,
      method,
      headers: finalHeaders,
      body: finalBody,
      signal: controller.signal,
    };

    logger.info(`→ HTTP ${method} ${finalUrl}`, { requestId });

    let rawResponse: Response;
    try {
      rawResponse = await fetchFn(finalUrl, nativeFetchOptions);
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      if (err.name === "AbortError" || controller.signal.aborted) {
        const timeoutErr = new TimeoutError(`Request timeout after ${requestTimeout}ms`, {
          requestId,
          durationMs,
          url: finalUrl,
          headers: finalHeaders,
        });
        timeoutErr.options = options;
        logger.error(`✕ Timeout ${method} ${finalUrl} after ${durationMs}ms`, timeoutErr);
        throw timeoutErr;
      } else {
        const networkErr = new NetworkError(err.message || "Network request failed", {
          requestId,
          durationMs,
          url: finalUrl,
          headers: finalHeaders,
          originalError: err,
        });
        networkErr.options = options;
        logger.error(`✕ Network Error ${method} ${finalUrl}`, networkErr);
        throw networkErr;
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }

    const durationMs = Date.now() - startTime;
    const responseHeaders = parseHeaders(rawResponse.headers);
    let parsedData: any = null;

    // Handle 304 Not Modified - return empty 304 response
    // The cache handling happens at the performRequestWithAllFeatures level
    if (rawResponse.status === 304) {
      const httpResponse: HttpResponse<any> = {
        data: null,
        status: 304,
        statusText: "Not Modified",
        headers: responseHeaders,
        response: rawResponse,
        requestId,
        durationMs,
      };

      // Store ETag for future requests
      if (config.etag?.enabled !== false && method === "GET") {
        const etag = responseHeaders["etag"];
        if (etag) {
          etagManager.setETag(finalUrl, etag);
        }
      }

      logger.info(`← HTTP 304 (cached) ${finalUrl} in ${durationMs}ms`, { requestId });
      return httpResponse;
    }

    if (rawResponse.ok) {
      parsedData = await parseResponse(rawResponse);

      // Validate response if validateResponse callback is provided
      if (options.validateResponse) {
        if (!options.validateResponse(parsedData)) {
          const validationErr = new HttpError("Response validation failed", {
            status: rawResponse.status,
            statusText: rawResponse.statusText,
            headers: responseHeaders,
            data: parsedData,
            requestId,
            durationMs,
            url: finalUrl,
            options,
          });
          logger.error(`✕ Validation Error ${method} ${finalUrl}`, validationErr);
          throw validationErr;
        }
      }

      // Store ETag for future requests
      if (config.etag?.enabled !== false && method === "GET") {
        const etag = responseHeaders["etag"];
        if (etag) {
          etagManager.setETag(finalUrl, etag);
        }
      }

      const httpResponse: HttpResponse<any> = {
        data: parsedData,
        status: rawResponse.status,
        statusText: rawResponse.statusText,
        headers: responseHeaders,
        response: rawResponse,
        requestId,
        durationMs,
      };

      // Apply response transformers
      let transformedData = parsedData;
      if (config.responseTransformer) {
        transformedData = config.responseTransformer(transformedData, httpResponse);
      }
      if (options.transformer) {
        transformedData = options.transformer(transformedData, httpResponse);
      }
      httpResponse.data = transformedData;

      logger.info(`← HTTP ${rawResponse.status} ${finalUrl} in ${durationMs}ms`, { requestId });
      return httpResponse;
    } else {
      try {
        parsedData = await parseResponse(rawResponse);
      } catch (err) {
        // Fallback if fails to parse
      }

      const httpErr = new HttpError(`Request failed with status ${rawResponse.status}`, {
        status: rawResponse.status,
        statusText: rawResponse.statusText,
        headers: responseHeaders,
        data: parsedData,
        requestId,
        durationMs,
        url: finalUrl,
        options,
      });

      logger.error(`✕ HTTP ${rawResponse.status} ${finalUrl} in ${durationMs}ms`, httpErr);
      throw httpErr;
    }
  }

  // Core Request function with Interceptor pipeline chained
  async function request<T = any>(url: string, options: any): Promise<HttpResponse<T>> {
    let interceptorOptions = {
      url,
      ...options,
    };

    // Run Request Interceptors
    let reqErr: any = null;
    requestInterceptors.forEach((handler) => {
      if (reqErr) return;
      try {
        const result = handler.onFulfilled(interceptorOptions);
        if (result && typeof (result as any).then === "function") {
          // Promise returned
          interceptorOptions = result as any;
        } else {
          interceptorOptions = result;
        }
      } catch (err) {
        if (handler.onRejected) {
          try {
            interceptorOptions = handler.onRejected(err);
          } catch (rejectedErr) {
            reqErr = rejectedErr;
          }
        } else {
          reqErr = err;
        }
      }
    });

    if (reqErr) {
      return Promise.reject(reqErr);
    }

    // Resolve request interceptor options if it's a promise
    const resolvedOptions = await Promise.resolve(interceptorOptions);

    // Run request validation if provided
    if (config.requestValidator) {
      const isValid = await config.requestValidator(resolvedOptions.url, resolvedOptions);
      if (!isValid) {
        throw new Error(`Request validation failed for URL: ${resolvedOptions.url}`);
      }
    }

    // Generate or use request ID
    const requestId = resolvedOptions.requestId || generateRequestId();
    resolvedOptions.requestId = requestId;
    abortControllers.set(requestId, new AbortController());

    // Wrap with Circuit Breaker and Request Pool
    let responsePromise: Promise<HttpResponse<any>>;

    try {
      responsePromise = circuitBreaker.execute(async () => {
        return requestPool.execute(async () => {
          // Call global hooks
          if (config.hooks?.onRequest) {
            await config.hooks.onRequest(resolvedOptions.url, resolvedOptions);
          }

          try {
            const response = await performRequestWithAllFeatures(resolvedOptions);

            // Call global onSuccess hook
            if (config.hooks?.onSuccess) {
              await config.hooks.onSuccess(response);
            }

            return response;
          } catch (error) {
            // Call global onError hook
            if (config.hooks?.onError) {
              await config.hooks.onError(error);
            }
            throw error;
          } finally {
            // Call global onFinally hook
            if (config.hooks?.onFinally) {
              await config.hooks.onFinally();
            }

            abortControllers.delete(requestId);
          }
        });
      });
    } catch (error) {
      abortControllers.delete(requestId);
      responsePromise = Promise.reject(error);
    }

    // Run Response Interceptors
    responseInterceptors.forEach((handler) => {
      responsePromise = responsePromise.then(
        (res) => (handler.onFulfilled ? handler.onFulfilled(res) : res),
        (err) => {
          if (handler.onRejected) {
            return handler.onRejected(err);
          }
          return Promise.reject(err);
        }
      );
    });

    return responsePromise;
  }

  // Create HttpClientInstance API
  const instance: HttpClientInstance = {
    config,
    interceptors: {
      request: requestInterceptors,
      response: responseInterceptors,
    },

    get<T = any>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<T>> {
      return request<T>(url, { ...options, method: "GET" });
    },

    post(url: string, body?: any, options?: HttpRequestOptions): Promise<HttpResponse<any>> {
      return request(url, { ...options, method: "POST", body });
    },

    put(url: string, body?: any, options?: HttpRequestOptions): Promise<HttpResponse<any>> {
      return request(url, { ...options, method: "PUT", body });
    },

    patch(url: string, body?: any, options?: HttpRequestOptions): Promise<HttpResponse<any>> {
      return request(url, { ...options, method: "PATCH", body });
    },

    delete(url: string, bodyOrOptions?: any, options?: HttpRequestOptions): Promise<HttpResponse<any>> {
      // Intelligently check if second argument is HttpRequestOptions or Request Body
      const isOptions = bodyOrOptions && (
        "params" in bodyOrOptions ||
        "headers" in bodyOrOptions ||
        "cache" in bodyOrOptions ||
        "retry" in bodyOrOptions ||
        "timeout" in bodyOrOptions ||
        "deduplicate" in bodyOrOptions ||
        "signal" in bodyOrOptions
      );

      if (isOptions) {
        return request(url, { ...bodyOrOptions, method: "DELETE" });
      } else {
        return request(url, { ...options, method: "DELETE", body: bodyOrOptions });
      }
    },

    customFetch<T = any>(url: string, options?: RequestInit & HttpRequestOptions): Promise<HttpResponse<T>> {
      const method = options?.method || "GET";
      return request<T>(url, { ...options, method });
    },

    async batchRequests<T extends ReadonlyArray<() => Promise<HttpResponse<any>>>>(
      requests: T
    ): Promise<{ -readonly [K in keyof T]: T[K] extends () => Promise<HttpResponse<infer R>> ? HttpResponse<R> : any }> {
      const promises = requests.map((req) => req());
      const results = await Promise.all(promises);
      return results as any;
    },

    invalidateCache(urlPattern: string): void {
      for (const key of cacheMap.keys()) {
        if (key.includes(urlPattern)) {
          cacheMap.delete(key);
        }
      }
    },

    clearCache(): void {
      cacheMap.clear();
    },

    getMetrics(): HttpMetrics {
      return { ...metrics, durations: [...metrics.durations], statusCodes: { ...metrics.statusCodes } };
    },

    async withRequest<R>(requestContext: any, callback: () => Promise<R> | R): Promise<R> {
      if (requestContextStore) {
        return requestContextStore.run(requestContext, callback);
      }
      return callback();
    },

    async poll<T = any>(
      url: string,
      options?: HttpRequestOptions & { polling?: any }
    ): Promise<HttpResponse<T>> {
      const pollingOptions = options?.polling || { interval: 5000 };
      const requestId = generateRequestId();

      return pollingManager.poll<HttpResponse<T>>(
        async () => this.get<T>(url, options),
        pollingOptions,
        requestId
      );
    },

    cancel(requestId?: string): void {
      if (requestId) {
        const controller = abortControllers.get(requestId);
        if (controller) {
          controller.abort();
          abortControllers.delete(requestId);
        }
        pollingManager.stop(requestId);
      } else {
        // Cancel all
        for (const controller of abortControllers.values()) {
          controller.abort();
        }
        abortControllers.clear();
        pollingManager.stopAll();
      }
    },

    getHistory() {
      return requestHistory.getAll();
    },

    use(plugin: any): void {
      pluginManager.register(plugin);
    },

    getCircuitBreakerStatus() {
      return circuitBreaker.getStatus();
    },

    resetCircuitBreaker(): void {
      circuitBreaker.reset();
    },

    getCircuitBreaker() {
      return circuitBreaker;
    },

    getPoolStats() {
      const stats = requestPool.getStats();
      return {
        activeRequests: stats.activeRequests,
        queueLength: stats.queueLength,
      };
    },
  };

  return instance;
}
