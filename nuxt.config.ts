// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/ui', 'nuxt-auth-utils'],
  css: ['~/assets/css/main.css'],
  // 整骨院の予約ページはユーザーの OS 設定によらずライト固定（公共サービス想定）
  colorMode: {
    preference: 'light',
    fallback: 'light',
  },
})