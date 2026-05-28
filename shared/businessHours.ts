import type { BusinessHourRangeInput } from './schemas/businessHour'

// 全店舗共通の標準営業時間（新規店舗作成時の初期値）。
// 月〜金: 9:30-12:30 + 15:00-20:30 / 土日: 9:30-12:30 + 15:00-18:00
// 中抜け休憩は 2 レンジで表現する（「休憩」という特殊概念は持たない）。
// dayOfWeek: 0=日 〜 6=土
export const DEFAULT_BUSINESS_HOUR_RANGES: BusinessHourRangeInput[] = [
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
