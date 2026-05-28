import { Prisma } from '@prisma/client'
import { updateStaffSchema } from '../../../../shared/schemas/staff'
import { prisma } from '../../../utils/prisma'
import { requirePermission } from '../../../utils/requirePermission'
import { resolveStoreScope } from '../../../utils/storeScope'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'staff:edit')

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '不正な ID です' })
  }

  const body = await readBody(event)
  const parsed = updateStaffSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: '入力内容に誤りがあります',
      data: { issues: parsed.error.issues },
    })
  }

  // 既存スタッフの所属店舗で越権ガード（OWNER 以外は自店のみ操作可）
  const existing = await prisma.staff.findUnique({ where: { id }, select: { storeId: true } })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'スタッフが見つかりません' })
  }
  await resolveStoreScope(event, existing.storeId)

  try {
    return await prisma.staff.update({
      where: { id },
      data: parsed.data,
      select: {
        id: true, storeId: true, name: true, gender: true, role: true, baseShiftDays: true,
        displayOrder: true, assignOrder: true, isActive: true, isAssignable: true,
        createdAt: true, updatedAt: true,
      },
    })
  }
  catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2025') {
        throw createError({ statusCode: 404, statusMessage: 'スタッフが見つかりません' })
      }
      if (e.code === 'P2003') {
        throw createError({ statusCode: 400, statusMessage: '指定された店舗が見つかりません' })
      }
    }
    throw e
  }
})
