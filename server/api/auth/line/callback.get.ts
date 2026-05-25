import { decryptUtf8 } from '~~/server/utils/crypto'
import { hashEmail } from '~~/server/utils/hash'
import { exchangeCodeForTokens, verifyIdToken, verifySignedState } from '~~/server/utils/lineLogin'
import { prisma } from '~~/server/utils/prisma'

// LINE Login のコールバック。
// GET /api/auth/line/callback?code=...&state=...
//
// 分岐:
// 1. lineUserId で既存 Customer が見つかる
//    → 即セッション発行（emailVerifiedAt が必要 = 過去に紐付け済の確定会員）
//    → cookie の redirect 先へ
// 2. LINE 取得の email で既存 Customer (passwordHash あり) が見つかる
//    → pendingLineLink を session に保存 → /auth/line/link へ（パスワード本人確認）
// 3. それ以外
//    → pendingLineLink を session に保存 → /auth/line/signup へ（新規会員登録）

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const code = typeof query.code === 'string' ? query.code : ''
  const state = typeof query.state === 'string' ? query.state : ''
  const errorCode = typeof query.error === 'string' ? query.error : ''

  const signedState = getCookie(event, 'line_oauth_state') ?? ''
  const nonce = getCookie(event, 'line_oauth_nonce') ?? ''
  const redirectAfter = getCookie(event, 'line_oauth_redirect') ?? '/'

  // 使い終わった cookie はクリア
  deleteCookie(event, 'line_oauth_state', { path: '/' })
  deleteCookie(event, 'line_oauth_nonce', { path: '/' })
  deleteCookie(event, 'line_oauth_redirect', { path: '/' })

  // ユーザーが LINE 側でキャンセル
  if (errorCode) {
    return sendRedirect(event, `/login?line=cancelled`, 302)
  }

  if (!code || !state || !signedState || !nonce) {
    return sendRedirect(event, `/login?line=error&reason=missing_params`, 302)
  }

  // state 検証（CSRF 防止）
  const verifiedState = verifySignedState(signedState)
  if (!verifiedState || verifiedState !== state) {
    return sendRedirect(event, `/login?line=error&reason=state_mismatch`, 302)
  }

  // code → id_token + access_token
  let tokens
  try {
    tokens = await exchangeCodeForTokens(code)
  }
  catch (e) {
    console.error('[auth/line/callback] token exchange failed:', (e as Error).message)
    return sendRedirect(event, `/login?line=error&reason=token_exchange`, 302)
  }
  if (!tokens.id_token) {
    return sendRedirect(event, `/login?line=error&reason=no_id_token`, 302)
  }

  // id_token 検証 → LINE userId / displayName / email
  let payload
  try {
    payload = await verifyIdToken(tokens.id_token, nonce)
  }
  catch (e) {
    console.error('[auth/line/callback] id_token verify failed:', (e as Error).message)
    return sendRedirect(event, `/login?line=error&reason=verify_failed`, 302)
  }

  const lineUserId = payload.sub
  const lineDisplayName = payload.name
  const lineEmail = payload.email?.trim().toLowerCase()

  // (0) すでにメール会員でログイン中 → その会員に LINE を紐付ける（/me からの連携フロー）
  const sessionForLink = await getUserSession(event)
  if (sessionForLink.member?.id) {
    const memberId = sessionForLink.member.id
    // 別の Customer が既にこの lineUserId を保有していないか
    const conflict = await prisma.customer.findUnique({
      where: { lineUserId },
      select: { id: true },
    })
    if (conflict && conflict.id !== memberId) {
      return sendRedirect(event, `/me?line=conflict`, 302)
    }
    await prisma.customer.update({
      where: { id: memberId },
      data: { lineUserId, lineDisplayName: lineDisplayName ?? null },
    })
    return sendRedirect(event, `${redirectAfter}${redirectAfter.includes('?') ? '&' : '?'}line=linked`, 302)
  }

  // (1) lineUserId で既存 Customer 直接ヒット → 即ログイン
  const byLineId = await prisma.customer.findUnique({
    where: { lineUserId },
    select: {
      id: true,
      name: true,
      emailVerifiedAt: true,
      withdrawnAt: true,
      passwordHash: true,
    },
  })

  if (byLineId && !byLineId.withdrawnAt) {
    // 退会済でなく、emailVerifiedAt と passwordHash が揃ってる = 正規会員 → ログイン
    if (byLineId.emailVerifiedAt && byLineId.passwordHash) {
      await prisma.customer.update({
        where: { id: byLineId.id },
        data: { lastLoginAt: new Date() },
      })
      await setUserSession(event, {
        member: {
          id: byLineId.id,
          name: decryptUtf8(byLineId.name),
        },
        memberLoggedInAt: new Date().toISOString(),
      })
      return sendRedirect(event, redirectAfter, 302)
    }
    // 旧データ等で揃っていない場合は安全側で signup フローへ
  }

  // (2) LINE 取得の email で既存会員ヒット → 紐付けフローへ
  let matchedCustomerId: number | undefined
  if (lineEmail) {
    const byEmail = await prisma.customer.findUnique({
      where: { emailHash: hashEmail(lineEmail) },
      select: { id: true, passwordHash: true, withdrawnAt: true },
    })
    if (byEmail && byEmail.passwordHash && !byEmail.withdrawnAt) {
      matchedCustomerId = byEmail.id
    }
  }

  // pendingLineLink を session に保存（既存セッションがあれば温存）
  const current = await getUserSession(event)
  await setUserSession(event, {
    ...current,
    pendingLineLink: {
      lineUserId,
      lineDisplayName,
      email: lineEmail,
      matchedCustomerId,
      issuedAt: new Date().toISOString(),
    },
  })

  if (matchedCustomerId) {
    // (2) 既存会員紐付け → パスワード入力
    return sendRedirect(event, `/auth/line/link`, 302)
  }
  // (3) 新規登録
  return sendRedirect(event, `/auth/line/signup`, 302)
})
