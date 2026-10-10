import js from "@eslint/js";
import tseslint from "typescript-eslint";
import jsxA11y from "eslint-plugin-jsx-a11y";

const toastLibs = [
  "sonner",
  "react-hot-toast",
  "react-toastify",
  "notistack",
  "react-simple-toasts",
];

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/next-env.d.ts",
      "apps/web/public/sw.js",
      ".mail-preview/**",
      "coverage/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "no-console": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": ["error", { "ts-ignore": "allow-with-description" }],
      "no-restricted-imports": [
        "error",
        {
          paths: toastLibs.map((name) => ({
            name,
            message: "R4: no toasts. Use FeedbackProvider.",
          })),
        },
      ],
    },
  },
  { files: ["scripts/**/*.mjs", "tests/**"], rules: { "no-console": "off" } },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: { process: "readonly", console: "readonly", URL: "readonly", Buffer: "readonly" },
    },
  },
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    ...jsxA11y.flatConfigs.recommended,
  },
  {
    // R-layout: client code never imports server-only modules.
    files: ["apps/web/src/components/**/*.{ts,tsx}", "apps/web/src/lib/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/server/*", "@/server/*", "@/server"],
              message: "Client code must not import server-only modules.",
            },
          ],
          paths: toastLibs.map((name) => ({
            name,
            message: "R4: no toasts. Use FeedbackProvider.",
          })),
        },
      ],
    },
  },
);
