Tu es un expert TypeScript, architecture de librairie HTTP, TanStack Start, browser/server runtime, et refactoring non-régressif.

Je veux que tu fasses une **implémentation complète** du module **`rhttp.io`**.
Tu dois analyser chaque implémentation, corriger les bugs, unifier les comportements, améliorer l’API, ajouter les fonctionnalités manquantes, et **ne pas casser les codes actuels**.
, que tu **corriges les implémentations existantes**, que tu **unifies l’architecture**, et que tu **ajoutes toutes les nouvelles fonctionnalités et configurations** ci-dessous.

### Objectif principal

* Implémenter toutes les nouvelles fonctionnalités demandées.
* Corriger les bugs et incohérences du code actuel.
* Unifier les comportements entre `core`, `client` et `server`.
* Améliorer l’API sans casser les usages existants.
* Garder une compatibilité maximale avec le code actuel.
* Ne pas créer de fichiers `.md` inutiles.
* Ne pas écrire de documentation décorative non demandée.
* Modifier le moins possible l’existant tout en le rendant correct, cohérent et extensible.

### Règles importantes

* Ne casse pas les APIs actuelles.
* Préserve les signatures publiques existantes autant que possible.
* Si une évolution est nécessaire, garde un chemin de compatibilité.
* Corrige les erreurs au lieu de les contourner.
* Implémente les fonctionnalités manquantes de façon propre.
* Refactorise seulement si cela améliore réellement la cohérence ou corrige un problème.
* Ne crée pas de fichiers `.md` inutiles.
* Ne supprime pas de code existant sans raison claire.
* Toute nouvelle config doit être intégrée proprement dans le système actuel.
* Corrige les implémentations au lieu de les contourner.
* Ajoute les nouvelles fonctionnalités demandées ci-dessous.

---

# Fonctionnalités à implémenter

## 1) `createServerHttp` avec auto-detection TanStack Start

Je veux que `createServerHttp` puisse fonctionner simplement comme ceci :

```typescript
import { createServerHttp } from "rhttp.io/server";

// Option 1: Auto-detect TanStack Start (simplest)
const http = createServerHttp({
  baseURL: "https://internal-api.example.com"
});
```

Et aussi avec un contexte explicite :

```typescript
import { getRequest } from "@tanstack/react-start/server";
import { createServerFn } from "@tanstack/react-start/server";

const http = createServerHttp({
  baseURL: process.env.INTERNAL_API_URL,
  requestContext: () => getRequest(),
});

export const getOrdersData = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data } = await http.get("/api/orders");
    return data;
  });
```

### Exigences serveur

* Détection automatique du contexte de requête TanStack Start si possible.
* Possibilité de passer explicitement `requestContext`.
* Injection automatique des cookies / headers utiles depuis la requête entrante.
* Support du forwarding transparent des headers côté serveur.

---

## 2) Custom headers côté serveur

Je veux pouvoir ajouter des headers service-to-service comme ceci :

```typescript
const http = createServerHttp({
  defaultFetchOptions: {
    headers: {
      "X-Service": "my-app",
      "X-Environment": process.env.NODE_ENV,
      "X-API-Key": process.env.INTERNAL_API_KEY
    }
  }
});
```

### Exigences

* Fusion correcte des headers.
* Support propre des headers standards et custom.
* Compatibilité avec `defaultFetchOptions`.

---

## 3) `createHttp` avec configuration complète et cohérente

Je veux que `createHttp` supporte proprement une configuration comme celle-ci :

```typescript
import { createHttp } from "rhttp.io";

const http = createHttp({
  baseURL: "https://api.example.com",
  timeout: 30_000,
  
  // Configuration that works in browser or server
  defaultFetchOptions?: {
    credentials?: "include" | "omit" | "same-origin";
    headers: {
      "Content-Type": "application/json",
      "X-Custom": "value"
    }
  },
  
  // CSRF configuration (not enabled by default)
  csrf?: {
    enabled: true,
    fetchEndpoint: "/api/csrf",
    prefetch: true
  },
  
  // Authentication
  auth?: {
    scheme: "Bearer",
    getToken: async () => {
      if (typeof window !== "undefined") {
        return localStorage.getItem("token");
      } else {
        return process.env.API_TOKEN;
      }
    }
  },
  
  // Retry logic
  retry?: {
    attempts: 3,
    strategy: "exponential",
    statusCodes: [408, 429, 500, 502, 503, 504]
  },
  
  // Caching
  cache: {
    enabled: true,
    ttl: 60_000,
    strategy: "LRU"
  },
  
  // Observability
  observability?: {
    logger: true,
    tracing: true,
    metrics: true
  }
});
```

### Exigences

* Typage TypeScript propre et cohérent.
* Fusion intelligente des options.
* Gestion robuste des options par défaut.
* Support client et serveur.
* Ajout des fonctionnalités manquantes si elles sont nécessaires à cette API.
* Ne pas introduire de comportements ambigus.

---

## 4) Configuration du Browser Client avec `createClientHttp`

Je veux que le module client supporte cette configuration de référence :

```typescript
interface BrowserClientConfig {
  // Basic
  baseURL: string;
  timeout?: number;
  
  // Fetch options (smart-merged)
  defaultFetchOptions?: {
    credentials?: "include" | "omit" | "same-origin";
    headers?: Record<string, string>;
    // ... other RequestInit options
  };

  // CSRF (not enabled by default)
  csrf?: {
    enabled?: boolean;
    fetchEndpoint?: string;
    cookieName?: string;
    headerName?: string;
    methods?: string[];
    prefetch?: boolean;
  };
  
  // Token (auto-injected if enable but not enabled by default)
  auth?: {
    getToken?: () => string | Promise<string>;
    scheme?: string;
    setToken?:() => string | Promise<string>;
  };
  
  // ... and all other core options
}
```

### Exigences côté client

* `createClientHttp` doit être taillé pour les Client Components.
* `credentials: "include"` doit être supporté proprement par défaut si choisi dans la config.
* Injection automatique du `Authorization: Bearer <token>` si un token est disponible.
* Récupération du token via `localStorage` ou `process.env.API_TOKEN` côté client.
* Support des headers custom.
* Fusion propre de `defaultFetchOptions`.
* Pas de régression sur l’existant.

---

## 5) Configuration du Server Client avec `createServerHttp`

Je veux que le module serveur supporte cette configuration de référence :

```typescript
interface ServerClientConfig {
  // Basic
  baseURL: string;
  timeout?: number;
  
  // Request context (auto-detects by default)
  requestContext?: () => Request | null;
  
  // Fetch options
  defaultFetchOptions?: {
    headers?: Record<string, string>;
    // ... other RequestInit options
  };
  
  auth?: {
    forwardCookies?: boolean;
    scheme?: string;
    getToken?: () => string | Promise<string>;
  };
  
  // Observability (enabled by default)
  observability?: {
    enable?:boolean;
    logger?: boolean;
    tracing?: boolean;
    metrics?: boolean;
  };
  
  // ... and all other core options
}
```

### Exigences côté serveur

* Auto-detection du contexte de requête si `requestContext` n’est pas fourni.
* Possibilité de transmettre explicitement `requestContext`.
* Forwarding automatique des cookies si `forwardCookies` est activé.
* Gestion propre du scheme d’auth.
* Support des headers custom.
* Observability intégrable sans casser l’API.

---

# Comportement attendu

Tu dois :
1. Corriger les bugs, incohérences et implémentations incomplètes.
2. Implémenter les nouvelles options de configuration.
3. Unifier les comportements entre core, client et server.
4. Simplifier l’API publique quand c’est possible.
5. Maintenir la compatibilité maximale avec l’existant.
6. Ne pas créer de fichiers `.md` inutiles.
7. Rendre le tout plus robuste, plus clair et plus maintenable.

---

# Attendu de ta réponse

Quand tu as fini l’audit et l’implémentation, rends :

* la liste des fichiers modifiés,
* la liste des problèmes corrigés,
* la liste des nouvelles fonctionnalités implémentées,
* les éventuels points de compatibilité à surveiller,
* et le code final prêt à être intégré.

Ne fais pas de documentation inutile.
Ne crée pas de fichiers `.md` non demandés.
Concentre-toi sur le code, les corrections, et les implémentations.
