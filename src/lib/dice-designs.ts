/** Ludo has no dice designs; kept as no-op so the shared 3D die compiles unchanged. */
export interface DiceDesign { id: string; pip: string; body: string; body2?: string; motif?: string; flag?: string; glow?: string; finish?: string }
export function designFromLook(look: unknown): DiceDesign | null {
  if (typeof look !== "object" || look == null || !("body" in look) || !("pip" in look) || !("id" in look)) return null;
  const { body, pip, id } = look;
  if (typeof body !== "string" || typeof pip !== "string" || typeof id !== "string") return null;
  return { id, body, pip };
}
export function paintDesignFace(_d: DiceDesign, _ctx: CanvasRenderingContext2D, _n: number, _onDie = false): void {}
