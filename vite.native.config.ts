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
    // Match every spelling (alias, absolute or relative such as report.ts' "./online.functions") so server functions never enter the package.
    if (/(^|\/)online\/online\.functions(\.ts)?$/.test(source) || (source === "./online.functions" && importer?.includes("/src/lib/online/"))) return resolve("src/lib/native/online-client.ts");
    // Each server route gets its own stub module: routeTree.gen mutates every Route via update(), so they must not share one object.
    if (source.startsWith("./routes/api/") && importer?.endsWith("routeTree.gen.ts")) return `\0ludo-native-api:${source}`;
    return null;
  },
  load(id) {
    if (id.startsWith("\0ludo-native-api:")) return `import { createFileRoute } from "@tanstack/react-router";\nexport const Route = createFileRoute(${JSON.stringify(id.slice(id.indexOf("/routes") + 7))})({ component: () => null });`;
    return null;
  },
};
export default defineConfig({
  root: resolve("native-shell"), envDir: resolve("."), base: "/",
  plugins: [nativeModules, react(), tailwind()],
  resolve: { alias: { "@": resolve("src") } },
  build: { outDir: resolve("dist-native"), emptyOutDir: true },
});