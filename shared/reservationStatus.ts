// 予約のステータス表示ロジック。
// DB の status は CONFIRMED / CANCELLED / NO_SHOW の 3 値のみ。
// 「完了」は status=CONFIRMED かつ終了時刻が過去という条件で自動判定する。
// 過去データに COMPLETED が残っている場合は同じく「完了」として扱う（互換）。

export type DbStatus = 'CONFIRMED' | 'CANCELLED' | 'NO_SHOW' | 'COMPLETED'
export type DisplayStatus = 'UPCOMING' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED'

export function displayStatus(status: DbStatus, endAt: Date | string): DisplayStatus {
  if (status === 'CANCELLED') return 'CANCELLED'
  if (status === 'NO_SHOW') return 'NO_SHOW'
  if (status === 'COMPLETED') return 'COMPLETED'
  // CONFIRMED: 終了時刻を過ぎていれば「完了」扱い
  const end = typeof endAt === 'string' ? new Date(endAt) : endAt
  return end.getTime() <= Date.now() ? 'COMPLETED' : 'UPCOMING'
}

export const DISPLAY_STATUS_LABEL: Record<DisplayStatus, string> = {
  UPCOMING: '予約済',
  COMPLETED: '完了',
  NO_SHOW: '無断キャンセル',
  CANCELLED: 'キャンセル',
}

export const DISPLAY_STATUS_BADGE_CLASS: Record<DisplayStatus, string> = {
  UPCOMING: 'bg-green-100 text-green-800 border-green-300',
  COMPLETED: 'bg-blue-100 text-blue-800 border-blue-300',
  NO_SHOW: 'bg-red-100 text-red-800 border-red-300',
  CANCELLED: 'bg-slate-100 text-slate-500 border-slate-300',
}
