import { createHash } from 'node:crypto'

// 顧客の検索・重複防止用ハッシュ。
// AES-256-GCM の暗号化値は比較できないため、平文を正規化してから sha256 で保存する。

/** UTF-8 入力を SHA-256 (hex 64 文字) に。 */
function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex')
}

/** 氏名: trim + 連続空白を 1 つに圧縮。大文字小文字は区別する（漢字/カナ想定）。 */
export function hashName(name: string): string {
  const normalized = name.trim().replace(/\s+/g, ' ')
  return sha256Hex(normalized)
}

/** 電話: 数字以外を全部削除して比較。+81 / 国内表記の揺れを吸収。 */
export function hashPhone(phone: string): string {
  const digits = phone.replace(/\D+/g, '')
  return sha256Hex(digits)
}

/** メール: trim + 小文字化。 */
export function hashEmail(email: string): string {
  return sha256Hex(email.trim().toLowerCase())
}
