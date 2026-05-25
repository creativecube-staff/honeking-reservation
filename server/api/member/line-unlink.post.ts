import { prisma } from '~~/server/utils/prisma'

// マイページから LINE 連携を解除する。
// POST /api/member/line-unlink
// セッションに member が必要。
//
// 注意:
// - パスワード再確認は要らない（既にログイン済みのため。重要操作ではあるが解除は復元可能なので緩めに）
// - 退会済 / 未認証ユーザーには許可しない

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session.member) {
    throw createError({ statusCode: 401, statusMessage: 'ログインが必要です' })
  }

  const customer = await prisma.customer.findUnique({
    where: { id: session.member.id },
    select: { id: true, withdrawnAt: true, emailVerifiedAt: true, lineUserId: true },
  })

  if (!customer || customer.withdrawnAt || !customer.emailVerifiedAt) {
    throw createError({ statusCode: 401, statusMessage: 'ログイン状態が無効です' })
  }

  if (!customer.lineUserId) {
    return { ok: true, alreadyUnlinked: true }
  }

  await prisma.customer.update({
    where: { id: customer.id },
    data: { lineUserId: null, lineDisplayName: null },
  })

  return { ok: true }
})
