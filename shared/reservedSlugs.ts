// 店舗 slug が衝突してはいけないパス先頭ワード。
// お客様向け URL 構造が `reserve.honeking.jp/[storeSlug]/...` のフラット構成のため、
// 既存の固定ルート（/me, /login, /complete 等）と slug の名前空間がぶつかる。これを防ぐためのリスト。
//
// 新しい固定ルートを `app/pages/` 直下に追加するたび、このリストにも 1 行追加すること。
export const RESERVED_SLUGS: ReadonlyArray<string> = [
  // 公開向け固定ページ
  'complete',
  'me',
  'signup',
  'login',
  'logout',
  'forgot-email',
  'verify-email',
  'password-reset',
  'privacy',
  'terms',

  // フレームワーク / API 予約
  'api',
  'admin',
  '_nuxt',
  '__nuxt',
  '_payload',
  '_ipx',

  // 慣習で予約されがちなパス
  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
  'manifest.json',
  'health',
  'static',
  'public',
  'assets',
]

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.includes(slug.toLowerCase())
}
