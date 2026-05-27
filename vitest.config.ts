import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@/": new URL("./src/", import.meta.url).pathname,
      // react-konva, konva, and @pmndrs/detect-gpu are not installed in the worktree
      // (no node_modules). These aliases redirect to stub files so vite's import-analysis
      // transform does not error. Individual test files override with vi.mock() as needed.
      "react-konva": new URL("./src/__mocks__/react-konva.tsx", import.meta.url).pathname,
      "konva/lib/Node": new URL("./src/__mocks__/konva-node.ts", import.meta.url).pathname,
      "@pmndrs/detect-gpu": new URL("./src/__mocks__/detect-gpu.ts", import.meta.url).pathname,
    },
  },
  test: {
    globals: true,
    // Default environment is `node` for fast pure-module tests. Component / hook
    // test files opt in to `happy-dom` via the `/** @vitest-environment happy-dom *\/`
    // pragma at the top of the file (see e.g. src/components/app/cards/__tests__/*).
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/**/*.test.ts"],
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
