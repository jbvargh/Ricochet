// TerpSpark ESLint flat config — see README.md § Development → ESLint
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  // Next.js Core Web Vitals + React, React Hooks, jsx-a11y, import rules
  ...nextVitals,
  // TypeScript recommended rules (@typescript-eslint)
  ...nextTs,

  // Project-specific rule adjustments
  {
    rules: {
      // UI labels use literal "// …" strings as monospace decoration, not JSX comments.
      "react/jsx-no-comment-textnodes": "off",
    },
  },

  globalIgnores([
    // Default ignores from eslint-config-next
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Dependencies and tooling output
    "node_modules/**",
    ".cursor/**",
  ]),
]);

export default eslintConfig;
