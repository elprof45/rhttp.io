# Changelog

All notable changes to rhttp.io are documented in this file.

The format is based on Keep a Changelog and follows Semantic Versioning.

## [Unreleased]

### Added

- Strongly typed React and TanStack Query helpers for query and mutation builders.
- Richer integration surface for `createClientHttp()` with better developer experience and safer defaults.
- Reusable typed configuration/result contracts for React-friendly request helpers.
- Better public exports for React-oriented helpers from the package entrypoint.
- Expanded regression coverage for client-side React integration behavior.

### Improved

- Tightened TypeScript typing across the React adapter and core request pipeline.
- Reduced reliance on permissive `any`-like patterns in public-facing helper APIs.
- Improved compatibility between the React adapter and the existing HTTP client contract.
- Enhanced DX for query/mutation configuration with clearer option handling and inferred types.
- Strengthened internal request typing to preserve compatibility during declaration generation.

### Fixed

- Resolved declaration-generation issues that could appear during builds when using stricter typings.
- Fixed cache override resolution and request-context typing issues in the core pipeline.
- Stabilized interceptor promise handling so response pipeline typing remains correct.
- Preserved existing runtime behavior while adding stronger static guarantees.

### Notes

- The existing public API remains compatible; these changes are additive and focused on typing and DX.
- The library remains suitable for both universal/server-side usage and browser-based clients.
- The build and test suite were verified successfully after the changes.

---

## [1.0.5]

### Added

- Universal HTTP client support with caching, retries, circuit breaker, auth, CSRF, and Socket.IO integrations.
- Browser-safe client helpers and secure token-storage support.
- Advanced hooks, observability, and request lifecycle instrumentation.

### Improved

- Better request context support for server and SSR environments.
- Enhanced polling behavior and reliability.
- Expanded documentation and examples for common integration patterns.

### Fixed

- Fixed polling behavior that could block the first request and return incomplete results.
- Fixed request context propagation for non-server client creation flows.
- Improved reliability of auth-related flows and request lifecycle handling.
