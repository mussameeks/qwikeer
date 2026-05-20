import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Qwikeer ESLint config
 *
 * Notes:
 * - Next.js 16 / React 19 includes a strict rule:
 *   react-hooks/set-state-in-effect
 *
 * In Qwikeer, many client pages intentionally fetch data inside useEffect()
 * and then update local state. This is acceptable for our current client-side
 * dashboard pages, so we disable that noisy rule for now.
 */

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;