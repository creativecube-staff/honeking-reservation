import { verifyEmailSchema } from '~~/shared/schemas/member'
import { prisma } from '~~/server/utils/prisma'

// メール認証トークンの検証 → Customer.emailVerifiedAt を埋めて本登録完了
//
// フロー:
// 1. token を受け取って EmailVerificationToken を検索
// 2. usedAt != null（既に使用済）→ 400
// 3. expiresAt < 今 → 400（期限切れ）
// 4. Customer.emailVerifiedAt を now にし、トークンを usedAt = now でマーク
// 5. 成功レスポンス

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = verifyEmailSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'トークンが不正です' })
  }
  const { token } = parsed.data

  const row = await prisma.emailVerificationToken.findUnique({
    where: { token },
    select: { id: true, customerId: true, expiresAt: true, usedAt: true },
  })

  if (!row) {
    throw createError({ statusCode: 400, statusMessage: 'トークンが見つかりません。リンクが正しいかご確認ください。' })
  }
  if (row.usedAt) {
    throw createError({ statusCode: 400, statusMessage: 'このトークンはすでに使用されています。すでに認証が完了している可能性があります。' })
  }
  if (row.expiresAt < new Date()) {
    throw createError({ statusCode: 400, statusMessage: 'トークンの有効期限が切れています。お手数ですが再度会員登録をお試しください。' })
  }

  // 認証完了処理（トランザクションで Customer と Token を一緒に更新）
  const now = new Date()
  await prisma.$transaction([
    prisma.customer.update({
      where: { id: row.customerId },
      data: { emailVerifiedAt: now },
    }),
    prisma.emailVerificationToken.update({
      where: { id: row.id },
      data: { usedAt: now },
    }),
  ])

  return { ok: true }
})
