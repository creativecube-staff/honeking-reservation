import { prisma } from '../../../utils/prisma'

// お客様側: 店舗で予約可能なメニュー一覧。
// - 共通メニュー（storeId IS NULL）+ その店舗の特別メニュー（storeId = this store）
// - isActive のみ
// - 表示期間 availableUntil が過去のものは除外（availableFrom は予約対象日が決まる次画面でチェック）
// - この店舗で「非表示」設定（MenuStoreExclusion）の共通メニューは除外
// - 「対象日に差し替えアクティブな店舗特別メニュー」がある共通メニューは自動的に除外
//   （期間終了で自動的に共通メニューへ戻る挙動はこの判定で実現）
//
// ?date=YYYY-MM-DD が指定されればその日付で availableFrom/availableUntil を厳密フィルタ。
// 指定なしの場合は「今日以降に予約可能な可能性があるもの」を返す（=availableUntil >= today）。
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'slug が指定されていません' })
  }
  const query = getQuery(event)
  const dateStr = typeof query.date === 'string' ? query.date : ''

  const store = await prisma.store.findUnique({
    where: { slug },
    select: { id: true, isActive: true },
  })
  if (!store || !store.isActive) {
    throw createError({ statusCode: 404, statusMessage: '店舗が見つかりません' })
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // 表示期間フィルタの基準日
  const targetDate = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? new Date(dateStr) : today

  const menus = await prisma.menu.findMany({
    where: {
      isActive: true,
      OR: [
        // 共通メニューだがこの店舗で「非表示」と除外されていない
        {
          storeId: null,
          NOT: { excludedStores: { some: { storeId: store.id } } },
        },
        // この店舗の特別メニュー
        { storeId: store.id },
      ],
    },
    orderBy: [
      { storeId: 'asc' }, // 共通メニュー（null）が先に来る
      { displayOrder: 'asc' },
      { id: 'asc' },
    ],
    select: {
      id: true,
      storeId: true,
      name: true,
      description: true,
      durationMinutes: true,
      priceJpy: true,
      availableFrom: true,
      availableUntil: true,
      replacesMenuId: true,
    },
  })

  // この店舗で、対象日に「アクティブ」な店舗特別メニューが差し替えている共通メニュー ID の集合。
  // アクティブ = isActive=true（DB where 済み）かつ対象日が availableFrom..availableUntil に入る。
  const replacedCommonIds = new Set<number>()
  for (const m of menus) {
    if (m.storeId !== store.id || m.replacesMenuId == null) continue
    if (m.availableFrom && targetDate < m.availableFrom) continue
    if (m.availableUntil && targetDate > m.availableUntil) continue
    replacedCommonIds.add(m.replacesMenuId)
  }

  return menus.filter((m) => {
    // 共通メニューが対象日にアクティブな差し替え対象を持っていれば除外（=その日は店舗特別メニューで上書き）
    if (m.storeId === null && replacedCommonIds.has(m.id)) return false

    // date 指定があれば対象日 within [from, until]
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      if (m.availableFrom && targetDate < m.availableFrom) return false
      if (m.availableUntil && targetDate > m.availableUntil) return false
      return true
    }
    // date 指定なし: 過去キャンペーン（availableUntil < today）だけ除外
    if (m.availableUntil && m.availableUntil < today) return false
    return true
  })
})
