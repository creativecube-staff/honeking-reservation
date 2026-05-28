// 一回限りの「店休日 + 祝日」データ補充スクリプト。
// 冪等動作（upsert / createMany skipDuplicates）。何度流しても既存データは壊さない。
//
// 投入対象:
//   - 店休日 (Holiday): 年末年始 12/29 - 1/3 を 2026〜2028 年度ぶん、全有効店舗に追加
//   - 祝日 (PublicHoliday): 2026〜2028 年の国民の祝日（2026-2027 は seed と同一、2028 は新規）
//
// 実行: docker compose exec -T nuxt node prisma/backfill-holidays-2026-2028.mjs

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ── 店休日（年末年始） ─────────────────────────────────
// 各年度の年末年始 6 日。最終日 1/3 は翌年の日付。
const STORE_HOLIDAYS = [
  // 2026 年度末 → 2027 年始
  { date: '2026-12-29', note: '年末年始' },
  { date: '2026-12-30', note: '年末年始' },
  { date: '2026-12-31', note: '年末年始' },
  { date: '2027-01-01', note: '年末年始' },
  { date: '2027-01-02', note: '年末年始' },
  { date: '2027-01-03', note: '年末年始' },
  // 2027 年度末 → 2028 年始
  { date: '2027-12-29', note: '年末年始' },
  { date: '2027-12-30', note: '年末年始' },
  { date: '2027-12-31', note: '年末年始' },
  { date: '2028-01-01', note: '年末年始' },
  { date: '2028-01-02', note: '年末年始' },
  { date: '2028-01-03', note: '年末年始' },
  // 2028 年度末 → 2029 年始
  { date: '2028-12-29', note: '年末年始' },
  { date: '2028-12-30', note: '年末年始' },
  { date: '2028-12-31', note: '年末年始' },
  { date: '2029-01-01', note: '年末年始' },
  { date: '2029-01-02', note: '年末年始' },
  { date: '2029-01-03', note: '年末年始' },
]

// ── 国民の祝日 ────────────────────────────────────────
// 2026-2027 は seed と同一値。2028 は天文計算ベースの春分/秋分（本番投入前に閣議決定で再確認）。
const PUBLIC_HOLIDAYS = [
  // 2026
  { date: '2026-01-01', name: '元日' },
  { date: '2026-01-12', name: '成人の日' },
  { date: '2026-02-11', name: '建国記念の日' },
  { date: '2026-02-23', name: '天皇誕生日' },
  { date: '2026-03-20', name: '春分の日' },
  { date: '2026-04-29', name: '昭和の日' },
  { date: '2026-05-03', name: '憲法記念日' },
  { date: '2026-05-04', name: 'みどりの日' },
  { date: '2026-05-05', name: 'こどもの日' },
  { date: '2026-05-06', name: '振替休日' },
  { date: '2026-07-20', name: '海の日' },
  { date: '2026-08-11', name: '山の日' },
  { date: '2026-09-21', name: '敬老の日' },
  { date: '2026-09-22', name: '国民の休日' },
  { date: '2026-09-23', name: '秋分の日' },
  { date: '2026-10-12', name: 'スポーツの日' },
  { date: '2026-11-03', name: '文化の日' },
  { date: '2026-11-23', name: '勤労感謝の日' },
  // 2027
  { date: '2027-01-01', name: '元日' },
  { date: '2027-01-11', name: '成人の日' },
  { date: '2027-02-11', name: '建国記念の日' },
  { date: '2027-02-23', name: '天皇誕生日' },
  { date: '2027-03-21', name: '春分の日' },
  { date: '2027-03-22', name: '振替休日' },
  { date: '2027-04-29', name: '昭和の日' },
  { date: '2027-05-03', name: '憲法記念日' },
  { date: '2027-05-04', name: 'みどりの日' },
  { date: '2027-05-05', name: 'こどもの日' },
  { date: '2027-07-19', name: '海の日' },
  { date: '2027-08-11', name: '山の日' },
  { date: '2027-09-20', name: '敬老の日' },
  { date: '2027-09-23', name: '秋分の日' },
  { date: '2027-10-11', name: 'スポーツの日' },
  { date: '2027-11-03', name: '文化の日' },
  { date: '2027-11-23', name: '勤労感謝の日' },
  // 2028（春分=3/20, 秋分=9/22 は天文計算ベース、本番投入前に内閣府の最新発表で再確認）
  { date: '2028-01-01', name: '元日' },
  { date: '2028-01-10', name: '成人の日' },
  { date: '2028-02-11', name: '建国記念の日' },
  { date: '2028-02-23', name: '天皇誕生日' },
  { date: '2028-03-20', name: '春分の日' },
  { date: '2028-04-29', name: '昭和の日' },
  { date: '2028-05-03', name: '憲法記念日' },
  { date: '2028-05-04', name: 'みどりの日' },
  { date: '2028-05-05', name: 'こどもの日' },
  { date: '2028-07-17', name: '海の日' },
  { date: '2028-08-11', name: '山の日' },
  { date: '2028-09-18', name: '敬老の日' },
  { date: '2028-09-22', name: '秋分の日' },
  { date: '2028-10-09', name: 'スポーツの日' },
  { date: '2028-11-03', name: '文化の日' },
  { date: '2028-11-23', name: '勤労感謝の日' },
]

async function main() {
  console.log('🏥 有効店舗を取得...')
  const stores = await prisma.store.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  })
  console.log(`  → ${stores.length} 店舗:`, stores.map(s => s.name).join(' / '))

  if (stores.length === 0) {
    console.warn('  ⚠️  有効な店舗がありません。終了します。')
    return
  }

  // ── 店休日: 全店 × 全日付で upsert ────────────────────
  console.log('🚫 店休日を全店に投入（既存はスキップ）...')
  let holidayCreated = 0
  for (const s of stores) {
    for (const h of STORE_HOLIDAYS) {
      const r = await prisma.holiday.upsert({
        where: { storeId_date: { storeId: s.id, date: new Date(h.date) } },
        update: {}, // 既存は触らない（メモ等を上書きしたくない）
        create: { storeId: s.id, date: new Date(h.date), note: h.note },
        select: { id: true, createdAt: true, updatedAt: true },
      })
      // 新規 created の検出（createdAt と updatedAt がほぼ同時刻なら create と判定）
      if (Math.abs(r.createdAt.getTime() - r.updatedAt.getTime()) < 100) {
        holidayCreated++
      }
    }
  }
  console.log(`  → 新規作成: ${holidayCreated} 件 / 想定上限: ${STORE_HOLIDAYS.length * stores.length} 件`)

  // ── 祝日: createMany + skipDuplicates ─────────────────
  console.log('🎌 祝日を投入（既存はスキップ）...')
  const phResult = await prisma.publicHoliday.createMany({
    data: PUBLIC_HOLIDAYS.map(p => ({ date: new Date(p.date), name: p.name })),
    skipDuplicates: true,
  })
  console.log(`  → 新規作成: ${phResult.count} 件 / 投入対象: ${PUBLIC_HOLIDAYS.length} 件`)

  // ── 最終確認 ──────────────────────────────────────
  const counts = {
    Holiday: await prisma.holiday.count(),
    PublicHoliday: await prisma.publicHoliday.count(),
  }
  console.log('✅ 完了:', counts)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
