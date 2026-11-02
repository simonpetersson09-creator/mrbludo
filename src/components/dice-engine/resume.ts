/** Presentation-only wake; never requests a roll or changes game state. */
export function subscribeDiceResume(wake: () => void): () => void {
  const visible = () => { if (document.visibilityState === 'visible') wake(); };
  document.addEventListener('visibilitychange', visible);
  window.addEventListener('pageshow', visible);
  window.addEventListener('focus', visible);
  window.addEventListener('mrb-ludo:resume', visible);
  return () => {
    document.removeEventListener('visibilitychange', visible);
    window.removeEventListener('pageshow', visible);
    window.removeEventListener('focus', visible);
    window.removeEventListener('mrb-ludo:resume', visible);
  };
}
