import { buildAuthorizeUrl, generateLineState, signState } from '~~/server/utils/lineLogin'

// LINE Login の開始エンドポイント。
// GET /api/auth/line/start  → 302 で LINE の認可画面へリダイレクト。
//
// CSRF 対策:
// - state / nonce を発行
// - state は HMAC 署名付き cookie (`line_oauth_state`) に保存
// - nonce は HttpOnly cookie (`line_oauth_nonce`) に保存し、callback で id_token 検証時に突合
//
// 完了後のリダイレクト先（任意）:
// - クエリ ?redirect=/me/profile のように指定すると、ログイン完了後にそのパスへ戻す
// - host-aware なので reserve. ホストでのみ動作する想定

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const redirectParam = typeof query.redirect === 'string' && query.redirect.startsWith('/')
    ? query.redirect
    : '/'

  const { state, nonce } = generateLineState()
  const signedState = signState(state)

  // state + nonce + 戻り先を cookie に保存（10 分有効）
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 10,
    secure: false, // dev: HTTP の LAN IP 共有用。本番は env で reverse-proxy 側か runtimeConfig で true に
  }
  setCookie(event, 'line_oauth_state', signedState, cookieOptions)
  setCookie(event, 'line_oauth_nonce', nonce, cookieOptions)
  setCookie(event, 'line_oauth_redirect', redirectParam, cookieOptions)

  const url = buildAuthorizeUrl({ state, nonce })
  return sendRedirect(event, url, 302)
})
