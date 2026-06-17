/**
 * @http-io/socket.io.client
 * Realtime WebSocket Client with SSR Support
 */

export interface CsrfConfig {
  enabled: boolean;
  fetchEndpoint: string;
  headerName?: string;
  cookieName?: string;
  fetchOptions?: RequestInit;
}

export interface AuthConfig {
  token?: string;
  scheme?: string;
  getToken?: () => Promise<string | null>;
  authFactory?: () => Promise<Record<string, any>>;
}

export interface OfflineQueueConfig {
  enabled: boolean;
  maxSize?: number;
  storageKey?: string;
}

export interface RoomConfig {
  autoRejoin?: boolean;
  autoJoin?: string[];
}

export interface RealtimeClientConfig {
  // Socket.io connection URL
  socketUrl: string;

  // Enable credentials (cookies)
  withCredentials?: boolean;

  // Custom headers
  extraHeaders?: Record<string, string>;

  // Authentication configuration
  auth?: AuthConfig;

  // CSRF protection
  csrf?: CsrfConfig;

  // Room management
  rooms?: RoomConfig;

  // Offline queue
  offlineQueue?: OfflineQueueConfig;

  // Reconnection settings
  reconnection?: boolean;
  reconnectionDelay?: number;
  reconnectionDelayMax?: number;
  reconnectionAttempts?: number;

  // Transport priorities
  transports?: string[];

  // Socket.io client options (advanced)
  socketOptions?: Record<string, any>;

  // Logger configuration
  logger?: boolean | any;

  // Event validator/schema checker
  eventValidator?: (event: string, data: any, direction: "emit" | "receive") => boolean | Promise<boolean>;

  // Event transformer
  eventTransformer?: (event: string, data: any, direction: "emit" | "receive") => any | Promise<any>;

  // Lifecycle hooks
  hooks?: {
    onConnect?: () => void | Promise<void>;
    onDisconnect?: (reason: string) => void | Promise<void>;
    onError?: (error: any) => void | Promise<void>;
  };
}

export interface RealtimeClientInstance {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;

  // Core methods
  connect(): Promise<void>;
  disconnect(): void;
  destroy(): void;

  // Event emission
  emit(event: string, data?: any, callback?: (response: any) => void): void;
  emitWithAck(event: string, data?: any, timeout?: number): Promise<any>;

  // Room management
  joinRoom(room: string): Promise<void>;
  leaveRoom(room: string): Promise<void>;
  getRooms(): string[];
  isInRoom(room: string): boolean;

  // Event listeners
  on(event: string, handler: (data: any) => void): () => void;
  off(event: string, handler?: (data: any) => void): void;
  once(event: string, handler: (data: any) => void): () => void;

  // Offline queue
  getQueueLength(): number;
  clearQueue(): void;
  flushQueue(): Promise<void>;

  // State subscription
  onStateChange(handler: (state: ConnectionState) => void): () => void;

  // Debugging
  getMetrics(): RealtimeMetrics;
}

export interface RealtimeMetrics {
  totalEventsEmitted: number;
  totalEventsReceived: number;
  reconnectAttempts: number;
  queuedMessages: number;
  uptime: number;
  averageLatency: number;
  connectionStartTime: number | null;
}

export interface OfflineMessage {
  id: string;
  event: string;
  data: any;
  timestamp: number;
  room?: string;
}

export interface ConnectionState {
  connected: boolean;
  connecting: boolean;
  reconnecting: boolean;
}

export interface RealtimeContextValue {
  client: RealtimeClientInstance | null;
  connectionState: ConnectionState;
  isReady: boolean;
}

export type SocketEventHandler = (data: any) => void;
export type SocketEventUnsubscribe = () => void;
