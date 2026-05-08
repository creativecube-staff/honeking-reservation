import { Prisma } from '@prisma/client'
import { prisma } from '../../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const storeId = Number(getRouterParam(event, 'id'))
  const holidayId = Number(getRouterParam(event, 'holidayId'))
  if (!Number.isInteger(storeId) || storeId <= 0 || !Number.isInteger(holidayId) || holidayId <= 0) {
    throw createError({ statusCode: 400, statusMessage: '不正な ID です' })
  }

  const holiday = await prisma.holiday.findFirst({
    where: { id: holidayId, storeId },
    select: { id: true },
  })
  if (!holiday) {
    throw createError({ statusCode: 404, statusMessage: '店休日が見つかりません' })
  }

  try {
    return await prisma.holiday.delete({ where: { id: holidayId } })
  }
  catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      throw createError({ statusCode: 404, statusMessage: '店休日が見つかりません' })
    }
    throw e
  }
})
