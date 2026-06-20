import { defineConfig } from "vocs";

export default defineConfig({
  title: "rhttp.io",
  description:
    "Universal HTTP client with caching, retries, circuit breaker, JWT auth, CSRF protection, and Socket.io realtime.",
  logoUrl: { light: "/logo-light.svg", dark: "/logo-dark.svg" },
  iconUrl: "/favicon.svg",
  ogImageUrl:
    "https://vocs.dev/api/og?logo=%logo&title=%title&description=%description",

  topNav: [
    { text: "Docs", link: "/introduction/getting-started", match: "/introduction" },
    {
      text: "API Reference",
      link: "/api/create-http",
      match: "/api",
    },
    { text: "v1.0.2", items: [
      { text: "Changelog", link: "https://github.com/elprof45/rhttp.io/blob/main/CHANGELOG.md" },
      { text: "Contributing", link: "https://github.com/elprof45/rhttp.io" },
    ]},
  ],

  sidebar: [
    {
      text: "Introduction",
      items: [
        { text: "What is rhttp.io?", link: "/introduction/what-is-rhttp" },
        { text: "Getting Started", link: "/introduction/getting-started" },
        { text: "Entry Points", link: "/introduction/entry-points" },
      ],
    },
    {
      text: "Guides",
      items: [
        { text: "HTTP Client", link: "/guides/http-client" },
        { text: "Browser Client", link: "/guides/browser-client" },
        { text: "Server Client (SSR)", link: "/guides/server-client" },
        { text: "Authentication", link: "/guides/authentication" },
        { text: "Caching", link: "/guides/caching" },
        { text: "Interceptors", link: "/guides/interceptors" },
        { text: "React & TanStack Query", link: "/guides/react" },
        { text: "Realtime (Socket.io)", link: "/guides/realtime" },
      ],
    },
    {
      text: "Advanced",
      items: [
        { text: "Circuit Breaker", link: "/advanced/circuit-breaker" },
        { text: "Request Pooling", link: "/advanced/request-pooling" },
        { text: "Polling", link: "/advanced/polling" },
        { text: "ETag Support", link: "/advanced/etag" },
        { text: "Plugin System", link: "/advanced/plugins" },
        { text: "Lifecycle Hooks", link: "/advanced/hooks" },
        { text: "Extensions", link: "/advanced/extensions" },
      ],
    },
    {
      text: "API Reference",
      items: [
        { text: "createHttp", link: "/api/create-http" },
        { text: "createClientHttp", link: "/api/create-client-http" },
        { text: "createServerHttp", link: "/api/create-server-http" },
        { text: "createRealtimeClient", link: "/api/create-realtime-client" },
        { text: "createRefreshAuthInterceptor", link: "/api/create-refresh-auth-interceptor" },
        { text: "Types", link: "/api/types" },
        { text: "Errors", link: "/api/errors" },
      ],
    },
  ],

  socials: [
    {
      icon: "github",
      link: "https://github.com/elprof45/rhttp.io",
    },
    {
      icon: "npm",
      link: "https://www.npmjs.com/package/rhttp.io",
    },
  ],

  theme: {
    accentColor: {
      light: "#5b6af7",
      dark: "#818cf8",
    },
  },
});
