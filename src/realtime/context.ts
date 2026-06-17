/**
 * React Context for realtime client
 */

import { createContext } from "react";
import type { RealtimeClientInstance, RealtimeContextValue, ConnectionState } from "./types";

export const RealtimeContext = createContext<RealtimeContextValue | null>(null);

/**
 * Get initial context value
 */
export function getInitialContextValue(): RealtimeContextValue {
  return {
    client: null,
    connectionState: {
      connected: false,
      connecting: false,
      reconnecting: false,
    },
    isReady: false,
  };
}

/**
 * Create context value from client
 */
export function createContextValue(
  client: RealtimeClientInstance,
  connectionState: ConnectionState
): RealtimeContextValue {
  return {
    client,
    connectionState,
    isReady: !!client,
  };
}
