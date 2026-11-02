/** Ludo has no dice designs; kept as no-op so the shared 3D die compiles unchanged. */
export interface DiceDesign { id: string; pip: string; finish?: string }
export function designFromLook(_look: unknown): DiceDesign | null { return null; }
export function paintDesignFace(_d: DiceDesign, _ctx: CanvasRenderingContext2D, _n: number, _onDie = false): void {}
