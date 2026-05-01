import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".claude/**",
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "test-openai-key.js",
  ]),
]);

export default eslintConfig;
