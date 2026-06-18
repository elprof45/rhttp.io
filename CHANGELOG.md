# Changelog

## [1.0.0] - 2024-06-18

### Features
- Core HTTP client with fetch-based API
- Cache strategies: cache-first, network-first, stale-while-revalidate
- Request deduplication for concurrent duplicates
- Retry logic: exponential/linear backoff, configurable status codes
- Circuit breaker for fault tolerance
- JWT refresh token interceptor
- CSRF token management and injection
- Request pooling and concurrency control
- ETag caching optimization
- Polling manager for automatic requests
- Request history and analytics
- Plugin system for extensibility

### Features
- Comprehensive error handling (HttpError, TimeoutError, NetworkError)
- Interceptor system for request/response modification
- Middleware chain architecture
- Observability: logging, tracing, metrics
- TypeScript support with full type inference
- React/TanStack Query integration
- Socket.io realtime client
- SSR support for Next.js and TanStack Start
- Edge runtime compatibility (Vercel, Cloudflare)

### Fixes
- Request deduplication now works independently of cache setting
- Custom shouldRetry callbacks now take priority over status codes
- Improved retry attempt tracking with 0-based indexing

### Tests
- 56 comprehensive tests covering all features
- 100% test pass rate
