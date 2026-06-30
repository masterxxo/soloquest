// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  app: {
    head: { title: 'Solo Quest' },
    // The grimoire frame stays put; only the page content cross-fades + lifts.
    pageTransition: { name: 'page-flip', mode: 'out-in' },
  },
  css: ['~/assets/css/main.css'],
  modules: ['@pinia/nuxt', '@nuxtjs/tailwindcss'],
  runtimeConfig: { public: { apiBase: 'http://localhost:3001'}},
  nitro: {
    // h3 strips the '/api' mount prefix before forwarding, so target must re-add it
    // (not path doubling). Browser-only — SSR fetches the backend directly.
    devProxy: {'/api': { target: 'http://localhost:3001/api', changeOrigin: true }},
  },
});
