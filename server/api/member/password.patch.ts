import bcrypt from 'bcryptjs'
import { memberPasswordChangeSchema } from '~~/shared/schemas/member'
import { prisma } from '~~/server/utils/prisma'

// 会員: パスワード変更（現在のパスワード認証 + 新パスワード設定）
//
// セキュリティ:
// - 現在のパスワードを必ず検証してから更新（セッション盗用時の被害最小化）
// - 旧 PasswordResetToken は無効化しない（リセット中に他端末で気づいて自前で変える場合の整合性のため、
//   そちらは別途リセット時に使用済化される）

const BCRYPT_COST = 10

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session.member?.id) {
    throw createError({ statusCode: 401, statusMessage: 'ログインが必要です' })
  }

  const body = await readBody(event)
  const parsed = memberPasswordChangeSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: '入力内容に誤りがあります',
      data: { issues: parsed.error.issues },
    })
  }
  const { currentPassword, newPassword } = parsed.data

  const me = await prisma.customer.findUnique({
    where: { id: session.member.id },
    select: { passwordHash: true },
  })
  if (!me || !me.passwordHash) {
    throw createError({ statusCode: 401, statusMessage: 'ログインが必要です' })
  }

  const ok = await bcrypt.compare(currentPassword, me.passwordHash)
  if (!ok) {
    throw createError({ statusCode: 401, statusMessage: '現在のパスワードが違います' })
  }

  if (currentPassword === newPassword) {
    throw createError({ statusCode: 400, statusMessage: '新しいパスワードが現在のものと同じです。別のパスワードを設定してください。' })
  }

  const newHash = await bcrypt.hash(newPassword, BCRYPT_COST)
  await prisma.customer.update({
    where: { id: session.member.id },
    data: { passwordHash: newHash },
  })

  return { ok: true }
})
