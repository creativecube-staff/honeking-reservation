import { Prisma } from '@prisma/client'
import { memberProfileUpdateSchema } from '~~/shared/schemas/member'
import { encryptUtf8 } from '~~/server/utils/crypto'
import { hashName, hashPhone } from '~~/server/utils/hash'
import { prisma } from '~~/server/utils/prisma'

// 会員: 氏名・電話番号の更新
// メアドの変更はここでは扱わない（再認証フローのため /email-change/* で別建て）
//
// セキュリティ:
// - session.member.id でログイン会員を識別
// - 名前/電話の値は AES-256-GCM 暗号化、検索 hash 併せて更新
// - phoneHash の unique 衝突 → 他人と被るので 409

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session.member?.id) {
    throw createError({ statusCode: 401, statusMessage: 'ログインが必要です' })
  }

  const body = await readBody(event)
  const parsed = memberProfileUpdateSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: '入力内容に誤りがあります',
      data: { issues: parsed.error.issues },
    })
  }
  const { name, phone } = parsed.data

  try {
    await prisma.customer.update({
      where: { id: session.member.id },
      data: {
        name: encryptUtf8(name),
        nameHash: hashName(name),
        phone: encryptUtf8(phone),
        phoneHash: hashPhone(phone),
      },
    })
  }
  catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw createError({
        statusCode: 409,
        statusMessage: 'この電話番号は既に他のお客様が登録しています。',
      })
    }
    throw e
  }

  // セッションの表示名も即時更新
  await setUserSession(event, {
    member: {
      id: session.member.id,
      name,
    },
  })

  return { ok: true }
})
