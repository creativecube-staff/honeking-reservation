import { prisma } from '../../../utils/prisma'

// ダッシュボード概要ウィジェット用のカウント
export default defineEventHandler(async () => {
  // 日本時間の「今日」「今週(月-日)」を計算
  const now = new Date()
  const jstNow = new Date(now.getTime() + 9 * 3600_000)
  const y = jstNow.getUTCFullYear()
  const m = jstNow.getUTCMonth()
  const d = jstNow.getUTCDate()
  // 今日の JST 0:00 を UTC で表現
  const todayStart = new Date(Date.UTC(y, m, d, -9, 0, 0))
  const todayEnd = new Date(todayStart.getTime() + 86_400_000)
  // 今週: 日曜始まり〜土曜
  const todayDow = jstNow.getUTCDay()
  const weekStart = new Date(todayStart.getTime() - todayDow * 86_400_000)
  const weekEnd = new Date(weekStart.getTime() + 7 * 86_400_000)

  const [stores, beds, staff, menus, holidaysFuture, todayReservations, weekReservations, upcomingConfirmed] = await Promise.all([
    prisma.store.count({ where: { isActive: true } }),
    prisma.bed.count({ where: { isActive: true } }),
    prisma.practitioner.count({ where: { isActive: true } }),
    prisma.menu.count({ where: { isActive: true } }),
    prisma.holiday.count({ where: { date: { gte: todayStart } } }),
    prisma.reservation.count({
      where: {
        status: 'CONFIRMED',
        startAt: { gte: todayStart, lt: todayEnd },
      },
    }),
    prisma.reservation.count({
      where: {
        status: 'CONFIRMED',
        startAt: { gte: weekStart, lt: weekEnd },
      },
    }),
    prisma.reservation.count({
      where: {
        status: 'CONFIRMED',
        startAt: { gte: now },
      },
    }),
  ])

  return {
    stores,
    beds,
    staff,
    menus,
    holidaysFuture,
    todayReservations,
    weekReservations,
    upcomingConfirmed,
  }
})
