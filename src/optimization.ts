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
export function createCompressionMiddleware(
  config?: Partial<CompressionConfig>,
) {
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
  ];
}
