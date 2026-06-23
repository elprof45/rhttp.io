export interface RetryConfig {
  /**
   * Nombre de tentatives supplémentaires après l'échec initial.
   * Total: 1 tentative initiale + N tentatives = N+1 requêtes.
   */
  attempts: number;

  /**
   * Stratégie de progression du délai entre les tentatives.
   */
  strategy: "none" | "linear" | "exponential";

  /**
   * Délai initial avant la première tentative (en millisecondes).
   */
  delay: number;

  /**
   * Délai maximum entre deux tentatives.
   */
  maxDelay: number;

  /**
   * Codes HTTP qui déclenchent automatiquement un retry.
   */
  statusCodes: number[];

  /**
   * Fonction personnalisée pour décider du retry.
   */
  shouldRetry?: (
    error: unknown,
    attemptNumber: number,
  ) => Promise<boolean> | boolean;
}

export interface CacheConfig {
  /**
   * Active/désactive le cache globalement.
   */
  enabled: boolean;

  /**
   * Durée de vie des entrées en cache (Time To Live, en ms).
   */
  ttl: number;

  /**
   * Stratégie de cache globale.
   * - network-first: essaie le réseau, retombe sur le cache si échec
   * - cache-first: utilise le cache si disponible et frais, sinon réseau
   * - stale-while-revalidate: retourne le cache (même périmé) et revalide en arrière-plan
   * - cache-only: utilise uniquement le cache
   * - network-only: utilise uniquement le réseau
   */
  strategy?: CacheStrategy;

  /**
   * Fonction personnalisée pour générer la clé de cache.
   */
  keyBuilder?: (url: string, options: any) => string;
}

export interface CsrfConfig {
  /**
   * Active/désactive la protection CSRF.
   * Par défaut: false (pas de protection CSRF sauf si explicitement activé)
   */
  enabled: boolean;

  /**
   * Endpoint pour obtenir le token CSRF (requête GET).
   */
  fetchEndpoint: string;

  /**
   * Nom du cookie dans lequel le token CSRF est stocké côté client.
   */
  cookieName: string;

  /**
   * En-tête HTTP pour envoyer le token avec chaque mutation.
   */
  headerName: string;

  /**
   * Méthodes HTTP pour lesquelles le token est obligatoire.
   * Par défaut: ["POST", "PUT", "PATCH", "DELETE"]
   */
  methods: string[];

  /**
   * Pré-charger le token CSRF au démarrage de l'application.
   * Utile pour les Client Components avec CSRF activé.
   */
  prefetch: boolean;
}

export interface CustomLogger {
  debug: (...args: any[]) => void;
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
}

export interface ObservabilityConfig {
  /**
   * Logger intégré ou personnalisé.
   * - true: utilise console.log/warn/error
   * - false: pas de logs
   * - logger personnalisé: { debug(), info(), warn(), error() }
   */
  logger: boolean | CustomLogger;

  /**
   * Ajoute un requestId unique à chaque requête pour le tracing.
   */
  tracing: boolean;

  /**
   * Collecte des métriques: durée, statuts, tailles.
   */
  metrics: boolean;
}

export interface AuthConfig {
  /**
   * Forward cookies from incoming request to outgoing API calls (SSR only).
   *
   * Cookies are forwarded via priority order:
   * 1. requestContext (TanStack Start recommended, auto-detected)
   * 2. auth.forwardCookies interceptor (fallback)
   * 3. Explicit cookie header manipulation (manual)
   *
   * IMPORTANT: HttpOnly cookies set by server (via Set-Cookie) are automatically
   * included in fetch() with credentials: 'include'. This option handles forwarding
   * cookies from the incoming SSR request to outgoing API calls, which is separate.
   *
   * @example
   * ```typescript
   * // In TanStack Start or Next.js (auto-detected)
   * const http = createServerHttp({ auth: { forwardCookies: true } });
   * // Cookies from request context automatically forwarded
   *
   * // In custom SSR (manual)
   * const http = createServerHttp({
   *   auth: { forwardCookies: true },
   *   requestContext: () => getActiveRequest(),
   * });
   * ```
   */
  forwardCookies: boolean;

  /**
   * Static authentication token (e.g., service-to-service calls).
   * Used if provided; otherwise getToken() is called per-request.
   *
   * Token Priority:
   * 1. HttpOnly cookies (Set-Cookie from server) → RECOMMENDED, automatic with fetch
   * 2. Token storage (localStorage, sessionStorage, or token storage impl)
   * 3. accessToken (static token, use for service-to-service)
   * 4. getToken() (dynamic function, use for user sessions)
   *
   * @example
   * ```typescript
   * // Static service token
   * createHttp({ auth: { accessToken: process.env.API_KEY } })
   *
   * // Dynamic token from browser storage
   * createClientHttp({ auth: { getToken: () => localStorage.getItem('token') } })
   *
   * // Token refresh with automatic retry
   * createHttp({ auth: { getToken: refreshableToken } })
   * ```
   */
  accessToken?: string;

  /**
   * Authentication scheme used in Authorization header.
   * Common values: "Bearer", "Basic", "ApiKey", "AWS4-HMAC-SHA256"
   * Default: "Bearer"
   */
  scheme: string;

  /**
   * Dynamic token retrieval function called for each request.
   * Called only if accessToken is undefined.
   * Can read from localStorage (client), process.env (server), or refresh endpoints.
   *
   * Priority order for token sources (checked in this order):
   * 1. HttpOnly cookies (automatic, most secure)
   * 2. getToken() callback (your implementation)
   * 3. accessToken static value (fallback)
   *
   * @returns Token string, null if no auth, or Promise if async (e.g., refresh)
   *
   * @example
   * ```typescript
   * // Read from localStorage
   * getToken: () => localStorage.getItem('token')
   *
   * // Read from async storage
   * getToken: async () => {
   *   const stored = await tokenStorage.get();
   *   if (!stored || isExpired(stored)) {
   *     return await refreshToken();
   *   }
   *   return stored;
   * }
   * ```
   */
  getToken?: () => Promise<string | null> | string | null;
}

export interface CreateHttpConfig {
  /**
   * URL de base pour toutes les requêtes (absolute ou relative).
   */
  baseURL?: string;

  /**
   * En-têtes HTTP envoyés automatiquement avec chaque requête.
   */
  defaultHeaders?: Record<string, string>;

  /**
   * Options fetch() natives à appliquer globalement.
   */
  defaultFetchOptions?: RequestInit;

  /**
   * Timeout global par défaut (en millisecondes).
   */
  timeout?: number;

  /**
   * Configuration du retry automatique.
   */
  retry?: Partial<RetryConfig>;

  /**
   * Configuration du cache en mémoire.
   */
  cache?: Partial<CacheConfig>;

  /**
   * Configuration de la protection CSRF.
   */
  csrf?: Partial<CsrfConfig>;

  /**
   * Configuration de l'observabilité.
   */
  observability?: Partial<ObservabilityConfig>;

  /**
   * Configuration de l'authentification.
   */
  auth?: Partial<AuthConfig>;

  /**
   * Contexte spécifique à TanStack Start (SSR) ou autre framework serveur.
   */
  requestContext?: () => any;

  /**
   * Implémentation personnalisée de fetch().
   */
  fetch?: typeof globalThis.fetch;

  /**
   * Configuration avancée: Circuit Breaker
   */
  circuitBreaker?: Partial<CircuitBreakerConfig>;

  /**
   * Configuration avancée: Request Pooling
   */
  requestPool?: Partial<RequestPoolConfig>;

  /**
   * Configuration avancée: ETag support
   */
  etag?: Partial<ETagConfig>;

  /**
   * Hooks globaux de cycle de vie
   */
  hooks?: RequestHooks;

  /**
   * Plugins extensibles
   */
  plugins?: PluginConfig[];

  /**
   * Validateur global de requête
   */
  requestValidator?: RequestValidator;

  /**
   * Transformateur global de réponse
   */
  responseTransformer?: ResponseTransformer;
}

export interface HttpRequestOptions extends Omit<
  RequestInit,
  "headers" | "cache"
> {
  /**
   * Paramètres de query (sérialisés automatiquement).
   */
  params?: Record<string, any>;

  /**
   * En-têtes HTTP personnalisés.
   */
  headers?: Record<string, string>;

  /**
   * Override de la configuration de cache pour cette requête.
   */
  cache?: boolean | Partial<CacheConfig> | { strategy?: CacheStrategy };

  /**
   * Override de la configuration de retry pour cette requête.
   */
  retry?: boolean | Partial<RetryConfig>;

  /**
   * Override du timeout (en millisecondes).
   */
  timeout?: number;

  /**
   * Active ou désactive la déduplication des requêtes concurrentes.
   */
  deduplicate?: boolean;

  /**
   * Active ou désactive la protection CSRF pour cette requête.
   */
  csrf?: boolean;

  /**
   * Identifiant unique de requête personnalisé (optionnel).
   */
  requestId?: string;

  /**
   * Hooks de cycle de vie pour cette requête.
   */
  hooks?: RequestHooks;

  /**
   * Stratégie de cache avancée pour cette requête.
   */
  cacheStrategy?: CacheStrategy;

  /**
   * Transformateur de réponse personnalisé.
   */
  transformer?: (data: any, response: HttpResponse<any>) => any;

  /**
   * Configuration de polling pour le polling automatique.
   */
  polling?: Partial<PollingConfig>;

  /**
   * Valide la réponse avant de la retourner.
   */
  validateResponse?: (data: any) => boolean;
}

export interface HttpResponse<T> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  response: Response;
  requestId: string;
  durationMs: number;
}

export interface InterceptorHandler<T> {
  id: number;
  eject: () => void;
}

export interface InterceptorManager<T> {
  use: (
    onFulfilled: (value: T) => Promise<T> | T,
    onRejected?: (error: any) => Promise<any> | any,
  ) => InterceptorHandler<T>;
  eject: (id: number) => void;
  clear: () => void;
}

export interface HttpMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  durations: number[];
  statusCodes: Record<number, number>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Advanced Features Types
// ─────────────────────────────────────────────────────────────────────────────

export type CacheStrategy =
  | "cache-only"
  | "network-first"
  | "cache-first"
  | "stale-while-revalidate"
  | "network-only";

/**
 * Lifecycle hooks with rich context for request/response cycle
 *
 * Hooks are executed in this order:
 * 1. onRequest - before request is sent
 * 2. (network call)
 * 3. onRetry (if applicable) - before each retry
 * 4. onSuccess - on successful response
 * 5. onError - on error (before retry decision)
 * 6. onFinally - always, after all retries exhausted
 */
export interface RequestHooks {
  /**
   * Called before the request is sent
   * Can be used to log, modify options, or validate
   * Return false to abort the request
   */
  onRequest?: (context: {
    url: string;
    method: string;
    options: any;
    requestId: string;
    timestamp: number;
  }) => boolean | void | Promise<boolean | void>;

  /**
   * Called on successful response (any 2xx status)
   * Can be used to log, transform data, or trigger side effects
   */
  onSuccess?: (context: {
    url: string;
    method: string;
    status: number;
    response: HttpResponse<any>;
    durationMs: number;
    requestId: string;
    isCached: boolean;
    timestamp: number;
  }) => void | Promise<void>;

  /**
   * Called on error (network error, non-2xx status, validation error)
   * Called BEFORE retry decision, so can influence retry behavior
   * Throw to prevent retries
   */
  onError?: (context: {
    url: string;
    method: string;
    error: any;
    status?: number;
    attemptNumber: number;
    durationMs: number;
    requestId: string;
    willRetry: boolean;
    timestamp: number;
  }) => void | Promise<void>;

  /**
   * Called before each retry attempt (if applicable)
   * Can be used to log retry attempts or modify retry strategy
   */
  onRetry?: (context: {
    url: string;
    method: string;
    attemptNumber: number;
    totalAttempts: number;
    delayMs: number;
    reason: string;
    requestId: string;
    timestamp: number;
  }) => void | Promise<void>;

  /**
   * Called after all requests are done (success or exhausted retries)
   * Always called, useful for cleanup
   */
  onFinally?: (context: {
    url: string;
    method: string;
    success: boolean;
    totalAttempts: number;
    totalDurationMs: number;
    requestId: string;
    timestamp: number;
  }) => void | Promise<void>;
}

export interface CircuitBreakerConfig {
  enabled: boolean;
  failureThreshold: number; // Number of failures before opening
  successThreshold: number; // Number of successes before closing
  timeout: number; // Time in ms before half-open
}

export interface RequestPoolConfig {
  enabled: boolean;
  maxConcurrent: number; // Max concurrent requests
  queueLimit?: number; // Max queue size
}

export interface PollingConfig {
  interval: number; // Poll interval in ms
  maxAttempts?: number; // Max polls before stopping
  stopCondition?: (result: any) => boolean; // Stop when condition true
}

export interface ETagConfig {
  enabled: boolean;
  storage?: "memory" | "localStorage"; // Where to store ETags
}

export type ResponseTransformer = (
  data: any,
  response: HttpResponse<any>,
) => any;

export type RequestValidator = (
  url: string,
  options: any,
) => boolean | Promise<boolean>;

export interface PluginConfig {
  name: string;
  beforeRequest?: (url: string, options: any) => any;
  afterResponse?: (response: HttpResponse<any>) => any;
  onError?: (error: any) => any;
}

export interface HttpClientInstance {
  config: CreateHttpConfig;
  interceptors: {
    request: InterceptorManager<
      HttpRequestOptions & { url: string; method: string; body?: any }
    >;
    response: InterceptorManager<HttpResponse<any>>;
  };

  get<T = any>(
    url: string,
    options?: HttpRequestOptions,
  ): Promise<HttpResponse<T>>;

  post<T = any>(
    url: string,
    body?: any,
    options?: HttpRequestOptions,
  ): Promise<HttpResponse<T>>;
  post<B = any, T = any>(
    url: string,
    body: B,
    options?: HttpRequestOptions,
  ): Promise<HttpResponse<T>>;

  put<T = any>(
    url: string,
    body?: any,
    options?: HttpRequestOptions,
  ): Promise<HttpResponse<T>>;
  put<B = any, T = any>(
    url: string,
    body: B,
    options?: HttpRequestOptions,
  ): Promise<HttpResponse<T>>;

  patch<T = any>(
    url: string,
    body?: any,
    options?: HttpRequestOptions,
  ): Promise<HttpResponse<T>>;
  patch<B = any, T = any>(
    url: string,
    body: B,
    options?: HttpRequestOptions,
  ): Promise<HttpResponse<T>>;

  delete<T = any>(
    url: string,
    options?: HttpRequestOptions,
  ): Promise<HttpResponse<T>>;
  delete<B = any, T = any>(
    url: string,
    body: B,
    options?: HttpRequestOptions,
  ): Promise<HttpResponse<T>>;

  customFetch<T = any>(
    url: string,
    options?: RequestInit & HttpRequestOptions,
  ): Promise<HttpResponse<T>>;

  batchRequests<T extends ReadonlyArray<() => Promise<HttpResponse<any>>>>(
    requests: T,
  ): Promise<{
    -readonly [K in keyof T]: T[K] extends () => Promise<HttpResponse<infer R>>
      ? HttpResponse<R>
      : any;
  }>;

  invalidateCache(urlPattern: string): void;
  clearCache(): void;
  getMetrics(): HttpMetrics;

  /**
   * Permet d'encapsuler l'exécution d'appels serveur (ex: SSR) avec une requête source.
   */
  withRequest<R>(request: any, callback: () => Promise<R> | R): Promise<R>;

  /**
   * Polling avec intervalle et conditions d'arrêt
   */
  poll<T = any>(
    url: string,
    options?: HttpRequestOptions & { polling?: Partial<PollingConfig> },
  ): Promise<HttpResponse<T>>;

  /**
   * Annuler les requêtes en cours
   */
  cancel(requestId?: string): void;

  /**
   * Récupérer l'historique des requêtes
   */
  getHistory(): Array<{
    requestId: string;
    url: string;
    method: string;
    status: number;
    durationMs: number;
    timestamp: number;
  }>;

  /**
   * Enregistrer un plugin
   */
  use(plugin: PluginConfig): void;

  /**
   * Obtenir le statut du circuit breaker
   */
  getCircuitBreakerStatus(): {
    state: "closed" | "open" | "half-open";
    failures: number;
    successes: number;
  };

  /**
   * Réinitialiser le circuit breaker
   */
  resetCircuitBreaker(): void;

  getCircuitBreaker?(): any;
  getPoolStats?(): { activeRequests: number; queueLength: number };
}
