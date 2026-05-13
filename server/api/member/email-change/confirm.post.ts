import { Prisma } from '@prisma/client'
import { memberEmailChangeConfirmSchema } from '~~/shared/schemas/member'
import { prisma } from '~~/server/utils/prisma'

// 会員: メアド変更の確定（リンククリック）
// フロー:
// 1. token を検証（存在・期限・未使用）
// 2. 確定時にも race condition で「新メアドが他人に取られていないか」再確認
// 3. Customer.email/emailHash を更新、token を usedAt 設定
// 4. 同顧客の他未使用トークンも一掃

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session.member?.id) {
    throw createError({ statusCode: 401, statusMessage: 'ログインが必要です' })
  }

  const body = await readBody(event)
  const parsed = memberEmailChangeConfirmSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'トークンが不正です' })
  }
  const { token } = parsed.data

  const row = await prisma.emailChangeToken.findUnique({
    where: { token },
    select: { id: true, customerId: true, newEmail: true, newEmailHash: true, expiresAt: true, usedAt: true },
  })
  if (!row) {
    throw createError({ statusCode: 400, statusMessage: 'トークンが見つかりません。リンクが正しいかご確認ください。' })
  }
  if (row.customerId !== session.member.id) {
    throw createError({ statusCode: 403, statusMessage: 'このトークンの所有者ではありません。' })
  }
  if (row.usedAt) {
    throw createError({ statusCode: 400, statusMessage: 'このトークンはすでに使用されています。' })
  }
  if (row.expiresAt < new Date()) {
    throw createError({ statusCode: 400, statusMessage: 'トークンの有効期限が切れています。再度メールアドレス変更を申請してください。' })
  }

  // race condition: 申請後〜確定までの間に他人が同じメアドで signup したかも
  const conflict = await prisma.customer.findUnique({
    where: { emailHash: row.newEmailHash },
    select: { id: true },
  })
  if (conflict && conflict.id !== session.member.id) {
    throw createError({ statusCode: 409, statusMessage: 'このメールアドレスは既に他のお客様が登録しています。' })
  }

  const now = new Date()
  try {
    await prisma.$transaction([
      prisma.customer.update({
        where: { id: row.customerId },
        data: { email: row.newEmail, emailHash: row.newEmailHash },
      }),
      prisma.emailChangeToken.update({
        where: { id: row.id },
        data: { usedAt: now },
      }),
      prisma.emailChangeToken.updateMany({
        where: { customerId: row.customerId, usedAt: null, id: { not: row.id } },
        data: { usedAt: now },
      }),
    ])
  }
  catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw createError({ statusCode: 409, statusMessage: 'このメールアドレスは既に他のお客様が登録しています。' })
    }
    throw e
  }

  return { ok: true }
})
