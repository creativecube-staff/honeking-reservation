import { prisma } from '../../../../../utils/prisma'

// 7 曜日分の営業時間を返す（不足分は isClosed=false ・時刻 null のデフォルト行で埋める）
export default defineEventHandler(async (event) => {
  const storeId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(storeId) || storeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: '不正な店舗 ID です' })
  }

  const rows = await prisma.businessHour.findMany({
    where: { storeId },
    orderBy: { dayOfWeek: 'asc' },
  })
  const byDow = new Map(rows.map(r => [r.dayOfWeek, r]))

  return Array.from({ length: 7 }, (_, dayOfWeek) => {
    const r = byDow.get(dayOfWeek)
    return r ?? {
      id: null as number | null,
      storeId,
      dayOfWeek,
      isClosed: false,
      openTime: null as string | null,
      closeTime: null as string | null,
      breakStartTime: null as string | null,
      breakEndTime: null as string | null,
      createdAt: null,
      updatedAt: null,
    }
  })
})
