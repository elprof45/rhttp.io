# What is rhttp.io?

`rhttp.io` is a **universal HTTP client** for TypeScript and JavaScript, designed for use in browsers, Node.js (≥18), and Edge Runtimes (Vercel, Cloudflare Workers).

It is built on top of the **Fetch API**, making it isomorphic by design, while adding a rich layer of enterprise-grade features that are typically scattered across multiple libraries.

---

## Design Philosophy

`rhttp.io` follows three core principles:

1. **Zero config, sane defaults** — works out of the box with no required configuration.
2. **Progressive complexity** — start simple, layer in features as you need them.
3. **Transparency** — every decision is observable through logging, tracing, and metrics.

---

## Feature Overview

| Category | Features |
|---|---|
| **Performance** | In-memory cache (5 strategies), request deduplication, request pooling, ETag support |
| **Reliability** | Automatic retry (exponential/linear), circuit breaker, automatic polling |
| **Security** | CSRF protection, JWT/Bearer auth, automatic token refresh, cookie forwarding |
| **Observability** | Structured logging, request tracing (`X-Request-ID`), metrics collection |
| **Developer Experience** | TypeScript inference, interceptors, transformers, validation, plugins |
| **Realtime** | Socket.io client with offline queue, rooms, event validation & transformation |
| **React** | TanStack Query `queryKey`/`queryFn`/`mutationFn` builders |
| **SSR** | TanStack Start integration, cookie forwarding, server context binding |

---

## How it compares

| | rhttp.io | axios | ky | swr/react-query |
|---|:---:|:---:|:---:|:---:|
| Fetch-based | ✅ | ❌ | ✅ | ✅ |
| Circuit breaker | ✅ | ❌ | ❌ | ❌ |
| CSRF built-in | ✅ | ❌ | ❌ | ❌ |
| Cache strategies | ✅ (5) | ❌ | ❌ | Partial |
| Socket.io client | ✅ | ❌ | ❌ | ❌ |
| SSR cookie forwarding | ✅ | Manual | Manual | Manual |
| Plugin system | ✅ | ✅ | ❌ | ❌ |
| TypeScript native | ✅ | Partial | ✅ | ✅ |

:::note
`rhttp.io` is best suited for production applications that need reliability, observability, and security out of the box.
:::
