/**
 * RealtimeProvider component
 */

"use client";

import React, { useEffect, useState, useCallback, type ReactNode } from "react";
import { RealtimeContext, createContextValue, getInitialContextValue } from "./context";
import { RealtimeClient } from "./client";
import type { RealtimeClientConfig, ConnectionState } from "./types";

interface RealtimeProviderProps {
  client: RealtimeClient;
  autoConnect?: boolean;
  prefetchCsrf?: boolean;
  children: ReactNode;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: Error) => void;
}

export function RealtimeProvider({
  client,
  autoConnect = true,
  prefetchCsrf = true,
  children,
  onConnected,
  onDisconnected,
  onError,
}: RealtimeProviderProps) {
  const [contextValue, setContextValue] = useState(() =>
    getInitialContextValue()
  );
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    connected: false,
    connecting: false,
    reconnecting: false,
  });

  // Subscribe to client state changes
  useEffect(() => {
    const unsubscribe = client.onStateChange((state) => {
      setConnectionState(state);
      setContextValue((prev) => createContextValue(client, state));

      if (state.connected) {
        onConnected?.();
      } else if (!state.connecting) {
        onDisconnected?.();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [client, onConnected, onDisconnected]);

  // Auto-connect on mount
  useEffect(() => {
    if (!autoConnect || connectionState.connected || connectionState.connecting) {
      return;
    }

    let isMounted = true;

    const doConnect = async () => {
      try {
        // Prefetch CSRF if enabled
        if (prefetchCsrf) {
          const csrfHandler = (client as any).csrfHandler;
          if (csrfHandler) {
            await csrfHandler.prefetch();
          }
        }

        // Connect
        if (isMounted) {
          await client.connect();
        }
      } catch (error) {
        if (isMounted) {
          console.error("Failed to connect realtime client:", error);
          onError?.(error instanceof Error ? error : new Error(String(error)));
        }
      }
    };

    doConnect();

    return () => {
      isMounted = false;
    };
  }, [autoConnect, prefetchCsrf, client, connectionState.connected, connectionState.connecting, onError]);

  // Set initial context value
  useEffect(() => {
    setContextValue((prev) => createContextValue(client, connectionState));
  }, [client, connectionState]);

  return (
    <RealtimeContext.Provider value={contextValue}>
      {children}
    </RealtimeContext.Provider>
  );
}
