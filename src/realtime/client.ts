/**
 * Core realtime client implementation
 */

import { io, type Socket } from "socket.io-client";
import type {
  RealtimeClientConfig,
  RealtimeClientInstance,
  AuthConfig,
  ConnectionState,
  RealtimeMetrics,
} from "./types";
import { CsrfHandler } from "./csrf-handler";
import { OfflineQueue } from "./offline-queue";
import {
  ConnectionError,
  AuthenticationError,
  RoomError,
  TimeoutError,
} from "./errors";

const isServer = typeof window === "undefined";

export class RealtimeClient implements RealtimeClientInstance {
  private socket: Socket | null = null;
  private config: RealtimeClientConfig;
  private csrfHandler: CsrfHandler;
  private offlineQueue: OfflineQueue;
  private rooms: Set<string> = new Set();
  private logger: any;
  private wrappedHandlersMap = new Map<any, any>();

  // State tracking
  isConnected: boolean = false;
  isConnecting: boolean = false;
  isReconnecting: boolean = false;

  // Listeners for state changes
  private stateListeners: ((state: ConnectionState) => void)[] = [];

  // Metrics
  private metrics = {
    totalEventsEmitted: 0,
    totalEventsReceived: 0,
    reconnectAttempts: 0,
    connectionStartTime: null as number | null,
    eventLatencies: [] as number[],
  };

  constructor(config: RealtimeClientConfig) {
    const createLogger = (loggerSetting: boolean | any) => {
      if (loggerSetting === true) {
        return {
          debug: (...args: any[]) => console.debug("[realtime-io] [DEBUG]", ...args),
          info: (...args: any[]) => console.info("[realtime-io] [INFO]", ...args),
          warn: (...args: any[]) => console.warn("[realtime-io] [WARN]", ...args),
          error: (...args: any[]) => console.error("[realtime-io] [ERROR]", ...args),
        };
      } else if (loggerSetting && typeof loggerSetting === "object") {
        return loggerSetting;
      }
      const noop = () => {};
      return { debug: noop, info: noop, warn: noop, error: noop };
    };

    this.logger = createLogger(config.logger);
    this.config = config;
    this.csrfHandler = new CsrfHandler(config.csrf);
    this.offlineQueue = new OfflineQueue(config.offlineQueue);

    if (isServer) {
      return;
    }
  }

  async connect(): Promise<void> {
    if (isServer) {
      this.logger.warn("Socket connection attempted on server, skipping");
      return;
    }

    if (this.socket?.connected) {
      return; // Already connected
    }

    try {
      this.isConnecting = true;
      this.emitStateChange();
      this.logger.info(`Connecting to socket at: ${this.config.socketUrl}`);

      // Prefetch CSRF token
      if (this.config.csrf?.enabled) {
        this.logger.debug("Prefetching CSRF token before socket connection");
        await this.csrfHandler.prefetch();
      }

      // Build auth data
      const authData = await this.buildAuthData();

      // Create socket connection
      this.socket = io(this.config.socketUrl, {
        reconnection: this.config.reconnection ?? true,
        reconnectionDelay: this.config.reconnectionDelay ?? 1000,
        reconnectionDelayMax: this.config.reconnectionDelayMax ?? 5000,
        reconnectionAttempts: this.config.reconnectionAttempts ?? Infinity,
        withCredentials: this.config.withCredentials ?? true,
        transports: this.config.transports ?? ["websocket", "polling"],
        auth: authData,
        extraHeaders: {
          ...this.config.extraHeaders,
          ...this.csrfHandler.getHeaders(),
        },
        ...this.config.socketOptions,
      });

      // Attach event handlers
      this.setupEventHandlers();

      // Wait for connection
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new ConnectionError("Connection timeout"));
        }, 10000);

        this.socket?.on("connect", () => {
          clearTimeout(timeout);
          resolve();
        });

        this.socket?.on("connect_error", (error) => {
          clearTimeout(timeout);
          reject(new ConnectionError(error.message));
        });
      });

      this.isConnecting = false;
      this.isConnected = true;
      this.metrics.connectionStartTime = Date.now();
      this.emitStateChange();

      // Flush offline queue
      if (this.offlineQueue.length() > 0) {
        this.logger.info(`Flushing ${this.offlineQueue.length()} queued offline messages`);
        await this.flushQueue();
      }

      // Auto-rejoin rooms
      if (this.config.rooms?.autoRejoin && this.rooms.size > 0) {
        for (const room of this.rooms) {
          await this.joinRoom(room);
        }
      }
    } catch (error) {
      this.isConnecting = false;
      this.isConnected = false;
      this.emitStateChange();
      this.logger.error("Failed to connect to socket:", error);
      throw error;
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.isConnected = false;
    this.isConnecting = false;
    this.isReconnecting = false;
    this.emitStateChange();
  }

  destroy(): void {
    this.disconnect();
    this.rooms.clear();
    this.stateListeners = [];
    this.offlineQueue.clear();
  }

  emit(
    event: string,
    data?: any,
    callback?: (response: any) => void
  ): void {
    const performEmit = async () => {
      let finalData = data;
      if (this.config.eventValidator) {
        const isValid = await this.config.eventValidator(event, data, "emit");
        if (!isValid) {
          this.logger.warn(`Event emission validation failed for event "${event}". Payload blocked.`);
          return;
        }
      }
      if (this.config.eventTransformer) {
        finalData = await this.config.eventTransformer(event, data, "emit");
      }

      if (!this.socket?.connected) {
        this.logger.debug(`Socket not connected, queuing event: ${event}`);
        this.offlineQueue.add(event, finalData);
        return;
      }

      this.socket.emit(event, finalData, callback);
      this.metrics.totalEventsEmitted++;
      this.logger.info(`Emitted event: ${event}`, finalData);
    };

    performEmit().catch((err) => {
      this.logger.error("Emit preprocessing failed:", err);
    });
  }

  async emitWithAck(
    event: string,
    data?: any,
    timeout: number = 5000
  ): Promise<any> {
    let finalData = data;
    if (this.config.eventValidator) {
      const isValid = await this.config.eventValidator(event, data, "emit");
      if (!isValid) {
        this.logger.warn(`Event emission validation failed for event "${event}". Ack payload blocked.`);
        throw new Error(`Event validation failed for event "${event}"`);
      }
    }
    if (this.config.eventTransformer) {
      finalData = await this.config.eventTransformer(event, data, "emit");
    }

    if (!this.socket?.connected) {
      throw new ConnectionError("Socket is not connected");
    }

    this.logger.info(`Emitting event with acknowledgement: ${event}`, finalData);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new TimeoutError(`Event ${event} timeout after ${timeout}ms`));
      }, timeout);

      this.socket?.emit(event, finalData, (response: any) => {
        clearTimeout(timer);
        this.metrics.totalEventsEmitted++;
        resolve(response);
      });
    });
  }

  async joinRoom(room: string): Promise<void> {
    this.logger.info(`Joining room: ${room}`);
    if (!this.socket?.connected) {
      this.rooms.add(room);
      this.offlineQueue.add("join:room", { room });
      return;
    }

    return new Promise((resolve, reject) => {
      this.socket?.emit("join:room", { room }, (response: any) => {
        if (response?.error) {
          this.logger.error(`Failed to join room: ${room}`, response.error);
          reject(new RoomError(response.error));
        } else {
          this.rooms.add(room);
          this.logger.info(`Successfully joined room: ${room}`);
          resolve();
        }
      });
    });
  }

  async leaveRoom(room: string): Promise<void> {
    this.logger.info(`Leaving room: ${room}`);
    this.rooms.delete(room);

    if (!this.socket?.connected) {
      return;
    }

    return new Promise((resolve) => {
      this.socket?.emit("leave:room", { room }, () => {
        this.logger.info(`Successfully left room: ${room}`);
        resolve();
      });
    });
  }

  getRooms(): string[] {
    return Array.from(this.rooms);
  }

  isInRoom(room: string): boolean {
    return this.rooms.has(room);
  }

  on(event: string, handler: (data: any) => void): () => void {
    if (!this.socket) {
      return () => {}; // No-op on server
    }

    const wrappedHandler = async (data: any) => {
      this.metrics.totalEventsReceived++;
      this.logger.info(`Received event: ${event}`, data);

      let finalData = data;
      if (this.config.eventValidator) {
        try {
          const isValid = await this.config.eventValidator(event, data, "receive");
          if (!isValid) {
            this.logger.warn(`Event validation failed for incoming event "${event}". Ignored.`);
            return;
          }
        } catch (err) {
          this.logger.error(`Error validating incoming event "${event}":`, err);
          return;
        }
      }

      if (this.config.eventTransformer) {
        try {
          finalData = await this.config.eventTransformer(event, data, "receive");
        } catch (err) {
          this.logger.error(`Error transforming incoming event "${event}":`, err);
        }
      }

      handler(finalData);
    };

    this.wrappedHandlersMap.set(handler, wrappedHandler);
    this.socket.on(event, wrappedHandler);

    // Return unsubscribe function
    return () => {
      this.off(event, handler);
    };
  }

  off(event: string, handler?: (data: any) => void): void {
    if (this.socket) {
      if (handler) {
        const wrapped = this.wrappedHandlersMap.get(handler);
        if (wrapped) {
          this.socket.off(event, wrapped);
          this.wrappedHandlersMap.delete(handler);
        } else {
          this.socket.off(event, handler);
        }
      } else {
        this.socket.off(event);
      }
    }
  }

  once(event: string, handler: (data: any) => void): () => void {
    if (!this.socket) {
      return () => {};
    }

    const wrappedHandler = async (data: any) => {
      this.metrics.totalEventsReceived++;
      this.logger.info(`Received event (once): ${event}`, data);
      this.wrappedHandlersMap.delete(handler);

      let finalData = data;
      if (this.config.eventValidator) {
        try {
          const isValid = await this.config.eventValidator(event, data, "receive");
          if (!isValid) {
            this.logger.warn(`Event validation failed for incoming event (once) "${event}". Ignored.`);
            return;
          }
        } catch (err) {
          this.logger.error(`Error validating incoming event (once) "${event}":`, err);
          return;
        }
      }

      if (this.config.eventTransformer) {
        try {
          finalData = await this.config.eventTransformer(event, data, "receive");
        } catch (err) {
          this.logger.error(`Error transforming incoming event (once) "${event}":`, err);
        }
      }

      handler(finalData);
    };

    this.wrappedHandlersMap.set(handler, wrappedHandler);
    this.socket.once(event, wrappedHandler);

    return () => {
      this.off(event, handler);
    };
  }

  getQueueLength(): number {
    return this.offlineQueue.length();
  }

  clearQueue(): void {
    this.offlineQueue.clear();
  }

  async flushQueue(): Promise<void> {
    const messages = this.offlineQueue.flush();

    for (const message of messages) {
      try {
        if (message.event === "join:room") {
          await this.joinRoom(message.data.room);
        } else {
          this.emit(message.event, message.data);
        }
      } catch (error) {
        console.error(`Failed to flush message ${message.id}:`, error);
        // Re-queue on failure
        this.offlineQueue.add(message.event, message.data, message.room);
      }
    }
  }

  getMetrics(): RealtimeMetrics {
    const uptime = this.metrics.connectionStartTime
      ? Date.now() - this.metrics.connectionStartTime
      : 0;

    const avgLatency =
      this.metrics.eventLatencies.length > 0
        ? this.metrics.eventLatencies.reduce((a, b) => a + b, 0) /
          this.metrics.eventLatencies.length
        : 0;

    return {
      totalEventsEmitted: this.metrics.totalEventsEmitted,
      totalEventsReceived: this.metrics.totalEventsReceived,
      reconnectAttempts: this.metrics.reconnectAttempts,
      queuedMessages: this.offlineQueue.length(),
      uptime,
      averageLatency: avgLatency,
      connectionStartTime: this.metrics.connectionStartTime,
    };
  }

  // Internal state management
  onStateChange(listener: (state: ConnectionState) => void): () => void {
    this.stateListeners.push(listener);
    return () => {
      this.stateListeners = this.stateListeners.filter((l) => l !== listener);
    };
  }

  private emitStateChange(): void {
    const state: ConnectionState = {
      connected: this.isConnected,
      connecting: this.isConnecting,
      reconnecting: this.isReconnecting,
    };

    this.stateListeners.forEach((listener) => listener(state));
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on("connect", () => {
      this.logger.info("Socket connected successfully");
      this.isConnected = true;
      this.isConnecting = false;
      this.isReconnecting = false;
      this.metrics.connectionStartTime = Date.now();
      this.emitStateChange();
      if (this.config.hooks?.onConnect) {
        Promise.resolve(this.config.hooks.onConnect()).catch((err) => {
          this.logger.error("Hook onConnect failed:", err);
        });
      }
    });

    this.socket.on("disconnect", (reason) => {
      this.logger.info(`Socket disconnected. Reason: ${reason}`);
      this.isConnected = false;
      this.isConnecting = false;
      this.emitStateChange();
      if (this.config.hooks?.onDisconnect) {
        Promise.resolve(this.config.hooks.onDisconnect(reason)).catch((err) => {
          this.logger.error("Hook onDisconnect failed:", err);
        });
      }
    });

    this.socket.on("connect_error", (error) => {
      this.logger.error("Connection error occurred:", error);
      if (this.config.hooks?.onError) {
        Promise.resolve(this.config.hooks.onError(error)).catch((err) => {
          this.logger.error("Hook onError failed:", err);
        });
      }
    });

    this.socket.on("reconnect_attempt", (attempt) => {
      this.logger.info(`Attempting to reconnect (attempt #${attempt})`);
      this.isReconnecting = true;
      this.metrics.reconnectAttempts++;
      this.emitStateChange();
    });

    this.socket.on("reconnect", (attempt) => {
      this.logger.info(`Socket reconnected successfully on attempt #${attempt}`);
      this.isConnected = true;
      this.isReconnecting = false;
      this.metrics.connectionStartTime = Date.now();
      this.emitStateChange();
      if (this.config.hooks?.onConnect) {
        Promise.resolve(this.config.hooks.onConnect()).catch((err) => {
          this.logger.error("Hook onConnect failed:", err);
        });
      }
    });
  }

  private async buildAuthData(): Promise<Record<string, any>> {
    if (!this.config.auth) {
      return {};
    }

    const { token, scheme = "Bearer", getToken, authFactory } = this.config
      .auth;

    // Priority: authFactory > getToken > token
    if (authFactory) {
      try {
        return await authFactory();
      } catch (error) {
        console.error("Auth factory failed:", error);
        return {};
      }
    }

    if (getToken) {
      try {
        const authToken = await getToken();
        if (authToken) {
          return { token: authToken, scheme };
        }
      } catch (error) {
        console.error("Get token failed:", error);
      }
    }

    if (token) {
      return { token, scheme };
    }

    return {};
  }
}
