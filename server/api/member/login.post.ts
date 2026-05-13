import bcrypt from 'bcryptjs'
import { memberLoginSchema } from '~~/shared/schemas/member'
import { decryptUtf8 } from '~~/server/utils/crypto'
import { hashEmail } from '~~/server/utils/hash'
import { prisma } from '~~/server/utils/prisma'

// 会員ログイン（メールアドレス + パスワード）
//
// セキュリティ:
// - ユーザー存在の漏洩を避けるため、ダミーハッシュで bcrypt 比較しタイミングを揃える
// - 「メールが未認証」と「パスワード不正」は区別してエラーを返す（UX 重視・会員制では存在隠蔽の優先度が低い）

const DUMMY_HASH = '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalid'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = memberLoginSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'メールアドレスとパスワードを入力してください' })
  }
  const { email, password } = parsed.data

  const customer = await prisma.customer.findUnique({
    where: { emailHash: hashEmail(email) },
    select: {
      id: true,
      name: true,
      passwordHash: true,
      emailVerifiedAt: true,
    },
  })

  // タイミング攻撃対策: 不在でも DUMMY_HASH で比較する
  const passOk = await bcrypt.compare(password, customer?.passwordHash ?? DUMMY_HASH)

  if (!customer || !customer.passwordHash || !passOk) {
    throw createError({ statusCode: 401, statusMessage: 'メールアドレスまたはパスワードが違います' })
  }

  if (!customer.emailVerifiedAt) {
    throw createError({
      statusCode: 403,
      statusMessage: 'メールアドレスの認証が完了していません。会員登録時に届いたメールのリンクをクリックして認証を完了してください。',
    })
  }

  // 最終ログイン時刻を更新
  await prisma.customer.update({
    where: { id: customer.id },
    data: { lastLoginAt: new Date() },
  })

  // セッションに会員情報を保存（既存の admin user セッションは温存）
  await setUserSession(event, {
    member: {
      id: customer.id,
      name: decryptUtf8(customer.name),
    },
    memberLoggedInAt: new Date().toISOString(),
  })

  return { ok: true }
})
