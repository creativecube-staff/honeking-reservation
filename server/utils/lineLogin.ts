// LINE Login (Web flow) 用のユーティリティ。
// OAuth2 認可コードフロー (response_type=code) を使用。
//
// LIFF ではなく通常の Web ブラウザでも動くフローを採用しているため、
// LINE アプリが入っていない PC からでも QR コードログインが利用できる。
//
// 必要な env:
// - LINE_LOGIN_CHANNEL_ID
// - LINE_LOGIN_CHANNEL_SECRET
// - LINE_LOGIN_CALLBACK_URL  例: https://reserve.honeking.localhost/api/auth/line/callback
//
// 参考:
// - https://developers.line.biz/ja/docs/line-login/integrate-line-login/
// - https://developers.line.biz/ja/docs/line-login/verify-id-token/

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const AUTHORIZE_URL = 'https://access.line.me/oauth2/v2.1/authorize'
const TOKEN_URL = 'https://api.line.me/oauth2/v2.1/token'
const VERIFY_URL = 'https://api.line.me/oauth2/v2.1/verify'

export type LineLoginConfig = {
  channelId: string
  channelSecret: string
  callbackUrl: string
}

export function getLineLoginConfig(): LineLoginConfig {
  const channelId = process.env.LINE_LOGIN_CHANNEL_ID
  const channelSecret = process.env.LINE_LOGIN_CHANNEL_SECRET
  const callbackUrl = process.env.LINE_LOGIN_CALLBACK_URL
  if (!channelId || !channelSecret || !callbackUrl) {
    throw new Error('LINE Login の env が未設定です。LINE_LOGIN_CHANNEL_ID / LINE_LOGIN_CHANNEL_SECRET / LINE_LOGIN_CALLBACK_URL を .env に設定してください。')
  }
  return { channelId, channelSecret, callbackUrl }
}

/** state（CSRF 防止用ランダム文字列）と nonce（ID トークン検証用）を発行。 */
export function generateLineState(): { state: string, nonce: string } {
  return {
    state: randomBytes(24).toString('hex'),
    nonce: randomBytes(24).toString('hex'),
  }
}

/** state を HMAC で署名して cookie に載せる形式に。 */
export function signState(state: string): string {
  const secret = process.env.LINE_LOGIN_CHANNEL_SECRET ?? ''
  const mac = createHmac('sha256', secret).update(state).digest('hex')
  return `${state}.${mac}`
}

/** signState で署名した cookie 値を検証 → 元の state を返す。失敗時 null。 */
export function verifySignedState(signed: string): string | null {
  const idx = signed.lastIndexOf('.')
  if (idx <= 0) return null
  const state = signed.slice(0, idx)
  const mac = signed.slice(idx + 1)
  const expected = createHmac('sha256', process.env.LINE_LOGIN_CHANNEL_SECRET ?? '').update(state).digest('hex')
  // タイミング攻撃対策で長さが同じ時のみ timingSafeEqual
  if (mac.length !== expected.length) return null
  try {
    if (!timingSafeEqual(Buffer.from(mac, 'hex'), Buffer.from(expected, 'hex'))) return null
  }
  catch {
    return null
  }
  return state
}

/** LINE 認可画面の URL を組み立てる。
 *  scope は 'profile openid email' を要求するが、email は LINE 側のオプション権限申請が通っていないと返って来ない（その場合フォローアップで入力させる）。
 */
export function buildAuthorizeUrl(params: { state: string, nonce: string }): string {
  const cfg = getLineLoginConfig()
  const url = new URL(AUTHORIZE_URL)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', cfg.channelId)
  url.searchParams.set('redirect_uri', cfg.callbackUrl)
  url.searchParams.set('state', params.state)
  url.searchParams.set('scope', 'profile openid email')
  url.searchParams.set('nonce', params.nonce)
  // bot_prompt=aggressive にすると公式アカウント友だち追加を強く促せる（運用次第）
  // ここでは付けず、Channel 設定側で制御する想定
  return url.toString()
}

export type LineTokenResponse = {
  access_token: string
  expires_in: number
  id_token?: string
  refresh_token?: string
  scope: string
  token_type: 'Bearer'
}

/** 認可コード → access_token + id_token に交換。 */
export async function exchangeCodeForTokens(code: string): Promise<LineTokenResponse> {
  const cfg = getLineLoginConfig()
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: cfg.callbackUrl,
    client_id: cfg.channelId,
    client_secret: cfg.channelSecret,
  })
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`LINE token endpoint failed: ${res.status} ${text}`)
  }
  return await res.json() as LineTokenResponse
}

export type LineIdTokenPayload = {
  iss: string
  sub: string // LINE userId（"U" 始まりの 33 文字）
  aud: string
  exp: number
  iat: number
  nonce?: string
  amr?: string[]
  name?: string
  picture?: string
  email?: string
}

/** id_token を LINE の verify エンドポイントで検証 + ペイロード取得。
 *  ローカルで JWT を検証してもよいが、verify エンドポイント経由が公式推奨かつ実装が単純。
 *  nonce は OAuth リダイレクトフロー時のみ渡す(LIFF SDK 経由の場合は SDK 内で管理済みのため省略)。
 */
export async function verifyIdToken(idToken: string, nonce?: string): Promise<LineIdTokenPayload> {
  const cfg = getLineLoginConfig()
  const body = new URLSearchParams({
    id_token: idToken,
    client_id: cfg.channelId,
  })
  if (nonce) body.set('nonce', nonce)
  const res = await fetch(VERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`LINE id_token verify failed: ${res.status} ${text}`)
  }
  return await res.json() as LineIdTokenPayload
}

/** pendingLineLink を session に置く際の TTL（10 分）。 */
export const PENDING_LINE_LINK_TTL_MS = 10 * 60 * 1000

export function isPendingLineLinkFresh(issuedAt: string): boolean {
  const t = Date.parse(issuedAt)
  if (Number.isNaN(t)) return false
  return Date.now() - t < PENDING_LINE_LINK_TTL_MS
}
