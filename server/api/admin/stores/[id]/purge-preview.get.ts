import { prisma } from '~~/server/utils/prisma'
import { requireUser } from '~~/server/utils/requirePermission'
import { computeStoreBlastRadius } from '~~/server/utils/storePurge'

// 完全削除（物理削除）の影響範囲プレビュー。
// 消えるデータの件数と、削除可否(canPurge)・拒否理由を返す。実削除は purge.delete.ts。
// 破壊的操作なので OWNER のみ。
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (user.role !== 'OWNER') {
    throw createError({ statusCode: 403, statusMessage: 'オーナーのみ実行できます' })
  }

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '不正な ID です' })
  }

  const store = await prisma.store.findUnique({
    where: { id },
    select: { id: true, name: true, slug: true, isActive: true },
  })
  if (!store) {
    throw createError({ statusCode: 404, statusMessage: '店舗が見つかりません' })
  }

  const blast = await computeStoreBlastRadius(id)

  // 削除を拒否する条件（理由を文章で返し、UI でそのまま表示する）
  const reasons: string[] = []
  if (store.isActive) {
    reasons.push('有効な店舗は完全削除できません。先に無効化してください。')
  }
  if (blast.crossStoreReservations > 0) {
    reasons.push(`この店舗のスタッフが他店の予約を ${blast.crossStoreReservations} 件担当しています。完全削除すると他店のデータを巻き込むため実行できません。`)
  }

  return {
    store,
    counts: blast.counts,
    crossStoreReservations: blast.crossStoreReservations,
    canPurge: reasons.length === 0,
    reasons,
  }
})
