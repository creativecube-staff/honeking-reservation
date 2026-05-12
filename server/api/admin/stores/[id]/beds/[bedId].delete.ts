import { Prisma } from '@prisma/client'
import { prisma } from '../../../../../utils/prisma'

// 予約履歴が無ければ物理削除、あれば論理削除（isActive=false）。
// レスポンス:
//   { mode: 'deleted' }                — 物理削除した
//   { mode: 'deactivated', reservationCount } — 予約があり論理削除に切り替えた
export default defineEventHandler(async (event) => {
  const storeId = Number(getRouterParam(event, 'id'))
  const bedId = Number(getRouterParam(event, 'bedId'))
  if (!Number.isInteger(storeId) || storeId <= 0 || !Number.isInteger(bedId) || bedId <= 0) {
    throw createError({ statusCode: 400, statusMessage: '不正な ID です' })
  }

  const bed = await prisma.bed.findFirst({ where: { id: bedId, storeId }, select: { id: true } })
  if (!bed) {
    throw createError({ statusCode: 404, statusMessage: 'ベッドが見つかりません' })
  }

  const reservationCount = await prisma.reservation.count({ where: { bedId } })

  if (reservationCount === 0) {
    try {
      await prisma.bed.delete({ where: { id: bedId } })
      return { mode: 'deleted' as const }
    }
    catch (e) {
      // 何らかの理由で物理削除が失敗したら論理削除に fallback
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        await prisma.bed.update({ where: { id: bedId }, data: { isActive: false } })
        return { mode: 'deactivated' as const, reservationCount: 0, fallback: true }
      }
      throw e
    }
  }

  // 予約あり → 論理削除
  await prisma.bed.update({ where: { id: bedId }, data: { isActive: false } })
  return { mode: 'deactivated' as const, reservationCount }
})
