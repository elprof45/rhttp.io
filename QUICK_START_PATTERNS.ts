/**
 * QUICK START PATTERNS - rhttp.io v2.0
 * Copy-paste ready examples for common use cases
 */

// ═══════════════════════════════════════════════════════════════════════════
// PATTERN 1: Basic SPA Setup
// ═══════════════════════════════════════════════════════════════════════════

import { createClientHttp } from "rhttp.io/client";
import { createObservabilityMiddleware } from "rhttp.io";

export const createApiClient = () => {
  // Create HTTP client with smart defaults
  const http = createClientHttp({
    baseURL: import.meta.env.VITE_API_URL,
    timeout: 15_000,
  });

  // Add observability in development
  if (import.meta.env.DEV) {
    const obs = createObservabilityMiddleware({
      enableLogging: true,
      enableMetrics: true,
    });
    http.use(obs);
  }

  return http;
};

export const http = createApiClient();

// ═══════════════════════════════════════════════════════════════════════════
// PATTERN 2: Login Flow with Secure Token Storage
// ═══════════════════════════════════════════════════════════════════════════

export async function login(email: string, password: string) {
  try {
    const response = await http.post("/auth/login", {
      email,
      password,
    });

    // ✅ Token stored securely (Hybrid by default)
    await http.setToken(response.data.token);

    return response.data;
  } catch (error) {
    if (error.status === 401) {
      throw new Error("Invalid credentials");
    }
    throw error;
  }
}

export async function logout() {
  try {
    await http.post("/auth/logout");
  } finally {
    // ✅ Clear token securely
    await http.clearToken();
  }
}

export async function isLoggedIn() {
  return await http.hasToken();
}

// ═══════════════════════════════════════════════════════════════════════════
// PATTERN 3: Polling with Proper Handling
// ═══════════════════════════════════════════════════════════════════════════

export async function pollJobStatus(jobId: string) {
  try {
    // ✅ Poll executes immediately, returns actual result
    const response = await http.poll(`/jobs/${jobId}`, {
      polling: {
        interval: 2_000,        // Poll every 2 seconds
        maxAttempts: 30,        // Max 30 attempts = 1 minute total
        stopCondition: (res) => {
          // Stop when job is completed or failed
          const status = res.data?.status;
          return status === "completed" || status === "failed";
        },
      },
    });

    console.log("Final job status:", response.data.status);
    return response.data;
  } catch (error) {
    console.error("Polling failed:", error);
    throw error;
  }
}

// Usage:
// const job = await pollJobStatus("job-123");
// console.log(job.result); // Job is completed

// ═══════════════════════════════════════════════════════════════════════════
// PATTERN 4: SSR with TanStack Start
// ═══════════════════════════════════════════════════════════════════════════

import { createServerHttp } from "rhttp.io/server";
import { getRequest } from "@tanstack/react-start/server";
import { createServerFn } from "@tanstack/react-start/server";

// Create once at startup
const serverHttp = createServerHttp({
  baseURL: process.env.INTERNAL_API_URL || "http://localhost:3000",
  timeout: 30_000,
  requestContext: () => getRequest(), // Auto-forwards cookies
});

// Server function that uses it
export const getUserProfile = createServerFn({
  method: "GET",
}).handler(async () => {
  try {
    // ✅ Cookies from client request are automatically forwarded
    const response = await serverHttp.get("/user/profile");
    return response.data;
  } catch (error) {
    throw new Error("Failed to fetch profile");
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PATTERN 5: Observability & Monitoring
// ═══════════════════════════════════════════════════════════════════════════

export const setupObservability = (http: any) => {
  const obs = createObservabilityMiddleware({
    enableLogging: true,
    enableTracing: true,
    enableMetrics: true,
    maxTracesStored: 100,

    // Send to your monitoring service
    onTrace: async (trace) => {
      if (import.meta.env.PROD) {
        // Send to Datadog, Sentry, etc.
        await sendToMonitoring({
          type: "request",
          traceId: trace.traceId,
          url: trace.url,
          duration: trace.duration,
          status: trace.status,
          error: trace.error?.message,
        });
      }
    },

    onLog: async (entry) => {
      if (entry.level === "error" && import.meta.env.PROD) {
        await sendToMonitoring({
          type: "error",
          level: entry.level,
          message: entry.message,
          context: entry.context,
        });
      }
    },
  });

  http.use(obs);

  // Export metrics getter
  return {
    getMetrics: () => obs.getMetrics(),
    getTraces: (filter?: any) => obs.getTraces(filter),
    getLogs: (filter?: any) => obs.getLogs(filter),
  };
};

// Usage in component:
// const { getMetrics } = setupObservability(http);
// setInterval(() => {
//   const metrics = getMetrics();
//   console.log(`Avg duration: ${metrics.avgDuration}ms, P95: ${metrics.p95Duration}ms`);
// }, 10_000);

// ═══════════════════════════════════════════════════════════════════════════
// PATTERN 6: Compression for Large Payloads
// ═══════════════════════════════════════════════════════════════════════════

import { createCompressionMiddleware } from "rhttp.io";

export const setupCompression = (http: any) => {
  http.use(
    createCompressionMiddleware({
      enabled: true,
      algorithms: ["gzip", "deflate"],
      minSize: 512, // Compress if > 512 bytes
      level: 6,     // Compression level 1-9
    })
  );
};

// Usage:
// const http = createClientHttp();
// setupCompression(http);

// ═══════════════════════════════════════════════════════════════════════════
// PATTERN 7: HTTP/2 Server Push
// ═══════════════════════════════════════════════════════════════════════════

import { createHttp2PushMiddleware } from "rhttp.io";

export const setupHttp2Push = (http: any) => {
  const pushMiddleware = createHttp2PushMiddleware({
    enabled: true,
    maxPushes: 5,
    cacheManifest: {
      // When /api/user is requested, also push these
      "/api/user": ["/api/user/settings", "/api/user/preferences"],

      // When /api/dashboard is requested, push these
      "/api/dashboard": ["/api/dashboard/stats", "/api/dashboard/charts"],
    },
  });

  http.use(pushMiddleware);

  // Add dynamically
  pushMiddleware.addPushManifest("/api/products", [
    "/api/products/categories",
    "/api/products/filters",
  ]);

  return pushMiddleware;
};

// ═══════════════════════════════════════════════════════════════════════════
// PATTERN 8: Service Worker for Offline Support
// ═══════════════════════════════════════════════════════════════════════════

import { createServiceWorkerMiddleware } from "rhttp.io";

export const setupServiceWorker = async (http: any) => {
  const swMiddleware = createServiceWorkerMiddleware({
    enabled: "serviceWorker" in navigator,
    workerPath: "/sw.js",
    cacheStrategy: "stale-while-revalidate",
    cacheName: "api-cache-v1",
    maxCacheSize: 100,
  });

  // Register service worker
  try {
    await swMiddleware.register();
    console.log("Service Worker registered");
  } catch (error) {
    console.warn("Service Worker registration failed:", error);
  }

  http.use(swMiddleware);

  // Check offline status
  window.addEventListener("offline", () => {
    console.log("App is offline - using cached responses");
  });

  return swMiddleware;
};

// ═══════════════════════════════════════════════════════════════════════════
// PATTERN 9: Error Handling with Custom Errors
// ═══════════════════════════════════════════════════════════════════════════

import { HttpError, TimeoutError, NetworkError } from "rhttp.io";

export async function fetchDataWithErrorHandling(url: string) {
  try {
    const response = await http.get(url);
    return response.data;
  } catch (error) {
    if (error instanceof TimeoutError) {
      console.error("Request timed out after 30 seconds");
      // Show timeout UI
      throw new Error("Request took too long, please try again");
    } else if (error instanceof NetworkError) {
      console.error("Network error:", error.originalError);
      // Handle offline
      throw new Error("Network connection failed");
    } else if (error instanceof HttpError) {
      if (error.status === 401) {
        // Handle unauthorized
        await logout();
        throw new Error("Session expired, please login again");
      } else if (error.status === 404) {
        throw new Error("Resource not found");
      } else if (error.status >= 500) {
        throw new Error("Server error, please try again later");
      }
      throw error;
    }
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PATTERN 10: Complete Setup for Production
// ═══════════════════════════════════════════════════════════════════════════

export async function setupHttpClient() {
  // 1. Create base client
  const http = createClientHttp({
    baseURL: import.meta.env.VITE_API_URL,
    timeout: 30_000,
    tokenStorage: "hybrid", // Secure storage
    retry: { attempts: 2, strategy: "exponential" },
    cache: {
      enabled: true,
      ttl: 5 * 60_000, // 5 minutes
      strategy: "stale-while-revalidate",
    },
  });

  // 2. Add observability
  if (import.meta.env.DEV) {
    setupObservability(http);
  }

  // 3. Add compression
  if (import.meta.env.PROD) {
    setupCompression(http);
  }

  // 4. Add HTTP/2 push
  setupHttp2Push(http);

  // 5. Add Service Worker
  if ("serviceWorker" in navigator) {
    await setupServiceWorker(http);
  }

  // 6. Setup request interceptors
  http.interceptors.request.use((options) => {
    // Add request ID for tracing
    options.headers = options.headers || {};
    options.headers["X-Request-ID"] = generateUUID();
    return options;
  });

  // 7. Setup response interceptors
  http.interceptors.response.use(
    (response) => {
      // Success handling
      return response;
    },
    (error) => {
      // Error handling
      console.error("Request failed:", error);
      throw error;
    }
  );

  return http;
}

// Usage in main app:
// const http = await setupHttpClient();
// window.http = http; // Make available globally for debugging

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function sendToMonitoring(data: any) {
  try {
    await fetch("https://monitoring.example.com/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch {
    // Ignore monitoring errors
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPESCRIPT TYPES (Optional)
// ═══════════════════════════════════════════════════════════════════════════

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Job {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  result?: any;
  error?: string;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Record<string, string>;
}
