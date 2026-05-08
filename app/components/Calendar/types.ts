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
  /** true なら「仮表示」用の薄いゴーストバー。シフト未設定をデフォルト時間で見せる時などに使う */
  isGhost?: boolean
}
