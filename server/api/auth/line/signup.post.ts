import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'
import { lineSignupSchema } from '~~/shared/schemas/member'
import { MEMBER_TERMS_VERSION } from '~~/shared/memberTerms'
import { encryptUtf8 } from '~~/server/utils/crypto'
import { hashEmail, hashName, hashPhone } from '~~/server/utils/hash'
import { isPendingLineLinkFresh } from '~~/server/utils/lineLogin'
import { prisma } from '~~/server/utils/prisma'

// LINE 経由の新規会員登録。
// POST /api/auth/line/signup  { email, password, name, phone, agreeTerms }
//
// 仕様（CLAUDE.md セッションで合意済み）:
// - 必ずパスワードも作らせる（LINE 紐付けは追加チャネル扱い）
// - LINE が email を提供した場合は emailVerifiedAt = now にして認証メールは送らない
// - LINE が email を出さなかった場合（または body の email が LINE と異なる場合）は emailVerifiedAt = null → 通常の認証メール導線
//
// session.pendingLineLink が無い／期限切れの場合は通常の signup に誘導する 400 を返す。

const BCRYPT_COST = 10

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = lineSignupSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: '入力内容に誤りがあります',
      data: { issues: parsed.error.issues },
    })
  }

  const session = await getUserSession(event)
  const pending = session.pendingLineLink
  if (!pending || !isPendingLineLinkFresh(pending.issuedAt)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'LINE 連携の有効期限が切れました。もう一度 LINE でログインし直してください。',
    })
  }

  const { email, password, name, phone } = parsed.data
  const emailHash = hashEmail(email)
  const phoneHash = hashPhone(phone)
  const nameHash = hashName(name)
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST)
  const now = new Date()

  // LINE 提供メアドと入力メアドが完全一致する場合のみ「認証メール省略」扱いにする
  const lineProvidedEmail = pending.email?.trim().toLowerCase()
  const isEmailFromLine = !!lineProvidedEmail && lineProvidedEmail === email
  const emailVerifiedAt = isEmailFromLine ? now : null

  // 既存 Customer 検索: emailHash で
  const existing = await prisma.customer.findUnique({
    where: { emailHash },
    select: { id: true, passwordHash: true, emailVerifiedAt: true, lineUserId: true, withdrawnAt: true },
  })

  if (existing && !existing.withdrawnAt && existing.passwordHash && existing.emailVerifiedAt) {
    // 既に本会員 → このルートで自動マージしてしまうと「他人の LINE で既存会員に紐付け」が成立してしまうため拒否
    throw createError({
      statusCode: 409,
      statusMessage: 'このメールアドレスはすでに会員登録されています。一度 LINE 連携を中止し、メアド+パスワードでログイン後、マイページから LINE を連携してください。',
    })
  }

  // 別 Customer が同じ lineUserId を持っていないか保険チェック
  const lineConflict = await prisma.customer.findUnique({
    where: { lineUserId: pending.lineUserId },
    select: { id: true },
  })
  if (lineConflict && lineConflict.id !== existing?.id) {
    throw createError({
      statusCode: 409,
      statusMessage: 'この LINE アカウントは別の会員に既に連携されています。',
    })
  }

  let customerId: number
  try {
    if (existing) {
      // 仮登録中 / ゲスト顧客 / 退会済 → 復活アップグレード
      const updated = await prisma.customer.update({
        where: { id: existing.id },
        data: {
          name: encryptUtf8(name),
          nameHash,
          phone: encryptUtf8(phone),
          phoneHash,
          passwordHash,
          emailVerifiedAt,
          termsAgreedAt: now,
          termsVersionAgreedAt: MEMBER_TERMS_VERSION,
          withdrawnAt: null,
          lineUserId: pending.lineUserId,
          lineDisplayName: pending.lineDisplayName ?? null,
        },
        select: { id: true },
      })
      customerId = updated.id
    }
    else {
      const created = await prisma.customer.create({
        data: {
          name: encryptUtf8(name),
          nameHash,
          phone: encryptUtf8(phone),
          phoneHash,
          email: encryptUtf8(email),
          emailHash,
          passwordHash,
          emailVerifiedAt,
          termsAgreedAt: now,
          termsVersionAgreedAt: MEMBER_TERMS_VERSION,
          lineUserId: pending.lineUserId,
          lineDisplayName: pending.lineDisplayName ?? null,
        },
        select: { id: true },
      })
      customerId = created.id
    }
  }
  catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw createError({
        statusCode: 409,
        statusMessage: 'この電話番号またはメールアドレスは他のお客様の登録情報と一致しました。お電話でお問い合わせください。',
      })
    }
    throw e
  }

  if (isEmailFromLine) {
    // 認証メールスキップ → 即セッション発行
    await prisma.customer.update({
      where: { id: customerId },
      data: { lastLoginAt: now },
    })
    await setUserSession(event, {
      member: {
        id: customerId,
        name,
      },
      memberLoggedInAt: now.toISOString(),
    })
    return { ok: true, verified: true }
  }

  // 入力メアドが LINE と異なる（または LINE が email を出さなかった）→ 認証メール送信
  const { generateMemberToken, emailVerificationExpiresAt } = await import('~~/server/utils/memberToken')
  const { sendMail } = await import('~~/server/utils/mail')
  const { renderEmailVerification } = await import('~~/server/utils/mailTemplates')

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
    console.error('[auth/line/signup] mail send failed:', (e as Error)?.message)
    return { ok: true, verified: false, mailSent: false }
  }

  return { ok: true, verified: false, mailSent: true }
})
