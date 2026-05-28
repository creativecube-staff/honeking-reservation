import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireUser } from '../../../utils/requirePermission'

// 管理画面: 予約の更新
// 以下のどれか or 組み合わせを 1 リクエストで処理する:
//   1) ステータス変更 (status / note)
//   2) 日時・メニュー・スタッフ・ベッド変更（リスケジュール）
//
// 何かしらフィールドが実際に変わった場合は ReservationHistory に 1 行記録する。
// 変更前後のスナップショットを残すため、トランザクション内で update + history.create を 1 セットで実行する。

const patchSchema = z.object({
  // ステータス（任意）
  status: z.enum(['CONFIRMED', 'CANCELLED', 'NO_SHOW']).optional(),
  // 予約自体のメモ（任意・既存 note の上書き）
  note: z.string().trim().max(1000).optional(),
  // リスケジュール用フィールド
  startAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{4}$/, 'startAt は YYYY-MM-DDTHHMM').optional(),
  menuId: z.number().int().positive().optional(),
  staffId: z.number().int().positive().optional(),
  bedId: z.number().int().positive().optional(),
  // true ならスタッフ・ベッドを自動再割当（手動指定があれば手動を優先）
  autoAssign: z.boolean().optional(),
  // 営業時間外チェック等を緩めるフラグ（管理者判断の特例）
  forceOverride: z.boolean().optional(),
  // 履歴に残す操作メモ（任意）
  historyNote: z.string().trim().max(1000).optional(),
})

function pad(n: number): string { return String(n).padStart(2, '0') }
function parseHm(s: string): number {
  const [h, m] = s.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

export default defineEventHandler(async (event) => {
  const currentUser = await requireUser(event)

  const idRaw = getRouterParam(event, 'id')
  const id = Number(idRaw)
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '予約 ID が不正です' })
  }

  const body = await readBody(event)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: '入力内容に誤りがあります',
      data: { issues: parsed.error.issues },
    })
  }

  const existing = await prisma.reservation.findUnique({ where: { id } })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: '予約が見つかりません' })
  }

  const { status, note, startAt: startAtStr, menuId: newMenuIdReq, staffId: staffIdReq, bedId: bedIdReq, autoAssign, forceOverride, historyNote } = parsed.data

  // ─── リスケジュール（日時 or メニュー or スタッフ or ベッドの変更）が含まれるか
  const isReschedule = typeof startAtStr === 'string' || typeof newMenuIdReq === 'number' || typeof staffIdReq === 'number' || typeof bedIdReq === 'number' || autoAssign === true

  // 最終的な確定値
  let finalStartAt: Date = existing.startAt
  let finalEndAt: Date = existing.endAt
  let finalMenuId: number = existing.menuId
  let finalStaffId: number = existing.staffId
  let finalBedId: number = existing.bedId

  if (isReschedule) {
    // ① メニュー確定（変更があればそれ、なければ既存）
    const menuId = newMenuIdReq ?? existing.menuId
    const menu = await prisma.menu.findUnique({ where: { id: menuId } })
    if (!menu || !menu.isActive) throw createError({ statusCode: 404, statusMessage: 'メニューが見つかりません' })
    if (menu.storeId !== null && menu.storeId !== existing.storeId) {
      throw createError({ statusCode: 400, statusMessage: 'このメニューはこの店舗で利用できません' })
    }

    // ② 開始時刻確定
    let startAt: Date = existing.startAt
    let ymd: string
    let startMin: number
    if (startAtStr) {
      ymd = startAtStr.slice(0, 10)
      const hh = Number.parseInt(startAtStr.slice(11, 13), 10)
      const mm = Number.parseInt(startAtStr.slice(13, 15), 10)
      if (Number.isNaN(hh) || Number.isNaN(mm)) {
        throw createError({ statusCode: 400, statusMessage: 'startAt の時刻が不正です' })
      }
      startMin = hh * 60 + mm
      startAt = new Date(`${ymd}T${pad(hh)}:${pad(mm)}:00+09:00`)
      if (Number.isNaN(startAt.getTime())) {
        throw createError({ statusCode: 400, statusMessage: '日時が不正です' })
      }
    }
    else {
      // 日時変更なし → 既存の startAt から日付・時刻を取り出す
      // JST 想定でフォーマット
      const jst = new Date(existing.startAt.getTime() + 9 * 60 * 60_000)
      ymd = `${jst.getUTCFullYear()}-${pad(jst.getUTCMonth() + 1)}-${pad(jst.getUTCDate())}`
      startMin = jst.getUTCHours() * 60 + jst.getUTCMinutes()
    }
    const endMin = startMin + menu.durationMinutes
    if (endMin > 24 * 60) throw createError({ statusCode: 400, statusMessage: '日跨ぎ予約は不可' })
    const endAt = new Date(startAt.getTime() + menu.durationMinutes * 60_000)

    const dateDb = new Date(`${ymd}T00:00:00Z`)
    const dayStart = new Date(`${ymd}T00:00:00+09:00`)
    const dayEnd = new Date(dayStart.getTime() + 86_400_000)

    const [businessHours, holidays, closures, publicHoliday, beds, staffs, reservations] = await Promise.all([
      prisma.businessHour.findMany({ where: { storeId: existing.storeId } }),
      prisma.holiday.findMany({ where: { storeId: existing.storeId, date: dateDb } }),
      prisma.closure.findMany({ where: { storeId: existing.storeId, date: dateDb } }),
      prisma.publicHoliday.findUnique({ where: { date: dateDb } }),
      prisma.bed.findMany({ where: { storeId: existing.storeId, isActive: true }, select: { id: true } }),
      prisma.staff.findMany({
        where: { storeId: existing.storeId, isActive: true, isAssignable: true },
        orderBy: [{ assignOrder: 'asc' }, { id: 'asc' }],
        select: { id: true, baseShiftDays: true },
      }),
      prisma.reservation.findMany({
        where: {
          storeId: existing.storeId,
          status: 'CONFIRMED',
          startAt: { gte: dayStart, lt: dayEnd },
          NOT: { id }, // 自身を除外
        },
        select: { bedId: true, staffId: true, startAt: true, endAt: true },
      }),
    ])

    // ③ 営業時間・休業日チェック（forceOverride で緩和可能）
    if (!forceOverride) {
      if (holidays.length > 0) throw createError({ statusCode: 409, statusMessage: 'この日は店休日です' })
      const effectiveDow = publicHoliday ? 0 : dateDb.getUTCDay()
      const ranges = businessHours.filter(b => b.dayOfWeek === effectiveDow).map(b => ({ startMin: parseHm(b.startTime), endMin: parseHm(b.endTime) }))
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

    // ④ ベッド・スタッフの使用状況計算（自身は除外済み）
    const usedBeds = new Set<number>()
    const usedStaffs = new Set<number>()
    for (const r of reservations) {
      const rs = new Date(r.startAt).getTime()
      const re = new Date(r.endAt).getTime()
      if (rs < endAt.getTime() && re > startAt.getTime()) {
        usedBeds.add(r.bedId)
        usedStaffs.add(r.staffId)
      }
    }

    // ⑤ ベッド確定
    let bedId: number
    if (bedIdReq) {
      const exists = beds.find(b => b.id === bedIdReq)
      if (!exists) throw createError({ statusCode: 400, statusMessage: '指定のベッドが見つかりません' })
      if (usedBeds.has(bedIdReq) && !forceOverride) {
        throw createError({ statusCode: 409, statusMessage: '指定のベッドはその時間帯すでに予約されています' })
      }
      bedId = bedIdReq
    }
    else if (autoAssign) {
      const free = beds.find(b => !usedBeds.has(b.id))
      if (!free) throw createError({ statusCode: 409, statusMessage: '空きベッドがありません' })
      bedId = free.id
    }
    else {
      // 指定なし・自動なし → 既存ベッドを維持。ただし新日時で既に使われていれば衝突
      bedId = existing.bedId
      if (usedBeds.has(bedId) && !forceOverride) {
        throw createError({ statusCode: 409, statusMessage: '元のベッドはその時間帯すでに別の予約と重なります。別のベッドを指定するか「自動で再割当」を選んでください' })
      }
    }

    // ⑥ スタッフ確定（基本シフト曜日に出勤するスタッフから選ぶ）
    const effectiveDow = publicHoliday ? 0 : dateDb.getUTCDay()

    let staffId: number
    if (staffIdReq) {
      const st = staffs.find(x => x.id === staffIdReq)
      if (!st) throw createError({ statusCode: 400, statusMessage: '指定のスタッフが見つかりません' })
      if (usedStaffs.has(staffIdReq) && !forceOverride) {
        throw createError({ statusCode: 409, statusMessage: '指定のスタッフはその時間帯すでに予約に入っています' })
      }
      if (!forceOverride && !st.baseShiftDays.includes(effectiveDow)) {
        throw createError({ statusCode: 409, statusMessage: '指定のスタッフはこの曜日は出勤予定がありません' })
      }
      staffId = staffIdReq
    }
    else if (autoAssign) {
      const free = staffs.find((st) => {
        if (usedStaffs.has(st.id)) return false
        return st.baseShiftDays.includes(effectiveDow)
      })
      if (!free) throw createError({ statusCode: 409, statusMessage: '空いているスタッフがいません' })
      staffId = free.id
    }
    else {
      staffId = existing.staffId
      if (usedStaffs.has(staffId) && !forceOverride) {
        throw createError({ statusCode: 409, statusMessage: '元のスタッフはその時間帯すでに別の予約に入っています。別のスタッフを指定するか「自動で再割当」を選んでください' })
      }
    }

    finalStartAt = startAt
    finalEndAt = endAt
    finalMenuId = menu.id
    finalStaffId = staffId
    finalBedId = bedId
  }

  // ステータス・メモ
  const finalStatus = status ?? existing.status
  const cancelledAt
    = finalStatus === 'CANCELLED' && existing.status !== 'CANCELLED'
      ? new Date()
      : finalStatus !== 'CANCELLED' && existing.cancelledAt
        ? null
        : existing.cancelledAt

  // ─── 何か変わったかチェック（フィールド単位の diff）
  const changed
    = finalStartAt.getTime() !== existing.startAt.getTime()
    || finalEndAt.getTime() !== existing.endAt.getTime()
    || finalStatus !== existing.status
    || finalMenuId !== existing.menuId
    || finalStaffId !== existing.staffId
    || finalBedId !== existing.bedId
    || (typeof note !== 'undefined' && note !== existing.note)

  if (!changed) {
    return existing
  }

  // 履歴に残すかは「リスケジュール or ステータス変更」のとき。note だけの変更は履歴に残さない。
  const shouldHistory
    = finalStartAt.getTime() !== existing.startAt.getTime()
    || finalEndAt.getTime() !== existing.endAt.getTime()
    || finalStatus !== existing.status
    || finalMenuId !== existing.menuId
    || finalStaffId !== existing.staffId
    || finalBedId !== existing.bedId

  try {
    return await prisma.$transaction(async (tx) => {
      const updated = await tx.reservation.update({
        where: { id },
        data: {
          startAt: finalStartAt,
          endAt: finalEndAt,
          status: finalStatus,
          menuId: finalMenuId,
          staffId: finalStaffId,
          bedId: finalBedId,
          note: typeof note !== 'undefined' ? note : existing.note,
          cancelledAt,
        },
      })

      if (shouldHistory) {
        await tx.reservationHistory.create({
          data: {
            reservationId: id,
            changedByLoginId: currentUser.id,
            changedByName: currentUser.displayName,
            prevStartAt: existing.startAt,
            prevEndAt: existing.endAt,
            prevStatus: existing.status,
            prevMenuId: existing.menuId,
            prevStaffId: existing.staffId,
            prevBedId: existing.bedId,
            newStartAt: updated.startAt,
            newEndAt: updated.endAt,
            newStatus: updated.status,
            newMenuId: updated.menuId,
            newStaffId: updated.staffId,
            newBedId: updated.bedId,
            note: historyNote || null,
          },
        })
      }

      return updated
    })
  }
  catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw createError({ statusCode: 409, statusMessage: 'その時間帯はすでに別の予約と重複しています' })
    }
    const msg = String((e as { message?: string })?.message ?? '')
    if (msg.includes('exclusion constraint') || msg.includes('conflicting key value')) {
      throw createError({ statusCode: 409, statusMessage: 'その時間帯はすでに別の予約と重複しています' })
    }
    throw e
  }
})
