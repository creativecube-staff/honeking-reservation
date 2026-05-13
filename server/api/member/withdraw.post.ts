import { prisma } from '~~/server/utils/prisma'

// 会員: 退会（ゲスト顧客に格下げ）
//
// 設計判断:
// - Customer 行は削除しない（Reservation との FK 整合性、店舗側の来店履歴を保持）
// - 会員機能を無効化する: passwordHash / emailVerifiedAt / lastLoginAt / termsAgreedAt をクリア
// - 暗号化済の name / phone / email は残す（過去予約の表示に必要）
// - 未使用のリセット系トークン全消去
// - 退会後、同じメアドで signup すれば既存 Customer をアップグレードする形で再登録可

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session.member?.id) {
    throw createError({ statusCode: 401, statusMessage: 'ログインが必要です' })
  }

  const customerId = session.member.id

  await prisma.$transaction([
    prisma.customer.update({
      where: { id: customerId },
      data: {
        passwordHash: null,
        emailVerifiedAt: null,
        lastLoginAt: null,
        termsAgreedAt: null,
        termsVersionAgreedAt: null,
        withdrawnAt: new Date(),
      },
    }),
    prisma.emailVerificationToken.deleteMany({ where: { customerId } }),
    prisma.passwordResetToken.deleteMany({ where: { customerId } }),
    prisma.emailChangeToken.deleteMany({ where: { customerId } }),
  ])

  // セッションを破棄（admin user セッションも一緒に落ちる前提、Phase 2 と同じ方針）
  await clearUserSession(event)

  return { ok: true }
})
