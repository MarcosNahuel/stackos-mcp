import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    testTimeout: 10_000,
    include: ["src/**/*.test.ts"],
    // Excluir tests E2E que requieren red/Supabase real (legacy del repo)
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "src/yo/**/*.integration.test.ts",
    ],
  },
});
