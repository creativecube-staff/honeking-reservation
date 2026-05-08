import { businessHoursBulkSchema } from '../../../../../../shared/schemas/businessHour'
import { prisma } from '../../../../../utils/prisma'

// 1 店舗の営業時間レンジを全置換（deleteMany → createMany）
// 店休 = 該当 dayOfWeek を ranges に含めない
// 同一日内のレンジ重複・隣接は許容しない（startTime 昇順で前のレンジの endTime <= 次の startTime）
export default defineEventHandler(async (event) => {
  const storeId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(storeId) || storeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: '不正な店舗 ID です' })
  }

  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { id: true } })
  if (!store) {
    throw createError({ statusCode: 404, statusMessage: '店舗が見つかりません' })
  }

  const body = await readBody(event)
  const parsed = businessHoursBulkSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: '入力内容に誤りがあります',
      data: { issues: parsed.error.issues },
    })
  }

  // 同一日内のレンジ重複検証（startTime でソートし、前 endTime <= 次 startTime）
  const byDow = new Map<number, { startTime: string, endTime: string }[]>()
  for (const r of parsed.data.ranges) {
    if (!byDow.has(r.dayOfWeek)) byDow.set(r.dayOfWeek, [])
    byDow.get(r.dayOfWeek)!.push({ startTime: r.startTime, endTime: r.endTime })
  }
  for (const [dow, ranges] of byDow) {
    ranges.sort((a, b) => a.startTime.localeCompare(b.startTime))
    for (let i = 1; i < ranges.length; i++) {
      if (ranges[i - 1]!.endTime > ranges[i]!.startTime) {
        throw createError({
          statusCode: 400,
          statusMessage: `曜日 ${dow} のレンジが重複しています`,
        })
      }
    }
  }

  // 全置換: 既存レンジを delete、新規 createMany
  await prisma.$transaction([
    prisma.businessHour.deleteMany({ where: { storeId } }),
    prisma.businessHour.createMany({
      data: parsed.data.ranges.map(r => ({
        storeId,
        dayOfWeek: r.dayOfWeek,
        startTime: r.startTime,
        endTime: r.endTime,
      })),
    }),
  ])

  return { ok: true, count: parsed.data.ranges.length }
})
