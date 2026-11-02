/** Ludo has no dice designs; kept as no-op so the shared 3D die compiles unchanged. */
export interface DiceDesign { id: string; pip: string; body: string; body2?: string; motif?: string; flag?: string; glow?: string; finish?: string }
export function designFromLook(_look: unknown): DiceDesign | null { return null; }
export function paintDesignFace(_d: DiceDesign, _ctx: CanvasRenderingContext2D, _n: number, _onDie = false): void {}
