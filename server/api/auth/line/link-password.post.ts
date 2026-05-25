import bcrypt from 'bcryptjs'
import { lineLinkPasswordSchema } from '~~/shared/schemas/member'
import { decryptUtf8 } from '~~/server/utils/crypto'
import { isPendingLineLinkFresh } from '~~/server/utils/lineLogin'
import { prisma } from '~~/server/utils/prisma'

// LINE 経由ログイン時に既存メアドにヒットした場合、パスワード本人確認で紐付ける。
// POST /api/auth/line/link-password  { password }
//
// 前提:
// - session.pendingLineLink.matchedCustomerId が立っている（callback がセット済）
// - matchedCustomerId の Customer に passwordHash がある
//
// 成功時:
// - Customer.lineUserId / lineDisplayName をセット
// - pendingLineLink をクリアし、member セッションに昇格

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = lineLinkPasswordSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'パスワードを入力してください' })
  }

  const session = await getUserSession(event)
  const pending = session.pendingLineLink
  if (!pending || !isPendingLineLinkFresh(pending.issuedAt) || !pending.matchedCustomerId) {
    throw createError({ statusCode: 400, statusMessage: 'LINE 連携の有効期限が切れました。もう一度 LINE でログインし直してください。' })
  }

  const customer = await prisma.customer.findUnique({
    where: { id: pending.matchedCustomerId },
    select: {
      id: true,
      name: true,
      passwordHash: true,
      emailVerifiedAt: true,
      withdrawnAt: true,
      lineUserId: true,
    },
  })

  if (!customer || !customer.passwordHash || customer.withdrawnAt) {
    throw createError({ statusCode: 400, statusMessage: '対象の会員が見つかりません。' })
  }

  const ok = await bcrypt.compare(parsed.data.password, customer.passwordHash)
  if (!ok) {
    throw createError({ statusCode: 401, statusMessage: 'パスワードが違います。' })
  }

  if (!customer.emailVerifiedAt) {
    throw createError({
      statusCode: 403,
      statusMessage: 'メールアドレスの認証が完了していません。会員登録時に届いたメールのリンクをクリックして認証を完了してください。',
    })
  }

  // 別の Customer が既に同じ lineUserId を持っていないか保険チェック（unique 違反予防）
  if (customer.lineUserId && customer.lineUserId !== pending.lineUserId) {
    throw createError({
      statusCode: 409,
      statusMessage: 'この会員には別の LINE アカウントが既に連携されています。マイページから連携を解除してから再度お試しください。',
    })
  }

  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      lineUserId: pending.lineUserId,
      lineDisplayName: pending.lineDisplayName ?? null,
      lastLoginAt: new Date(),
    },
  })

  // セッションを member 昇格 + pendingLineLink クリア
  await setUserSession(event, {
    member: {
      id: customer.id,
      name: decryptUtf8(customer.name),
    },
    memberLoggedInAt: new Date().toISOString(),
  })

  return { ok: true }
})
