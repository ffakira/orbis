import js from "@eslint/js";
import boundaries from "eslint-plugin-boundaries";
import importX from "eslint-plugin-import-x";
import globals from "globals";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

const sourceFiles = ["src/**/*.ts"];
const testFiles = ["tests/**/*.ts"];

const importRules = {
  "no-restricted-imports": [
    "error",
    {
      patterns: [
        {
          group: ["./*", "../*"],
          message:
            "Use the package import aliases defined in package.json instead of relative imports.",
        },
      ],
    },
  ],
  "import-x/no-unresolved": [
    "error",
    {
      commonjs: true,
      caseSensitive: true,
    },
  ],
  "import-x/no-duplicates": "error",
  "import-x/order": [
    "error",
    {
      groups: [
        "builtin",
        "external",
        "internal",
        "parent",
        "sibling",
        "index",
        "object",
        "type",
      ],
      pathGroups: [
        {
          pattern: "#**",
          group: "internal",
          position: "before",
        },
      ],
      pathGroupsExcludedImportTypes: ["builtin"],
      "newlines-between": "always",
      alphabetize: {
        order: "asc",
        caseInsensitive: true,
      },
    },
  ],
};

const importSettings = {
  "import-x/resolver": {
    typescript: {
      alwaysTryTypes: true,
      project: "./tsconfig.json",
    },
    node: {
      extensions: [".js", ".mjs", ".ts"],
    },
  },
};

export default defineConfig(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/coverage/**",
      "**/drizzle/**",
      "**/.terraform/**",
    ],
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: sourceFiles,
    extends: [
      js.configs.recommended,
      tseslint.configs.recommendedTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "import-x": importX,
      boundaries,
    },
    settings: {
      ...importSettings,

      "boundaries/elements": [
        { type: "bootstrap", pattern: "src/bootstrap/**" },
        { type: "config", pattern: "src/config/**" },
        { type: "presentation", pattern: "src/presentation/**" },
        { type: "infrastructure", pattern: "src/infrastructure/**" },
        {
          type: "module-domain",
          pattern: "src/modules/*/domain/**",
          capture: ["module"],
        },
        {
          type: "module-application",
          pattern: "src/modules/*/application/**",
          capture: ["module"],
        },
        {
          type: "module-infrastructure",
          pattern: "src/modules/*/infrastructure/**",
          capture: ["module"],
        },
        {
          type: "module-other",
          pattern: "src/modules/*/**",
          capture: ["module"],
        },
      ],

      "boundaries/files": [
        {
          pattern: "src/{server,lambda,outbox-lambda}.ts",
          category: "entrypoint",
        },
      ],
    },
    rules: {
      ...importRules,

      "boundaries/dependencies": [
        "error",
        {
          default: "allow",
          policies: [
            {
              from: {
                element: { type: "module-domain" },
              },
              disallow: {
                to: [
                  {
                    element: {
                      type: [
                        "module-application",
                        "module-infrastructure",
                        "module-other",
                        "bootstrap",
                        "config",
                        "delivery",
                        "infrastructure",
                      ],
                    },
                  },
                  {
                    file: { categories: "entrypoint" },
                  },
                ],
              },
            },
            {
              from: {
                element: { type: "module-application" },
              },
              disallow: {
                to: [
                  {
                    element: {
                      type: [
                        "module-infrastructure",
                        "module-other",
                        "bootstrap",
                        "delivery",
                        "infrastructure",
                      ],
                    },
                  },
                  {
                    file: { categories: "entrypoint" },
                  },
                ],
              },
            },
            {
              from: {
                element: { type: "module-infrastructure" },
              },
              disallow: {
                to: [
                  {
                    element: {
                      type: ["bootstrap", "delivery"],
                    },
                  },
                  {
                    file: { categories: "entrypoint" },
                  },
                ],
              },
            },
            {
              from: {
                element: { type: "delivery" },
              },
              disallow: {
                to: [
                  {
                    element: {
                      type: [
                        "bootstrap",
                        "infrastructure",
                        "module-infrastructure",
                        "module-other",
                      ],
                    },
                  },
                ],
              },
            },
          ],
        },
      ],

      "boundaries/no-unknown-files": "error",
    },
  },
  {
    files: ["src/infrastructure/database/schema/**/*.ts"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    files: testFiles,
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
    ],
    plugins: {
      "import-x": importX,
    },
    settings: importSettings,
    rules: {
      ...importRules,
      "no-restricted-imports": "off",

      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      "@typescript-eslint/no-empty-function": "off",
    },
  },
  {
    files: ["*.config.ts", "*.mjs", "*.cjs", "scripts/**/*.mjs"],
    extends: [js.configs.recommended],
  },
  prettier,
);
