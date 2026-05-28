// 縦軸=時刻のカレンダーコンポーネントで使う共通型

export interface CalendarColumn {
  id: string | number
  label: string
  subLabel?: string
  /** ヘッダー文字色など、Tailwind クラスを直接指定 */
  headerClass?: string
  /** 行/列の背景に付ける Tailwind クラス（曜日色など。未使用のコンポーネントでは無視） */
  bgClass?: string
  /** 行全体のラッパーに付ける Tailwind クラス（mt-* / border-t-* で行間に区切りを入れたい時に使う） */
  rowClass?: string
  /**
   * この列固有の「使えない時間帯」。週ビューのように行ごとに営業時間が違うときに使う。
   * 指定があると TimeRowCalendar の global `nonBusinessRanges` prop より優先される。
   */
  nonBusinessRanges?: { startTime: string, endTime: string, label?: string }[]
}

export interface CalendarRange {
  id: string
  columnId: string | number
  startTime: string // "HH:MM"
  endTime: string // "HH:MM"
  /** true なら「仮表示」用の薄いゴーストバー。シフト未設定をデフォルト時間で見せる時などに使う */
  isGhost?: boolean
}
