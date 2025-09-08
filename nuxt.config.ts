// nuxt.config.ts
export default defineNuxtConfig({
  devtools: { enabled: true },
  css: ['~/assets/main.css'], // style sederhana
  runtimeConfig: {
    public: {
      UNIMIND_AGG_URL:
        'https://cdn-content.kompas.id/litbang/litbangkompas-unimind-data.json',
      UNIMIND_RAW_URL:
        'https://cdn-content.kompas.id/litbang/litbangkompas-unimind-datarow.json',
    },
  },
})
