// LIFF (LINE Front-end Framework) SDK のラッパー。
// LINE 公式アカウントのリッチメニュー等から LIFF URL で開かれた場合、SDK 経由で
// 「外部リダイレクトなしのログイン」が実現できる(LINE 内蔵ブラウザ時)。
// 通常の PC ブラウザでも liff.login() は OAuth リダイレクトに自動フォールバックする。
//
// 使い方:
//   const { isReady, isInClient, login, getIdToken } = useLiff()
//   await login() で LINE ログイン → 完了後に getIdToken() で id_token を取得 → サーバへ POST

// SDK は CSR でだけ動かす(dynamic import で SSR を回避)
type LiffStatic = typeof import('@line/liff').default

let liffInstance: LiffStatic | null = null
let initPromise: Promise<LiffStatic | null> | null = null

export function useLiff() {
  const config = useRuntimeConfig()
  const liffId = (config.public.liffId as string) || ''

  /** SDK 初期化(冪等)。.env に NUXT_PUBLIC_LIFF_ID が無いと no-op。 */
  async function init(): Promise<LiffStatic | null> {
    if (!import.meta.client) return null
    if (!liffId) return null
    if (liffInstance) return liffInstance
    if (initPromise) return initPromise

    initPromise = (async () => {
      try {
        const mod = await import('@line/liff')
        const liff = mod.default
        await liff.init({ liffId })
        liffInstance = liff
        return liff
      }
      catch (e) {
        console.error('[useLiff] init failed:', (e as Error).message)
        return null
      }
    })()
    return initPromise
  }

  /** LIFF が利用可能か(SDK 初期化が完了したか)。 */
  async function isReady(): Promise<boolean> {
    const liff = await init()
    return !!liff
  }

  /** LINE 内蔵ブラウザで開かれているか。
   *  true なら liff.login() は外部リダイレクトせず即時完結する。
   *  false(PC ブラウザ等)なら OAuth リダイレクトと同じ体験になる。
   */
  async function isInClient(): Promise<boolean> {
    const liff = await init()
    return liff?.isInClient() ?? false
  }

  /** すでに LIFF でログイン済みか。 */
  async function isLoggedIn(): Promise<boolean> {
    const liff = await init()
    return liff?.isLoggedIn() ?? false
  }

  /** ログイン開始。LIFF webview なら即時、PC ブラウザなら LINE 認可画面へリダイレクト。
   *  redirectUri を渡すと LINE 認可後にその URL に戻る(同一オリジン必須)。
   */
  async function login(options: { redirectUri?: string } = {}) {
    const liff = await init()
    if (!liff) return
    if (liff.isLoggedIn()) return
    liff.login({ redirectUri: options.redirectUri })
  }

  /** id_token を取得。getIDToken() は SDK 内で取得済みのもの返すため軽量。 */
  async function getIdToken(): Promise<string | null> {
    const liff = await init()
    if (!liff || !liff.isLoggedIn()) return null
    return liff.getIDToken() ?? null
  }

  /** LIFF プロフィール(displayName / userId / pictureUrl)。 */
  async function getProfile() {
    const liff = await init()
    if (!liff || !liff.isLoggedIn()) return null
    return await liff.getProfile()
  }

  /** ログアウト(クライアント側 LIFF セッションだけ。サーバの member セッションとは別物)。 */
  async function logout() {
    const liff = await init()
    if (!liff || !liff.isLoggedIn()) return
    liff.logout()
  }

  return { init, isReady, isInClient, isLoggedIn, login, getIdToken, getProfile, logout }
}
