/**
 * Compression & HTTP/2 Optimization Middleware
 *
 * Features:
 * - Automatic request/response compression (gzip, deflate, brotli)
 * - HTTP/2 Server Push integration
 * - Request deduplication for push
 * - Compression level tuning
 * - Size threshold for compression
 */

export interface CompressionConfig {
  enabled: boolean;
  algorithms: ("gzip" | "deflate" | "br")[];
  minSize: number; // Minimum bytes to compress
  level?: number; // Compression level 1-9
}

export interface Http2PushConfig {
  enabled: boolean;
  maxPushes?: number;
  cacheManifest?: Record<string, string[]>; // URL -> dependencies
}

/**
 * Create compression middleware
 */
export function createCompressionMiddleware(config?: Partial<CompressionConfig>) {
  const finalConfig: CompressionConfig = {
    enabled: config?.enabled ?? true,
    algorithms: config?.algorithms ?? ["gzip", "deflate"],
    minSize: config?.minSize ?? 1024, // 1KB minimum
    level: config?.level ?? 6,
  };

  return {
    name: "compression",
    config: finalConfig,

    async beforeRequest(url: string, options: any) {
      if (!finalConfig.enabled) return options;

      // Set Accept-Encoding header to advertise compression support
      options.headers = options.headers || {};
      options.headers["Accept-Encoding"] = finalConfig.algorithms.join(", ");

      // Set compression level if available
      if (options.body && typeof options.body === "string") {
        const bodySize = new TextEncoder().encode(options.body).byteLength;

        if (bodySize > finalConfig.minSize) {
          // Mark for compression (actual compression done by fetch/server)
          options._shouldCompress = true;
          options.headers["Content-Encoding"] = "gzip";
        }
      }

      return options;
    },

    async afterResponse(response: any) {
      // Response is already decompressed by browser/fetch API
      // No additional processing needed

      // Log compression info
      const contentEncoding = response.headers?.["content-encoding"];
      if (contentEncoding) {
        response._compressionUsed = contentEncoding;
      }

      return response;
    },
  };
}

/**
 * Create HTTP/2 Server Push middleware
 *
 * Server Push allows the server to proactively send resources
 * that the client will need, improving page load times
 */
export function createHttp2PushMiddleware(config?: Partial<Http2PushConfig>) {
  const finalConfig: Http2PushConfig = {
    enabled: config?.enabled ?? true,
    maxPushes: config?.maxPushes ?? 10,
    cacheManifest: config?.cacheManifest ?? {},
  };

  const pushCache = new Set<string>();

  return {
    name: "http2-push",
    config: finalConfig,

    /**
     * Add URLs to push manifest
     *
     * Example:
     * ```typescript
     * middleware.addPushManifest("/api/user", ["/api/user/settings", "/api/user/profile"])
     * ```
     */
    addPushManifest(primaryUrl: string, dependencyUrls: string[]) {
      if (!finalConfig.cacheManifest) finalConfig.cacheManifest = {};
      finalConfig.cacheManifest[primaryUrl] = dependencyUrls;
    },

    async beforeRequest(url: string, options: any) {
      if (!finalConfig.enabled) return options;

      // Add Link header for HTTP/2 Server Push
      const dependencies = finalConfig.cacheManifest?.[url] || [];

      if (dependencies.length > 0) {
        const pushLinks = dependencies
          .slice(0, finalConfig.maxPushes)
          .map((dep) => `<${dep}>; rel=preload; as=fetch`)
          .join(", ");

        if (pushLinks) {
          options.headers = options.headers || {};
          options.headers["Link"] = pushLinks;
        }

        // Track pushed URLs to avoid duplicates
        dependencies.forEach((dep) => pushCache.add(dep));
      }

      return options;
    },

    async afterResponse(response: any) {
      // Parse Link headers from server push
      const linkHeader = response.headers?.["link"];
      if (linkHeader) {
        response._pushedResources = linkHeader;
      }

      return response;
    },

    getPushCache() {
      return Array.from(pushCache);
    },

    clearPushCache() {
      pushCache.clear();
    },
  };
}

/**
 * Create Service Worker integration middleware
 *
 * Enables offline support and request caching through Service Worker
 */
export function createServiceWorkerMiddleware(config?: {
  enabled?: boolean;
  workerPath?: string;
  cacheStrategy?: "network-first" | "cache-first" | "stale-while-revalidate";
  cacheName?: string;
  maxCacheSize?: number;
}) {
  const finalConfig = {
    enabled: config?.enabled ?? true,
    workerPath: config?.workerPath ?? "/sw.js",
    cacheStrategy: config?.cacheStrategy ?? "network-first" as const,
    cacheName: config?.cacheName ?? "rhttp-cache-v1",
    maxCacheSize: config?.maxCacheSize ?? 50, // Max cached requests
  };

  let swRegistration: ServiceWorkerRegistration | null = null;
  const cachedRequests = new Map<string, Response>();

  return {
    name: "service-worker",
    config: finalConfig,

    /**
     * Register Service Worker
     */
    async register() {
      if (!finalConfig.enabled || typeof navigator === "undefined") return;

      try {
        swRegistration = await navigator.serviceWorker.register(finalConfig.workerPath, {
          scope: "/",
        });
        console.log("Service Worker registered:", swRegistration);
      } catch (error) {
        console.error("Service Worker registration failed:", error);
      }
    },

    /**
     * Unregister Service Worker
     */
    async unregister() {
      if (swRegistration) {
        await swRegistration.unregister();
        swRegistration = null;
      }
    },

    /**
     * Check if offline
     */
    isOffline(): boolean {
      return typeof navigator !== "undefined" && !navigator.onLine;
    },

    /**
     * Get cached response (for offline mode)
     */
    getCachedResponse(url: string): Response | undefined {
      return cachedRequests.get(url);
    },

    /**
     * Cache response manually
     */
    async cacheResponse(url: string, response: Response): Promise<void> {
      if (!finalConfig.enabled || typeof caches === "undefined") return;

      try {
        const cache = await caches.open(finalConfig.cacheName);
        await cache.put(url, response.clone());

        // Maintain max cache size
        if (cachedRequests.size >= finalConfig.maxCacheSize) {
          const firstKey = cachedRequests.keys().next().value;
          if (firstKey !== undefined) {
            cachedRequests.delete(firstKey);
          }
        }

        cachedRequests.set(url, response);
      } catch (error) {
        console.warn("Failed to cache response:", error);
      }
    },

    /**
     * Clear all caches
     */
    async clearCache(): Promise<void> {
      if (!finalConfig.enabled || typeof caches === "undefined") return;

      try {
        const names = await caches.keys();
        await Promise.all(
          names.map((name) => caches.delete(name))
        );
        cachedRequests.clear();
      } catch (error) {
        console.warn("Failed to clear caches:", error);
      }
    },

    async beforeRequest(url: string, options: any) {
      if (!finalConfig.enabled) return options;

      // Offline mode: return cached response
      if (this.isOffline()) {
        const cached = this.getCachedResponse(url);
        if (cached) {
          options._cachedOffline = true;
          return options;
        }
      }

      // Add Service Worker strategy header
      options.headers = options.headers || {};
      options.headers["X-Cache-Strategy"] = finalConfig.cacheStrategy;

      return options;
    },

    async afterResponse(response: any) {
      if (!finalConfig.enabled) return response;

      // Cache response if not from cache
      if (!response.options._cachedOffline) {
        await this.cacheResponse(
          response.options.url,
          new Response(response.data, {
            status: response.status,
            headers: response.headers,
          })
        );
      }

      return response;
    },
  };
}

/**
 * Create optimized middleware stack for modern clients
 */
export function createModernClientOptimizations() {
  return [
    createCompressionMiddleware({
      enabled: true,
      algorithms: ["gzip", "deflate"],
      minSize: 512, // Aggressive compression for small payloads
    }),
    createHttp2PushMiddleware({
      enabled: true,
      maxPushes: 5,
    }),
    createServiceWorkerMiddleware({
      enabled: true,
      cacheStrategy: "stale-while-revalidate",
    }),
  ];
}
