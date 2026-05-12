import { Prisma } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { createStaffSchema } from '../../../../shared/schemas/staff'
import { prisma } from '../../../utils/prisma'
import { requirePermission } from '../../../utils/requirePermission'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'staff:edit')

  const body = await readBody(event)
  const parsed = createStaffSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: '入力内容に誤りがあります',
      data: { issues: parsed.error.issues },
    })
  }

  // 指定された店舗が存在することを確認
  const store = await prisma.store.findUnique({
    where: { id: parsed.data.storeId },
    select: { id: true },
  })
  if (!store) {
    throw createError({ statusCode: 400, statusMessage: '指定された店舗が見つかりません' })
  }

  const { password, username, role, permissions, canLogin, ...rest } = parsed.data

  // canLogin の状態に応じて、ログイン関連フィールドをセット or null クリアする。
  const loginFields = canLogin
    ? {
        canLogin: true,
        username: username || null,
        passwordHash: password ? await bcrypt.hash(password, 10) : null,
        role: role ?? null,
        permissions: permissions ?? [],
      }
    : {
        canLogin: false,
        username: null,
        passwordHash: null,
        role: null,
        permissions: [],
      }

  try {
    const created = await prisma.practitioner.create({
      data: { ...rest, ...loginFields },
      select: {
        id: true, storeId: true, name: true, displayOrder: true, isActive: true,
        isAssignable: true, canLogin: true, username: true, role: true, permissions: true,
        createdAt: true, updatedAt: true,
      },
    })
    return created
  }
  catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2003') {
        throw createError({ statusCode: 400, statusMessage: '指定された店舗が見つかりません' })
      }
      if (e.code === 'P2002') {
        throw createError({ statusCode: 409, statusMessage: 'そのユーザー名は既に使われています' })
      }
    }
    throw e
  }
})
