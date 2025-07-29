import devServer from "@hono/vite-dev-server";
import { defineConfig } from "vite";

// Change the import to use your runtime specific build
import build from "@hono/vite-build/node";

export default defineConfig(() => {
  return {
    plugins: [
      build({
        entry: "src/index.ts",
      }),
      devServer({
        entry: "src/index.ts",
      }),
    ],
  };
});
