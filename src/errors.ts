export class HttpError extends Error {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
  requestId: string;
  durationMs: number;
  url: string;
  options?: any;

  constructor(message: string, params: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    data: any;
    requestId: string;
    durationMs: number;
    url: string;
    options?: any;
  }) {
    super(message);
    this.name = "HttpError";
    this.status = params.status;
    this.statusText = params.statusText;
    this.headers = params.headers;
    this.data = params.data;
    this.requestId = params.requestId;
    this.durationMs = params.durationMs;
    this.url = params.url;
    this.options = params.options;
    
    // Ensure proper prototype chain for ES5/TS compilation targets
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class TimeoutError extends HttpError {
  constructor(message: string, params: {
    requestId: string;
    durationMs: number;
    url: string;
    headers?: Record<string, string>;
  }) {
    super(message, {
      status: 408,
      statusText: "Request Timeout",
      headers: params.headers || {},
      data: null,
      requestId: params.requestId,
      durationMs: params.durationMs,
      url: params.url,
    });
    this.name = "TimeoutError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NetworkError extends HttpError {
  originalError?: any;

  constructor(message: string, params: {
    requestId: string;
    durationMs: number;
    url: string;
    headers?: Record<string, string>;
    originalError?: any;
  }) {
    super(message, {
      status: 0,
      statusText: "Network Error",
      headers: params.headers || {},
      data: null,
      requestId: params.requestId,
      durationMs: params.durationMs,
      url: params.url,
    });
    this.name = "NetworkError";
    this.originalError = params.originalError;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
