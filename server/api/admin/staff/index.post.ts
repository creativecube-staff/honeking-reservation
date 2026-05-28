import { Prisma } from '@prisma/client'
import { createStaffSchema } from '../../../../shared/schemas/staff'
import { prisma } from '../../../utils/prisma'
import { requirePermission } from '../../../utils/requirePermission'
import { resolveStoreScope } from '../../../utils/storeScope'

// スタッフ新規作成。Login（管理画面ログイン）とは無関係に Staff だけを作る。
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

  // 越権ガード（OWNER 以外は自店のみ）
  await resolveStoreScope(event, parsed.data.storeId)

  // 指定された店舗が存在することを確認
  const store = await prisma.store.findUnique({
    where: { id: parsed.data.storeId },
    select: { id: true },
  })
  if (!store) {
    throw createError({ statusCode: 400, statusMessage: '指定された店舗が見つかりません' })
  }

  try {
    const created = await prisma.staff.create({
      data: {
        storeId: parsed.data.storeId,
        name: parsed.data.name,
        gender: parsed.data.gender ?? null,
        role: parsed.data.role ?? null,
        baseShiftDays: parsed.data.baseShiftDays,
        displayOrder: parsed.data.displayOrder,
        assignOrder: parsed.data.assignOrder,
        isActive: parsed.data.isActive,
        isAssignable: parsed.data.isAssignable,
      },
      select: {
        id: true, storeId: true, name: true, gender: true, role: true, baseShiftDays: true,
        displayOrder: true, assignOrder: true, isActive: true, isAssignable: true,
        createdAt: true, updatedAt: true,
      },
    })
    return created
  }
  catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
      throw createError({ statusCode: 400, statusMessage: '指定された店舗が見つかりません' })
    }
    throw e
  }
})
