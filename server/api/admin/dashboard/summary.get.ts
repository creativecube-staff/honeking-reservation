import { prisma } from '../../../utils/prisma'

// ダッシュボード概要ウィジェット用のカウント
export default defineEventHandler(async () => {
  const [stores, beds, staff, menus, holidaysFuture] = await Promise.all([
    prisma.store.count({ where: { isActive: true } }),
    prisma.bed.count({ where: { isActive: true } }),
    prisma.practitioner.count({ where: { isActive: true } }),
    prisma.menu.count({ where: { isActive: true } }),
    prisma.holiday.count({ where: { date: { gte: new Date() } } }),
  ])

  return {
    stores,
    beds,
    staff,
    menus,
    holidaysFuture,
  }
})
