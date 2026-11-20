// Android adaptive layers are 108dp; the guaranteed safe circle is 66dp.
// The foreground is a committed full-bleed master (resources/android/adaptive-foreground.png,
// built by scripts/make-android-adaptive-icon.py): the original icon's own background
// gradient covers the whole layer and the artwork sits inside the safe circle,
// so no launcher mask can reveal an edge, ring or lighter border.
import { join } from 'path';
export const ADAPTIVE_LAYER_DP = 108;
export const ADAPTIVE_FOREGROUND = join(process.cwd(), 'resources', 'android', 'adaptive-foreground.png');
// Matches the master's outer edge; only visible if a launcher ignores the foreground.
export const ADAPTIVE_EDGE_BG = '#013141';

export function adaptiveIconArgs(_source, output, scale) {
  const layer = Math.round(ADAPTIVE_LAYER_DP * scale);
  return [ADAPTIVE_FOREGROUND, '-colorspace', 'sRGB', '-filter', 'Lanczos',
    '-resize', `${layer}x${layer}!`, '-alpha', 'off', '-depth', '8', output];
}
