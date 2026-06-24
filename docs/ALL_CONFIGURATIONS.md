# rhttp.io - Complete Configuration Guide

Documentation complète de toutes les configurations pour les 4 entry points principaux.

---

## Table des matières

1. [createHttp()](#createhttp---client-universel)
2. [createClientHttp()](#createclienthttp---client-navigateur)
3. [createServerHttp()](#createserverhttp---client-serveur)
4. [createRealtimeClient()](#createrealtimeclient---websocket)

---

## createHttp() - Client Universel

Le client isomorphe core, utilisable dans n'importe quel environnement.

### Signature

```typescript
createHttp(config?: CreateHttpConfig): HttpClientInstance
```

### Configuration Complète

```typescript
interface CreateHttpConfig {
  // ========== BASE & DEFAULTS ==========

  /**
   * URL de base pour toutes les requêtes.
   * - Absolute: "https://api.example.com"
   * - Relative: "/api" (résolu à partir du domaine courant)
   *
   * @example
   * baseURL: "https://api.example.com"
   * await http.get("/users") → GET https://api.example.com/users
   */
  baseURL?: string;

  /**
   * En-têtes HTTP par défaut envoyés avec chaque requête.
   * Surchargeable par requête via options.headers
   *
   * @example
   * defaultHeaders: {
   *   "X-API-Version": "2",
   *   "X-Client-ID": "mobile-app"
   * }
   */
  defaultHeaders?: Record<string, string>;

  /**
   * Options fetch() natives appliquées globalement.
   * Fusionnées avec les options par requête.
   *
   * @example
   * defaultFetchOptions: {
   *   credentials: "include",
   *   headers: { "X-Custom": "value" }
   * }
   */
  defaultFetchOptions?: RequestInit;

  /**
   * Timeout global par défaut (en millisecondes).
   * 0 = sans timeout.
   * Surchargeable par requête.
   *
   * @example
   * timeout: 30000 // 30 secondes
   *
   * // Override par requête:
   * await http.get("/slow-endpoint", { timeout: 60000 })
   */
  timeout?: number;

  // ========== RETRY CONFIGURATION ==========

  /**
   * Configuration du retry automatique.
   */
  retry?: {
    /**
     * Nombre de tentatives supplémentaires.
     * Total = 1 tentative initiale + N tentatives.
     *
     * @example
     * attempts: 2 → 3 requêtes totales (1 initiale + 2 retries)
     */
    attempts?: number;

    /**
     * Stratégie de progression du délai.
     *
     * Options:
     * - "none": Pas de délai entre les tentatives (immédiat)
     * - "linear": délai × tentative (300ms, 600ms, 900ms)
     * - "exponential": délai × 2^tentative (300ms, 600ms, 1200ms)
     */
    strategy?: "none" | "linear" | "exponential";

    /**
     * Délai initial avant la première tentative.
     *
     * @example
     * delay: 300 // 300ms pour la première tentative
     */
    delay?: number;

    /**
     * Délai maximum entre deux tentatives.
     * Empêche les délais de devenir trop importants.
     *
     * @example
     * maxDelay: 30000 // Cap à 30 secondes
     */
    maxDelay?: number;

    /**
     * Codes HTTP qui déclenchent automatiquement un retry.
     *
     * Défaut: [408, 429, 500, 502, 503, 504]
     * - 408: Request Timeout
     * - 429: Too Many Requests (rate limiting)
     * - 500: Internal Server Error
     * - 502: Bad Gateway
     * - 503: Service Unavailable
     * - 504: Gateway Timeout
     *
     * @example
     * statusCodes: [408, 429, 500, 502, 503, 504, 429]
     */
    statusCodes?: number[];

    /**
     * Fonction personnalisée pour décider du retry.
     * Appelée avant chaque retry.
     *
     * @example
     * shouldRetry: async (error, attemptNumber) => {
     *   if (error.status === 401) return false; // Ne pas retry les 401
     *   if (attemptNumber >= 3) return false; // Max 3 tentatives
     *   return true; // Sinon, retry
     * }
     */
    shouldRetry?: (
      error: unknown,
      attemptNumber: number,
    ) => Promise<boolean> | boolean;
  };

  // ========== CACHE CONFIGURATION ==========

  /**
   * Configuration du cache en mémoire.
   */
  cache?: {
    /**
     * Active/désactive le cache globalement.
     * Défaut: false
     *
     * @example
     * enabled: true
     */
    enabled?: boolean;

    /**
     * Durée de vie des entrées en cache (Time To Live, en ms).
     * Défaut: 60000 (1 minute)
     *
     * @example
     * ttl: 300000 // 5 minutes
     */
    ttl?: number;

    /**
     * Stratégie de cache globale.
     *
     * Stratégies:
     * - "cache-first": Utilise le cache si frais, sinon réseau
     *   → Rapide, mais data peut être stale
     *
     * - "network-first": Essaie le réseau, retombe sur cache si échec
     *   → Frais, mais peut être lent ou offline-unfriendly
     *
     * - "stale-while-revalidate": Retourne le cache ET revalide en arrière-plan
     *   → Rapide et frais (async refresh)
     *
     * - "cache-only": Utilise UNIQUEMENT le cache
     *   → Pour les apps offline-first
     *
     * - "network-only": Utilise UNIQUEMENT le réseau
     *   → Désactive complètement le cache
     *
     * Défaut: "cache-first"
     *
     * @example
     * strategy: "stale-while-revalidate"
     */
    strategy?:
      | "cache-first"
      | "network-first"
      | "stale-while-revalidate"
      | "cache-only"
      | "network-only";

    /**
     * Fonction personnalisée pour générer la clé de cache.
     *
     * @example
     * keyBuilder: (url, options) =>
     *   `${options.method}:${url}:${JSON.stringify(options.params)}`
     */
    keyBuilder?: (url: string, options: any) => string;
  };

  // ========== CSRF CONFIGURATION ==========

  /**
   * Configuration de la protection CSRF.
   */
  csrf?: {
    /**
     * Active/désactive la protection CSRF.
     *
     * Défaut (client): true (enabled)
     * Défaut (server): false (disabled)
     *
     * @example
     * enabled: true
     */
    enabled?: boolean;

    /**
     * Endpoint pour obtenir le token CSRF (méthode GET).
     *
     * Défaut: "/api/csrf"
     *
     * @example
     * fetchEndpoint: "/api/csrf-token"
     */
    fetchEndpoint?: string;

    /**
     * Nom du cookie où le token CSRF est stocké côté client.
     *
     * Défaut: "csrf-token"
     *
     * @example
     * cookieName: "x-csrf-token"
     */
    cookieName?: string;

    /**
     * En-tête HTTP utilisé pour envoyer le token.
     *
     * Défaut: "X-CSRF-Token"
     *
     * @example
     * headerName: "X-CSRF-Token"
     */
    headerName?: string;

    /**
     * Méthodes HTTP pour lesquelles le token est requis.
     *
     * Défaut: ["POST", "PUT", "PATCH", "DELETE"]
     *
     * @example
     * methods: ["POST", "PUT", "PATCH", "DELETE"]
     */
    methods?: string[];

    /**
     * Pré-charger le token CSRF au démarrage.
     * Utile pour les Client Components.
     *
     * Défaut: false
     *
     * @example
     * prefetch: true
     */
    prefetch?: boolean;
  };

  // ========== OBSERVABILITY CONFIGURATION ==========

  /**
   * Configuration de l'observabilité (logs, tracing, métriques).
   */
  observability?: {
    /**
     * Logger intégré ou personnalisé.
     *
     * Options:
     * - true: Utilise console.log/warn/error
     * - false: Pas de logs
     * - CustomLogger: { debug(), info(), warn(), error() }
     *
     * Défaut: false (désactivé)
     *
     * @example
     * logger: true // utilise console
     *
     * // Ou logger personnalisé:
     * logger: {
     *   debug: (msg) => console.debug(msg),
     *   info: (msg) => console.info(msg),
     *   warn: (msg) => console.warn(msg),
     *   error: (msg) => console.error(msg)
     * }
     */
    logger?:
      | boolean
      | {
          debug: (...args: any[]) => void;
          info: (...args: any[]) => void;
          warn: (...args: any[]) => void;
          error: (...args: any[]) => void;
        };

    /**
     * Ajoute un requestId unique à chaque requête pour le tracing.
     * Utile pour déboguer et tracer les requêtes.
     *
     * Défaut: false
     *
     * @example
     * tracing: true
     * // Ajoute header: X-Request-ID: <uuid>
     */
    tracing?: boolean;

    /**
     * Collecte des métriques: durée, statuts HTTP, tailles.
     * Accessible via http.getMetrics()
     *
     * Défaut: false
     *
     * @example
     * metrics: true
     */
    metrics?: boolean;
  };

  // ========== AUTHENTICATION CONFIGURATION ==========

  /**
   * Configuration de l'authentification.
   */
  auth?: {
    /**
     * Forward les cookies de la requête entrante aux appels API sortants (SSR).
     * Utilisé pour TanStack Start, Next.js, etc.
     *
     * Défaut: false
     *
     * @example
     * forwardCookies: true
     *
     * // Combine avec requestContext:
     * requestContext: () => getRequest() // TanStack Start
     */
    forwardCookies?: boolean;

    /**
     * Token d'authentification statique (e.g. service-to-service).
     * Ajoute l'en-tête: Authorization: Bearer <token>
     *
     * Défaut: undefined
     *
     * @example
     * accessToken: process.env.API_KEY
     * // Ajoute: Authorization: Bearer <API_KEY>
     */
    accessToken?: string;

    /**
     * Schéma d'authentification utilisé dans Authorization header.
     *
     * Valeurs communes:
     * - "Bearer": Authorization: Bearer <token>
     * - "Basic": Authorization: Basic <base64>
     * - "ApiKey": Authorization: ApiKey <key>
     * - "AWS4-HMAC-SHA256": Signature AWS
     *
     * Défaut: "Bearer"
     *
     * @example
     * scheme: "Bearer"
     */
    scheme?: string;

    /**
     * Fonction dynamique pour récupérer le token par requête.
     * Appelée uniquement si accessToken est undefined.
     *
     * Retourne: string | null | Promise<string | null>
     *
     * @example
     * // Client: Lire depuis localStorage
     * getToken: () => localStorage.getItem('token')
     *
     * // Avec refresh automatique:
     * getToken: async () => {
     *   const stored = await tokenStorage.get();
     *   if (!stored || isExpired(stored)) {
     *     return await refreshToken();
     *   }
     *   return stored;
     * }
     */
    getToken?: () => Promise<string | null> | string | null;
  };

  // ========== ADVANCED FEATURES ==========

  /**
   * Contexte de requête (SSR frameworks).
   * Fonction qui retourne la requête courante (TanStack Start, Next.js, etc.)
   *
   * Défaut: undefined
   *
   * @example
   * // TanStack Start:
   * requestContext: () => getRequest()
   *
   * // Next.js App Router:
   * requestContext: async () => {
   *   const { headers } = await import('next/headers');
   *   return { headers: await headers() };
   * }
   */
  requestContext?: () => any;

  /**
   * Implémentation personnalisée de fetch().
   * Utile pour mocker ou utiliser une implémentation alternative.
   *
   * Défaut: globalThis.fetch
   *
   * @example
   * fetch: customFetchImplementation
   */
  fetch?: typeof globalThis.fetch;

  /**
   * Circuit Breaker pour prévenir les cascades de défaillances.
   */
  circuitBreaker?: {
    /**
     * Active/désactive le Circuit Breaker.
     * Défaut: true (enabled)
     */
    enabled?: boolean;

    /**
     * Nombre d'échecs avant d'ouvrir le circuit.
     * Défaut: 5
     *
     * @example
     * failureThreshold: 5 // Ouvre après 5 échecs
     */
    failureThreshold?: number;

    /**
     * Nombre de succès en HALF-OPEN avant de fermer le circuit.
     * Défaut: 2
     *
     * @example
     * successThreshold: 2 // Ferme après 2 succès
     */
    successThreshold?: number;

    /**
     * Temps (ms) avant passage de OPEN à HALF-OPEN.
     * Défaut: 60000 (60 secondes)
     *
     * @example
     * timeout: 30000 // Teste après 30s
     */
    timeout?: number;
  };

  /**
   * Request Pooling pour limiter les requêtes concurrentes.
   */
  requestPool?: {
    /**
     * Active/désactive le Request Pooling.
     * Défaut: true (enabled)
     */
    enabled?: boolean;

    /**
     * Nombre maximum de requêtes concurrentes.
     * Défaut: 6 (limite du navigateur)
     *
     * @example
     * maxConcurrent: 6
     */
    maxConcurrent?: number;

    /**
     * Taille maximum de la queue.
     * Défaut: 100
     *
     * @example
     * queueLimit: 100
     */
    queueLimit?: number;
  };

  /**
   * ETag support pour les requêtes conditionnelles (304 Not Modified).
   */
  etag?: {
    /**
     * Active/désactive le support ETag.
     * Défaut: true (enabled)
     */
    enabled?: boolean;

    /**
     * Où stocker les ETags.
     *
     * Options:
     * - "memory": En mémoire (perdu au rechargement)
     * - "localStorage": LocalStorage navigateur
     *
     * Défaut: "memory"
     */
    storage?: "memory" | "localStorage";
  };

  /**
   * Hooks globaux de cycle de vie.
   */
  hooks?: {
    /**
     * Appelé avant d'envoyer la requête.
     * Retourner false pour annuler.
     */
    onRequest?: (context: {
      url: string;
      method: string;
      options: any;
      requestId: string;
      timestamp: number;
    }) => boolean | void | Promise<boolean | void>;

    /**
     * Appelé sur réponse réussie (2xx).
     */
    onSuccess?: (context: {
      url: string;
      method: string;
      status: number;
      response: any;
      durationMs: number;
      requestId: string;
      isCached: boolean;
      timestamp: number;
    }) => void | Promise<void>;

    /**
     * Appelé sur erreur (network, non-2xx, validation).
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
     * Appelé après tout (success ou max retries).
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
  };

  /**
   * Plugins extensibles.
   */
  plugins?: Array<{
    name: string;
    beforeRequest?: (url: string, options: any) => any;
    afterResponse?: (response: any) => any;
    onError?: (error: any) => any;
  }>;

  /**
   * Validateur global de requête.
   */
  requestValidator?: (url: string, options: any) => boolean | Promise<boolean>;

  /**
   * Transformateur global de réponse.
   */
  responseTransformer?: (data: any, response: any) => any;
}
```

### Exemple d'utilisation

```typescript
import { createHttp } from "rhttp.io";

const http = createHttp({
  baseURL: "https://api.example.com",
  timeout: 30000,
  defaultHeaders: {
    "X-API-Version": "2",
  },
  retry: {
    attempts: 2,
    strategy: "exponential",
    delay: 300,
    maxDelay: 30000,
  },
  cache: {
    enabled: true,
    ttl: 60000,
    strategy: "cache-first",
  },
  auth: {
    accessToken: process.env.API_KEY,
    scheme: "Bearer",
  },
  observability: {
    logger: true,
    tracing: true,
    metrics: true,
  },
  circuitBreaker: {
    enabled: true,
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 60000,
  },
  requestPool: {
    enabled: true,
    maxConcurrent: 6,
    queueLimit: 100,
  },
});
```

---

## createClientHttp() - Client Navigateur

Client optimisé pour le navigateur avec sécurité CSRF, token storage, et smart caching.

### Signature

```typescript
createClientHttp(config?: CreateClientHttpConfig): HttpClientInstance
```

### Configuration Complète

Hérite de `CreateHttpConfig` + configuration spécifique au client:

```typescript
interface CreateClientHttpConfig extends CreateHttpConfig {
  // ========== TOKEN STORAGE ==========

  /**
   * Stratégie de stockage du token.
   *
   * Options:
   * - "memory": En mémoire (perdu au rechargement, plus sûr)
   * - "session": SessionStorage (clair au fermeture du tab)
   * - "hybrid": Memory + SessionStorage backup (RECOMMANDÉ)
   * - "indexeddb": IndexedDB (pour les gros tokens ou offline)
   *
   * Défaut: "hybrid"
   *
   * @example
   * tokenStorage: "hybrid"
   */
  tokenStorage?: "memory" | "session" | "hybrid" | "indexeddb";

  /**
   * Implémentation personnalisée de TokenStorage.
   *
   * @example
   * tokenStorageImpl: {
   *   get: async () => { ... },
   *   set: async (token) => { ... },
   *   clear: async () => { ... },
   *   isAvailable: async () => true
   * }
   */
  tokenStorageImpl?: any;

  // ========== SMART CACHING ==========

  /**
   * Smart caching avec invalidation pattern-based.
   */
  smartCaching?: {
    /**
     * Active/désactive le smart caching.
     * Défaut: true
     */
    enabled?: boolean;

    /**
     * Patterns de cache avec règles d'invalidation.
     *
     * @example
     * patterns: {
     *   '/api/users': {
     *     ttl: 60000,
     *     // Invalider quand POST/PUT/DELETE sur /api/users
     *     invalidateOn: ['POST', 'PUT', 'DELETE'],
     *     // Aussi invalider /api/users/:id
     *     tags: ['users']
     *   },
     *   '/api/posts': {
     *     ttl: 30000,
     *     invalidateOn: ['POST', 'PUT']
     *   }
     * }
     */
    patterns?: Record<
      string,
      {
        ttl?: number;
        invalidateOn?: string[];
        tags?: string[];
      }
    >;
  };
}
```

### Valeurs par défaut (Client)

```typescript
{
  // CSRF activé par défaut
  csrf: {
    enabled: true,
    prefetch: true,
    // ... autres configs
  },

  // Token storage hybrid par défaut
  tokenStorage: "hybrid",

  // Smart caching activé par défaut
  smartCaching: {
    enabled: true,
  },

  // Credentials inclus par défaut
  defaultFetchOptions: {
    credentials: "include",
    headers: { "Content-Type": "application/json" }
  },

  // Cache client-first par défaut
  cache: {
    enabled: true,
    strategy: "cache-first"
  }
}
```

### Exemple d'utilisation

```typescript
import { createClientHttp } from "rhttp.io/client";

const http = createClientHttp({
  baseURL: "https://api.example.com",

  // Token storage
  tokenStorage: "hybrid", // ou: memory, session, indexeddb

  // Smart caching
  smartCaching: {
    enabled: true,
    patterns: {
      "/api/users": {
        ttl: 60000,
        invalidateOn: ["POST", "PUT", "DELETE"],
        tags: ["users"],
      },
      "/api/posts": {
        ttl: 30000,
        invalidateOn: ["POST", "PUT"],
        tags: ["posts"],
      },
    },
  },

  // Auth avec token dynamic
  auth: {
    getToken: async () => {
      const stored = await tokenStorage.get();
      if (!stored || isExpired(stored)) {
        return await refreshToken();
      }
      return stored;
    },
    scheme: "Bearer",
  },

  // CSRF enabled par défaut, peut être customisé
  csrf: {
    enabled: true,
    prefetch: true,
    fetchEndpoint: "/api/csrf",
    headerName: "X-CSRF-Token",
  },

  // Cache
  cache: {
    enabled: true,
    ttl: 300000, // 5 minutes
    strategy: "cache-first",
  },
});

// Utilisation
const { data: users } = await http.get("/api/users");
const { data: user } = await http.post("/api/users", { name: "John" });
// Automatiquement invalide le cache de /api/users

const { data: sameUsers } = await http.get("/api/users");
// Retourne les données cachées (non refetched)
```

---

## createServerHttp() - Client Serveur

Client optimisé pour la SSR (Server-Side Rendering) avec forwarding de cookies.

### Signature

```typescript
createServerHttp(config?: CreateHttpConfig): HttpClientInstance
```

### Configuration Complète

Utilise la même signature que `CreateHttpConfig`, mais avec valeurs par défaut optimisées pour le serveur.

### Valeurs par défaut (Serveur)

```typescript
{
  // Authentification: Forward cookies par défaut
  auth: {
    forwardCookies: true,  // Active forwarding
    scheme: "Bearer"
    // ... autres configs
  },

  // Observabilité: Tout activé par défaut
  observability: {
    logger: true,
    tracing: true,
    metrics: process.env.NODE_ENV === "production"
  },

  // Retry agressif sur serveur
  retry: {
    attempts: 2,
    strategy: "exponential",
    delay: 500,
    maxDelay: 10000,
    statusCodes: [408, 429, 500, 502, 503, 504]
  },

  // Timeout plus haut pour les appels internes
  timeout: 30000,

  // CSRF désactivé (serveur-to-serveur)
  csrf: {
    enabled: false
  },

  // Credentials: omit (pas d'envoi des cookies du serveur)
  defaultFetchOptions: {
    credentials: "omit"
  }
}
```

### Exemple d'utilisation avec TanStack Start

```typescript
import { createServerHttp } from "rhttp.io/server";
import { getRequest } from "@tanstack/react-start/server";

const http = createServerHttp({
  baseURL: "https://internal-api.example.com",

  // TanStack Start context (auto-deteceted)
  requestContext: () => getRequest(),

  // Authentification
  auth: {
    forwardCookies: true,
    accessToken: process.env.INTERNAL_API_KEY,
    scheme: "Bearer",
  },

  // Observabilité
  observability: {
    logger: true,
    tracing: true,
    metrics: true,
  },

  // Timeout
  timeout: 30000,

  // Retry
  retry: {
    attempts: 2,
    strategy: "exponential",
  },
});

// Utilisation dans une server function
export const fetchUserProfile = createServerFn({ method: "GET" }).handler(
  async () => {
    // Automatiquement forward les cookies du client
    const { data: profile } = await http.get("/api/me");
    return profile;
  },
);
```

### Exemple avec Next.js

```typescript
import { createServerHttp } from "rhttp.io/server";
import { headers } from "next/headers";

const http = createServerHttp({
  baseURL: "https://internal-api.example.com",

  // Next.js context (headers)
  requestContext: async () => {
    const headersList = await headers();
    return { headers: headersList };
  },

  auth: {
    forwardCookies: true
  },

  observability: {
    logger: true,
    tracing: true
  }
});

// Utilisation dans une Server Component
export async function UserProfile() {
  const { data: profile } = await http.get("/api/me");
  return <div>{profile.name}</div>;
}
```

---

## createRealtimeClient() - WebSocket

Client realtime avec Socket.io pour les communications bidirectionnelles.

### Signature

```typescript
createRealtimeClient(config: RealtimeClientConfig): RealtimeClientInstance
```

### Configuration Complète

```typescript
interface RealtimeClientConfig {
  // ========== CONNECTION ==========

  /**
   * URL du serveur Socket.io.
   *
   * Défaut: undefined (OBLIGATOIRE)
   *
   * @example
   * socketUrl: "https://api.example.com"
   * socketUrl: "wss://api.example.com:3000"
   */
  socketUrl: string;

  /**
   * Envoyer les credentials (cookies) avec la connexion.
   * Défaut: true
   *
   * @example
   * withCredentials: true
   */
  withCredentials?: boolean;

  /**
   * En-têtes personnalisés.
   * Défaut: {}
   *
   * @example
   * extraHeaders: {
   *   "X-Custom-Header": "value"
   * }
   */
  extraHeaders?: Record<string, string>;

  // ========== RECONNECTION ==========

  /**
   * Active/désactive la reconnexion automatique.
   * Défaut: true
   *
   * @example
   * reconnection: true
   */
  reconnection?: boolean;

  /**
   * Délai initial avant la première reconnexion (ms).
   * Défaut: 1000
   *
   * @example
   * reconnectionDelay: 1000
   */
  reconnectionDelay?: number;

  /**
   * Délai maximum entre les reconnexions (ms).
   * Défaut: 5000
   *
   * @example
   * reconnectionDelayMax: 5000
   */
  reconnectionDelayMax?: number;

  /**
   * Nombre de tentatives avant d'abandonner.
   * Défaut: Infinity
   *
   * @example
   * reconnectionAttempts: 10 // Essayer 10 fois
   */
  reconnectionAttempts?: number;

  // ========== TRANSPORTS ==========

  /**
   * Priorités des transports.
   * Défaut: ["websocket", "polling"]
   *
   * Options:
   * - "websocket": WebSocket protocol (recommandé)
   * - "polling": HTTP long polling (fallback)
   *
   * @example
   * transports: ["websocket", "polling"]
   */
  transports?: string[];

  // ========== AUTHENTICATION ==========

  /**
   * Configuration de l'authentification.
   */
  auth?: {
    /**
     * Token statique d'authentification.
     *
     * @example
     * token: "bearer_token_here"
     */
    token?: string;

    /**
     * Schéma d'authentification.
     * Défaut: "Bearer"
     *
     * @example
     * scheme: "Bearer"
     */
    scheme?: string;

    /**
     * Fonction dynamique pour récupérer le token.
     *
     * @example
     * getToken: async () => {
     *   const token = await tokenStorage.get();
     *   return token;
     * }
     */
    getToken?: () => Promise<string | null>;

    /**
     * Factory pour l'objet d'auth personnalisé.
     *
     * @example
     * authFactory: async () => ({
     *   token: await getToken(),
     *   userId: getCurrentUserId()
     * })
     */
    authFactory?: () => Promise<Record<string, any>>;
  };

  // ========== CSRF PROTECTION ==========

  /**
   * Configuration CSRF pour WebSocket.
   */
  csrf?: {
    /**
     * Active/désactive la protection CSRF.
     * Défaut: false
     */
    enabled?: boolean;

    /**
     * Endpoint pour obtenir le token CSRF.
     * Défaut: "/api/csrf"
     *
     * @example
     * fetchEndpoint: "/api/csrf"
     */
    fetchEndpoint?: string;

    /**
     * En-tête pour envoyer le token.
     * Défaut: "X-CSRF-Token"
     *
     * @example
     * headerName: "X-CSRF-Token"
     */
    headerName?: string;

    /**
     * Nom du cookie CSRF.
     * Défaut: "csrf-token"
     *
     * @example
     * cookieName: "csrf-token"
     */
    cookieName?: string;

    /**
     * Options fetch pour récupérer le token.
     *
     * @example
     * fetchOptions: {
     *   credentials: "include"
     * }
     */
    fetchOptions?: RequestInit;
  };

  // ========== ROOMS ==========

  /**
   * Configuration des rooms.
   */
  rooms?: {
    /**
     * Rejoin automatiquement les rooms à la reconnexion.
     * Défaut: true
     *
     * @example
     * autoRejoin: true
     */
    autoRejoin?: boolean;

    /**
     * Rooms à rejoindre automatiquement.
     *
     * @example
     * autoJoin: ["notifications", "chat"]
     */
    autoJoin?: string[];
  };

  // ========== OFFLINE QUEUE ==========

  /**
   * Configuration de la queue offline.
   */
  offlineQueue?: {
    /**
     * Active/désactive la queue offline.
     * Défaut: true
     */
    enabled?: boolean;

    /**
     * Taille maximum de la queue.
     * Défaut: 100
     *
     * @example
     * maxSize: 100
     */
    maxSize?: number;

    /**
     * Clé localStorage pour la persistence.
     * Défaut: "offline_messages"
     *
     * @example
     * storageKey: "offline_messages"
     */
    storageKey?: string;
  };

  // ========== OBSERVABILITY ==========

  /**
   * Logger intégré ou personnalisé.
   *
   * Défaut: false
   *
   * @example
   * logger: true // utilise console
   *
   * // Ou logger personnalisé:
   * logger: {
   *   debug: (...args) => console.debug(...args),
   *   info: (...args) => console.info(...args),
   *   warn: (...args) => console.warn(...args),
   *   error: (...args) => console.error(...args)
   * }
   */
  logger?: boolean | any;

  // ========== EVENT HANDLING ==========

  /**
   * Validateur d'événements.
   * Vérifie la structure des événements avant traitement.
   *
   * @example
   * eventValidator: (event, data, direction) => {
   *   if (event === "message" && direction === "receive") {
   *     return typeof data.text === "string";
   *   }
   *   return true;
   * }
   */
  eventValidator?: (
    event: string,
    data: any,
    direction: "emit" | "receive",
  ) => boolean | Promise<boolean>;

  /**
   * Transformateur d'événements.
   * Transforme les données avant traitement.
   *
   * @example
   * eventTransformer: (event, data, direction) => {
   *   if (event === "message" && direction === "receive") {
   *     return {
   *       ...data,
   *       receivedAt: new Date()
   *     };
   *   }
   *   return data;
   * }
   */
  eventTransformer?: (
    event: string,
    data: any,
    direction: "emit" | "receive",
  ) => any | Promise<any>;

  // ========== LIFECYCLE HOOKS ==========

  /**
   * Hooks de cycle de vie.
   */
  hooks?: {
    /**
     * Appelé lors de la connexion réussie.
     *
     * @example
     * onConnect: async () => {
     *   console.log("Connected!");
     *   await joinRooms();
     * }
     */
    onConnect?: () => void | Promise<void>;

    /**
     * Appelé lors de la déconnexion.
     *
     * @example
     * onDisconnect: async (reason) => {
     *   console.log("Disconnected:", reason);
     * }
     */
    onDisconnect?: (reason: string) => void | Promise<void>;

    /**
     * Appelé sur erreur de connexion.
     *
     * @example
     * onError: async (error) => {
     *   console.error("Socket error:", error);
     * }
     */
    onError?: (error: any) => void | Promise<void>;
  };

  // ========== ADVANCED ==========

  /**
   * Options Socket.io additionnelles.
   * Passées directement à io().
   *
   * @example
   * socketOptions: {
   *   upgrade: true,
   *   rememberUpgrade: true
   * }
   */
  socketOptions?: Record<string, any>;
}
```

### Exemple d'utilisation

```typescript
import { createRealtimeClient } from "rhttp.io/realtime";

const realtime = createRealtimeClient({
  socketUrl: "https://api.example.com",

  // Authentification
  auth: {
    getToken: async () => {
      const token = await tokenStorage.get();
      return token;
    },
    scheme: "Bearer",
  },

  // CSRF Protection
  csrf: {
    enabled: true,
    fetchEndpoint: "/api/csrf",
  },

  // Rooms
  rooms: {
    autoRejoin: true,
    autoJoin: ["notifications"],
  },

  // Offline queue
  offlineQueue: {
    enabled: true,
    maxSize: 100,
  },

  // Reconnection
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: Infinity,

  // Observabilité
  logger: true,

  // Hooks
  hooks: {
    onConnect: async () => {
      console.log("Connected!");
    },
    onDisconnect: async (reason) => {
      console.log("Disconnected:", reason);
    },
    onError: async (error) => {
      console.error("Socket error:", error);
    },
  },
});

// Connexion
await realtime.connect();

// Émettre un événement
realtime.emit("message", { text: "Hello!" });

// Émettre avec acknowledgment
const response = await realtime.emitWithAck("action", { type: "save" });

// Écouter des événements
realtime.on("notification", (data) => {
  console.log("Notification:", data);
});

// Gérer les rooms
await realtime.joinRoom("chat");
await realtime.leaveRoom("notifications");

// Déconnexion
realtime.disconnect();
```

### React Integration

```typescript
import { RealtimeProvider, useSocketClient, useSocketEvent } from "rhttp.io/realtime";

// Provider
<RealtimeProvider client={realtime}>
  <App />
</RealtimeProvider>

// Dans un composant
function ChatComponent() {
  const client = useSocketClient();
  const [messages, setMessages] = useState([]);

  useSocketEvent("message", (data) => {
    setMessages(prev => [...prev, data]);
  });

  return (
    <div>
      {messages.map((msg, i) => (
        <div key={i}>{msg.text}</div>
      ))}
    </div>
  );
}
```

---

## Comparaison des configurations

| Feature             | `createHttp()` | `createClientHttp()` | `createServerHttp()` | `createRealtimeClient()` |
| ------------------- | -------------- | -------------------- | -------------------- | ------------------------ |
| **Base URL**        | ✓              | ✓                    | ✓                    | N/A                      |
| **Auth**            | ✓              | ✓                    | ✓ (forwardCookies)   | ✓ (token/getToken)       |
| **Cache**           | ✓              | ✓ (smart)            | ✓                    | N/A                      |
| **CSRF**            | Optional       | ✓ Default            | ✗ Default            | ✓ Optional               |
| **Retry**           | ✓              | ✓                    | ✓ (2x)               | N/A                      |
| **Timeout**         | ✓              | ✓                    | ✓ (30s)              | N/A                      |
| **Observability**   | Optional       | ✓                    | ✓                    | ✓ Logger                 |
| **Circuit Breaker** | ✓              | ✓                    | ✓                    | N/A                      |
| **Request Pool**    | ✓              | ✓                    | ✓                    | N/A                      |
| **Token Storage**   | N/A            | ✓ (hybrid)           | N/A                  | N/A                      |
| **Smart Caching**   | N/A            | ✓                    | N/A                  | N/A                      |
| **Offline Queue**   | N/A            | N/A                  | N/A                  | ✓                        |
| **Rooms**           | N/A            | N/A                  | N/A                  | ✓                        |

---

## Exemples Avancés

### Client + TanStack Query

```typescript
import { withReact } from "rhttp.io/react";
import { useQuery } from "@tanstack/react-query";

const http = withReact(createClientHttp({
  baseURL: "https://api.example.com"
}));

function UsersList() {
  const { data: users } = useQuery(
    http.query<User[]>({
      url: "/users",
      cache: { ttl: 60000 }
    })
  );

  return <div>{users?.map(u => <p key={u.id}>{u.name}</p>)}</div>;
}
```

### Server + TanStack Start

```typescript
import { createServerHttp } from "rhttp.io/server";
import { getRequest } from "@tanstack/react-start/server";

const http = createServerHttp({
  baseURL: process.env.API_URL,
  requestContext: () => getRequest(),
});

export const getUser = createServerFn({ method: "GET" }).handler(
  async (userId: string) => {
    const { data } = await http.get(`/users/${userId}`);
    return data;
  },
);
```

### Realtime Chat

```typescript
const realtime = createRealtimeClient({
  socketUrl: "https://api.example.com",
  auth: { getToken: () => getToken() },
  rooms: { autoJoin: ["chat"] },
});

await realtime.connect();

realtime.on("message", (msg) => {
  console.log("Message:", msg);
});

realtime.emit("message", { text: "Hello" });
```

---

**End of Configuration Guide**
