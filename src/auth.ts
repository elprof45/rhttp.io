import type { HttpClientInstance } from "./types";
import { HttpError } from "./errors";

export interface RefreshAuthOptions {
  /**
   * The function that performs the token refresh.
   * It should request a new token and return it (or throw/return null on failure).
   */
  refreshToken: () => Promise<string | null> | string | null;

  /**
   * Callback to update the stored/active token in your application.
   */
  onTokenRefreshed?: (newToken: string) => void | Promise<void>;

  /**
   * Optional list of status codes that trigger a token refresh.
   * Defaults to [401].
   */
  statusCodes?: number[];
}

/**
 * Creates an interceptor function for response errors that handles automatic JWT refresh.
 *
 * @param client The HttpClientInstance to attach to.
 * @param options Configuration options for refresh behavior.
 */
export function createRefreshAuthInterceptor(
  client: HttpClientInstance,
  options: RefreshAuthOptions,
) {
  const statusCodes = options.statusCodes || [401];
  const REFRESH_TIMEOUT = 10_000; // 10 second timeout for token refresh

  let isRefreshing = false;
  let refreshQueue: Array<{
    resolve: (token: string | null) => void;
    reject: (err: any) => void;
  }> = [];

  const processQueue = (err: any, token: string | null = null) => {
    refreshQueue.forEach((promise) => {
      if (err) {
        promise.reject(err);
      } else {
        promise.resolve(token);
      }
    });
    refreshQueue = [];
  };

  return async (error: any) => {
    // Check if error is an HttpError with a trigger status code
    if (!(error instanceof HttpError) || !statusCodes.includes(error.status)) {
      throw error;
    }

    const originalRequest = error.options;
    if (!originalRequest) {
      throw error;
    }

    // Prevent infinite loop if the refresh request itself fails
    if (originalRequest._retry) {
      throw error;
    }

    originalRequest._retry = true;

    if (isRefreshing) {
      // Queue requests while token is refreshing
      return new Promise<string | null>((resolve, reject) => {
        refreshQueue.push({ resolve, reject });
      })
        .then((newToken) => {
          if (!newToken) throw error;

          // Re-inject token in headers
          const scheme = client.config.auth?.scheme || "Bearer";
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers["authorization"] = `${scheme} ${newToken}`;

          // Re-run the request
          return client.customFetch(originalRequest.url, originalRequest);
        })
        .catch((err) => {
          throw err;
        });
    }

    isRefreshing = true;

    try {
      // Apply timeout to token refresh to prevent hanging indefinitely
      const newToken = await Promise.race([
        options.refreshToken(),
        new Promise<null>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(`Token refresh timeout after ${REFRESH_TIMEOUT}ms`),
              ),
            REFRESH_TIMEOUT,
          ),
        ),
      ]);

      if (!newToken) {
        throw error;
      }

      if (options.onTokenRefreshed) {
        await options.onTokenRefreshed(newToken);
      }

      // Update client config if auth config exists
      if (client.config.auth) {
        client.config.auth.accessToken = newToken;
      } else {
        client.config.auth = {
          accessToken: newToken,
          scheme: "Bearer",
          forwardCookies: false,
        };
      }

      // Re-inject token in headers
      const scheme = client.config.auth?.scheme || "Bearer";
      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers["authorization"] = `${scheme} ${newToken}`;

      processQueue(null, newToken);
      isRefreshing = false;

      // Re-run the request
      return await client.customFetch(originalRequest.url, originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      isRefreshing = false;
      throw refreshError;
    }
  };
}
