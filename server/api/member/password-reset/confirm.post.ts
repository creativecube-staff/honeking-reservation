import bcrypt from 'bcryptjs'
import { passwordResetConfirmSchema } from '~~/shared/schemas/member'
import { prisma } from '~~/server/utils/prisma'

// パスワードリセット実行（トークン + 新パスワード）
//
// フロー:
// 1. token を検証（存在・期限・未使用）
// 2. 新パスワードを bcrypt ハッシュ化
// 3. Customer.passwordHash を更新、トークンを usedAt = now でマーク
// 4. 念のため当該 Customer の未使用トークンも一掃（複数発行されてた場合の保険）
// 5. 既存セッションを無効化したい場合は別途対応（今は最小実装、ログイン状態は維持）

const BCRYPT_COST = 10

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = passwordResetConfirmSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'トークンまたはパスワードが不正です',
      data: { issues: parsed.error.issues },
    })
  }
  const { token, newPassword } = parsed.data

  const row = await prisma.passwordResetToken.findUnique({
    where: { token },
    select: { id: true, customerId: true, expiresAt: true, usedAt: true },
  })
  if (!row) {
    throw createError({ statusCode: 400, statusMessage: 'トークンが見つかりません。リンクが正しいかご確認ください。' })
  }
  if (row.usedAt) {
    throw createError({ statusCode: 400, statusMessage: 'このトークンはすでに使用されています。再度パスワード再設定を申請してください。' })
  }
  if (row.expiresAt < new Date()) {
    throw createError({ statusCode: 400, statusMessage: 'トークンの有効期限が切れています。再度パスワード再設定を申請してください。' })
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST)
  const now = new Date()

  await prisma.$transaction([
    prisma.customer.update({
      where: { id: row.customerId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: row.id },
      data: { usedAt: now },
    }),
    // 同じ顧客の他の未使用トークンも全部使用済扱いに（多重発行されてた場合の保険）
    prisma.passwordResetToken.updateMany({
      where: { customerId: row.customerId, usedAt: null, id: { not: row.id } },
      data: { usedAt: now },
    }),
  ])

  return { ok: true }
})
