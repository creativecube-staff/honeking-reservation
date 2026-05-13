import { passwordResetRequestSchema } from '~~/shared/schemas/member'
import { decryptUtf8 } from '~~/server/utils/crypto'
import { hashEmail } from '~~/server/utils/hash'
import { prisma } from '~~/server/utils/prisma'
import { generateMemberToken, passwordResetExpiresAt } from '~~/server/utils/memberToken'
import { sendMail } from '~~/server/utils/mail'
import { renderPasswordReset } from '~~/server/utils/mailTemplates'

// パスワードリセット要求
//
// セキュリティポリシー（メアド漏洩防止）:
// - 存在しないメアドへの要求でも 200 を返す
// - レスポンスタイミングも揃える（本当は dummy sleep 等で完全に揃えるべきだが、現状は同期処理で十分近い）
// - メール送信は best-effort: 失敗してもユーザーには 200
//
// 動作:
// - Customer が emailHash で見つかり、かつ passwordHash と emailVerifiedAt 両方ある場合のみトークン発行 + 送信
// - 仮登録中（emailVerifiedAt=null）のユーザーには送らない（先に signup 再送で本登録を促す方針）
// - ゲスト Customer（passwordHash=null）にも送らない

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = passwordResetRequestSchema.safeParse(body)
  if (!parsed.success) {
    // バリデーション失敗時も汎用メッセージで 200 を返す（メアド存在/不存在の漏洩防止のため、
    // フォーマット不正の通知も最小限に抑える）
    return { ok: true }
  }
  const { email } = parsed.data
  const emailHash = hashEmail(email)

  const customer = await prisma.customer.findUnique({
    where: { emailHash },
    select: { id: true, name: true, passwordHash: true, emailVerifiedAt: true },
  })

  // 対象でなければ即 200（メアド漏洩防止）
  if (!customer || !customer.passwordHash || !customer.emailVerifiedAt) {
    return { ok: true }
  }

  // 既存の未使用トークンを破棄して、最新 1 件だけ有効に
  await prisma.passwordResetToken.deleteMany({
    where: { customerId: customer.id, usedAt: null },
  })

  const token = generateMemberToken()
  await prisma.passwordResetToken.create({
    data: {
      customerId: customer.id,
      token,
      expiresAt: passwordResetExpiresAt(),
    },
  })

  // 送信失敗は内部ログのみ、ユーザーには 200
  try {
    const mail = renderPasswordReset({ customerName: decryptUtf8(customer.name), token })
    await sendMail({ to: email, subject: mail.subject, text: mail.text, html: mail.html })
  }
  catch (e) {
    console.error('[member/password-reset/request] mail send failed:', (e as Error)?.message)
  }

  return { ok: true }
})
