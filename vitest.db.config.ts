import { defineConfig } from "vitest/config";
import path from "node:path";

// Database integration tests: run only through `bun run test:db` (throwaway local PostgreSQL).
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.db.test.ts"],
    fileParallelism: false,
    testTimeout: 20_000,
    // Runs before any test module: blocks every network call that is not the local test server.
    setupFiles: ["./src/test/db-guard.ts"],
  },
  resolve: {
    // Deterministic substitutes (not module mocks, which concurrent dynamic imports could bypass):
    // the privileged client talks only to the local test server, and push never leaves the machine.
    alias: [
      { find: "@/integrations/supabase/client.server", replacement: path.resolve(__dirname, "./src/test/db-admin-client.ts") },
      { find: "@/lib/push/push-server", replacement: path.resolve(__dirname, "./src/test/db-push-stub.ts") },
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
  },
});
