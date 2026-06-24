## exemple authConfig

```ts
// SSR - Transmettre les cookies
export const http = createHttp({
  auth: {
    forwardCookies: true,
  },
});

// Client - Token statique (service-to-service)
export const http = createHttp({
  auth: {
    accessToken: process.env.API_KEY,
    scheme: "Bearer",
  },
});

// Client - Token dynamique depuis localStorage
export const http = createClientHttp({
  auth: {
    getToken: () => localStorage.getItem("access_token"),
    scheme: "Bearer",
  },
});

// Client - Token avec refresh automatique
export const http = createClientHttp({
  auth: {
    getToken: async () => {
      const stored = await tokenStorage.get();
      if (!stored || isExpired(stored)) {
        return await refreshToken();
      }
      return stored;
    },
    scheme: "Bearer",
  },
});

// Service-to-service avec schéma personnalisé
export const http = createHttp({
  auth: {
    accessToken: process.env.API_KEY,
    scheme: "ApiKey",
  },
});
```
