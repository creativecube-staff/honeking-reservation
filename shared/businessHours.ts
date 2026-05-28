import type { BusinessHourRangeInput } from './schemas/businessHour'

// 全店舗共通の標準営業時間（新規店舗作成時の初期値）。
// 月〜金: 9:30-12:30 + 15:00-20:30 / 土日祝: 9:30-12:30 + 15:00-18:00
// 中抜け休憩は 2 レンジで表現する（「休憩」という特殊概念は持たない）。
// dayOfWeek: -1=祝日, 0=日, … , 6=土
export const DEFAULT_BUSINESS_HOUR_RANGES: BusinessHourRangeInput[] = [
  // 祝（日曜と同じ短縮営業）
  { dayOfWeek: -1, startTime: '09:30', endTime: '12:30' },
  { dayOfWeek: -1, startTime: '15:00', endTime: '18:00' },
  // 日（短縮）
  { dayOfWeek: 0, startTime: '09:30', endTime: '12:30' },
  { dayOfWeek: 0, startTime: '15:00', endTime: '18:00' },
  // 月〜金
  ...[1, 2, 3, 4, 5].flatMap(dayOfWeek => [
    { dayOfWeek, startTime: '09:30', endTime: '12:30' },
    { dayOfWeek, startTime: '15:00', endTime: '20:30' },
  ]),
  // 土（短縮）
  { dayOfWeek: 6, startTime: '09:30', endTime: '12:30' },
  { dayOfWeek: 6, startTime: '15:00', endTime: '18:00' },
]

// 祝日値（マジックナンバー回避用）
export const DOW_PUBLIC_HOLIDAY = -1

/**
 * その日付について BusinessHour を引くべき dayOfWeek を解決する。
 *
 * 祝日(-1) のレンジを店舗が持っていれば祝日扱い、無ければ日曜(0) にフォールバック。
 * これにより既存店舗（祝日レンジ未設定）の挙動は従来どおり「祝日=日曜扱い」のまま保たれる。
 *
 * @param isPublicHoliday その日が PublicHoliday に該当するか
 * @param fallbackDow     祝日でないときの曜日 (= date.getUTCDay())
 * @param hasHolidayRanges その店舗が祝日(-1) レンジを 1 件以上持っているか
 */
export function resolveBusinessHourDow(
  isPublicHoliday: boolean,
  fallbackDow: number,
  hasHolidayRanges: boolean,
): number {
  if (isPublicHoliday) return hasHolidayRanges ? DOW_PUBLIC_HOLIDAY : 0
  return fallbackDow
}

/**
 * スタッフが祝日に出勤するかを判定する。
 *
 * baseShiftDays に -1 を含むなら祝日出勤。
 * -1 を含まないスタッフは「日曜(0) の出勤可否」にフォールバック。
 * （既存スタッフは画面で祝日チェックを足さなくても従来挙動を保つ）
 */
export function isStaffWorkingOnPublicHoliday(baseShiftDays: number[]): boolean {
  if (baseShiftDays.includes(DOW_PUBLIC_HOLIDAY)) return true
  return baseShiftDays.includes(0)
}
