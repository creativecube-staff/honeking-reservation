import { prisma } from '../../../../../utils/prisma'

// 1 店舗の全営業時間レンジを返す
// dayOfWeek 順、同一曜日内は startTime 順
// 店休日は単に該当 dayOfWeek の行が 0 件、で表現される
export default defineEventHandler(async (event) => {
  const storeId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(storeId) || storeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: '不正な店舗 ID です' })
  }

  const rows = await prisma.businessHour.findMany({
    where: { storeId },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    select: {
      id: true,
      dayOfWeek: true,
      startTime: true,
      endTime: true,
    },
  })

  return rows
})
