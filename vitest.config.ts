import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@/": new URL("./src/", import.meta.url).pathname,
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: "./coverage",
      include: ["src/lib/engine/**/*.ts"],
      exclude: [
        "src/lib/engine/__tests__/**",
        "src/lib/engine/types.ts",
        "src/lib/engine/calibration-baseline.json",
        "src/lib/engine/training-data.json",
        "src/lib/engine/ml-weights.json",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
