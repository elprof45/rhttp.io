import type { HttpClientInstance, HttpRequestOptions } from "./types";

type HttpMethod = "POST" | "PUT" | "PATCH" | "DELETE";
type QueryKeyPart =
  | string
  | number
  | boolean
  | Record<string, unknown>
  | null
  | undefined;
type QueryKey = ReadonlyArray<QueryKeyPart>;

export type QueryRetryOption<TError = unknown> =
  | HttpRequestOptions["retry"]
  | number
  | ((failureCount: number, error: TError) => boolean);

export interface ReactQueryConfig<
  TData = unknown,
  TError = unknown,
> extends Omit<
  HttpRequestOptions,
  "params" | "headers" | "body" | "transformer" | "validateResponse" | "retry"
> {
  url: string;
  params?: Record<string, unknown>;
  headers?: Record<string, string>;
  enabled?: boolean;
  staleTime?: number;
  gcTime?: number;
  retry?: HttpRequestOptions["retry"] | QueryRetryOption<TError>;
  placeholderData?: TData | ((previousData: TData | undefined) => TData);
  initialData?: TData | (() => TData);
  refetchOnWindowFocus?: boolean;
  refetchOnReconnect?: boolean;
  refetchInterval?: number | false;
  select?: (data: unknown) => TData;
  meta?: Record<string, unknown>;
  structuralSharing?:
    | boolean
    | ((oldData: TData | undefined, newData: TData) => TData);
  throwOnError?: boolean | ((error: TError) => boolean);
  networkMode?: "online" | "always" | "offlineFirst";
}

export interface ReactQueryResult<TData = unknown, TError = unknown> {
  queryKey: QueryKey;
  queryFn: () => Promise<TData>;
  enabled?: boolean;
  staleTime?: number;
  gcTime?: number;
  retry?: HttpRequestOptions["retry"] | QueryRetryOption<TError>;
  placeholderData?: TData | ((previousData: TData | undefined) => TData);
  initialData?: TData | (() => TData);
  refetchOnWindowFocus?: boolean;
  refetchOnReconnect?: boolean;
  refetchInterval?: number | false;
  select?: (data: unknown) => TData;
  meta?: Record<string, unknown>;
  structuralSharing?:
    | boolean
    | ((oldData: TData | undefined, newData: TData) => TData);
  throwOnError?: boolean | ((error: TError) => boolean);
  networkMode?: "online" | "always" | "offlineFirst";
}

export interface ReactMutationConfig<
  TVariables = unknown,
  TData = unknown,
  TError = unknown,
> extends Omit<
  HttpRequestOptions,
  "params" | "headers" | "body" | "transformer" | "validateResponse" | "retry"
> {
  method: HttpMethod;
  url: string | ((variables: TVariables) => string);
  body?: unknown | ((variables: TVariables) => unknown);
  params?:
    | Record<string, unknown>
    | ((variables: TVariables) => Record<string, unknown>);
  headers?:
    | Record<string, string>
    | ((variables: TVariables) => Record<string, string>);
  retry?: HttpRequestOptions["retry"];
  onSuccess?: (data: TData, variables: TVariables) => void | Promise<void>;
  onError?: (error: TError, variables: TVariables) => void | Promise<void>;
  onSettled?: (
    data: TData | undefined,
    error: TError | null,
    variables: TVariables,
  ) => void | Promise<void>;
  meta?: Record<string, unknown>;
}

export interface ReactMutationResult<
  TData = unknown,
  TVariables = unknown,
  TError = unknown,
> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  onSuccess?: (data: TData, variables: TVariables) => void | Promise<void>;
  onError?: (error: TError, variables: TVariables) => void | Promise<void>;
  onSettled?: (
    data: TData | undefined,
    error: TError | null,
    variables: TVariables,
  ) => void | Promise<void>;
  meta?: Record<string, unknown>;
}

export interface ReactHttpClientInstance extends HttpClientInstance {
  /**
   * Create a TanStack Query-compatible queryKey and queryFn for GET requests.
   */
  query<TData = unknown, TError = unknown>(
    config: ReactQueryConfig<TData, TError>,
  ): ReactQueryResult<TData, TError>;

  /**
   * Create a TanStack Query-compatible mutationFn for POST/PUT/PATCH/DELETE requests.
   */
  mutation<TVariables = unknown, TData = unknown, TError = unknown>(
    config: ReactMutationConfig<TVariables, TData, TError>,
  ): ReactMutationResult<TData, TVariables, TError>;
}

export function withReact(
  httpClient: HttpClientInstance,
): ReactHttpClientInstance {
  const normalizeQueryRetry = <TError = unknown>(
    retryOption: QueryRetryOption<TError> | undefined,
  ): HttpRequestOptions["retry"] | undefined => {
    if (retryOption === undefined) {
      return undefined;
    }

    if (typeof retryOption === "boolean" || typeof retryOption === "object") {
      return retryOption;
    }

    if (typeof retryOption === "number") {
      return { attempts: retryOption };
    }

    return {
      shouldRetry: (error: unknown, attemptNumber: number) =>
        retryOption(attemptNumber, error as TError),
    };
  };

  const query = <TData = unknown, TError = unknown>(
    config: ReactQueryConfig<TData, TError>,
  ): ReactQueryResult<TData, TError> => {
    const {
      url,
      params,
      select,
      enabled,
      staleTime,
      gcTime,
      retry,
      placeholderData,
      initialData,
      refetchOnWindowFocus,
      refetchOnReconnect,
      refetchInterval,
      structuralSharing,
      throwOnError,
      networkMode,
      meta,
      ...requestOptions
    } = config;

    const resolvedParams = params ?? {};
    const normalizedRetry = normalizeQueryRetry(retry);

    return {
      queryKey: [url, resolvedParams] as QueryKey,
      queryFn: async () => {
        const response = await httpClient.get<unknown>(url, {
          ...requestOptions,
          params: resolvedParams,
          retry: normalizedRetry,
        });
        const payload = response.data;
        return select ? select(payload) : (payload as TData);
      },
      enabled,
      staleTime,
      gcTime,
      retry,
      placeholderData,
      initialData,
      refetchOnWindowFocus,
      refetchOnReconnect,
      refetchInterval,
      select,
      meta,
      structuralSharing,
      throwOnError,
      networkMode,
    };
  };

  const mutation = <TVariables = unknown, TData = unknown, TError = unknown>(
    config: ReactMutationConfig<TVariables, TData, TError>,
  ): ReactMutationResult<TData, TVariables, TError> => {
    const {
      method,
      url: urlOrFn,
      body,
      params,
      headers,
      retry,
      onSuccess,
      onError,
      onSettled,
      meta,
      ...requestOptions
    } = config;

    return {
      mutationFn: async (variables: TVariables) => {
        const url =
          typeof urlOrFn === "function" ? urlOrFn(variables) : urlOrFn;
        const resolvedBody =
          typeof body === "function" ? body(variables) : (body ?? variables);
        const resolvedParams =
          typeof params === "function" ? params(variables) : params;
        const resolvedHeaders =
          typeof headers === "function" ? headers(variables) : headers;

        const { cache: _cache, ...transportOptions } = requestOptions;

        const response = await httpClient.customFetch<TData>(url, {
          ...transportOptions,
          method,
          body: resolvedBody,
          params: resolvedParams,
          headers: resolvedHeaders,
          retry,
        });

        return response.data;
      },
      onSuccess,
      onError,
      onSettled,
      meta,
    };
  };

  return {
    ...httpClient,
    query,
    mutation,
  } as ReactHttpClientInstance;
}

export * from "./core";
export * from "./types";
export * from "./errors";
export {
  buildUrl,
  getCookie,
  parseHeaders,
  parseResponse,
  generateRequestId,
} from "./utils";
