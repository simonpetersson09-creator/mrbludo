/** Ludo has no dice tiers or shop: only the classic white die exists. */
export type DiceSkin = 'white';
export type DiceLook = DiceSkin | 'bronze' | 'silver' | 'gold' | 'platinum' | `d:${string}`;
