/**
 * rhttp.io/socket.io.client
 * Main exports
 */

export * from "./types";
export * from "./errors";
export * from "./client";
export * from "./context";
export * from "./hooks";
export * from "./provider";
export * from "./offline-queue";
export * from "./csrf-handler";

import { RealtimeClient } from "./client";
import type { RealtimeClientConfig } from "./types";

// Global singleton
let globalClient: RealtimeClient | null = null;

/**
 * Create a new realtime client instance
 */
export function createRealtimeClient(config: RealtimeClientConfig) {
  return new RealtimeClient(config);
}

/**
 * Initialize global realtime client singleton
 */
export function initializeSocketClient(config: RealtimeClientConfig) {
  if (!globalClient) {
    globalClient = new RealtimeClient(config);
  }
  return globalClient;
}

/**
 * Get global socket client instance
 */
export function getSocketClient(): RealtimeClient | null {
  return globalClient;
}

/**
 * Export global socket client
 */
export const socket = {
  get instance() {
    return globalClient;
  },
  create(config: RealtimeClientConfig) {
    globalClient = new RealtimeClient(config);
    return globalClient;
  },
  connect() {
    return globalClient?.connect();
  },
  disconnect() {
    globalClient?.disconnect();
  },
  destroy() {
    globalClient?.destroy();
    globalClient = null;
  },
};
