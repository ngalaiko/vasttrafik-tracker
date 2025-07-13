import prettier from "eslint-config-prettier";
import { includeIgnoreFile } from "@eslint/compat";
import js from "@eslint/js";
import jsdoc from "eslint-plugin-jsdoc";
import svelte from "eslint-plugin-svelte";
import globals from "globals";
import { fileURLToPath } from "node:url";

const gitignorePath = fileURLToPath(new URL("./.gitignore", import.meta.url));

/** @type {import('eslint').Linter.Config[]} */
export default [
  includeIgnoreFile(gitignorePath),
  js.configs.recommended,
  jsdoc.configs["flat/recommended"],
  ...svelte.configs.recommended,
  prettier,
  ...svelte.configs.prettier,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, Bun: "readonly" },
    },
  },
  {
    files: ["**/*.js"],
    rules: {
      "jsdoc/require-description": "error",
      "jsdoc/require-param-description": "error",
      "jsdoc/require-returns-description": "error",
      "jsdoc/check-types": "error",
      "jsdoc/no-undefined-types": "error",
    },
  },
  {
    files: ["**/*.svelte", "**/*.svelte.js"],
    languageOptions: {
      parserOptions: {
        svelteConfig: "./packages/web/svelte.config.js",
      },
    },
  },
];
