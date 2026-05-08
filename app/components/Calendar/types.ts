// 縦軸=時刻のカレンダーコンポーネントで使う共通型

export interface CalendarColumn {
  id: string | number
  label: string
  subLabel?: string
  /** ヘッダー文字色など、Tailwind クラスを直接指定 */
  headerClass?: string
}

export interface CalendarRange {
  id: string
  columnId: string | number
  startTime: string // "HH:MM"
  endTime: string // "HH:MM"
}
