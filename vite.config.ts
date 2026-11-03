// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  plugins: [{
    name: "ludo-three-source-attributes",
    enforce: "post",
    transform(code, id) {
      if (!id.split("?")[0].includes("/src/components/dice-engine/")) return;
      // Source labels are DOM attributes, not valid Three.js object properties.
      // Keep labels on the rest of the app, but never pass them into R3F.
      const clean = code.replace(/(["'])data-tsd-source\1\s*:\s*(["'])(?:\\.|(?!\2)[^\\])*\2\s*,?/g, "");
      return clean === code ? undefined : { code: clean, map: null };
    },
  }],
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
