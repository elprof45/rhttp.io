# 🚀 Guide d'améliorations rhttp.io

Ce guide rassemble les améliorations majeures apportées à rhttp.io, avec un focus sur la DX, la robustesse, le typage TypeScript et les bonnes pratiques de mise en œuvre. Il est pensé pour servir à la fois de référence de migration, de documentation technique et de base de travail pour des applications réelles.

---

## 1. Objectif du guide

Ce document a pour but de vous aider à :

- comprendre les évolutions récentes du client HTTP;
- utiliser les nouveaux helpers React/TanStack Query de façon sûre;
- implémenter un flux CRUD complet avec commentaires utiles;
- intégrer les stratégies de cache, retry, authentification et observabilité;
- éviter les pièges fréquents en production.

---

## 2. Ce qui a été amélioré

### 2.1 Typage TypeScript renforcé

Le cœur du client a été rendu plus robuste côté typage. Les helpers React ont été conçus pour être plus explicites, plus sûrs et plus proches des APIs modernes, sans casser l’API existante.

### 2.2 Intégration React/TanStack Query

Le module React permet désormais de créer rapidement des builders de requêtes et de mutations avec une expérience proche de TanStack Query, tout en restant compatible avec les mécanismes internes déjà présents.

### 2.3 Meilleure gestion des erreurs et du cycle de vie

Les hooks, le retry, le cache et les contextes de requête sont maintenant plus transparents, ce qui simplifie le debugging et la supervision.

### 2.4 Meilleure DX pour les développeurs

L’objectif est de pouvoir écrire des appels réseau avec moins de boilerplate, plus de lisibilité et une meilleure sécurité statique.

---

## 3. Installation et configuration minimale

```ts
import { createClientHttp } from "rhttp.io/client";

const http = createClientHttp({
  baseURL: "https://api.example.com",
  timeout: 15_000,
  retry: { attempts: 2, strategy: "exponential" },
  cache: { enabled: true, ttl: 60_000 },
});

export default http;
```

### Notes importantes

- `baseURL` centralise les URL de votre API.
- `timeout` évite les appels bloqués trop longtemps.
- `retry` améliore la résilience réseau.
- `cache` réduit les appels inutiles pour les ressources stables.

---

## 4. Exemple CRUD complet avec commentaires

Dans cette section, nous allons construire un exemple complet de gestion d’utilisateurs via une API REST. L’objectif est de montrer des exemples réalistes, commentés, et prêts à être adaptés.

### 4.1 Définition des types

```ts
// Interface représentant un utilisateur retourné par l'API.
export interface User {
  id: number;
  name: string;
  email: string;
  role: "admin" | "user";
  createdAt: string;
}

// Payload envoyé lors de la création d'un utilisateur.
export interface CreateUserPayload {
  name: string;
  email: string;
  role: "admin" | "user";
}

// Payload envoyé lors de la mise à jour d'un utilisateur.
export interface UpdateUserPayload {
  name?: string;
  email?: string;
  role?: "admin" | "user";
}
```

### 4.2 Création d’un client HTTP

```ts
import { createClientHttp } from "rhttp.io/client";

// Le client centralise la configuration commune à toutes les requêtes.
export const http = createClientHttp({
  baseURL: "https://api.example.com",
  timeout: 15_000,
  retry: { attempts: 2, strategy: "exponential" },
  headers: {
    "Content-Type": "application/json",
  },
});
```

### 4.3 Lecture d’une liste d’utilisateurs

```ts
// Récupère la liste complète des utilisateurs.
export async function getUsers(): Promise<User[]> {
  // Le client retourne directement une réponse typée.
  const response = await http.get<User[]>('/users');

  // Le payload est déjà disponible dans response.data.
  return response.data;
}
```

### 4.4 Lecture d’un utilisateur par ID

```ts
// Récupère un utilisateur spécifique par son identifiant.
export async function getUserById(id: number): Promise<User> {
  const response = await http.get<User>(`/users/${id}`);
  return response.data;
}
```

### 4.5 Création d’un utilisateur

```ts
// Crée un nouvel utilisateur.
export async function createUser(payload: CreateUserPayload): Promise<User> {
  // On envoie le payload au endpoint de création.
  const response = await http.post<User>('/users', payload);

  // La réponse contient l’utilisateur créé.
  return response.data;
}
```

### 4.6 Mise à jour d’un utilisateur

```ts
// Met à jour un utilisateur existant.
export async function updateUser(
  id: number,
  payload: UpdateUserPayload,
): Promise<User> {
  const response = await http.put<User>(`/users/${id}`, payload);
  return response.data;
}
```

### 4.7 Suppression d’un utilisateur

```ts
// Supprime un utilisateur.
export async function deleteUser(id: number): Promise<void> {
  await http.delete(`/users/${id}`);
}
```

### 4.8 Exemple d’utilisation complet

```ts
import {
  createUser,
  deleteUser,
  getUserById,
  getUsers,
  updateUser,
} from "./user-service";

async function runCrudDemo() {
  // CREATE
  const createdUser = await createUser({
    name: "Ada Lovelace",
    email: "ada@example.com",
    role: "admin",
  });
  console.log("Utilisateur créé", createdUser);

  // READ
  const users = await getUsers();
  console.log("Liste des utilisateurs", users);

  const fetchedUser = await getUserById(createdUser.id);
  console.log("Utilisateur récupéré", fetchedUser);

  // UPDATE
  const updatedUser = await updateUser(createdUser.id, {
    name: "Ada Lovelace Updated",
  });
  console.log("Utilisateur mis à jour", updatedUser);

  // DELETE
  await deleteUser(createdUser.id);
  console.log("Utilisateur supprimé");
}

runCrudDemo().catch((error) => {
  console.error("Une erreur est survenue pendant le CRUD", error);
});
```

---

## 5. Utilisation avancée avec React

Le module React permet de construire des helpers de requêtes et de mutations avec une syntaxe claire et un typage adapté.

### 5.1 Création d’un client enrichi

```ts
import { createClientHttp } from "rhttp.io/client";
import { withReact } from "rhttp.io/react";

const baseHttp = createClientHttp({
  baseURL: "https://api.example.com",
  timeout: 15_000,
});

export const reactHttp = withReact(baseHttp);
```

### 5.2 Requête de lecture typée

```ts
import type { User } from "./types";

const userQuery = reactHttp.query<User>({
  url: "/users/1",
  staleTime: 30_000,
  enabled: true,
  select: (data) => data as User,
});

const user = await userQuery.queryFn();
console.log(user);
```

### 5.3 Mutation typée pour la création

```ts
import type { CreateUserPayload, User } from "./types";

const createUserMutation = reactHttp.mutation<User, CreateUserPayload>({
  method: "POST",
  url: "/users",
  body: (variables) => variables,
  onSuccess: (data) => {
    console.log("Création réussie", data);
  },
  onError: (error) => {
    console.error("Échec de création", error);
  },
});

await createUserMutation.mutationFn({
  name: "Grace Hopper",
  email: "grace@example.com",
  role: "user",
});
```

### 5.4 Exemple React complet avec commentaires

```tsx
import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { reactHttp } from "./http";
import type { User, CreateUserPayload } from "./types";

export function UsersPage() {
  const queryClient = useQueryClient();

  const usersQuery = useQuery<User[]>({
    ...reactHttp.query<User[]>({
      url: "/users",
      staleTime: 60_000,
      params: { limit: 20 },
    }),
  });

  const createUserMutation = useMutation<User, Error, CreateUserPayload>({
    ...reactHttp.mutation<User, CreateUserPayload>({
      method: "POST",
      url: "/users",
      body: (variables) => variables,
      onSuccess: () => {
        // Invalider les requêtes concernées après une création réussie.
        queryClient.invalidateQueries({ queryKey: ["/users"] });
      },
    }),
  });

  const users = usersQuery.data ?? [];

  const content = useMemo(() => {
    if (usersQuery.isLoading) return <p>Chargement…</p>;
    if (usersQuery.isError) return <p>Erreur lors du chargement</p>;

    return (
      <ul>
        {users.map((user) => (
          <li key={user.id}>{user.name}</li>
        ))}
      </ul>
    );
  }, [users, usersQuery.isError, usersQuery.isLoading]);

  return (
    <div>
      <h1>Utilisateurs</h1>
      {content}
      <button
        onClick={() =>
          createUserMutation.mutate({
            name: "Niels Bohr",
            email: "niels@example.com",
            role: "user",
          })
        }
      >
        Ajouter un utilisateur
      </button>
    </div>
  );
}
```

---

## 6. Gestion des erreurs

Les erreurs doivent toujours être traitées explicitement. rhttp.io permet d’utiliser des stratégies de retry, des hooks et des mécanismes de validation pour garder un comportement maîtrisé.

```ts
try {
  const response = await http.get("/users");
  console.log(response.data);
} catch (error) {
  // Une erreur réseau, un timeout ou une réponse HTTP 4xx/5xx peut arriver ici.
  console.error("Erreur lors de la récupération des utilisateurs", error);
}
```

### Recommandations

- ne pas laisser les erreurs non traitées dans les composants UI;
- centraliser la logique d’erreur dans un service ou un helper;
- journaliser les erreurs en production avec un contexte utile;
- afficher des états de chargement et d’erreur cohérents.

---

## 7. Cache, retry et résilience

### 7.1 Cache simple

```ts
const http = createClientHttp({
  baseURL: "https://api.example.com",
  cache: {
    enabled: true,
    ttl: 60_000,
  },
});
```

### 7.2 Retry avec stratégie exponentielle

```ts
const http = createClientHttp({
  baseURL: "https://api.example.com",
  retry: {
    attempts: 3,
    strategy: "exponential",
    delay: 500,
  },
});
```

### 7.3 Retry par requête

```ts
await http.get("/users", {
  retry: {
    attempts: 5,
    strategy: "linear",
    delay: 250,
  },
});
```

---

## 8. Authentification et stockage des tokens

Les clients modernes doivent éviter les pratiques peu sûres. Le stockage mémoire et hybride est recommandé pour limiter les risques XSS.

```ts
import { createClientHttp } from "rhttp.io/client";

const http = createClientHttp({
  baseURL: "https://api.example.com",
  tokenStorage: "hybrid",
});

await http.setToken("mon-token-jwt");
const response = await http.get("/protected");
await http.clearToken();
```

### Bonnes pratiques

- privilégier les cookies HttpOnly côté serveur si possible;
- éviter `localStorage` pour les tokens sensibles;
- nettoyer les tokens à la déconnexion;
- centraliser la logique d’authentification dans un service dédié.

---

## 9. Observabilité et tracing

L’observabilité facilite le debugging et la supervision en production.

```ts
import { createObservabilityMiddleware } from "rhttp.io";

const observability = createObservabilityMiddleware({
  enableLogging: true,
  enableTracing: true,
  enableMetrics: true,
});

const http = createClientHttp({
  baseURL: "https://api.example.com",
});

http.use(observability);
```

### Ce que vous pouvez surveiller

- temps de réponse;
- nombre de requêtes;
- taux d’erreur;
- cache hits / misses;
- retry effectués;
- contextes de requête et traces.

---

## 10. Patterns recommandés

### 10.1 Service repository

```ts
// Un repository centralise les accès réseau pour une ressource donnée.
export class UserRepository {
  constructor(private readonly http: typeof http) {}

  async list() {
    return this.http.get("/users");
  }

  async get(id: number) {
    return this.http.get(`/users/${id}`);
  }

  async create(payload: CreateUserPayload) {
    return this.http.post("/users", payload);
  }

  async update(id: number, payload: UpdateUserPayload) {
    return this.http.put(`/users/${id}`, payload);
  }

  async remove(id: number) {
    return this.http.delete(`/users/${id}`);
  }
}
```

### 10.2 Hook personnalisé pour les données

```ts
import { useQuery } from "@tanstack/react-query";

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const response = await http.get("/users");
      return response.data;
    },
  });
}
```

---

## 11. Bonnes pratiques de production

- garder les services réseau séparés des composants UI;
- utiliser des types explicites pour les payloads et réponses;
- éviter les appels réseau redondants;
- gérer les erreurs avec une stratégie cohérente;
- documenter les endpoints critiques;
- surveiller l’impact du cache et du retry sur l’expérience utilisateur.

---

## 12. Résumé

Les améliorations apportées à rhttp.io visent à rendre le client plus moderne, plus sûr, plus typé et plus agréable à utiliser au quotidien. Les points clés à retenir sont :

- le typage TypeScript est maintenant plus solide;
- l’intégration React/TanStack Query est plus naturelle;
- le CRUD devient plus simple à écrire et à maintenir;
- les mécanismes de cache, retry et observabilité sont plus accessibles;
- la bibliothèque reste compatible avec les usages existants tout en ouvrant la voie à des applications plus évolutives.

---

## 13. Exemple de migration rapide

```ts
// Avant
const response = await fetch("https://api.example.com/users");
const data = await response.json();

// Après
const response = await http.get("/users");
const data = response.data;
```

Ce changement simplifie le code, réduit le boilerplate et apporte un meilleur contrôle sur les options de requête.
