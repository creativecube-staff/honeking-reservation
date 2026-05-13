import { memberEmailChangeRequestSchema } from '~~/shared/schemas/member'
import { encryptUtf8, decryptUtf8 } from '~~/server/utils/crypto'
import { hashEmail } from '~~/server/utils/hash'
import { prisma } from '~~/server/utils/prisma'
import { generateMemberToken, emailVerificationExpiresAt } from '~~/server/utils/memberToken'
import { sendMail, getAppBaseUrl } from '~~/server/utils/mail'

// 会員: メアド変更申請
// フロー:
// 1. 新メアドを受け取る
// 2. 他の顧客が同じメアドで登録済みなら 409
// 3. EmailChangeToken を発行（既存の未使用トークンは破棄）
// 4. 新メアド宛に確認リンク送信
// 5. クリックで confirm.post.ts により Customer.email/emailHash を更新

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session.member?.id) {
    throw createError({ statusCode: 401, statusMessage: 'ログインが必要です' })
  }

  const body = await readBody(event)
  const parsed = memberEmailChangeRequestSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'メールアドレスの形式が正しくありません',
      data: { issues: parsed.error.issues },
    })
  }
  const { newEmail } = parsed.data
  const newEmailHash = hashEmail(newEmail)

  // 既に他人が使用しているメアドはブロック
  const existing = await prisma.customer.findUnique({
    where: { emailHash: newEmailHash },
    select: { id: true },
  })
  if (existing && existing.id !== session.member.id) {
    throw createError({ statusCode: 409, statusMessage: 'このメールアドレスは既に他のお客様が登録しています。' })
  }

  // 自分の現在のメアドと同じ場合は何もしない
  const me = await prisma.customer.findUnique({
    where: { id: session.member.id },
    select: { name: true, emailHash: true },
  })
  if (!me) {
    throw createError({ statusCode: 401, statusMessage: 'ログインが必要です' })
  }
  if (me.emailHash === newEmailHash) {
    throw createError({ statusCode: 400, statusMessage: '現在のメールアドレスと同じです。' })
  }

  // 既存の未使用トークンを掃除
  await prisma.emailChangeToken.deleteMany({
    where: { customerId: session.member.id, usedAt: null },
  })

  const token = generateMemberToken()
  await prisma.emailChangeToken.create({
    data: {
      customerId: session.member.id,
      newEmail: encryptUtf8(newEmail),
      newEmailHash,
      token,
      expiresAt: emailVerificationExpiresAt(),
    },
  })

  // 新メアド宛にリンク送信
  const url = `${getAppBaseUrl()}/me/email-change/${token}`
  const subject = '【メールアドレス変更の確認】ご本人確認のリンクをお送りします'
  const customerName = decryptUtf8(me.name)
  const text = `${customerName} 様

メールアドレス変更のお手続きを受け付けました。
以下のリンクを 24 時間以内にクリックして、変更を完了してください。

${url}

リンクをクリックすると、当院に登録されたメールアドレスが新しいものに変更されます。
本メールに心当たりがない場合は破棄してください。

このメールアドレスは送信専用です。返信されても対応できません。
`
  await sendMail({
    to: newEmail,
    subject,
    text,
    html: text.replace(/\n/g, '<br>'),
  })

  return { ok: true }
})
