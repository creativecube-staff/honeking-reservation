import { decryptUtf8 } from '~~/server/utils/crypto'
import { prisma } from '~~/server/utils/prisma'

// 現在ログイン中の会員情報を返す。
// 未ログインなら member: null。
// 都度 DB から最新を引き、復号した name/phone/email を返す（マイページ表示用）。

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session.member) {
    return { member: null, loggedIn: false }
  }

  const c = await prisma.customer.findUnique({
    where: { id: session.member.id },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      emailVerifiedAt: true,
      lastLoginAt: true,
      lineUserId: true,
      lineDisplayName: true,
    },
  })
  if (!c || !c.emailVerifiedAt) {
    // セッションは残ってるが DB 側で退会または未認証化された → セッション破棄
    await replaceUserSession(event, {
      user: session.user,
      loggedInAt: session.loggedInAt,
    })
    return { member: null, loggedIn: false }
  }

  return {
    loggedIn: true,
    member: {
      id: c.id,
      name: decryptUtf8(c.name),
      phone: c.phone ? decryptUtf8(c.phone) : null,
      email: c.email ? decryptUtf8(c.email) : null,
      lastLoginAt: c.lastLoginAt?.toISOString() ?? null,
      // LINE 連携状態
      lineLinked: !!c.lineUserId,
      lineDisplayName: c.lineDisplayName ?? null,
    },
  }
})
