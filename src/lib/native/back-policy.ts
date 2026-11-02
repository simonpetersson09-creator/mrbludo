export type BackAction = "minimize" | "confirm-leave" | "back" | "home";

/** Match screens: local play and an online match (not the lobby). */
export function isMatchPath(path: string): boolean {
  return path === "/play" || /^\/online\/[^/]+$/.test(path);
}

export function backAction(path: string, canGoBack: boolean): BackAction {
  if (path === "/" || path === "/index" || path === "") return "minimize";
  if (isMatchPath(path)) return "confirm-leave";
  return canGoBack ? "back" : "home";
}
