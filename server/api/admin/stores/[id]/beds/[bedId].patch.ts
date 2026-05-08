import { Prisma } from '@prisma/client'
import { updateBedSchema } from '../../../../../../shared/schemas/bed'
import { prisma } from '../../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const storeId = Number(getRouterParam(event, 'id'))
  const bedId = Number(getRouterParam(event, 'bedId'))
  if (!Number.isInteger(storeId) || storeId <= 0 || !Number.isInteger(bedId) || bedId <= 0) {
    throw createError({ statusCode: 400, statusMessage: '不正な ID です' })
  }

  const body = await readBody(event)
  const parsed = updateBedSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: '入力内容に誤りがあります',
      data: { issues: parsed.error.issues },
    })
  }

  // bedId が当該店舗のものか確認
  const bed = await prisma.bed.findFirst({ where: { id: bedId, storeId }, select: { id: true } })
  if (!bed) {
    throw createError({ statusCode: 404, statusMessage: 'ベッドが見つかりません' })
  }

  try {
    return await prisma.bed.update({ where: { id: bedId }, data: parsed.data })
  }
  catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw createError({ statusCode: 409, statusMessage: '同名のベッドがすでに存在します' })
    }
    throw e
  }
})
