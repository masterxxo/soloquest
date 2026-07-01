import type { Config } from 'tailwindcss';

// Central Solo Leveling theme palette ("System": dark background, purple glow).
// Colors are defined as `rgb(... / <alpha-value>)` so Tailwind's opacity modifiers work
// (e.g. `bg-accent/45` = the former `rgba(124, 92, 232, 0.45)`). The palette core comes
// from the refactor rules; the remaining tokens are colors that actually recur in the
// code. Rare/one-off hexes stay as arbitrary values in the components.
export default {
  theme: {
    extend: {
      colors: {
        app: 'rgb(7 4 17 / <alpha-value>)', // #070411 — app background
        panel: 'rgb(10 6 24 / <alpha-value>)', // #0a0618 — book/panel background
        line: 'rgb(42 32 80 / <alpha-value>)', // #2a2050 — base border
        'line-strong': 'rgb(58 45 110 / <alpha-value>)', // #3a2d6e — frame border
        'line-soft': 'rgb(74 61 122 / <alpha-value>)', // #4a3d7a — muted border
        ink: 'rgb(208 200 248 / <alpha-value>)', // #d0c8f8 — primary text
        'ink-bright': 'rgb(239 234 255 / <alpha-value>)', // #efeaff — bright text
        'ink-soft': 'rgb(236 232 251 / <alpha-value>)', // #ece8fb — bright text (headings)
        'ink-dim': 'rgb(138 127 181 / <alpha-value>)', // #8a7fb5 — dimmed text
        'ink-muted': 'rgb(129 116 184 / <alpha-value>)', // #8174b8 — description/meta text
        accent: 'rgb(124 92 232 / <alpha-value>)', // #7c5ce8 — primary accent
        'accent-soft': 'rgb(185 166 255 / <alpha-value>)', // #b9a6ff — bright accent (glow)
        'accent-light': 'rgb(156 124 255 / <alpha-value>)', // #9c7cff — bright accent (XP)
        'accent-deep': 'rgb(106 79 216 / <alpha-value>)', // #6a4fd8 — accent in gradient
        'accent-dark': 'rgb(74 53 168 / <alpha-value>)', // #4a35a8 — dark accent in gradient
        blue: 'rgb(91 139 255 / <alpha-value>)', // #5b8bff — blue accent
        gold: 'rgb(240 180 41 / <alpha-value>)', // #f0b429 — gold accent
        danger: 'rgb(240 160 160 / <alpha-value>)', // #f0a0a0 — overdue text
        'danger-bright': 'rgb(255 128 128 / <alpha-value>)', // #ff8080 — errors/delete
        'danger-bg': 'rgb(42 19 32 / <alpha-value>)', // #2a1320 — overdue background
        'danger-line': 'rgb(90 32 48 / <alpha-value>)', // #5a2030 — overdue border
      },
    },
  },
} satisfies Partial<Config>;
