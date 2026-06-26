Tu es un Software Architect, Senior TypeScript Engineer et Open Source Maintainer expert en conception de bibliothèques HTTP, React, TanStack Query, SSR, DX (Developer Experience) et API Design.

Tu dois analyser en profondeur les fichiers `@file:client.ts`, `@file:react.ts` et `@file:types.ts` afin d’évaluer comment améliorer l’architecture actuelle, simplifier l’API et compléter les fonctionnalités manquantes.

L’objectif est de déterminer s’il est possible de fusionner ou rapprocher `@file:react.ts` et `@file:client.ts` pour proposer une utilisation plus simple, plus cohérente et plus moderne, notamment à travers des hooks et une intégration plus fluide.

Tu dois également étudier comment intégrer ou reproduire davantage de fonctionnalités inspirées de **TanStack Query**, afin de remplacer l’usage d’un client simple par une approche plus puissante, plus ergonomique et plus complète, avec support des options, de la configuration avancée, des types, de la gestion d’erreurs, des états, du cache et de tout autre comportement utile.

- une nouvelle couche client moderne pour toutes les utilisations côté navigateur

L’ensemble doit prendre en charge toutes les fonctionnalités nécessaires : typage fort, gestion des erreurs, structure des données, état, configuration, extensibilité, et une expérience développeur plus simple et plus robuste.
Couche React

Cette couche doit être complètement repensée.

Elle doit proposer une API moderne inspirée de TanStack Query.
Par exemple :
useQuery
useMutation
useInfiniteQuery
usePrefetch
useInvalidate
useSuspenseQuery
useOptimisticMutation
mais adaptée à la philosophie du projet.
Évalue si cette couche doit encore exister dans react.ts ou être fusionnée avec client.ts.
Justifie chaque décision.

Identifie toutes les fonctionnalités pertinentes qui pourraient être intégrées ou adaptées, notamment :

Query Keys
Cache Management
Query State
Mutation State
Retry
Backoff
Garbage Collection
Cache Time
Stale Time
Background Refetch
Focus Refetch
Network Refetch
Polling
Optimistic Updates
Invalidation
Prefetch
Hydration
Dehydration
Infinite Query
Pagination
Cancellation
Request Deduplication
Parallel Queries
Dependent Queries
Suspense
Streaming
SSR
Error Boundary
DevTools
Middleware
Plugins
Persisters
Persistence
Broadcast Cache
Selectors
Structural Sharing
Placeholder Data
Initial Data
keepPreviousData
Query Observers
Mutation Observers
Global Configuration
Default Options

Pour chaque fonctionnalité, indique :

si elle est déjà présente ;
si elle manque ;
si elle est pertinente ;
comment l'intégrer proprement ;
si elle doit être simplifiée.

L'objectif n'est pas de copier TanStack Query, mais d'en conserver les meilleures idées tout en restant fidèle à la philosophie du projet.

Avant toute implémentation, tu dois d’abord :

1. analyser complètement les fichiers fournis,
2. identifier les limites, incohérences et opportunités d’amélioration,
3. proposer un plan détaillé et professionnel,
4. puis seulement ensuite commencer le travail.

L'objectif final est de produire une bibliothèque HTTP moderne, élégante, performante et maintenable, offrant une expérience développeur de niveau professionnel, comparable aux meilleures bibliothèques de l'écosystème JavaScript tout en conservant une API simple, cohérente et intuitive.
