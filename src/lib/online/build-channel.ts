/**
 * "test" for TestFlight, Xcode and Android debug builds; "store" for App Store/Google Play builds.
 * Older builds without the native helper report nothing and count as before.
 */
let p: Promise<"test" | "store" | null> | null = null;
export function buildChannel(): Promise<"test" | "store" | null> {
  p ??= (async () => {
    try {
      const { Capacitor, registerPlugin } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable("BuildChannel")) return null;
      const plugin = registerPlugin<{ get(): Promise<{ channel: string }> }>("BuildChannel");
      const { channel } = await plugin.get();
      return channel === "test" ? "test" : channel === "store" ? "store" : null;
    } catch { return null; }
  })();
  return p;
}

/** Server rule: only a native visit report from a test build marks the player as a test device. */
export function isTestBuildReport(r: { kind: string; platform: string; detail: Record<string, unknown> }): boolean {
  return (r.platform === "ios" || r.platform === "android") && r.kind === "session" && r.detail["ch"] === "test";
}
