import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

/** Shared flat ESLint config for plain TypeScript packages (no React). */
export const baseConfig = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
  {
    ignores: ["dist/**", ".next/**", "node_modules/**", ".turbo/**"],
  },
);

export default baseConfig;
