import { TAG_COLOR_HEX, type TagColor } from '@soloquest/shared';

// The one place a tag colour KEY becomes concrete styles. Tailwind can't generate classes
// from runtime values, so every tag chip/swatch binds `:style` from here instead — no hex is
// written in any component, and re-tuning a shade is a single edit in @soloquest/shared.

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Muted chip: coloured text on a faint tint with a soft border of the same hue. Deliberately
// low-key so tag chips never out-shout the rank badge or the Complete button, while staying
// readable on the dark ground (#0a0618).
export function tagChipStyle(color: TagColor) {
  const hex = TAG_COLOR_HEX[color] ?? TAG_COLOR_HEX.amethyst;
  const [r, g, b] = hexToRgb(hex);
  return {
    color: hex,
    borderColor: `rgba(${r}, ${g}, ${b}, 0.5)`,
    backgroundColor: `rgba(${r}, ${g}, ${b}, 0.14)`,
  };
}

// Solid swatch (the colour-picker grid, the manager's current-colour dot).
export function tagSwatchStyle(color: TagColor) {
  return { backgroundColor: TAG_COLOR_HEX[color] ?? TAG_COLOR_HEX.amethyst };
}
