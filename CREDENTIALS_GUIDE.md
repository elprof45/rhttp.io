/**
 * CREDENTIALS_GUIDE.ts
 *
 * Complete guide for token and credential management in rhttp.io.
 * Covers authentication patterns, security best practices, and real-world scenarios.
 *
 * @version 1.0.0
 * @security Critical - Follow all security recommendations when handling credentials
 */

import { createClientHttp, createServerHttp, HttpError } from "rhttp.io";

// ============================================================================
// SECTION 1: TOKEN STORAGE HIERARCHY
// ============================================================================

/**
 * TOKEN STORAGE OPTIONS (In Order of Preference)
 *
 * 1. ✅ HttpOnly Cookies (MOST SECURE - RECOMMENDED)
 *    - Automatically sent by browser
 *    - Protected from XSS attacks
 *    - Not accessible to JavaScript
 *    - Perfect for SSR applications
 *
 * 2. ✅ Secure Token Storage Implementations
 *    - localStorage (if HTTPS only)
 *    - sessionStorage (if HTTPS only)
 *    - Memory storage (session-only)
 *    - IndexedDB (encrypted storage)
 *
 * 3. ✅ getToken() Callback (MOST FLEXIBLE)
 *    - Retrieve from any source
 *    - Compute token dynamically
 *    - Validate before sending
 *    - Allows custom logic
 *
 * 4. ⚠️  Environment Variables (STATIC TOKENS ONLY)
 *    - Build-time tokens
 *    - Public/non-sensitive only
 *    - Never use for user credentials
 *
 * ⚠️  SECURITY REMINDERS:
 * - NEVER hardcode tokens in client code
 * - NEVER send sensitive tokens in query parameters
 * - NEVER log tokens in production
 * - ALWAYS use HTTPS for token transmission
 * - ALWAYS validate tokens before use
 */

// ============================================================================
// SECTION 2: HttpOnly Cookie Authentication (RECOMMENDED)
// ============================================================================

/**
 * Pattern 2.1: HttpOnly Cookie Setup
 *
 * Flow:
 * 1. User logs in via HTTPS
 * 2. Server sets HttpOnly, Secure, SameSite cookie
 * 3. Browser automatically sends cookie with requests
 * 4. JavaScript cannot read the cookie
 * 5. Protected from XSS attacks
 */
export function pattern_2_1_httponly_cookies() {
  const http = createClientHttp({
    baseURL: "https://api.example.com",
    auth: {
      // HttpOnly cookies are sent automatically
      // No explicit token handling needed
      forwardCookies: true,
    },
  });

  return http;
}

// ============================================================================
// SECTION 3: Token Storage in Browser
// ============================================================================

/**
 * Pattern 3.1: Memory-Based Storage (SESSION ONLY)
 *
 * Best for: Highly sensitive operations, temporary sessions
 * Trade-off: Must re-login on page refresh
 */
export function pattern_3_1_memory_storage() {
  let token: string | null = null;

  const http = createClientHttp({
    baseURL: "https://api.example.com",
    auth: {
      scheme: "Bearer",
      getToken: async () => token || undefined,
    },
  });

  return { http, setToken: (t: string) => (token = t) };
}

/**
 * Pattern 3.2: localStorage (HTTPS ONLY)
 *
 * Best for: Low-sensitivity applications
 * ⚠️  Only use HTTPS, vulnerable to XSS
 */
export function pattern_3_2_localstorage() {
  const STORAGE_KEY = "auth_token";

  const http = createClientHttp({
    baseURL: "https://api.example.com",
    auth: {
      scheme: "Bearer",
      getToken: async () => localStorage.getItem(STORAGE_KEY) || undefined,
    },
  });

  const logout = () => localStorage.removeItem(STORAGE_KEY);
  const setToken = (token: string) => localStorage.setItem(STORAGE_KEY, token);

  return { http, logout, setToken };
}

/**
 * Pattern 3.3: sessionStorage (SESSION ONLY)
 *
 * Best for: Multi-tab applications, sensitive operations
 * Clears when tab closes
 */
export function pattern_3_3_sessionstorage() {
  const STORAGE_KEY = "auth_token";

  const http = createClientHttp({
    baseURL: "https://api.example.com",
    auth: {
      scheme: "Bearer",
      getToken: async () => sessionStorage.getItem(STORAGE_KEY) || undefined,
    },
  });

  return http;
}

// ============================================================================
// SECTION 4: Token Refresh Patterns
// ============================================================================

/**
 * Pattern 4.1: Automatic Token Refresh
 *
 * Flow:
 * 1. Request made with token
 * 2. Receive 401 Unauthorized
 * 3. refreshToken() called automatically
 * 4. Get new token from refresh endpoint
 * 5. Retry original request with new token
 * 6. All pending requests queued during refresh
 *
 * Security:
 * - Built-in 10-second timeout prevents indefinite waits
 * - Old token used for refresh
 * - Graceful degradation on failure
 */
export function pattern_4_1_automatic_refresh() {
  const http = createClientHttp({
    baseURL: "https://api.example.com",
    auth: {
      scheme: "Bearer",
      getToken: async () => localStorage.getItem("auth_token") || undefined,
      refreshToken: async (expiredToken: string) => {
        const response = await fetch("https://api.example.com/auth/refresh", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${expiredToken}`,
          },
        });

        if (!response.ok) {
          throw new Error("Token refresh failed");
        }

        const { token } = await response.json();
        localStorage.setItem("auth_token", token);
        return token;

        // Built-in 10s timeout applied automatically
      },
    },
  });

  return http;
}

/**
 * Pattern 4.2: Refresh Token Rotation
 *
 * Flow:
 * 1. Server issues: accessToken (short-lived) + refreshToken (long-lived)
 * 2. Access token stored in localStorage
 * 3. Refresh token stored in HttpOnly cookie
 * 4. Access token expires frequently
 * 5. Use refresh token (cookie) to get new access token
 *
 * Security:
 * - Access token compromised = limited damage (short expiry)
 * - Refresh token in HttpOnly cookie = most secure
 * - Automatic refresh before expiry
 */
export function pattern_4_2_refresh_token_rotation() {
  const http = createClientHttp({
    baseURL: "https://api.example.com",
    auth: {
      scheme: "Bearer",
      getToken: async () => {
        const token = localStorage.getItem("access_token");
        const expiresAt = localStorage.getItem("access_token_expires_at");

        // Token expired, need refresh
        if (expiresAt && Date.now() > parseInt(expiresAt)) {
          return undefined;
        }

        return token || undefined;
      },
      refreshToken: async () => {
        // Use refresh token (in HttpOnly cookie)
        const response = await fetch("https://api.example.com/auth/refresh", {
          method: "POST",
          credentials: "include", // Include refresh token cookie
        });

        if (!response.ok) {
          localStorage.removeItem("access_token");
          window.location.href = "/login";
          throw new Error("Token refresh failed");
        }

        const { accessToken, expiresIn } = await response.json();
        localStorage.setItem("access_token", accessToken);
        localStorage.setItem(
          "access_token_expires_at",
          (Date.now() + expiresIn * 1000).toString(),
        );

        return accessToken;
      },
    },
  });

  return http;
}

/**
 * Pattern 4.3: Silent Token Refresh (Before Expiry)
 *
 * Refresh token BEFORE expiry to prevent 401 errors
 * Better UX: requests never fail with "unauthorized"
 * Trade-off: More frequent refresh requests
 */
export function pattern_4_3_silent_refresh() {
  let refreshTimeout: NodeJS.Timeout | null = null;
  const REFRESH_BEFORE_EXPIRY = 5 * 60 * 1000; // 5 minutes

  async function scheduleRefresh(expiresIn: number) {
    if (refreshTimeout) clearTimeout(refreshTimeout);

    const refreshAt = expiresIn - REFRESH_BEFORE_EXPIRY;

    refreshTimeout = setTimeout(async () => {
      try {
        const response = await fetch("https://api.example.com/auth/refresh", {
          method: "POST",
          credentials: "include",
        });

        if (response.ok) {
          const { expiresIn: newExpiresIn } = await response.json();
          scheduleRefresh(newExpiresIn);
        }
      } catch (error) {
        console.error("Silent refresh failed");
      }
    }, refreshAt);
  }

  return { scheduleRefresh };
}

// ============================================================================
// SECTION 5: Authentication Flows
// ============================================================================

/**
 * Pattern 5.1: Login Flow
 *
 * Complete flow from login to authenticated requests
 */
export async function pattern_5_1_login_flow() {
  const http = createClientHttp({
    baseURL: "https://api.example.com",
    auth: {
      scheme: "Bearer",
      getToken: async () => localStorage.getItem("auth_token") || undefined,
    },
  });

  async function login(email: string, password: string) {
    try {
      const response = await http.post("/auth/login", { email, password });
      const { token } = response.data;
      localStorage.setItem("auth_token", token);
      return response.data;
    } catch (error) {
      if (error instanceof HttpError && error.status === 401) {
        throw new Error("Invalid credentials");
      }
      throw error;
    }
  }

  function logout() {
    localStorage.removeItem("auth_token");
    window.location.href = "/login";
  }

  return { http, login, logout };
}

/**
 * Pattern 5.2: Multi-Factor Authentication (MFA)
 *
 * Two-step: password + OTP
 */
export async function pattern_5_2_mfa_login() {
  const http = createClientHttp({
    baseURL: "https://api.example.com",
    auth: {
      scheme: "Bearer",
      getToken: async () => localStorage.getItem("auth_token") || undefined,
    },
  });

  async function loginWithMFA(email: string, password: string) {
    // Step 1: Initial login
    const mfaResponse = await http.post("/auth/login", { email, password });
    return {
      temporaryToken: mfaResponse.data.temporaryToken,
      method: mfaResponse.data.method, // "email" | "sms"
    };
  }

  async function verifyMFA(temporaryToken: string, otp: string) {
    // Step 2: Verify OTP
    const response = await http.post(
      "/auth/verify-mfa",
      { otp },
      {
        headers: { "X-Temporary-Token": temporaryToken },
      },
    );

    localStorage.setItem("auth_token", response.data.token);
    return response.data;
  }

  return { loginWithMFA, verifyMFA };
}

/**
 * Pattern 5.3: OAuth Login (Google, GitHub)
 *
 * Social authentication
 */
export async function pattern_5_3_oauth_login() {
  const http = createClientHttp({
    baseURL: "https://api.example.com",
    auth: {
      scheme: "Bearer",
      getToken: async () => localStorage.getItem("auth_token") || undefined,
    },
  });

  function initiateOAuthFlow(provider: "google" | "github") {
    const clientId = process.env.REACT_APP_OAUTH_CLIENT_ID;
    const redirectUri = `${window.location.origin}/auth/callback`;
    const scope = provider === "google" ? "openid email profile" : "user:email";

    const params = new URLSearchParams({
      client_id: clientId || "",
      redirect_uri: redirectUri,
      response_type: "code",
      scope,
    });

    const endpoint =
      provider === "google"
        ? "https://accounts.google.com/o/oauth2/v2/auth"
        : "https://github.com/login/oauth/authorize";

    window.location.href = `${endpoint}?${params}`;
  }

  async function handleOAuthCallback(code: string) {
    const response = await http.post("/auth/oauth/callback", { code });
    localStorage.setItem("auth_token", response.data.token);
    return response.data;
  }

  return { initiateOAuthFlow, handleOAuthCallback };
}

// ============================================================================
// SECTION 6: Security Best Practices
// ============================================================================

/**
 * Pattern 6.1: Token Validation
 *
 * Validate token before including in request
 */
export function pattern_6_1_token_validation() {
  function isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.exp ? Date.now() >= payload.exp * 1000 : false;
    } catch {
      return true;
    }
  }

  const http = createClientHttp({
    baseURL: "https://api.example.com",
    auth: {
      scheme: "Bearer",
      getToken: async () => {
        const token = localStorage.getItem("auth_token");
        if (!token || isTokenExpired(token)) return undefined;
        return token;
      },
    },
  });

  return http;
}

/**
 * Pattern 6.2: Secure Error Handling
 *
 * Never log tokens, always sanitize errors
 */
export function pattern_6_2_error_handling() {
  const http = createClientHttp({
    baseURL: "https://api.example.com",
    auth: {
      scheme: "Bearer",
      getToken: async () => localStorage.getItem("auth_token") || undefined,
    },
  });

  http.on("error", (context) => {
    if (context.status === 401) {
      localStorage.removeItem("auth_token");
      window.location.href = "/login";
    } else if (context.status === 403) {
      console.error("Access denied");
    } else {
      // Never log full error (might contain credentials)
      console.error("Request failed:", context.error.message);
    }
  });

  return http;
}

/**
 * Pattern 6.3: HTTPS-Only Configuration
 *
 * Ensure secure transmission
 */
export function pattern_6_3_https_only() {
  const http = createClientHttp({
    baseURL: "https://api.example.com", // Always HTTPS
    auth: {
      scheme: "Bearer",
      getToken: async () => {
        if (window.location.protocol !== "https:") {
          console.error("Auth only available over HTTPS");
          return undefined;
        }
        return localStorage.getItem("auth_token") || undefined;
      },
    },
  });

  return http;
}

/**
 * Pattern 6.4: CSRF Protection
 *
 * Prevent cross-site request forgery
 */
export function pattern_6_4_csrf_protection() {
  function getCSRFToken(): string {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta?.getAttribute("content") || "";
  }

  const http = createClientHttp({
    baseURL: "https://api.example.com",
    csrf: {
      enabled: true,
      headerName: "X-CSRF-Token",
      getToken: getCSRFToken,
    },
    auth: {
      scheme: "Bearer",
      getToken: async () => localStorage.getItem("auth_token") || undefined,
    },
  });

  return http;
}

// ============================================================================
// SECTION 7: Server-Side Patterns
// ============================================================================

/**
 * Pattern 7.1: SSR with HttpOnly Cookies
 *
 * Server-side rendering with secure cookie forwarding
 */
export function pattern_7_1_ssr_setup() {
  const http = createServerHttp({
    baseURL: "https://api.example.com",
    auth: {
      requestContext: () => {
        // In real app: get from request object
        return {
          cookie: "", // req.headers.cookie
        };
      },
    },
  });

  return http;
}

/**
 * Pattern 7.2: Service-to-Service Authentication
 *
 * Server making requests to another service
 */
export function pattern_7_2_service_auth() {
  const SERVICE_TOKEN = process.env.SERVICE_API_TOKEN;

  const http = createServerHttp({
    baseURL: "https://internal-api.example.com",
    auth: {
      scheme: "Bearer",
      token: SERVICE_TOKEN,
    },
    defaultHeaders: {
      "X-Service-Name": "user-service",
    },
  });

  return http;
}

// ============================================================================
// SECTION 8: Complete Production Setup
// ============================================================================

/**
 * Pattern 8.1: Production Authentication Setup
 *
 * Full setup with all security best practices
 */
export function pattern_8_1_production_setup() {
  const CONFIG = {
    API_URL: process.env.REACT_APP_API_URL || "https://api.example.com",
    TOKEN_KEY: "auth_token",
    REFRESH_BEFORE_EXPIRY: 5 * 60 * 1000,
  };

  function isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.exp ? Date.now() >= payload.exp * 1000 : false;
    } catch {
      return true;
    }
  }

  const http = createClientHttp({
    baseURL: CONFIG.API_URL,
    timeout: 30_000,
    auth: {
      scheme: "Bearer",
      getToken: async () => {
        const token = localStorage.getItem(CONFIG.TOKEN_KEY);
        return token && !isTokenExpired(token) ? token : undefined;
      },
      refreshToken: async (expiredToken: string) => {
        const response = await fetch(`${CONFIG.API_URL}/auth/refresh`, {
          method: "POST",
          headers: { Authorization: `Bearer ${expiredToken}` },
        });

        if (!response.ok) {
          localStorage.removeItem(CONFIG.TOKEN_KEY);
          window.location.href = "/login";
          throw new Error("Refresh failed");
        }

        const { token } = await response.json();
        localStorage.setItem(CONFIG.TOKEN_KEY, token);
        return token;
      },
    },
    csrf: {
      enabled: true,
      getToken: () => {
        const meta = document.querySelector('meta[name="csrf-token"]');
        return meta?.getAttribute("content") || "";
      },
    },
  });

  async function login(email: string, password: string) {
    const response = await http.post("/auth/login", { email, password });
    const { token } = response.data;
    localStorage.setItem(CONFIG.TOKEN_KEY, token);
    return response.data;
  }

  function logout() {
    localStorage.removeItem(CONFIG.TOKEN_KEY);
    window.location.href = "/login";
  }

  http.on("error", (context) => {
    if (context.status === 401) logout();
  });

  return { http, login, logout };
}

// ============================================================================
// SECURITY CHECKLIST
// ============================================================================

/**
 * Before deploying to production:
 *
 * ✓ Use HTTPS everywhere
 * ✓ Use HttpOnly cookies for session tokens (not localStorage)
 * ✓ Never log sensitive tokens
 * ✓ Implement token refresh before expiry
 * ✓ Validate tokens before sending
 * ✓ Clear tokens on logout
 * ✓ Implement CSRF protection
 * ✓ Use secure auth headers
 * ✓ Implement proper error handling
 * ✓ Test auth flows thoroughly
 * ✓ Monitor for suspicious patterns
 * ✓ Implement rate limiting on auth endpoints
 * ✓ Use strong token expiration times
 * ✓ Implement MFA for sensitive operations
 * ✓ Keep dependencies updated
 */

export const credentialsPatterns = {
  "2.1": pattern_2_1_httponly_cookies,
  "3.1": pattern_3_1_memory_storage,
  "3.2": pattern_3_2_localstorage,
  "3.3": pattern_3_3_sessionstorage,
  "4.1": pattern_4_1_automatic_refresh,
  "4.2": pattern_4_2_refresh_token_rotation,
  "4.3": pattern_4_3_silent_refresh,
  "5.1": pattern_5_1_login_flow,
  "5.2": pattern_5_2_mfa_login,
  "5.3": pattern_5_3_oauth_login,
  "6.1": pattern_6_1_token_validation,
  "6.2": pattern_6_2_error_handling,
  "6.3": pattern_6_3_https_only,
  "6.4": pattern_6_4_csrf_protection,
  "7.1": pattern_7_1_ssr_setup,
  "7.2": pattern_7_2_service_auth,
  "8.1": pattern_8_1_production_setup,
};
