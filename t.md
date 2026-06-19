Voici une version reformulée, plus claire et plus précise de ton prompt, en gardant tes mots, tes idées et tes exemples de code :

---

Je veux que tu fasses un **review complet du module `rhttp.io`** afin de **corriger, améliorer, unifier et ajouter des implémentations**, **sans casser le code actuel**.

Tu dois **parcourir chaque fichier** dans `./src/**/*` et **revoir chaque implémentation** pour la corriger si nécessaire, la rendre plus cohérente, plus simple, plus robuste et mieux structurée.

Ton objectif est de faire un audit complet du module et de proposer des corrections concrètes, tout en respectant l’existant et en évitant de casser l’API actuelle.

## Objectifs globaux

- Corriger les bugs existants.
- Améliorer la cohérence générale du module.
- Unifier les comportements entre le serveur et le client.
- Ajouter les implémentations manquantes si nécessaire.
- Simplifier l’usage de l’API.
- Garder la compatibilité avec le code actuel autant que possible.
- Revoir chaque fichier de `./src/**/*` un par un.
- Détecter les incohérences, duplications, mauvaises abstractions et erreurs d’architecture.
- Proposer une version plus propre, plus maintenable et plus intuitive.

## Côté Serveur (`@http.io/server`)

Je veux une extraction et un transfert transparents des en-têtes, notamment :

```typescript
Cookie: request.headers.get("cookie");
```

depuis le contexte de la requête du framework, par exemple avec `TanStack Start` et `getRequest()`.

Le point d’entrée `src/server.ts` doit être taillé pour les `Server Functions` de TanStack Start.
Il doit extraire automatiquement les cookies de :

```typescript
import { getRequest } from "@tanstack/react-start/server";
```

et les injecter dans les appels vers l’API d’arrière-plan sans aucune action manuelle.

Exemple de comportement attendu :

```typescript
// Obligatoire dans TanStack Start
import { getRequest } from "@tanstack/react-start/server";
// Cookies from getRequest are automatically forwarded
export function createServerHttp(
  config: CreateHttpConfig = {},
): HttpClientInstance {
  const http = createHttp(config);
  // Injection automatique et transparente du contexte de session (Cookies)
  http.interceptors.request.use(async (options) => {
    try {
      const serverRequest = getRequest();
      if (serverRequest) {
        const clientCookies = serverRequest.headers.get("cookie") || "";
        options.headers = {
          ...options.headers,
          Cookie: clientCookies,
        };
      }
    } catch {
      // Ignoré silencieusement si exécuté en dehors d'une requête HTTP (ex: build time)
    }
    return options;
  });

  return createHttp;
}
```

## Côté Client (`@http.io/client`)

Je veux une injection automatique de :

```typescript
credentials: "include";
```

ou une gestion dynamique du header :

```typescript
Authorization: Bearer<token>;
```

Le point d’entrée `src/client.ts` doit être taillé pour les `Client Components`.
Il doit configurer l’instance pour inclure automatiquement les cookies et gérer dynamiquement l’en-tête `Authorization` en utilisant un `Access Token` stocké dans le `localStorage`.

Exemple attendu :

```typescript
export function createClientHttp(
  config: CreateHttpConfig = {},
): HttpClientInstance {
  // On force le comportement sécurisé des cookies sur le client par défaut
  const clientConfig: CreateHttpConfig = {
    ...config,
    defaultFetchOptions: {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      ...config.defaultFetchOptions,
    },
  };

  const http = createHttp(clientConfig);

  // Intercepteur pour gérer dynamiquement un Access Token stocké dans le localStorage
  http.interceptors.request.use((options) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("access_token");
      if (token) {
        options.headers = {
          ...options.headers,
          Authorization: `Bearer ${token}`,
        };
      }
    }
    return options;
  });
  return createHttp;
}
```

Et je veux aussi pouvoir définir ceci dans le module `./core` :

```typescript
export const http = createHttp({
  // a ajouter dans au module (./core)
  defaultFetchOptions: {
    credentials: "include",
  },
});
```

## Simplification attendue côté serveur

Actuellement, je veux remplacer cette approche :

```typescript
import { createServerHttp } from "rhttp.io/server";
const http = createServerHttp({
  auth: {
    forwardCookies: true, // Forward incoming request cookies
  },
});

// In TanStack Start
export const fetchProtectedData = createServerFn({ method: "GET" }).handler(
  async ({ request }) => {
    // Cookies from request are automatically forwarded
    return http.withRequest(request, async () => {
      return http.get<Todo[]>("/protected-data");
    });
  },
);
```

par une version plus simple, plus directe et plus élégante :

```typescript
import { createServerHttp } from "rhttp.io/server";
const http = createServerHttp({
  auth: {
    forwardCookies: true, // Forward incoming request cookies
  },
});

// In TanStack Start Cookies are automatically forwarded
export const fetchProtectedData = createServerFn({ method: "GET" }).handler(
  async () => {
    const { data: todos } = await http.get<Todo[]>("/protected-data");
    return todos;
  },
);
```

## Ce que tu dois faire

- Lire tout le module `rhttp.io`.
- Analyser tous les fichiers dans `./src/**/*`.
- Corriger les implémentations incorrectes.
- Unifier les patterns entre client, serveur et core.
- Ajouter les implémentations manquantes.
- Simplifier l’expérience développeur.
- Éviter de casser les usages existants.
- Proposer des améliorations concrètes, propres et cohérentes.
- Si une API actuelle est trop compliquée, la rendre plus simple tout en gardant la compatibilité.

## Contraintes importantes

- Ne casse pas les codes actuels.
- Préserve l’existant autant que possible.
- Corrige les erreurs au lieu de les contourner.
- Harmonise les comportements.
- Garde une API claire, simple et intuitive.
- Mets à jour les implémentations pour que le comportement côté client et côté serveur soit cohérent.
