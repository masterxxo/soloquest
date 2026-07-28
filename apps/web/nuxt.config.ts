// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  app: {
    head: { title: 'Solo Quest' },
    // The grimoire frame stays put; only the page content cross-fades + lifts.
    pageTransition: { name: 'page-flip', mode: 'out-in' },
  },
  css: [
    // Self-hosted fonts via @fontsource — no runtime request to Google Fonts. Each file sets
    // `font-display: swap`; unicode-range subsetting means only the Latin cut is fetched.
    '@fontsource/chakra-petch/500.css', // display
    '@fontsource/chakra-petch/600.css',
    '@fontsource-variable/inter/index.css', // UI (variable, covers 400–600); preloaded in a plugin
    '@fontsource/jetbrains-mono/400.css', // numerals + micro-labels
    '@fontsource/jetbrains-mono/500.css',
    '~/assets/css/tokens.css',
    '~/assets/css/main.css',
  ],
  modules: ['@pinia/nuxt', '@nuxtjs/tailwindcss', '@nuxt/eslint'],
  runtimeConfig: { public: { apiBase: 'http://localhost:3001'}},
  nitro: {
    // h3 strips the '/api' mount prefix before forwarding, so target must re-add it
    // (not path doubling). Browser-only — SSR fetches the backend directly.
    devProxy: {'/api': { target: 'http://localhost:3001/api', changeOrigin: true }},
  },
});
