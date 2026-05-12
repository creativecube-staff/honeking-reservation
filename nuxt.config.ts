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
  // セッション Cookie 設定
  // dev: LAN IP (192.168.x.x) で HTTP アクセスする際に Cookie を送れるよう secure=false
  // prod: .env で `NUXT_SESSION_COOKIE_SECURE=true` を必ず設定すること（HTTPS 必須）
  runtimeConfig: {
    session: {
      cookie: {
        secure: false,
      },
    },
  },
})