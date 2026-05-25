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
  // ファビコン・apple-touch-icon・mask-icon は honeking.jp 本体と同じものを参照
  app: {
    head: {
      link: [
        { rel: 'apple-touch-icon', sizes: '180x180', href: 'https://honeking.jp/wp/wp-content/themes/honeking/assets/img/favicon/honeking/apple-touch-icon.png' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: 'https://honeking.jp/wp/wp-content/themes/honeking/assets/img/favicon/honeking/favicon-32x32.png' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: 'https://honeking.jp/wp/wp-content/themes/honeking/assets/img/favicon/honeking/favicon-16x16.png' },
        { rel: 'mask-icon', href: 'https://honeking.jp/wp/wp-content/themes/honeking/assets/img/favicon/honeking/safari-pinned-tab.svg', color: '#5bbad5' },
      ],
    },
  },
  // Vite が runtime 中に `@line/liff` を新規依存として発見すると pre-bundle が走り、
  // ブラウザが強制リロードされて SPA ステートが飛ぶ。事前 include で安定化する。
  vite: {
    optimizeDeps: {
      include: ['@line/liff'],
    },
    // dev 時のみ、外部トンネル経由（cloudflared / ngrok）で LIFF 確認するために外部 Host を許可。
    // 各サービスのサブドメイン全部を許可する書き方（先頭ドット）。本番ビルドには影響しない。
    server: {
      allowedHosts: ['.trycloudflare.com', '.ngrok-free.app', '.ngrok.app', '.ngrok.io'],
    },
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
    // クライアントから参照可能な公開 runtimeConfig。
    // - liffId: LINE Front-end Framework の LIFF アプリ ID（公開情報・OK）。
    //          .env の NUXT_PUBLIC_LIFF_ID で上書きされる。
    public: {
      liffId: '',
    },
  },
})