import { createHttp, setRequestContextStore } from "./core";
import type { CreateHttpConfig, HttpClientInstance } from "./types";

export function createServerHttp(config: CreateHttpConfig = {}): HttpClientInstance {
  return createHttp({
    ...config,
    auth: {
      forwardCookies: true,
      ...config.auth,
    },
    observability: {
      logger: true,
      tracing: true,
      metrics: process.env.NODE_ENV === "production",
      ...config.observability,
    },
  });
}

export { setRequestContextStore } from "./core";
export * from "./core";
export * from "./types";
export * from "./errors";
export { buildUrl, getCookie, parseHeaders, parseResponse, generateRequestId } from "./utils";
