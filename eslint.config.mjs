import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Pre-existing code with React 19 compiler lint errors -- not part of engine v2 scope
    "extraction/**",
    "scripts/**",
    "verification/**",
    "src/components/hive/**",
    "src/components/primitives/TrafficLights.tsx",
    "src/components/motion/**",
    "src/components/visualization/**",
    "src/components/viral-results/**",
    "src/components/trending/**",
    "src/components/ui/card.tsx",
    "src/components/ui/carousel.tsx",
    "src/components/ui/select.tsx",
    "src/components/ui/skeleton.tsx",
    "src/components/ui/toast.tsx",
    "src/components/ui/typography.tsx",
    "src/components/app/settings/**",
    "src/hooks/use-infinite-videos.ts",
    "src/hooks/usePrefersReducedMotion.ts",
  ]),
]);

export default eslintConfig;
