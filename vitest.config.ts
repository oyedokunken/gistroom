import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "apps/web/src") } },
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: [
            "tests/unit/**/*.test.ts",
            "packages/**/src/**/*.test.ts",
            "apps/**/src/**/*.test.ts",
          ],
          environment: "node",
        },
      },
      {
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
        },
      },
      { test: { name: "socket", include: ["tests/socket/**/*.test.ts"], environment: "node" } },
    ],
  },
});
