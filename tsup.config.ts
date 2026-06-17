import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    client: "src/client.ts",
    server: "src/server.ts",
    react: "src/react.ts",
    "socket.io": "src/socket.io.ts",
  },
<<<<<<< HEAD
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: false,
  splitting: true,
  external: [
    "react",
    "@tanstack/react-query",
    "@tanstack/react-start",
    "@tanstack/react-start/server",
    "node:async_hooks",
    "socket.io-client",
  ],
});
=======

  format: ["esm", "cjs"],

  dts: {
    resolve: true
  },

  clean: true,
  sourcemap: true,
  minify: true,
  splitting: true,

  external: [
    "react",
    "react-dom",
    "@tanstack/react-query",
    "@tanstack/react-start",
    "@tanstack/react-start/server",
    "socket.io-client",
    "node:async_hooks"
  ]
});
>>>>>>> 51b5407 (last)
