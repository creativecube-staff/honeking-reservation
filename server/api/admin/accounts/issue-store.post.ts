import { Prisma } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { encryptUtf8 } from '~~/server/utils/crypto'
import { generatePassword } from '~~/server/utils/generatePassword'
import { prisma } from '~~/server/utils/prisma'
import { requireUser } from '~~/server/utils/requirePermission'

// ログインアカウントを持たない既存店舗（シードで作られた店舗など）に、
// 店舗ログイン（店長相当・自店固定）を後から発行する。OWNER のみ。パスワードは自動生成。
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (user.role !== 'OWNER') {
    throw createError({ statusCode: 403, statusMessage: 'オーナーのみ実行できます' })
  }

  const body = await readBody(event).catch(() => null) as Record<string, unknown> | null
  const storeId = Number(body?.storeId)
  if (!Number.isInteger(storeId) || storeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: '店舗 ID が不正です' })
  }

  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { id: true, name: true, slug: true } })
  if (!store) {
    throw createError({ statusCode: 404, statusMessage: '店舗が見つかりません' })
  }

  // 既に店舗ログイン（MANAGER）があれば二重発行しない（パスワード再発行を使ってもらう）
  const existing = await prisma.practitioner.findFirst({
    where: { storeId, canLogin: true, role: 'MANAGER' },
    select: { id: true },
  })
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'この店舗には既にログインアカウントがあります。パスワード再発行をご利用ください。' })
  }

  const password = generatePassword()
  const passwordHash = await bcrypt.hash(password, 10)

  try {
    const account = await prisma.practitioner.create({
      data: {
        storeId: store.id,
        name: store.name,
        displayOrder: 0,
        isActive: true,
        isAssignable: false,
        canLogin: true,
        username: store.slug,
        passwordHash,
        passwordEnc: encryptUtf8(password),
        role: 'MANAGER',
        permissions: [],
      },
      select: { username: true },
    })
    return { ok: true, username: account.username, password }
  }
  catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw createError({ statusCode: 409, statusMessage: `ログイン ID「${store.slug}」は既に使われています` })
    }
    throw e
  }
})
