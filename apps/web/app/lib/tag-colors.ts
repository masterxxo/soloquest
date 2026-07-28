import { TAG_COLOR_HEX, type TagColor } from '@soloquest/shared';

// The one place a tag colour KEY becomes concrete styles. Tailwind can't generate classes
// from runtime values, so every tag chip/swatch binds `:style` from here instead — no hex is
// written in any component, and re-tuning a shade is a single edit in @soloquest/shared.

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Daylight rule (step 1 of 4): colour never carries text. A chip renders as a 10%-opacity
// fill, a full-colour 1px outline (border width comes from the component's `border` class),
// and its LABEL is always ink (#14111F) — never the hue. The dot (see tagSwatchStyle) is the
// third place the full colour lives. This is the one deliberately-visible change of step 1.
export function tagChipStyle(color: TagColor) {
  const hex = TAG_COLOR_HEX[color] ?? TAG_COLOR_HEX.amethyst;
  const [r, g, b] = hexToRgb(hex);
  return {
    color: '#14111F', // dl.ink — the label is always ink, regardless of the tag hue
    borderColor: hex, // full colour
    backgroundColor: `rgba(${r}, ${g}, ${b}, 0.1)`, // fill at 10% opacity
  };
}

// Solid swatch (the colour-picker grid, the manager's current-colour dot).
export function tagSwatchStyle(color: TagColor) {
  return { backgroundColor: TAG_COLOR_HEX[color] ?? TAG_COLOR_HEX.amethyst };
}
