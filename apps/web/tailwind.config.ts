import type { Config } from 'tailwindcss';

// Centralna paleta motywu Solo Leveling ("System": ciemne tło, fioletowa poświata).
// Kolory zdefiniowane w formacie `rgb(... / <alpha-value>)`, dzięki czemu działają
// modyfikatory przezroczystości Tailwinda (np. `bg-accent/45` = dawne
// `rgba(124, 92, 232, 0.45)`). Rdzeń palety pochodzi z reguł refactoru, a pozostałe
// tokeny to kolory faktycznie powtarzające się w kodzie. Rzadkie/jednorazowe hexy
// zostają jako arbitrary values w komponentach.
export default {
  theme: {
    extend: {
      colors: {
        app: 'rgb(7 4 17 / <alpha-value>)', // #070411 — tło aplikacji
        panel: 'rgb(10 6 24 / <alpha-value>)', // #0a0618 — tło księgi/panelu
        line: 'rgb(42 32 80 / <alpha-value>)', // #2a2050 — border podstawowy
        'line-strong': 'rgb(58 45 110 / <alpha-value>)', // #3a2d6e — border ramy
        'line-soft': 'rgb(74 61 122 / <alpha-value>)', // #4a3d7a — border wygaszony
        ink: 'rgb(208 200 248 / <alpha-value>)', // #d0c8f8 — tekst główny
        'ink-bright': 'rgb(239 234 255 / <alpha-value>)', // #efeaff — tekst jasny
        'ink-soft': 'rgb(236 232 251 / <alpha-value>)', // #ece8fb — tekst jasny (nagłówki)
        'ink-dim': 'rgb(138 127 181 / <alpha-value>)', // #8a7fb5 — tekst wygaszony
        'ink-muted': 'rgb(129 116 184 / <alpha-value>)', // #8174b8 — tekst opisów/meta
        accent: 'rgb(124 92 232 / <alpha-value>)', // #7c5ce8 — akcent główny
        'accent-soft': 'rgb(185 166 255 / <alpha-value>)', // #b9a6ff — akcent jasny (blask)
        'accent-light': 'rgb(156 124 255 / <alpha-value>)', // #9c7cff — akcent jasny (XP)
        'accent-deep': 'rgb(106 79 216 / <alpha-value>)', // #6a4fd8 — akcent w gradiencie
        'accent-dark': 'rgb(74 53 168 / <alpha-value>)', // #4a35a8 — akcent ciemny w gradiencie
        blue: 'rgb(91 139 255 / <alpha-value>)', // #5b8bff — niebieski akcent
        gold: 'rgb(240 180 41 / <alpha-value>)', // #f0b429 — złoty akcent
        danger: 'rgb(240 160 160 / <alpha-value>)', // #f0a0a0 — tekst overdue
        'danger-bright': 'rgb(255 128 128 / <alpha-value>)', // #ff8080 — błędy/usuwanie
        'danger-bg': 'rgb(42 19 32 / <alpha-value>)', // #2a1320 — tło overdue
        'danger-line': 'rgb(90 32 48 / <alpha-value>)', // #5a2030 — border overdue
      },
    },
  },
} satisfies Partial<Config>;
