/**
 * CREDENTIALS & AUTHENTICATION BEST PRACTICES
 *
 * Common issues with default credentials handling
 */

// ────────────────────────────────────────────────────────────────────────────
// PROBLEM 1: Inconsistent Credentials Between Environments
// ────────────────────────────────────────────────────────────────────────────

// ❌ WRONG - Client sends credentials to same origin
export function badClientSetup() {
  // This WILL include credentials (cookies) by default
  // But other headers might not be merged correctly
  const response = fetch("/api/data", {
    credentials: "include", // ✅ This is correct
  });
}

// ❌ WRONG - Server uses credentials when shouldn't
export function badServerSetup() {
  const response = fetch("https://api.example.com/data", {
    credentials: "include", // ❌ WRONG! Server should NOT use client's credentials
  });
}

// ────────────────────────────────────────────────────────────────────────────
// SOLUTION: Proper Credentials Configuration
// ────────────────────────────────────────────────────────────────────────────

import { createClientHttp } from "rhttp.io/client";
import { createServerHttp } from "rhttp.io/server";

// ✅ CLIENT - Include credentials for same-origin requests
export const clientHttp = createClientHttp({
  baseURL: "https://api.example.com",
  // defaultFetchOptions automatically includes:
  // - credentials: "include" (sends cookies)
  // - headers: { "Content-Type": "application/json" }
});

// ✅ SERVER - Don't include browser credentials
export const serverHttp = createServerHttp({
  baseURL: "https://internal-api.example.com",
  // defaultFetchOptions automatically includes:
  // - credentials: "omit" (don't send cookies)
  // Cookies are forwarded explicitly via interceptor instead
});

// ────────────────────────────────────────────────────────────────────────────
// EXAMPLE: Login Flow with Credentials
// ────────────────────────────────────────────────────────────────────────────

export async function exampleLoginFlow() {
  const http = createClientHttp({
    baseURL: "https://api.example.com",
  });

  // Step 1: Login with credentials
  const loginResponse = await http.post("/auth/login", {
    email: "user@example.com",
    password: "secret",
    // Behind the scenes:
    // - POST request includes credentials: "include"
    // - Cookies from response are automatically stored by browser
  });

  console.log("Login successful");
  // Response may include Set-Cookie header:
  // Set-Cookie: session_id=abc123; HttpOnly; Secure; SameSite=Strict

  // Step 2: Subsequent requests automatically include cookies
  const userResponse = await http.get("/user/profile");
  // This request AUTOMATICALLY includes the session_id cookie
  // because credentials: "include" is set by default

  console.log("User profile:", userResponse.data);

  // Step 3: Logout
  await http.post("/auth/logout");
  // Browser automatically clears the session_id cookie
}

// ────────────────────────────────────────────────────────────────────────────
// EXAMPLE: Cross-Origin Requests with Credentials
// ────────────────────────────────────────────────────────────────────────────

export async function crossOriginWithCredentials() {
  const http = createClientHttp({
    baseURL: "https://api.different-domain.com",
    defaultFetchOptions: {
      // Already includes credentials: "include" by default
    },
  });

  // ⚠️ IMPORTANT: Server must allow credentials in CORS headers
  // Server Response Headers Required:
  // Access-Control-Allow-Credentials: true
  // Access-Control-Allow-Origin: https://client.com (NOT *)
  // Access-Control-Allow-Methods: GET, POST, ...
  // Access-Control-Allow-Headers: Content-Type, Authorization, ...

  try {
    const response = await http.get("/protected-data");
    console.log(response.data);
  } catch (error) {
    if (error.status === 0 || error.statusText === "Network Error") {
      console.error(
        "CORS error! Server must set Access-Control-Allow-Credentials: true"
      );
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// EXAMPLE: Server-Side Rendering with Cookies
// ────────────────────────────────────────────────────────────────────────────

export async function exampleSSRWithCookies() {
  const http = createServerHttp({
    baseURL: "https://internal-api.example.com",
    requestContext: () => getRequest(), // TanStack Start
    // Behind the scenes:
    // - credentials: "omit" (server doesn't use browser cookies)
    // - Interceptor extracts cookies from incoming request
    // - Forwards them to internal API
  });

  // In a server function:
  export const getUser = createServerFn({ method: "GET" }).handler(
    async () => {
      // The incoming request from client has:
      // Cookie: session_id=abc123

      // Our interceptor automatically:
      // 1. Reads the session_id from request.headers.get("cookie")
      // 2. Adds it to outgoing request to internal API
      // 3. Internal API validates the session

      const response = await http.get("/user");
      return response.data;
    }
  );
}

// ────────────────────────────────────────────────────────────────────────────
// EXAMPLE: Token-Based Authentication (Bearer)
// ────────────────────────────────────────────────────────────────────────────

export async function tokenBasedAuth() {
  const http = createClientHttp({
    baseURL: "https://api.example.com",
    auth: {
      scheme: "Bearer", // Default
      // Token is stored securely (hybrid storage by default)
      // And automatically included in Authorization header
    },
  });

  // Step 1: Login and store token
  const loginResponse = await http.post("/auth/login", {
    username: "user",
    password: "pass",
  });

  // Store token securely (not in localStorage!)
  await http.setToken(loginResponse.data.token);
  // ✅ Stored in Memory + SessionStorage (hybrid)

  // Step 2: Subsequent requests automatically include token
  const dataResponse = await http.get("/data");
  // Behind the scenes:
  // Authorization: Bearer <token>

  // Step 3: Logout
  await http.clearToken();
  // ✅ Token is cleared from secure storage
}

// ────────────────────────────────────────────────────────────────────────────
// SECURITY COMPARISON TABLE
// ────────────────────────────────────────────────────────────────────────────

export const CREDENTIALS_COMPARISON = {
  // Include for same-origin requests
  "include": {
    description: "Send credentials for same-origin requests",
    safeCookie: true,
    autoInclude: true,
    useCases: ["Login", "User sessions", "Protected resources"],
  },

  // Omit for all requests
  "omit": {
    description: "Never send credentials",
    safeCookie: false,
    autoInclude: false,
    useCases: ["Public APIs", "Public static data"],
  },

  // Include only for same-origin
  "same-origin": {
    description: "Send credentials only for same-origin",
    safeCookie: true,
    autoInclude: true,
    useCases: ["Mostly same-origin", "Some cross-origin"],
  },
};

// ────────────────────────────────────────────────────────────────────────────
// HEADERS MERGING (Why credentials alone isn't enough)
// ────────────────────────────────────────────────────────────────────────────

export async function properHeaderMerging() {
  // ❌ WRONG - Headers are replaced, not merged
  const badFetch = async () => {
    const response = await fetch("/api/data", {
      headers: {
        "Authorization": "Bearer token123",
        // Content-Type is LOST!
      },
      // default headers not included
    });
  };

  // ✅ RIGHT - Headers are properly merged
  const http = createClientHttp({
    baseURL: "https://api.example.com",
    defaultHeaders: {
      "Content-Type": "application/json",
      "X-Custom-Header": "value",
    },
  });

  // When you make a request with additional headers:
  const response = await http.get("/data", {
    headers: {
      "Authorization": "Bearer token123",
      // Merged with defaults:
      // - Content-Type: application/json (from default)
      // - X-Custom-Header: value (from default)
      // - Authorization: Bearer token123 (from request)
    },
  });
  // ✅ All headers are preserved!
}

// ────────────────────────────────────────────────────────────────────────────
// CREDENTIALS WITH CSRF PROTECTION
// ────────────────────────────────────────────────────────────────────────────

export async function credentialsWithCsrf() {
  const http = createClientHttp({
    baseURL: "https://api.example.com",
    // credentials: "include" is automatic ✅

    csrf: {
      enabled: true,
      fetchEndpoint: "/api/csrf",
      headerName: "X-CSRF-Token",
      methods: ["POST", "PUT", "PATCH", "DELETE"],
      prefetch: true, // Fetch token at startup
    },
  });

  // Flow:
  // 1. credentials: "include" sends session cookie
  // 2. CSRF token is fetched from /api/csrf
  // 3. Server validates: session cookie + CSRF token
  // 4. POST request includes both ✅

  await http.post("/data", { /* ... */ });
}
