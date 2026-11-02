import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { resolve } from "node:path";

// Static packaging target; normal TanStack Start deployment remains unchanged.
const nativeModules: Plugin = {
  name: "ludo-native-modules", enforce: "pre",
  resolveId(source, importer) {
    if (source === "./routes/__root" && importer?.endsWith("routeTree.gen.ts")) return resolve("src/native/root.tsx");
    if (source === "./routes/_authenticated/route" && importer?.endsWith("routeTree.gen.ts")) return resolve("src/native/player-gate.tsx");
    if (source === "@/lib/online/online.functions" || source === resolve("src/lib/online/online.functions")) return resolve("src/lib/native/online-client.ts");
    if (source === "./routes/api/public/native" && importer?.endsWith("routeTree.gen.ts")) return resolve("src/native/api-placeholder.ts");
    return null;
  },
};
export default defineConfig({
  root: resolve("native-shell"), envDir: resolve("."), base: "/",
  plugins: [nativeModules, react(), tailwind()],
  resolve: { alias: { "@": resolve("src") } },
  build: { outDir: resolve("dist-native"), emptyOutDir: true },
});