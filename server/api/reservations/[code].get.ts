import { decryptUtf8 } from '../../utils/crypto'
import { prisma } from '../../utils/prisma'

// お客様側: 予約コードから予約詳細を取得（完了画面・確認用）。
// 予約コード（8 文字英数字）を知っている人だけがアクセス可能。
// 推測困難な十分なエントロピー（32^8 ≈ 1.1 兆通り）なので、認証トークン代わりに使う。
export default defineEventHandler(async (event) => {
  const code = getRouterParam(event, 'code')
  if (!code || !/^[A-Z0-9]{8}$/.test(code)) {
    throw createError({ statusCode: 400, statusMessage: '予約コードの形式が不正です' })
  }

  const reservation = await prisma.reservation.findUnique({
    where: { confirmationCode: code },
    include: {
      store: { select: { id: true, name: true, address: true, phone: true } },
      menu: { select: { id: true, name: true, durationMinutes: true, priceJpy: true } },
      customer: { select: { name: true } }, // 暗号化値（後で復号）
    },
  })

  if (!reservation) {
    throw createError({ statusCode: 404, statusMessage: '予約が見つかりません' })
  }

  // 顧客名は暗号化されているので復号して返す
  // ※ 失敗しても予約自体は表示できるよう、エラーは握りつぶす
  let customerName: string | null = null
  try {
    customerName = decryptUtf8(reservation.customer.name)
  }
  catch {
    customerName = null
  }

  return {
    confirmationCode: reservation.confirmationCode,
    status: reservation.status,
    startAt: reservation.startAt,
    endAt: reservation.endAt,
    note: reservation.note,
    store: reservation.store,
    menu: reservation.menu,
    customerName,
  }
})
