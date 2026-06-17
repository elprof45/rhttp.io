import type { HttpClientInstance } from "./types";

export interface ReactHttpClientInstance extends HttpClientInstance {
  /**
   * Create a TanStack Query-compatible queryKey and queryFn for GET requests
   */
  query<T = any, E = unknown>(config: {
    url: string;
    params?: Record<string, any>;
    headers?: Record<string, string>;
    timeout?: number;
    cache?: boolean;
    retry?: any;
  }): {
    queryKey: (string | Record<string, any>)[];
    queryFn: () => Promise<T>;
  };

  /**
   * Create a TanStack Query-compatible mutationFn for POST/PUT/PATCH/DELETE requests
   */
  mutation<B = any, T = any, E = unknown>(config: {
    method: "POST" | "PUT" | "PATCH" | "DELETE";
    url: string | ((variables: B) => string);
  }): {
    mutationFn: (variables: B) => Promise<T>;
  };
}

export function withReact(httpClient: HttpClientInstance): ReactHttpClientInstance {
  return {
    ...httpClient,

    query(config) {
      const { url, params, ...requestOptions } = config;
      return {
        queryKey: [url, params || {}],
        queryFn: async () => {
          const response = await httpClient.get(url, {
            ...requestOptions,
            params,
          });
          return response.data;
        },
      };
    },

    mutation(config) {
      const { method, url: urlOrFn } = config;
      return {
        mutationFn: async (variables: any) => {
          const url = typeof urlOrFn === "function" ? urlOrFn(variables) : urlOrFn;
          
          let response: any;
          switch (method.toUpperCase()) {
            case "POST":
              response = await httpClient.post(url, variables);
              break;
            case "PUT":
              response = await httpClient.put(url, variables);
              break;
            case "PATCH":
              response = await httpClient.patch(url, variables);
              break;
            case "DELETE":
              response = await httpClient.delete(url, variables);
              break;
            default:
              throw new Error(`Unknown method: ${method}`);
          }
          
          return response.data;
        },
      };
    },
  } as ReactHttpClientInstance;
}

export * from "./core";
export * from "./types";
export * from "./errors";
export { buildUrl, getCookie, parseHeaders, parseResponse, generateRequestId } from "./utils";
