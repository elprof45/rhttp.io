import { createHttp } from "./core";
import type { CreateHttpConfig, HttpClientInstance } from "./types";

export function createClientHttp(config: CreateHttpConfig = {}): HttpClientInstance {
  return createHttp({
    ...config,
    csrf: {
      enabled: true,
      cookieName: "csrf-token",
      headerName: "X-CSRF-Token",
      fetchEndpoint: "/api/csrf",
      prefetch: true,
      ...config.csrf,
    },
  });
}

export * from "./core";
export * from "./types";
export * from "./errors";
export { buildUrl, getCookie, parseHeaders, parseResponse, generateRequestId } from "./utils";
