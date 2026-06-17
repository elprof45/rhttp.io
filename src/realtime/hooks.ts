/**
 * React hooks for realtime client
 */

"use client";

import {
  useContext,
  useEffect,
  useRef,
  useCallback,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { RealtimeContext } from "./context";
import type {
  RealtimeClientInstance,
  ConnectionState,
  SocketEventHandler,
  SocketEventUnsubscribe,
} from "./types";

/**
 * Get realtime context
 */
export function useRealtimeContext() {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error(
      "useRealtimeClient must be used within RealtimeProvider"
    );
  }
  return context;
}

/**
 * Get realtime client instance
 */
export function useRealtimeClient(): RealtimeClientInstance {
  const { client } = useRealtimeContext();
  if (!client) {
    throw new Error("Realtime client not initialized");
  }
  return client;
}

/**
 * Get connection state with proper sync external store
 */
export function useConnectionState(): ConnectionState {
  const { client } = useRealtimeContext();

  const subscribe = useCallback(
    (listener: (state: ConnectionState) => void) => {
      if (!client) return () => {};
      return client.onStateChange(listener);
    },
    [client]
  );

  const getSnapshot = useCallback((): ConnectionState => {
    if (!client) {
      return {
        connected: false,
        connecting: false,
        reconnecting: false,
      };
    }
    return {
      connected: client.isConnected,
      connecting: client.isConnecting,
      reconnecting: client.isReconnecting,
    };
  }, [client]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Get socket client with utilities (alias for useRealtimeClient)
 */
export function useSocketClient(): RealtimeClientInstance {
  return useRealtimeClient();
}

/**
 * Listen to socket event
 */
export function useSocketEvent(
  event: string,
  handler: SocketEventHandler
): void {
  const client = useRealtimeClient();
  const handlerRef = useRef(handler);

  // Keep handler ref updated
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!client) return;

    const wrappedHandler = (data: any) => {
      handlerRef.current(data);
    };

    const unsubscribe = client.on(event, wrappedHandler);

    return () => {
      unsubscribe();
    };
  }, [client, event]);
}

/**
 * Join room and listen to room event
 */
export function useRoomEvent(
  room: string,
  event: string,
  handler: SocketEventHandler
): void {
  const client = useRealtimeClient();
  const handlerRef = useRef(handler);

  // Keep handler ref updated
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!client) return;

    let mounted = true;

    // Join room
    client.joinRoom(room).catch((error) => {
      console.error(`Failed to join room ${room}:`, error);
    });

    // Set up event listener
    const wrappedHandler = (data: any) => {
      if (mounted) {
        handlerRef.current(data);
      }
    };

    const unsubscribe = client.on(event, wrappedHandler);

    // Cleanup: leave room and remove listener
    return () => {
      mounted = false;
      unsubscribe();
      client.leaveRoom(room).catch((error) => {
        console.error(`Failed to leave room ${room}:`, error);
      });
    };
  }, [client, room, event]);
}

/**
 * Emit socket event with callback
 */
export function useSocketEmit() {
  const client = useRealtimeClient();

  return useCallback(
    (event: string, data?: any, callback?: (response: any) => void) => {
      client.emit(event, data, callback);
    },
    [client]
  );
}

/**
 * Emit socket event with acknowledgment (promise-based)
 */
export function useSocketEmitWithAck() {
  const client = useRealtimeClient();

  return useCallback(
    async (event: string, data?: any, timeout?: number) => {
      return client.emitWithAck(event, data, timeout);
    },
    [client]
  );
}

/**
 * Room management utilities
 */
export function useRoomManagement() {
  const client = useRealtimeClient();

  return {
    joinRoom: useCallback(
      (room: string) => client.joinRoom(room),
      [client]
    ),
    leaveRoom: useCallback(
      (room: string) => client.leaveRoom(room),
      [client]
    ),
    getRooms: useCallback(() => client.getRooms(), [client]),
    isInRoom: useCallback((room: string) => client.isInRoom(room), [client]),
  };
}

/**
 * Offline queue utilities
 */
export function useOfflineQueue() {
  const client = useRealtimeClient();

  return {
    getQueueLength: useCallback(() => client.getQueueLength(), [client]),
    clearQueue: useCallback(() => client.clearQueue(), [client]),
    flushQueue: useCallback(() => client.flushQueue(), [client]),
  };
}

/**
 * Connection metrics
 */
export function useConnectionMetrics() {
  const client = useRealtimeClient();

  const subscribe = useCallback(
    (listener: () => void) => {
      // Poll metrics every 1 second
      const interval = setInterval(listener, 1000);
      return () => clearInterval(interval);
    },
    []
  );

  const getSnapshot = useCallback(() => {
    return client.getMetrics();
  }, [client]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Listen to event with automatic cleanup (one-time)
 */
export function useSocketEventOnce(
  event: string,
  handler: SocketEventHandler
): void {
  const client = useRealtimeClient();
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!client) return;

    const wrappedHandler = (data: any) => {
      handlerRef.current(data);
    };

    return client.once(event, wrappedHandler);
  }, [client, event]);
}

/**
 * Listen to multiple events at once
 */
export function useSocketEvents(
  events: Record<string, SocketEventHandler>
): void {
  const client = useRealtimeClient();
  const handlersRef = useRef(events);

  useEffect(() => {
    handlersRef.current = events;
  }, [events]);

  useEffect(() => {
    if (!client) return;

    const unsubscribers: SocketEventUnsubscribe[] = [];

    for (const [event, handler] of Object.entries(events)) {
      const wrappedHandler = (data: any) => {
        const currentHandler = handlersRef.current[event];
        if (currentHandler) {
          currentHandler(data);
        }
      };
      unsubscribers.push(client.on(event, wrappedHandler));
    }

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [client, Object.keys(events).join(",")]);
}

/**
 * Manual socket connection control
 */
export function useSocketConnection() {
  const client = useRealtimeClient();
  const connectionState = useConnectionState();

  const connect = useCallback(async () => {
    try {
      if (client) {
        await client.connect();
      }
    } catch (error) {
      console.error("Failed to connect socket:", error);
      throw error;
    }
  }, [client]);

  const disconnect = useCallback(() => {
    if (client) {
      client.disconnect();
    }
  }, [client]);

  return {
    ...connectionState,
    connect,
    disconnect,
  };
}
