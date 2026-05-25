import { Prisma } from '@prisma/client'
import { createReservationSchema } from '../../shared/schemas/reservation'
import { MAX_ADVANCE_DAYS } from '../../shared/reservationPolicy'
import { decryptUtf8, encryptUtf8 } from '../utils/crypto'
import { hashEmail, hashName, hashPhone } from '../utils/hash'
import { prisma } from '../utils/prisma'
import { generateReservationCode } from '../utils/reservationCode'
import { sendReservationConfirmation } from '../utils/reservationMail'

// お客様側: 予約作成
// 入力: { storeSlug, menuId, startAt: "YYYY-MM-DDTHHMM", customer: { name, phone?, email?, note? } }
// 出力: { confirmationCode }
//
// フロー:
// 1. 入力バリデーション
// 2. 店舗・メニュー確認
// 3. 空き状況再チェック（営業時間・店休・部分閉店・ベッド・スタッフ）
// 4. 顧客 upsert（電話/メールハッシュで既存検索、無ければ新規作成）
// 5. 予約作成（confirmationCode は衝突したら再生成、EXCLUDE 違反は 409）

function pad(n: number): string {
  return String(n).padStart(2, '0')
}
function parseHm(s: string): number {
  const [h, m] = s.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = createReservationSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: '入力内容に誤りがあります',
      data: { issues: parsed.error.issues },
    })
  }
  const { storeSlug, menuId, startAt: startAtStr, customer } = parsed.data

  // startAt 解析
  const ymd = startAtStr.slice(0, 10)
  const hh = Number.parseInt(startAtStr.slice(11, 13), 10)
  const mm = Number.parseInt(startAtStr.slice(13, 15), 10)
  if (Number.isNaN(hh) || Number.isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    throw createError({ statusCode: 400, statusMessage: 'startAt の時刻が不正です' })
  }
  const startTime = `${pad(hh)}:${pad(mm)}`

  // 店舗・メニュー
  const store = await prisma.store.findUnique({ where: { slug: storeSlug } })
  if (!store || !store.isActive) {
    throw createError({ statusCode: 404, statusMessage: '店舗が見つかりません' })
  }
  const menu = await prisma.menu.findUnique({ where: { id: menuId } })
  if (!menu || !menu.isActive) {
    throw createError({ statusCode: 404, statusMessage: 'メニューが見つかりません' })
  }
  if (menu.storeId !== null && menu.storeId !== store.id) {
    throw createError({ statusCode: 400, statusMessage: 'このメニューは指定店舗で利用できません' })
  }

  // 時刻計算（JST で扱う）
  const startMin = hh * 60 + mm
  const endMin = startMin + menu.durationMinutes
  if (endMin > 24 * 60) {
    throw createError({ statusCode: 400, statusMessage: '日跨ぎの予約には対応していません' })
  }
  const endTime = `${pad(Math.floor(endMin / 60))}:${pad(endMin % 60)}`

  // 絶対時刻（JST 想定 → UTC タイムスタンプ）
  const startAt = new Date(`${ymd}T${startTime}:00+09:00`)
  const endAt = new Date(startAt.getTime() + menu.durationMinutes * 60_000)
  if (Number.isNaN(startAt.getTime())) {
    throw createError({ statusCode: 400, statusMessage: '日時が不正です' })
  }
  if (startAt.getTime() <= Date.now()) {
    throw createError({ statusCode: 400, statusMessage: '過去の時間は予約できません' })
  }

  // 受付上限を超える予約は拒否(UI で disabled しているが API 直叩き対策)。
  // 上限 = 今日(UTC) + MAX_ADVANCE_DAYS - 1 の 23:59:59
  const maxAdvanceEnd = new Date()
  maxAdvanceEnd.setUTCHours(0, 0, 0, 0)
  maxAdvanceEnd.setUTCDate(maxAdvanceEnd.getUTCDate() + MAX_ADVANCE_DAYS)
  if (startAt.getTime() >= maxAdvanceEnd.getTime()) {
    throw createError({
      statusCode: 400,
      statusMessage: `ご予約は本日から ${MAX_ADVANCE_DAYS} 日先までお受けしております`,
    })
  }

  // メニュー表示期間
  const dateDb = new Date(`${ymd}T00:00:00Z`)
  if (menu.availableFrom && dateDb < menu.availableFrom) {
    throw createError({ statusCode: 400, statusMessage: 'メニューの提供開始日より前です' })
  }
  if (menu.availableUntil && dateDb > menu.availableUntil) {
    throw createError({ statusCode: 400, statusMessage: 'メニューの提供終了日を過ぎています' })
  }

  // その日の関連データ
  const dayOfWeek = dateDb.getUTCDay()
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

  if (holidays.length > 0) {
    throw createError({ statusCode: 409, statusMessage: 'この日は店休日です' })
  }

  // 営業時間
  const effectiveDow = publicHoliday ? 0 : dayOfWeek
  const ranges = businessHours
    .filter(b => b.dayOfWeek === effectiveDow)
    .map(b => ({ startMin: parseHm(b.startTime), endMin: parseHm(b.endTime) }))
  if (ranges.length === 0) {
    throw createError({ statusCode: 409, statusMessage: 'この日は営業していません' })
  }
  const fitsRange = ranges.some(r => r.startMin <= startMin && endMin <= r.endMin)
  if (!fitsRange) {
    throw createError({ statusCode: 400, statusMessage: '営業時間外です' })
  }

  // 部分閉店
  for (const c of closures) {
    const cStart = parseHm(c.startTime)
    const cEnd = parseHm(c.endTime)
    if (cStart < endMin && cEnd > startMin) {
      throw createError({ statusCode: 409, statusMessage: 'その時間帯は閉店中です' })
    }
  }

  // 空きベッド検索
  const usedBeds = new Set<number>()
  const usedPractitioners = new Set<number>()
  for (const r of reservations) {
    const rStart = new Date(r.startAt).getTime()
    const rEnd = new Date(r.endAt).getTime()
    if (rStart < endAt.getTime() && rEnd > startAt.getTime()) {
      usedBeds.add(r.bedId)
      usedPractitioners.add(r.practitionerId)
    }
  }
  const availableBed = beds.find(b => !usedBeds.has(b.id))
  if (!availableBed) {
    throw createError({ statusCode: 409, statusMessage: '空きベッドがありません' })
  }

  // 空きスタッフ検索（シフトが収まっており、他予約と被らない）
  const shiftMap = new Map<number, { startMin: number, endMin: number }>()
  for (const s of shifts) {
    shiftMap.set(s.practitionerId, { startMin: parseHm(s.startTime), endMin: parseHm(s.endTime) })
  }
  const availablePractitioner = practitioners.find((p) => {
    if (usedPractitioners.has(p.id)) return false
    const sh = shiftMap.get(p.id)
    if (!sh) return false
    return sh.startMin <= startMin && endMin <= sh.endMin
  })
  if (!availablePractitioner) {
    throw createError({ statusCode: 409, statusMessage: '空いている施術者がいません' })
  }

  // 顧客の特定
  // 会員ログイン中ならセッションから Customer を直接特定し、body の name/phone/email は無視する。
  // ゲスト予約は従来通り phone/email ハッシュで upsert する。
  let customerRow: { id: number } | null = null
  // 完了メール用の平文(送信できなければ null のまま)
  let recipientName: string | null = null
  let recipientEmail: string | null = null
  const session = await getUserSession(event)
  if (session.member?.id) {
    const member = await prisma.customer.findUnique({
      where: { id: session.member.id },
      select: { id: true, emailVerifiedAt: true, name: true, email: true },
    })
    if (!member || !member.emailVerifiedAt) {
      // セッションは残ってるが DB 側が無効化された
      throw createError({
        statusCode: 401,
        statusMessage: '会員セッションが無効です。再度ログインしてください。',
      })
    }
    customerRow = { id: member.id }
    try {
      recipientName = decryptUtf8(member.name)
      recipientEmail = member.email ? decryptUtf8(member.email) : null
    }
    catch {
      // 復号失敗(暗号化キーが本番と dev で違う等)。メール送信はスキップさせる
      recipientName = null
      recipientEmail = null
    }
  }
  else {
    // ゲスト予約: 既存の upsert フロー
    const customerName = customer.name.trim()
    const customerPhone = (customer.phone ?? '').trim()
    const customerEmail = (customer.email ?? '').trim()
    const nameHash = hashName(customerName)
    const phoneHash = customerPhone ? hashPhone(customerPhone) : null
    const emailHash = customerEmail ? hashEmail(customerEmail) : null

    if (phoneHash) {
      customerRow = await prisma.customer.findUnique({ where: { phoneHash }, select: { id: true } })
    }
    if (!customerRow && emailHash) {
      customerRow = await prisma.customer.findUnique({ where: { emailHash }, select: { id: true } })
    }
    if (!customerRow) {
      try {
        customerRow = await prisma.customer.create({
          data: {
            name: encryptUtf8(customerName),
            nameHash,
            phone: customerPhone ? encryptUtf8(customerPhone) : null,
            phoneHash,
            email: customerEmail ? encryptUtf8(customerEmail) : null,
            emailHash,
          },
          select: { id: true },
        })
      }
      catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          // phoneHash か emailHash の衝突（findUnique 直後の競合作成、レア）
          throw createError({
            statusCode: 409,
            statusMessage: '同じ電話番号またはメールアドレスのお客様が既に登録されています。お電話でお問い合わせください。',
          })
        }
        throw e
      }
    }
    recipientName = customerName
    recipientEmail = customerEmail || null
  }

  // 予約作成（confirmationCode 衝突は再生成、EXCLUDE 違反は 409）
  async function createReservation(attempt = 0): Promise<{ confirmationCode: string }> {
    const code = generateReservationCode()
    try {
      const created = await prisma.reservation.create({
        data: {
          storeId: store!.id,
          bedId: availableBed!.id,
          practitionerId: availablePractitioner!.id,
          menuId: menu!.id,
          customerId: customerRow!.id,
          startAt,
          endAt,
          status: 'CONFIRMED',
          confirmationCode: code,
          note: customer.note || null,
        },
        select: { confirmationCode: true },
      })
      return created
    }
    catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' && attempt < 5) {
        return createReservation(attempt + 1) // confirmationCode 衝突
      }
      const msg = String((e as { message?: string })?.message ?? '')
      if (msg.includes('exclusion constraint') || msg.includes('EXCLUDE') || msg.includes('conflicting key value')) {
        throw createError({
          statusCode: 409,
          statusMessage: 'その時間帯はすでに別のご予約と重複しています。お手数ですが別の時間をお選びください。',
        })
      }
      throw e
    }
  }

  const created = await createReservation()

  // 完了メール送信(best-effort: 失敗しても予約は確定済なので throw しない)
  if (recipientEmail && recipientName) {
    try {
      await sendReservationConfirmation({
        customerName: recipientName,
        customerEmail: recipientEmail,
        store: { name: store.name, address: store.address, phone: store.phone, slug: store.slug },
        menu: { name: menu.name, durationMinutes: menu.durationMinutes, priceJpy: menu.priceJpy },
        startAt,
        endAt,
        confirmationCode: created.confirmationCode,
        note: customer.note?.trim() || null,
      })
    }
    catch (e) {
      // メアドや本文をログに残さない方針(個人情報・トークン漏洩防止)。予約コードだけ控える
      console.error('[reservation] 完了メール送信に失敗', {
        reservationCode: created.confirmationCode,
        error: (e as Error).message,
      })
    }
  }

  return { confirmationCode: created.confirmationCode }
})
