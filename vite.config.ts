import { defineConfig } from "vite-plus"

export default defineConfig({
  fmt: {
    ignorePatterns: [
      ".vite/**",
      ".vite-plus/**",
      "out/**",
      "package-lock.json",
      "playwright-report/**",
      "test-results/**",
    ],
    semi: false,
    sortTailwindcss: {
      stylesheet: "./src/renderer/src/styles.css",
      functions: ["cn", "cva"],
    },
  },
  lint: {
    plugins: ["typescript", "unicorn", "oxc", "react", "jsx-a11y", "import"],
    categories: {
      correctness: "error",
      suspicious: "warn",
      perf: "warn",
    },
    rules: {
      "import/default": "off",
      "import/no-unassigned-import": "off",
      "react/exhaustive-deps": "error",
      "react/react-in-jsx-scope": "off",
      "react/rules-of-hooks": "error",
      "typescript/consistent-return": "off",
      "unicorn/require-module-specifiers": "off",
    },
    env: {
      builtin: true,
    },
    options: {
      denyWarnings: true,
      reportUnusedDisableDirectives: "deny",
      typeAware: true,
      typeCheck: true,
    },
  },
})
