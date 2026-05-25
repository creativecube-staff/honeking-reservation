import { z } from 'zod'
import { decryptUtf8 } from '~~/server/utils/crypto'
import { hashEmail } from '~~/server/utils/hash'
import { verifyIdToken } from '~~/server/utils/lineLogin'
import { prisma } from '~~/server/utils/prisma'

// LIFF SDK 経由の LINE ログイン。
// POST /api/auth/line/liff-login  { idToken, redirectAfter? }
//
// クライアント側 (AuthModal) は liff.getIDToken() で取得した id_token を送り、
// レスポンスの status に応じて画面を切り替える。OAuth リダイレクトフローと違って
// 外部にリダイレクトせず、JSON で結果を返すため SPA ステートを維持できる。
//
// レスポンス:
// - { status: 'logged-in' }       … 既存 LINE 連携済み → セッション発行済 (refresh して画面更新)
// - { status: 'need-link' }       … 既存メアド一致 → クライアントは /auth/line/link へ
// - { status: 'need-signup' }     … 新規 → クライアントは /auth/line/signup へ
// - { status: 'linked' }          … すでにログイン中の会員に連携した
// - { status: 'conflict' }        … この LINE は別会員に紐付け済み

const bodySchema = z.object({
  idToken: z.string().min(10).max(4000),
  // pendingLineLink に保存して link/signup 完了後に戻すパス（同一オリジンの絶対パス）
  redirectAfter: z.string().startsWith('/').max(500).optional(),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'idToken が必要です' })
  }

  const payload = await verifyIdToken(parsed.data.idToken).catch((e: Error) => {
    console.error('[liff-login] verify failed:', e.message)
    return null
  })
  if (!payload) {
    throw createError({ statusCode: 401, statusMessage: 'LINE id_token の検証に失敗しました' })
  }

  const lineUserId = payload.sub
  const lineDisplayName = payload.name
  const lineEmail = payload.email?.trim().toLowerCase()

  // (0) すでにメール会員でログイン中 → 直接 lineUserId を紐付け
  const session = await getUserSession(event)
  if (session.member?.id) {
    const memberId = session.member.id
    const conflict = await prisma.customer.findUnique({
      where: { lineUserId },
      select: { id: true },
    })
    if (conflict && conflict.id !== memberId) {
      return { status: 'conflict' as const }
    }
    await prisma.customer.update({
      where: { id: memberId },
      data: { lineUserId, lineDisplayName: lineDisplayName ?? null },
    })
    return { status: 'linked' as const }
  }

  // (1) lineUserId で既存 Customer 直接ヒット
  const byLineId = await prisma.customer.findUnique({
    where: { lineUserId },
    select: {
      id: true,
      name: true,
      emailVerifiedAt: true,
      passwordHash: true,
      withdrawnAt: true,
    },
  })
  if (byLineId && !byLineId.withdrawnAt && byLineId.emailVerifiedAt && byLineId.passwordHash) {
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
    return { status: 'logged-in' as const }
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

  // pendingLineLink を session に保存
  const current = await getUserSession(event)
  await setUserSession(event, {
    ...current,
    pendingLineLink: {
      lineUserId,
      lineDisplayName,
      email: lineEmail,
      matchedCustomerId,
      issuedAt: new Date().toISOString(),
      redirectAfter: parsed.data.redirectAfter,
    },
  })

  if (matchedCustomerId) {
    return { status: 'need-link' as const }
  }
  return { status: 'need-signup' as const }
})
