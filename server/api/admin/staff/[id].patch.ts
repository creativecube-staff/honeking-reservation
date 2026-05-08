import { Prisma } from '@prisma/client'
import { updateStaffSchema } from '../../../../shared/schemas/staff'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
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

  try {
    return await prisma.practitioner.update({ where: { id }, data: parsed.data })
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
