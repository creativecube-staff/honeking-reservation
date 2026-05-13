import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { encryptUtf8 } from '../../../utils/crypto'
import { hashEmail, hashName, hashPhone } from '../../../utils/hash'
import { prisma } from '../../../utils/prisma'
import { generateReservationCode } from '../../../utils/reservationCode'

// 管理画面: 手動予約作成（電話受付した予約を入力するなど）
// お客様側 /api/reservations.post.ts と似ているが:
//   - 施術者・ベッドを明示指定できる（自動割当もできる）
//   - 営業時間外チェックは緩める（管理者が必要と判断すれば例外運用可能）
//   - 既存顧客は customerId で指定可能（暗号化値を再生成しない）
const createSchema = z.object({
  storeId: z.number().int().positive(),
  menuId: z.number().int().positive(),
  practitionerId: z.number().int().positive().optional(),
  bedId: z.number().int().positive().optional(),
  startAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{4}$/, 'startAt は YYYY-MM-DDTHHMM'),
  customer: z.union([
    z.object({ customerId: z.number().int().positive() }),
    z.object({
      name: z.string().trim().min(1).max(100),
      phone: z.string().trim().max(30).optional().or(z.literal('')),
      email: z.string().trim().email().max(200).optional().or(z.literal('')),
    }).refine(
      c => (c.phone && c.phone.length > 0) || (c.email && c.email.length > 0),
      { message: '電話番号またはメールアドレスを入力してください' },
    ),
  ]),
  note: z.string().trim().max(1000).optional(),
  /** true なら営業時間外チェック等を緩める（管理者判断の特例予約用） */
  forceOverride: z.boolean().optional(),
})

function pad(n: number): string { return String(n).padStart(2, '0') }
function parseHm(s: string): number {
  const [h, m] = s.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: '入力内容に誤りがあります',
      data: { issues: parsed.error.issues },
    })
  }
  const { storeId, menuId, startAt: startAtStr, customer, note, forceOverride } = parsed.data
  const practitionerIdReq = parsed.data.practitionerId ?? null
  const bedIdReq = parsed.data.bedId ?? null

  const ymd = startAtStr.slice(0, 10)
  const hh = Number.parseInt(startAtStr.slice(11, 13), 10)
  const mm = Number.parseInt(startAtStr.slice(13, 15), 10)
  if (Number.isNaN(hh) || Number.isNaN(mm)) {
    throw createError({ statusCode: 400, statusMessage: 'startAt の時刻が不正です' })
  }
  const startMin = hh * 60 + mm

  const [store, menu] = await Promise.all([
    prisma.store.findUnique({ where: { id: storeId } }),
    prisma.menu.findUnique({ where: { id: menuId } }),
  ])
  if (!store || !store.isActive) throw createError({ statusCode: 404, statusMessage: '店舗が見つかりません' })
  if (!menu || !menu.isActive) throw createError({ statusCode: 404, statusMessage: 'メニューが見つかりません' })
  if (menu.storeId !== null && menu.storeId !== store.id) {
    throw createError({ statusCode: 400, statusMessage: 'このメニューは指定店舗で利用できません' })
  }

  const endMin = startMin + menu.durationMinutes
  if (endMin > 24 * 60) throw createError({ statusCode: 400, statusMessage: '日跨ぎ予約は不可' })

  const startAt = new Date(`${ymd}T${pad(hh)}:${pad(mm)}:00+09:00`)
  const endAt = new Date(startAt.getTime() + menu.durationMinutes * 60_000)
  if (Number.isNaN(startAt.getTime())) {
    throw createError({ statusCode: 400, statusMessage: '日時が不正です' })
  }

  const dateDb = new Date(`${ymd}T00:00:00Z`)

  const [businessHours, holidays, closures, publicHoliday, beds, practitioners, shifts, reservations] = await Promise.all([
    prisma.businessHour.findMany({ where: { storeId: store.id } }),
    prisma.holiday.findMany({ where: { storeId: store.id, date: dateDb } }),
    prisma.closure.findMany({ where: { storeId: store.id, date: dateDb } }),
    prisma.publicHoliday.findUnique({ where: { date: dateDb } }),
    prisma.bed.findMany({ where: { storeId: store.id, isActive: true }, select: { id: true } }),
    // 予約に割り当て可能なスタッフのみ（オーナー等の特別アカウントは除外）
    prisma.practitioner.findMany({ where: { isActive: true, isAssignable: true }, select: { id: true, storeId: true } }),
    prisma.shift.findMany({
      where: {
        date: dateDb,
        OR: [
          { workStoreId: store.id },
          { workStoreId: null, practitioner: { storeId: store.id } },
        ],
      },
      select: { practitionerId: true, startTime: true, endTime: true },
    }),
    prisma.reservation.findMany({
      where: {
        storeId: store.id,
        status: 'CONFIRMED',
        startAt: { gte: new Date(`${ymd}T00:00:00+09:00`), lt: new Date(new Date(`${ymd}T00:00:00+09:00`).getTime() + 86_400_000) },
      },
      select: { bedId: true, practitionerId: true, startAt: true, endAt: true },
    }),
  ])

  // forceOverride でなければ通常チェック
  if (!forceOverride) {
    if (holidays.length > 0) throw createError({ statusCode: 409, statusMessage: 'この日は店休日です' })
    const effectiveDow = publicHoliday ? 0 : dateDb.getUTCDay()
    const ranges = businessHours
      .filter(b => b.dayOfWeek === effectiveDow)
      .map(b => ({ startMin: parseHm(b.startTime), endMin: parseHm(b.endTime) }))
    if (ranges.length === 0) throw createError({ statusCode: 409, statusMessage: 'この日は営業していません' })
    const fitsRange = ranges.some(r => r.startMin <= startMin && endMin <= r.endMin)
    if (!fitsRange) throw createError({ statusCode: 400, statusMessage: '営業時間外です（forceOverride=true で許可可能）' })
    for (const c of closures) {
      const cStart = parseHm(c.startTime)
      const cEnd = parseHm(c.endTime)
      if (cStart < endMin && cEnd > startMin) {
        throw createError({ statusCode: 409, statusMessage: 'その時間帯は閉店中です' })
      }
    }
  }

  // ベッド・施術者の決定
  const usedBeds = new Set<number>()
  const usedPractitioners = new Set<number>()
  for (const r of reservations) {
    const rs = new Date(r.startAt).getTime()
    const re = new Date(r.endAt).getTime()
    if (rs < endAt.getTime() && re > startAt.getTime()) {
      usedBeds.add(r.bedId)
      usedPractitioners.add(r.practitionerId)
    }
  }

  let bedId: number
  if (bedIdReq) {
    const exists = beds.find(b => b.id === bedIdReq)
    if (!exists) throw createError({ statusCode: 400, statusMessage: '指定のベッドが見つかりません' })
    if (usedBeds.has(bedIdReq) && !forceOverride) {
      throw createError({ statusCode: 409, statusMessage: '指定のベッドはその時間帯すでに予約されています' })
    }
    bedId = bedIdReq
  }
  else {
    const free = beds.find(b => !usedBeds.has(b.id))
    if (!free) throw createError({ statusCode: 409, statusMessage: '空きベッドがありません' })
    bedId = free.id
  }

  const shiftMap = new Map<number, { startMin: number, endMin: number }>()
  for (const s of shifts) shiftMap.set(s.practitionerId, { startMin: parseHm(s.startTime), endMin: parseHm(s.endTime) })

  let practitionerId: number
  if (practitionerIdReq) {
    const p = practitioners.find(x => x.id === practitionerIdReq)
    if (!p) throw createError({ statusCode: 400, statusMessage: '指定の施術者が見つかりません' })
    if (usedPractitioners.has(practitionerIdReq) && !forceOverride) {
      throw createError({ statusCode: 409, statusMessage: '指定の施術者はその時間帯すでに予約に入っています' })
    }
    // シフトチェック（force でなければ）
    if (!forceOverride) {
      const sh = shiftMap.get(practitionerIdReq)
      if (!sh || sh.startMin > startMin || sh.endMin < endMin) {
        throw createError({ statusCode: 409, statusMessage: '指定の施術者はその時間シフトに入っていません' })
      }
    }
    practitionerId = practitionerIdReq
  }
  else {
    const free = practitioners.find((p) => {
      if (usedPractitioners.has(p.id)) return false
      const sh = shiftMap.get(p.id)
      if (!sh) return false
      return sh.startMin <= startMin && endMin <= sh.endMin
    })
    if (!free) throw createError({ statusCode: 409, statusMessage: '空いている施術者がいません' })
    practitionerId = free.id
  }

  // 顧客
  let customerId: number
  if ('customerId' in customer) {
    customerId = customer.customerId
    const exists = await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } })
    if (!exists) throw createError({ statusCode: 400, statusMessage: '指定のお客様が見つかりません' })
  }
  else {
    const name = customer.name.trim()
    const phone = (customer.phone ?? '').trim()
    const email = (customer.email ?? '').trim()
    const phoneHash = phone ? hashPhone(phone) : null
    const emailHash = email ? hashEmail(email) : null
    const nameHash = hashName(name)

    let row: { id: number } | null = null
    if (phoneHash) row = await prisma.customer.findUnique({ where: { phoneHash }, select: { id: true } })
    if (!row && emailHash) row = await prisma.customer.findUnique({ where: { emailHash }, select: { id: true } })
    if (!row) {
      try {
        row = await prisma.customer.create({
          data: {
            name: encryptUtf8(name),
            nameHash,
            phone: phone ? encryptUtf8(phone) : null,
            phoneHash,
            email: email ? encryptUtf8(email) : null,
            emailHash,
          },
          select: { id: true },
        })
      }
      catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          // phoneHash か emailHash の衝突（findUnique 直後の競合作成、レア）
          throw createError({ statusCode: 409, statusMessage: '同じ電話番号またはメールアドレスのお客様が既に登録されています' })
        }
        throw e
      }
    }
    customerId = row.id
  }

  async function createReservation(attempt = 0): Promise<{ id: number, confirmationCode: string }> {
    const code = generateReservationCode()
    try {
      return await prisma.reservation.create({
        data: {
          storeId: store!.id,
          bedId,
          practitionerId,
          menuId: menu!.id,
          customerId,
          startAt,
          endAt,
          status: 'CONFIRMED',
          confirmationCode: code,
          note: note || null,
        },
        select: { id: true, confirmationCode: true },
      })
    }
    catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' && attempt < 5) {
        return createReservation(attempt + 1)
      }
      const msg = String((e as { message?: string })?.message ?? '')
      if (msg.includes('exclusion constraint') || msg.includes('conflicting key value')) {
        throw createError({ statusCode: 409, statusMessage: 'その時間帯はすでに別の予約と重複しています' })
      }
      throw e
    }
  }

  return createReservation()
})
