import { prisma } from '~~/server/utils/prisma'
import { displayStatus } from '~~/shared/reservationStatus'

// 会員: 自分の予約一覧
// - 未来の CONFIRMED → 上、過去 → 下、両方とも開始時刻順
// - キャンセル・変更は店舗対応のため、操作 API はない（表示のみ）
// - 店舗電話番号も一緒に返す（マイページで「お電話で変更」案内に使う）

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session.member?.id) {
    throw createError({ statusCode: 401, statusMessage: 'ログインが必要です' })
  }

  const reservations = await prisma.reservation.findMany({
    where: { customerId: session.member.id },
    orderBy: { startAt: 'desc' },
    select: {
      id: true,
      startAt: true,
      endAt: true,
      status: true,
      confirmationCode: true,
      note: true,
      store: { select: { id: true, name: true, slug: true, phone: true, address: true, isActive: true } },
      menu: { select: { id: true, name: true, durationMinutes: true, priceJpy: true, isActive: true } },
      staff: { select: { id: true, name: true } },
    },
  })

  // displayStatus（CONFIRMED + 過去 → COMPLETED 扱い）も付与
  // 担当者名はマイページ表示用に staffName として返す（互換維持のため practitionerName も同値で残す）
  return reservations.map(r => ({
    id: r.id,
    startAt: r.startAt.toISOString(),
    endAt: r.endAt.toISOString(),
    status: r.status,
    displayStatus: displayStatus(r.status, r.endAt),
    confirmationCode: r.confirmationCode,
    note: r.note,
    store: r.store,
    menu: r.menu,
    staffName: r.staff.name,
    practitionerName: r.staff.name,
  }))
})
