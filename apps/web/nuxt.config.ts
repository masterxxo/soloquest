// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@pinia/nuxt'],
  runtineConfig: { public: { apiBase: 'http://localhost:3001'}},
  nitro: {
    devProxy: {'/api': { target: 'http://localhost:3001/api', changeOrigin: true }},
  },
});
