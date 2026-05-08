import { prisma } from '../../../../../utils/prisma'

// 1 店舗の部分閉店レンジ一覧（日付昇順、同日内は startTime 昇順）
export default defineEventHandler(async (event) => {
  const storeId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(storeId) || storeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: '不正な店舗 ID です' })
  }

  return await prisma.closure.findMany({
    where: { storeId },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  })
})
