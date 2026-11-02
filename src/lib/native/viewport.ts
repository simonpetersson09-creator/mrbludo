/** Yatzy's visualViewport principle, without preview-only frames or module-scope DOM reads. */
export function installViewportSync() {
  const sync = () => {
    const view = window.visualViewport;
    document.documentElement.style.setProperty("--app-dvh", `${view?.height ?? window.innerHeight}px`);
  };
  sync();
  window.addEventListener("resize", sync, { passive: true });
  window.addEventListener("orientationchange", sync, { passive: true });
  window.visualViewport?.addEventListener("resize", sync, { passive: true });
  return () => {
    window.removeEventListener("resize", sync);
    window.removeEventListener("orientationchange", sync);
    window.visualViewport?.removeEventListener("resize", sync);
  };
}