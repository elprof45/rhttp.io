Tu es un ingénieur principal et Technical Writer expert. Ton objectif est de concevoir la documentation technique complète, professionnelle et ultra-claire de mon package NPM `rhttp.io` en utilisant le framework Vocs (vocs.dev).

---

### ETAPE 1 : ANALYSE DU PROJET (OBLIGATOIRE)
Avant de rédiger quoi que ce soit, analyse en profondeur l'arborescence et le code existant de mon projet :
1. Lis attentivement le fichier `README.md` ,`ADVANCED_FEATURES.md` `ADVANCED_FEATURES.md` `COMPLETE_DOCUMENTATION.md et CONFIGURATION_EXAMPLES.md` à la racine pour comprendre la vision globale.
2. Parcourt et analyse chaque fichier du dossier `./src/**/*` (notamment le core, la partie client et la partie serveur et le realtime,advance ....) pour comprendre l'API exacte, les types TypeScript, les intercepteurs et le comportement de `rhttp.io` `createServerHttp` et `createClientHttp`.

---

### ETAPE 2 : GÉNÉRATION DE LA DOCUMENTATION AVEC VOCS
En te basant exclusivement sur ton analyse réelle du code et du README, génère l'arborescence complète pour Vocs dans le dossier `docs/` (ou à la racine selon la configuration standard de Vocs). 

Produis le code source complet pour chaque fichier suivant :

#### 1. `vocs.config.ts`
Configure le projet avec le titre `rhttp.io`, une description percutante, et définis une sidebar (`sidebar: [...]`) parfaitement structurée et ordonnée (Introduction, Guide de démarrage, Configuration Client, Configuration Serveur, API Reference).

#### 2. `docs/pages/index.mdx` (Page d'accueil)
Utilise le layout de type `layout: "landing"` de Vocs. Crée une page d'accueil moderne avec un composant Hero, des badges, des boutons d'action clairs ("Démarrer", "GitHub"), et une section mettant en avant les points forts (Zéro-boilerplate, Forwarding automatique des cookies, TypeScript natif).

#### 3. `docs/pages/getting-started.md` (Guide de démarrage rapide)
Montre l'installation (`npm i rhttp.io`) et un exemple de configuration de base du cœur (`./core`) de A à Z avec `defaultFetchOptions`.

#### 4. `docs/pages/client-guide.mdx` (Guide Côté Client)

#### 5. `docs/pages/server-guide.mdx` (Guide Côté Serveur / TanStack Start)

#### 6. `docs/pages/advance-guide.mdx` (Guide avancer)

#### 7. `docs/pages/realtime-guide.mdx` (Guide realtime)

# Configuration Examples for rhttp.io

1. [Installation](#installation)
2. [Quick Start](#quick-start)
3. [Core Concepts](#core-concepts)
4. [API Reference](#api-reference)
5. [Advanced Features](#advanced-features)
6. [Error Handling](#error-handling)
7. [Interceptors](#interceptors)
8. [Caching Strategies](#caching-strategies)
9. [Authentication](#authentication)
10. [CSRF Protection](#csrf-protection)
11. [Retry Logic](#retry-logic)
12. [Rate Limiting](#rate-limiting)
13. [Request Profiling](#request-profiling)
14. [React Integration](#react-integration)
15. [Socket.io Realtime](#socketio-realtime)
16. [Examples](#examples)
17. [Troubleshooting](#troubleshooting)
---

### DIRECTIVES TECHNIQUES DE RÉDACTION VOCS
- **Surlignage de code avancé** : Utilise les annotations Shiki natives de Vocs dans tes blocs de code TypeScript pour mettre en évidence les lignes critiques (ex: `// [!code hl]` ou `// [!code ++]`).
- **Composants d'alerte** : Utilise les blocs de contenu Vocs comme `:::note`, `:::warning` ou `:::tip` pour guider visuellement le développeur.
- **Code Prêt pour la Production** : Tout le code fourni doit être en TypeScript strict, complet (pas de `// ... reste du code`), et correspondre exactement à ce que tu as trouvé dans mes fichiers sources.

Génère les fichiers un par un avec leur chemin exact.
 pour utiliser vocs
 Read https://vocs.dev/introduction/getting-started and set up Vocs for my project.
