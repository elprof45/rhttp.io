/**
 * Custom errors for realtime client
 */

export class RealtimeError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = "RealtimeError";
  }
}

export class ConnectionError extends RealtimeError {
  constructor(message: string) {
    super(message, "CONNECTION_ERROR");
    this.name = "ConnectionError";
  }
}

export class AuthenticationError extends RealtimeError {
  constructor(message: string) {
    super(message, "AUTHENTICATION_ERROR");
    this.name = "AuthenticationError";
  }
}

export class CsrfError extends RealtimeError {
  constructor(message: string) {
    super(message, "CSRF_ERROR");
    this.name = "CsrfError";
  }
}

export class RoomError extends RealtimeError {
  constructor(message: string) {
    super(message, "ROOM_ERROR");
    this.name = "RoomError";
  }
}

export class TimeoutError extends RealtimeError {
  constructor(message: string) {
    super(message, "TIMEOUT_ERROR");
    this.name = "TimeoutError";
  }
}
