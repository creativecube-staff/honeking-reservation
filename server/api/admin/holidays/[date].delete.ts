import { prisma } from '~~/server/utils/prisma'
import { requireUser } from '~~/server/utils/requirePermission'

// 指定日付の店休日を全店から一括削除する。OWNER のみ。
// パス: /api/admin/holidays/2026-12-30
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (user.role !== 'OWNER') {
    throw createError({ statusCode: 403, statusMessage: 'オーナーのみ実行できます' })
  }

  const dateParam = getRouterParam(event, 'date')
  if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    throw createError({ statusCode: 400, statusMessage: '日付は YYYY-MM-DD 形式で指定してください' })
  }
  const date = new Date(dateParam)

  const r = await prisma.holiday.deleteMany({ where: { date } })
  return { ok: true, deleted: r.count }
})
