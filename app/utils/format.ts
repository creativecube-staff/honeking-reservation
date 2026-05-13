// 表示用フォーマッタ。
// アプリ全体で同じ表現を使うため Nuxt の app/utils auto-import 経由で各画面から参照する。
//
// 日付系はすべて JST (UTC+9) ベース。UTC として保存している ISO 文字列を入力に取り、
// クライアント/サーバのローカルタイムゾーンに依存しない表示を行う。

export function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** 今日の日付を YYYY-MM-DD（ローカルタイムゾーン基準）で返す。input[type=date] 等の初期値用。 */
export function todayYmd(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** JST の YYYY/MM/DD 形式。null/undefined は em-dash で返す。 */
export function fmtJstDate(iso: string | Date | null | undefined): string {
  if (!iso) return '—'
  const d = typeof iso === 'string' ? new Date(iso) : iso
  const jst = new Date(d.getTime() + 9 * 3600_000)
  return `${jst.getUTCFullYear()}/${pad(jst.getUTCMonth() + 1)}/${pad(jst.getUTCDate())}`
}

/** JST の YYYY/MM/DD HH:MM 形式。null/undefined は em-dash で返す。 */
export function fmtJstDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return '—'
  const d = typeof iso === 'string' ? new Date(iso) : iso
  const jst = new Date(d.getTime() + 9 * 3600_000)
  return `${jst.getUTCFullYear()}/${pad(jst.getUTCMonth() + 1)}/${pad(jst.getUTCDate())} ${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}`
}

/** JST の HH:MM 形式。「予約終了 14:30」のように時刻単独で見せたいときに使う。 */
export function fmtJstTime(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  const jst = new Date(d.getTime() + 9 * 3600_000)
  return `${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}`
}

/** 円表記用の桁区切り。¥ 記号は呼び出し側で付ける。 */
export function yen(n: number): string {
  return n.toLocaleString('ja-JP')
}
