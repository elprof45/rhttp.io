/**
 * QUICK START PATTERNS - rhttp.io v1.0.2
 * Copy-paste ready examples for common use cases
 *
 * @description
 * This file contains practical, production-ready examples for:
 * - Authentication setup (static tokens, JWT refresh, OAuth)
 * - Cache configuration (strategies, invalidation, pattern-based)
 * - Error handling (interceptors, circuit breaker, retries)
 * - Realtime integration (Socket.io client, event handling)
 * - Request validation (Zod schemas, request/response)
 * - Advanced patterns (request pooling, deduplication, rate limiting)
 *
 * @usage
 * Each pattern is self-contained and can be copy-pasted.
 * No external dependencies besides rhttp.io.
 *
 * @version 1.0.2
 * @since 2026-06-23
 */

// ============================================================================
// PATTERN 1: Static Bearer Token Authentication
// ============================================================================

/**
 * Simplest auth pattern: fixed API key or bearer token
 *
 * Use when:
 * - You have a static API key
 * - Token never changes during app lifetime
 * - Service-to-service communication
 *
 * Pros: Simple, no refresh logic
 * Cons: No token refresh capability
 */
export const pattern1_StaticToken = {
  name: "Static Bearer Token",

  code: `
import { createClientHttp } from "rhttp.io/client";

const http = createClientHttp({
  baseURL: "https://api.example.com",
  auth: {
    type: "bearer",
    token: "sk_live_abc123...xyzdef"
    // Token never changes
  }
});

// Usage - token injected automatically
const data = await http.get("/api/data");
// Request: Authorization: Bearer sk_live_abc123...xyzdef
  `,

  typescript: `
interface User {
  id: string;
  name: string;
  email: string;
}

const response = await http.get<User[]>("/api/users");
// Fully typed: response.data is User[]
  `,

  security: [
    "✅ Use environment variables: token from process.env.API_KEY",
    "✅ Store in .env file (never commit)",
    "✅ In browser: use HttpOnly cookie instead (more secure)",
    "❌ Don't hardcode real tokens in source code",
  ],
};

// ============================================================================
// PATTERN 2: JWT Token with Automatic Refresh
// ============================================================================

/**
 * JWT authentication with automatic token refresh
 *
 * Use when:
 * - Using JWT tokens with expiration
 * - Have a refresh endpoint
 * - Want transparent token refresh on 401
 *
 * Pros: Automatic refresh, transparent to consumer
 * Cons: Extra logic, more request overhead
 */
export const pattern2_JWTRefresh = {
  name: "JWT with Automatic Refresh",

  code: `
import { createClientHttp } from "rhttp.io/client";
import { createRefreshAuthInterceptor } from "rhttp.io/advanced";

const http = createClientHttp({
  baseURL: "https://api.example.com",
  auth: {
    type: "bearer",
    getToken: async () => {
      // Get from storage
      const stored = localStorage.getItem("token");
      return stored || null;
    },
    refreshUrl: "/auth/refresh",
    // Token refresh only happens on 401
  }
});

// Add refresh interceptor
const refresher = createRefreshAuthInterceptor({
  http,
  refreshUrl: "/auth/refresh",
  getRefreshToken: () => localStorage.getItem("refresh_token"),
  onRefresh: (newToken, newRefreshToken) => {
    localStorage.setItem("token", newToken);
    localStorage.setItem("refresh_token", newRefreshToken);
  }
});

http.use(refresher);

// Usage - automatic refresh on 401
const data = await http.get("/api/data");
// If token expired: automatic refresh, then retry request
  `,

  lifecycle: `
1. User logs in → Get token + refresh_token
   POST /auth/login → { token, refreshToken }

2. Store both:
   localStorage.token = token          // Short lived (5-15 min)
   localStorage.refreshToken = refreshToken  // Long lived (7-30 days)

3. API request with token
   GET /api/data
   Authorization: Bearer token

4. Token expires (401 response)
   Interceptor detects 401
   Automatically calls: POST /auth/refresh
   With: { refreshToken }

5. Get new tokens:
   { token: newToken, refreshToken: newRefreshToken }
   Update localStorage

6. Retry original request with new token
   GET /api/data (with new token)

7. Continue normally
  `,

  security: [
    "✅ HttpOnly cookie for refresh token (more secure)",
    "✅ Short expiration on access token (5-15 min)",
    "✅ Long expiration on refresh token (7-30 days)",
    "✅ Refresh token rotation (get new one each refresh)",
    "❌ Don't store long-lived tokens in localStorage",
    "❌ Don't expose refresh token to frontend",
  ],
};

// ============================================================================
// PATTERN 3: OAuth 2.0 / OIDC Integration
// ============================================================================

/**
 * OAuth 2.0 / OpenID Connect setup
 *
 * Use when:
 * - Using external auth provider (Google, GitHub, Microsoft)
 * - Already have OAuth tokens from auth library
 * - Need to refresh via provider
 *
 * Pros: Delegate auth to trusted provider, better security
 * Cons: Extra latency for refreshes, dependency on provider
 */
export const pattern3_OAuth = {
  name: "OAuth 2.0 / OIDC",

  code: `
import { createClientHttp } from "rhttp.io/client";
import { useAuth } from "@oidc/library"; // e.g., authjs, keycloak-js

// Auth library handles OAuth login
const { accessToken, refreshToken } = useAuth();

const http = createClientHttp({
  baseURL: "https://api.example.com",
  auth: {
    type: "bearer",
    getToken: async () => {
      const { accessToken } = useAuth();
      return accessToken;
    },
    refreshUrl: "https://oauth.provider.com/token",
    onRefresh: async (response) => {
      // Update auth library's tokens
      updateAuthTokens({
        accessToken: response.access_token,
        refreshToken: response.refresh_token
      });
    }
  }
});

// Usage - same as pattern 2
const data = await http.get("/api/data");
// If token expired: refresh via OAuth provider
  `,

  providers: \`
// Google OAuth
const http = createClientHttp({
  auth: {
    refreshUrl: "https://oauth2.googleapis.com/token",
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET
  }
});

// GitHub OAuth
const http = createClientHttp({
  auth: {
    refreshUrl: "https://github.com/login/oauth/access_token",
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET
  }
});

// Auth0
const http = createClientHttp({
  auth: {
    refreshUrl: \`https://YOUR_DOMAIN.auth0.com/oauth/token\`,
    clientId: process.env.AUTH0_CLIENT_ID,
    clientSecret: process.env.AUTH0_CLIENT_SECRET
  }
});
\`,

  security: [
    "✅ Refresh token stored in HttpOnly cookie",
    "✅ Access token has short expiration",
    "✅ Refresh happens server-side (not exposed to frontend)",
    "✅ Client secret never exposed to frontend",
    "❌ Never expose client_secret in frontend code",
  ],
};

// ============================================================================
// PATTERN 4: Cache-First Strategy (Offline Support)
// ============================================================================

/**
 * Cache-first for offline support
 *
 * Use when:
 * - Building offline-first app
 * - Want cached data even if offline
 * - Network is unreliable
 *
 * Pros: Works offline, fast UX
 * Cons: Stale data risk, complex invalidation
 */
export const pattern4_CacheFirst = {
  name: "Cache-First (Offline)",

  code: `
import { createClientHttp } from "rhttp.io/client";

const http = createClientHttp({
  baseURL: "https://api.example.com",
  cache: {
    enabled: true,
    strategy: "cache-first",
    ttl: 300000, // 5 minutes
  },
  smartCaching: {
    enabled: true,
    patterns: {
      "/api/products": {
        ttl: 600000,  // 10 minutes - product list changes infrequently
        invalidateOn: ["POST", "PUT", "DELETE"]
      },
      "/api/user": {
        ttl: 60000,   // 1 minute - user preferences change
        invalidateOn: ["PUT"]
      }
    }
  }
});

// Usage
const products = await http.get("/api/products");
// First request: network → cache → return
// Second request (within 10m): cache → return (instant)
// Third request (after 10m): network → cache → return

// Invalidate cache after mutation
await http.post("/api/products", newProduct);
// Automatically invalidates /api/products cache due to POST
  `,

  invalidation: `
// Automatic invalidation
await http.post("/api/products", newProduct);
// Cache entry for /api/products deleted automatically

// Manual invalidation
await http.invalidateCache("/api/products");

// Invalidate pattern
await http.invalidateCache("/api/*/favorite");  // Supports wildcards
  `,

  userExperience: `
// Offline scenario
1. Load app
   GET /api/products
   → Network down
   → Return from cache
   → UI shows cached products immediately
   → User keeps working

2. Network restored
   GET /api/products
   → Cache expired (10 min)
   → Network succeeds
   → Update cache
   → UI refreshes with new products

Result: Seamless offline → online transition
  `,

  security: [
    "⚠️ Cache stores data in IndexedDB (not secure for secrets)",
    "✅ Use cache-only for public data",
    "✅ Use short TTL for sensitive data",
    "❌ Don't cache authentication tokens",
    "❌ Don't cache payment data",
  ],
};

// ============================================================================
// PATTERN 5: Network-First Strategy (Fresh Data)
// ============================================================================

/**
 * Network-first for always-fresh data
 *
 * Use when:
 * - Need real-time or near-real-time data
 * - Network usually available
 * - Stale data is worse than no data
 *
 * Pros: Always fresh, predictable behavior
 * Cons: Slower if network is slow, no offline support
 */
export const pattern5_NetworkFirst = {
  name: "Network-First (Fresh Data)",

  code: `
import { createClientHttp } from "rhttp.io/client";

const http = createClientHttp({
  baseURL: "https://api.example.com",
  cache: {
    enabled: true,
    strategy: "network-first",
    ttl: 30000,  // 30 seconds
    networkTimeout: 5000  // Fallback to cache if network takes >5s
  }
});

// Usage
const status = await http.get("/api/server-status");
// First request: network → cache → return
// Second request (before 30s): network → return (fresh) OR cache (if slow)
// Timeout: if network takes >5s, use cache instead
  `,

  scenarios: `
Scenario 1: Network fast (< 5s)
GET /api/data
→ Network succeeds
→ Update cache
→ Return fresh data

Scenario 2: Network slow (5-15s)
GET /api/data
→ Wait 5 seconds...
→ Network still loading
→ Return from cache (stale but available)
→ Network eventually succeeds, cache updated

Scenario 3: Network offline
GET /api/data
→ Network fails
→ Return from cache (better than error)
  `,

  useCases: [
    "Real-time dashboards (stock prices, server status)",
    "User profiles (fresh data important)",
    "Search results (users expect fresh)",
    "Sports scores, weather, news",
  ],
};

// ============================================================================
// PATTERN 6: Stale-While-Revalidate (Best UX)
// ============================================================================

/**
 * Stale-while-revalidate - best of both worlds
 *
 * Use when:
 * - Want fast UX (instant cached data)
 * - Also want fresh data in background
 * - Can tolerate brief staleness
 *
 * Pros: Best UX (instant + fresh), resilient
 * Cons: More complex, slightly more network
 */
export const pattern6_StaleWhileRevalidate = {
  name: "Stale-While-Revalidate",

  code: `
import { createClientHttp } from "rhttp.io/client";

const http = createClientHttp({
  baseURL: "https://api.example.com",
  cache: {
    enabled: true,
    strategy: "stale-while-revalidate",
    ttl: 60000,  // 1 minute
    staleTime: 300000  // Keep stale cache for 5 minutes
  },
  smartCaching: {
    enabled: true,
    patterns: {
      "/api/feed": {
        ttl: 30000,
        staleTime: 300000,
        invalidateOn: ["POST"]  // New posts invalidate feed
      }
    }
  }
});

// Usage
const feed = await http.get("/api/feed");
// First request: network → cache → return
// Second request: cache HIT → return immediately (stale)
//                 + network request in background
//                 → update cache when ready
//                 → UI updates automatically if subscribed
  `,

  userExperience: `
1. User opens app
   GET /api/feed
   → Cache miss (first time)
   → Fetch from network
   → Return data
   → Display feed immediately

2. User closes and reopens app (30s later)
   GET /api/feed
   → Cache hit (fresh)
   → Return cached data
   → Display instantly

3. User keeps app open (after 1 minute)
   GET /api/feed
   → Cache expired (stale)
   → Return cached data immediately (UX fast!)
   → Revalidate in background
   → New data arrives
   → Auto-update UI

Result: Always fast UI, always fresh data
  `,

  implementation: `
// Listen for cache updates
http.hooks.onSuccess = async (ctx) => {
  if (ctx.isCached) {
    console.log("Showing cached data:", ctx.response);
    // User sees cached data immediately
  } else {
    console.log("Refreshed with new data:", ctx.response);
    // Trigger UI update if needed
    updateUI(ctx.response);
  }
};
  `,

  useCases: [
    "Social media feeds (instant + fresh)",
    "Messaging apps (see cached messages + refresh)",
    "Product lists (instant load + update prices)",
    "Search results (instant cached results + refresh)",
    "Most web applications",
  ],
};

// ============================================================================
// PATTERN 7: Error Handling & Retry Strategy
// ============================================================================

/**
 * Comprehensive error handling with retries
 *
 * Use when:
 * - Network is unreliable
 * - Want graceful degradation
 * - Need detailed error tracking
 *
 * Pros: Resilient, good user experience, detailed logging
 * Cons: More code, delayed errors
 */
export const pattern7_ErrorHandling = {
  name: "Error Handling & Retries",

  code: `
import { createClientHttp } from "rhttp.io/client";
import { type HttpError } from "rhttp.io/errors";

const http = createClientHttp({
  baseURL: "https://api.example.com",
  retry: {
    enabled: true,
    maxAttempts: 3,
    backoff: "exponential",
    delayMs: 1000,
    conditions: {
      maxRetryCount: 3,
      // Retry on network errors and 5xx errors
      shouldRetry: (status, error) => {
        if (!status) return true; // Network error
        if (status >= 500) return true; // Server error
        if (status === 429) return true; // Rate limit
        return false;
      }
    }
  },
  circuitBreaker: {
    enabled: true,
    failureThreshold: 5,  // Open after 5 failures
    successThreshold: 2,  // Close after 2 successes
    timeout: 60000  // Try to recover after 1 minute
  },
  hooks: {
    onError: async (ctx) => {
      console.error(\`Error on attempt \${ctx.attemptNumber}\`, {
        url: ctx.url,
        method: ctx.method,
        status: ctx.status,
        error: ctx.error,
        willRetry: ctx.willRetry
      });

      if (ctx.willRetry) {
        console.log(\`Will retry in \${ctx.delayMs}ms\`);
      } else {
        console.error("No more retries - giving up");
        // Notify user
        notifyUser("Request failed after retries");
      }
    }
  }
});

// Usage with error handling
try {
  const data = await http.get("/api/data");
  console.log("Success:", data);
} catch (error) {
  const httpError = error as HttpError;

  if (httpError.isNetworkError) {
    console.error("Network unavailable");
  } else if (httpError.isTimeout) {
    console.error("Request timeout");
  } else if (httpError.status === 401) {
    console.error("Unauthorized - login required");
  } else if (httpError.status === 403) {
    console.error("Forbidden - insufficient permissions");
  } else if (httpError.status >= 500) {
    console.error("Server error - try again later");
  }
}
  `,

  circuitBreakerStates: `
STATE 1: CLOSED (normal operation)
├─ Requests pass through
├─ Failures tracked
└─ After 5 failures → transition to OPEN

STATE 2: OPEN (blocking requests)
├─ All requests rejected immediately
├─ Errors returned without trying
├─ Protects backend from more damage
└─ After 1 minute → transition to HALF_OPEN

STATE 3: HALF_OPEN (testing recovery)
├─ Single request allowed
├─ If success → transition to CLOSED
├─ If failure → transition to OPEN
└─ Gives backend time to recover
  `,

  bestPractices: [
    "✅ Set appropriate retry counts (usually 2-3)",
    "✅ Use exponential backoff (1s, 2s, 4s)",
    "✅ Don't retry on 4xx errors (client errors)",
    "✅ Retry on 5xx errors (server errors)",
    "✅ Retry on network errors",
    "✅ Add circuit breaker for protection",
    "✅ Log errors for debugging",
    "❌ Don't retry infinitely",
    "❌ Don't retry on 401 without refresh",
  ],
};

// ============================================================================
// PATTERN 8: Request Validation with Zod
// ============================================================================

/**
 * Runtime validation with Zod schemas
 *
 * Use when:
 * - Want type-safe runtime validation
 * - Need to validate before sending
 * - Need to validate response shape
 *
 * Pros: Type safety, runtime validation, great errors
 * Cons: Extra code, small bundle size impact
 */
export const pattern8_ZodValidation = {
  name: "Request Validation with Zod",

  code: `
import { createClientHttp } from "rhttp.io/client";
import { withSchemaValidation } from "rhttp.io/extensions";
import { z } from "zod";

// Define schemas
const CreateUserRequest = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().int().positive()
});

const UserResponse = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  createdAt: z.string().datetime()
});

// Create HTTP client with validation
const http = createClientHttp({
  baseURL: "https://api.example.com"
});

// Add validation middleware
const validator = withSchemaValidation({
  schemas: {
    request: CreateUserRequest,
    response: UserResponse
  }
});

http.use(validator);

// Usage - validated on send and receive
interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

const newUser = await http.post<User>("/api/users", {
  name: "John",
  email: "john@example.com",
  age: 30
});
// ✅ Request validated before sending
// ✅ Response validated after receiving
// ✅ Type errors caught at compile time
// ✅ Runtime errors caught with helpful messages
  `,

  errorHandling: `
// Validation errors
try {
  const user = await http.post("/api/users", {
    name: "",         // ❌ Empty string
    email: "invalid"  // ❌ Invalid email
    // age missing  // ❌ Required field
  });
} catch (error) {
  if (error instanceof ValidationError) {
    console.error("Validation failed:", error.issues);
    // [
    //   { path: ["name"], message: "String must contain at least 1 character" },
    //   { path: ["email"], message: "Invalid email" },
    //   { path: ["age"], message: "Required" }
    // ]
  }
}
  `,

  bestPractices: [
    "✅ Define schemas for all request bodies",
    "✅ Define schemas for all response shapes",
    "✅ Use discriminated unions for polymorphic responses",
    "✅ Validate at boundaries (request/response)",
    "✅ Provide clear error messages",
    "❌ Don't validate in component render",
  ],
};

// ============================================================================
// PATTERN 9: Realtime Integration (Socket.io)
// ============================================================================

/**
 * Realtime events with Socket.io
 *
 * Use when:
 * - Need realtime updates
 * - Want to stay in sync with server
 * - Building chat, notifications, live updates
 *
 * Pros: Realtime, efficient, automatic reconnection
 * Cons: More complex, server setup required
 */
export const pattern9_Realtime = {
  name: "Realtime Integration (Socket.io)",

  code: `
import { createClientHttp } from "rhttp.io/client";
import { createSocketioClient } from "rhttp.io/realtime";

// Create HTTP client for REST calls
const http = createClientHttp({
  baseURL: "https://api.example.com"
});

// Create realtime client for Socket.io
const realtime = createSocketioClient({
  url: "wss://api.example.com",
  auth: {
    token: localStorage.getItem("token")
  },
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5
});

// Listen for connection
realtime.on("connect", () => {
  console.log("Connected to realtime");
});

// Listen for disconnect
realtime.on("disconnect", (reason) => {
  console.log("Disconnected:", reason);
});

// Listen for specific events
realtime.on("message:new", (message) => {
  console.log("New message:", message);
  // Update UI
  addMessageToChat(message);
});

realtime.on("user:typing", (data) => {
  console.log("User typing:", data.userId);
  showTypingIndicator(data.userId);
});

// Emit events
realtime.emit("message:send", {
  text: "Hello, world!",
  channelId: "general"
});

// REST + Realtime together
const channels = await http.get("/api/channels");
// Fetch channels via REST

channels.forEach(channel => {
  realtime.emit("channel:subscribe", { channelId: channel.id });
  // Get realtime updates for channel
});
  `,

  eventPatterns: `
// Request-response pattern
realtime.emit("user:getData", { userId: "123" }, (response) => {
  console.log("User data:", response);
});

// Broadcast pattern
realtime.on("broadcast:announcement", (announcement) => {
  notifyAll(announcement);
});

// Room subscription
realtime.emit("room:join", { roomId: "project-123" });
realtime.on("room:message", (message) => {
  addToRoom(message);
});

// Presence (who's online)
realtime.emit("presence:update", { status: "online" });
realtime.on("presence:change", (data) => {
  updateOnlineList(data);
});
  `,

  useCases: [
    "Chat applications",
    "Live notifications",
    "Collaborative editing (Google Docs)",
    "Live dashboards (stock prices)",
    "Gaming (player positions, actions)",
    "Live comments (YouTube, Medium)",
  ],
};

// ============================================================================
// PATTERN 10: Request Pooling & Rate Limiting
// ============================================================================

/**
 * Control concurrency and rate limiting
 *
 * Use when:
 * - Need to limit concurrent requests
 * - API has rate limits
 * - Want to prevent overwhelming backend
 *
 * Pros: Prevents overload, respects rate limits
 * Cons: Delayed requests, needs configuration
 */
export const pattern10_Pooling = {
  name: "Request Pooling & Rate Limiting",

  code: `
import { createClientHttp } from "rhttp.io/client";
import { RequestPool, RateLimiter } from "rhttp.io/advanced";

// Option 1: Request pooling (limit concurrent requests)
const pool = new RequestPool({
  maxConcurrent: 5  // Max 5 requests at once
});

const http = createClientHttp({
  baseURL: "https://api.example.com"
});

http.use(pool);

// Usage - automatically queued
for (let i = 0; i < 20; i++) {
  // First 5 execute immediately
  // Next 15 queued and execute as others complete
  http.get(\`/api/items/\${i}\`);
}

// Option 2: Rate limiting (token bucket algorithm)
const limiter = new RateLimiter({
  rate: 100,        // 100 requests
  timeWindow: 60000 // Per minute
});

http.use(limiter);

// Usage - automatically rate limited
for (let i = 0; i < 150; i++) {
  const promise = http.get(\`/api/items/\${i}\`);
  // First 100: execute immediately
  // Next 50: queued until next minute
}

// Option 3: Combined pooling + rate limiting
const poolAndLimit = [pool, limiter];
http.use(...poolAndLimit);

// Usage - respects both limits
// Max 5 concurrent AND max 100 per minute
for (let i = 0; i < 500; i++) {
  http.get(\`/api/items/\${i}\`);
}
  `,

  visualization: `
REQUEST POOLING (maxConcurrent: 5):
Timeline: [1][2][3][4][5]░░░░░░░░░░░░░
          [6][7][8][9][10]░░░░░░░░░░
          (1-5 run, 6-10 queued)

RATE LIMITING (100/min):
Timeline: [1........50][51.......100]░
          (51-100 queued for next minute)

COMBINED:
Timeline: [1][2][3][4][5][6][7][8][9][10]░░░
          (Run 5 concurrent, respect rate limit)
  `,

  useCases: [
    "Bulk data operations (import thousands of items)",
    "APIs with rate limits (public APIs)",
    "Image uploads (don't overwhelm server)",
    "Data synchronization (periodic bulk syncs)",
    "Web scraping (respect server bandwidth)",
  ],
};

/**
 * ============================================================================
 * SUMMARY TABLE
 * ============================================================================
 */

export const PATTERNS_SUMMARY = \`
┌─────────────────────┬──────────────────────────┬─────────────────────────────┐
│ Pattern             │ Best Use Case            │ Key Benefit                 │
├─────────────────────┼──────────────────────────┼─────────────────────────────┤
│ Static Token        │ API keys, service-to-    │ Simple, no refresh logic    │
│                     │ service                  │                             │
├─────────────────────┼──────────────────────────┼─────────────────────────────┤
│ JWT Refresh         │ User authentication,     │ Transparent, automatic      │
│                     │ token expiration         │ refresh                     │
├─────────────────────┼──────────────────────────┼─────────────────────────────┤
│ OAuth               │ External providers,      │ Delegate security,          │
│                     │ SSO                      │ trusted provider            │
├─────────────────────┼──────────────────────────┼─────────────────────────────┤
│ Cache-First         │ Offline-first, slow net  │ Works offline, instant UX   │
├─────────────────────┼──────────────────────────┼─────────────────────────────┤
│ Network-First       │ Real-time data, fresh    │ Always fresh data           │
│                     │ required                 │                             │
├─────────────────────┼──────────────────────────┼─────────────────────────────┤
│ Stale-While-        │ Most web apps            │ Best UX + fresh data        │
│ Revalidate          │                          │                             │
├─────────────────────┼──────────────────────────┼─────────────────────────────┤
│ Error Handling      │ Unreliable networks,     │ Resilient, graceful         │
│                     │ resilient apps           │ degradation                 │
├─────────────────────┼──────────────────────────┼─────────────────────────────┤
│ Zod Validation      │ Type safety, contracts   │ Runtime validation + types  │
├─────────────────────┼──────────────────────────┼─────────────────────────────┤
│ Realtime (Socket)   │ Chat, live updates,      │ Real-time, efficient        │
│                     │ collaboration            │                             │
├─────────────────────┼──────────────────────────┼─────────────────────────────┤
│ Pooling/Rate Limit  │ Bulk ops, API rate       │ Prevents overload,          │
│                     │ limits                   │ respects limits             │
└─────────────────────┴──────────────────────────┴─────────────────────────────┘
\`;

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
        interval: 2_000, // Poll every 2 seconds
        maxAttempts: 30, // Max 30 attempts = 1 minute total
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
      level: 6, // Compression level 1-9
    }),
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
    },
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
