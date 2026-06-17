/**
 * CSRF token handler for realtime connections
 */

import type { CsrfConfig } from "./types";
import { CsrfError } from "./errors";

export class CsrfHandler {
  private token: string | null = null;
  private config: CsrfConfig;

  constructor(config?: CsrfConfig) {
    this.config = config || { enabled: false, fetchEndpoint: "/api/csrf" };
  }

  async prefetch(): Promise<string | null> {
    if (!this.isEnabled()) {
      return null;
    }

    try {
      const response = await fetch(this.config.fetchEndpoint, {
        method: "GET",
        credentials: "include",
        ...this.config.fetchOptions,
      });

      if (!response.ok) {
        throw new Error(`CSRF prefetch failed: ${response.statusText}`);
      }

      const data = await response.json();
      this.token = data.token || this.extractFromCookie();

      return this.token;
    } catch (error) {
      console.error("CSRF prefetch error:", error);
      this.token = this.extractFromCookie();
      return this.token;
    }
  }

  private extractFromCookie(): string | null {
    if (typeof document === "undefined") return null;

    const cookieName = this.config.cookieName || "csrf-token";
    const cookies = document.cookie.split(";");

    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split("=");
      if (name === cookieName && value !== undefined) {
        return decodeURIComponent(value);
      }
    }

    return null;
  }

  getHeaders(): Record<string, string> {
    if (!this.token || !this.isEnabled()) {
      return {};
    }

    const headerName = this.config.headerName || "X-CSRF-Token";
    return { [headerName]: this.token };
  }

  getToken(): string | null {
    return this.token;
  }

  setToken(token: string): void {
    this.token = token;
  }

  isEnabled(): boolean {
    return this.config.enabled ?? false;
  }

  clear(): void {
    this.token = null;
  }
}
