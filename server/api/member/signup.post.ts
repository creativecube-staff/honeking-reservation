import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'
import { memberSignupSchema } from '~~/shared/schemas/member'
import { MEMBER_TERMS_VERSION } from '~~/shared/memberTerms'
import { encryptUtf8 } from '~~/server/utils/crypto'
import { hashEmail, hashName, hashPhone } from '~~/server/utils/hash'
import { prisma } from '~~/server/utils/prisma'
import { generateMemberToken, emailVerificationExpiresAt } from '~~/server/utils/memberToken'
import { sendMail } from '~~/server/utils/mail'
import { renderEmailVerification } from '~~/server/utils/mailTemplates'

// 会員登録（仮登録）
//
// フロー:
// 1. 入力バリデーション（email, password, name, phone, 規約同意）
// 2. emailHash で既存 Customer を検索
//    - 既存あり + passwordHash あり + emailVerifiedAt あり => 「すでに会員登録済」エラー
//    - 既存あり + passwordHash あり + emailVerifiedAt なし => 仮登録中 -> パスワード更新 + 新トークン発行
//    - 既存あり + passwordHash なし                       => ゲスト予約済客のアップグレード
//    - 既存なし                                            => 新規作成
// 3. EmailVerificationToken を発行
// 4. 認証メールを送信（失敗してもユーザーには 200 を返す: メアド漏洩防止と再送導線の都合）
//
// セキュリティ:
// - パスワード: bcrypt(cost=10)
// - email/name/phone: AES-256-GCM 暗号化保存
// - 「既に登録済」エラーはメアド存在の漏洩につながるが、signup の文脈では仕方ない
//   (login や password-reset では存在漏洩を防ぐ実装にする)

const BCRYPT_COST = 10

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = memberSignupSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: '入力内容に誤りがあります',
      data: { issues: parsed.error.issues },
    })
  }
  const { email, password, name, phone } = parsed.data

  const emailHash = hashEmail(email)
  const phoneHash = hashPhone(phone)
  const nameHash = hashName(name)
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST)
  const now = new Date()

  // 既存顧客チェック（emailHash で同定）
  const existing = await prisma.customer.findUnique({
    where: { emailHash },
    select: { id: true, passwordHash: true, emailVerifiedAt: true, nameHash: true, phoneHash: true },
  })

  let customerId: number

  if (existing) {
    // すでにメール認証まで完了した会員 → 拒否
    if (existing.passwordHash && existing.emailVerifiedAt) {
      throw createError({
        statusCode: 409,
        statusMessage: 'このメールアドレスはすでに会員登録されています。ログインまたはパスワード再設定をご利用ください。',
      })
    }

    // 仮登録中 or ゲスト顧客のアップグレード → 既存行を更新
    // 既存の name/phone と新規入力が異なる場合は新規入力で上書き（最新の自己申告を尊重）
    // nameHash / phoneHash の重複が他人と起きる場合は P2002 → 案内
    try {
      const updated = await prisma.customer.update({
        where: { id: existing.id },
        data: {
          name: encryptUtf8(name),
          nameHash,
          phone: encryptUtf8(phone),
          phoneHash,
          passwordHash,
          emailVerifiedAt: null, // 再度の認証が必要
          termsAgreedAt: now,
          termsVersionAgreedAt: MEMBER_TERMS_VERSION,
        },
        select: { id: true },
      })
      customerId = updated.id
    }
    catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        // phoneHash か emailHash の衝突（既存の他人が同じ連絡先で登録済）
        throw createError({
          statusCode: 409,
          statusMessage: 'この電話番号またはメールアドレスは既に登録されています。',
        })
      }
      throw e
    }
  }
  else {
    // 新規 Customer 作成
    try {
      const created = await prisma.customer.create({
        data: {
          name: encryptUtf8(name),
          nameHash,
          phone: encryptUtf8(phone),
          phoneHash,
          email: encryptUtf8(email),
          emailHash,
          passwordHash,
          emailVerifiedAt: null,
          termsAgreedAt: now,
          termsVersionAgreedAt: MEMBER_TERMS_VERSION,
        },
        select: { id: true },
      })
      customerId = created.id
    }
    catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        // nameHash か phoneHash か emailHash の衝突。
        // emailHash は上で findUnique 済なのでほぼ来ない。残りは他人と被ったケース。
        throw createError({
          statusCode: 409,
          statusMessage: '入力された情報は他のお客様の登録情報と一致しました。お電話でお問い合わせください。',
        })
      }
      throw e
    }
  }

  // 認証トークン発行
  // 既存の未使用トークンがあれば消す（最新 1 件だけ有効にする運用）
  await prisma.emailVerificationToken.deleteMany({
    where: { customerId, usedAt: null },
  })
  const token = generateMemberToken()
  await prisma.emailVerificationToken.create({
    data: {
      customerId,
      token,
      expiresAt: emailVerificationExpiresAt(),
    },
  })

  // 認証メール送信
  // 失敗時もユーザーには 200 を返す方針（再送導線でカバーする）
  try {
    const mail = renderEmailVerification({ customerName: name, token })
    await sendMail({
      to: email,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    })
  }
  catch (e) {
    // 個人情報を含むメアドはログに残さない。メッセージのみログ。
    console.error('[member/signup] mail send failed:', (e as Error)?.message)
    // ユーザーには成功レスポンスを返すが、再送導線が必要な旨を含める
    return {
      ok: true,
      mailSent: false,
      message: 'ご登録ありがとうございます。確認メールの送信に失敗しました。お手数ですが時間をおいて再度お試しいただくか、お問い合わせください。',
    }
  }

  return { ok: true, mailSent: true }
})
