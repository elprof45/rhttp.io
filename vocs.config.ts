import { defineConfig } from 'vocs/config'

export default defineConfig({
  title: "rhttp.io",
  description:
    "Universal, isomorphic HTTP client for TypeScript — zero-boilerplate config, automatic cookie forwarding, caching, retries, circuit breaker, JWT auth, CSRF protection, and realtime Socket.io.",
  icon: "/icon.svg",
  logo: {
    src: "/icon.svg",
    srcDark: "/icon.svg",
    alt: "rhttp.io",
  },
  rootDir: "docs",
  sidebar: [
    {
      text: "Getting Started",
      items: [
        { text: "Introduction", link: "/introduction" },
        { text: "Installation", link: "/getting-started" },
      ],
    },
    {
      text: "Guides",
      items: [
        { text: "Client Configuration", link: "/client-guide" },
        { text: "Server Configuration", link: "/server-guide" },
        { text: "Advanced Features", link: "/advanced-guide" },
        { text: "Realtime & Socket.io", link: "/realtime-guide" },
      ],
    },
    {
      text: "Integrations",
      items: [{ text: "React & TanStack Query", link: "/integrations/react" }],
    },
    {
      text: "API Reference",
      items: [
        { text: "createHttp()", link: "/api/create-http" },
        { text: "Client Methods", link: "/api/client-methods" },
        { text: "Types", link: "/api/types" },
        { text: "Errors", link: "/api/errors" },
        { text: "Realtime API", link: "/api/realtime" },
      ],
    },
  ],
  topNav: [
    { text: "Docs", link: "/introduction" },
    { text: "Guides", link: "/client-guide" },
    { text: "API", link: "/api/create-http" },
    { text: "npm", link: "https://www.npmjs.com/package/rhttp.io" },
    {
      text: "GitHub",
      link: "https://github.com/elprof45/rhttp.io",
    },
  ],
  socialLinks: [
    { icon: "github", link: "https://github.com/elprof45/rhttp.io" },
    { icon: "npm", link: "https://www.npmjs.com/package/rhttp.io" },
  ],
  theme: {
    accentColor: {
      light: "#6d28d9",
      dark: "#a78bfa",
    },
  },
  ogImageUrl:
    "https://opengraph.githubassets.com/1/elprof45/rhttp.io",
  editLink: {
    pattern: "https://github.com/elprof45/rhttp.io/edit/main/docs/pages/:path",
  },
});
