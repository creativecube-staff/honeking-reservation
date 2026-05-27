import { randomInt } from 'node:crypto'

// 自動発行用の強いランダムパスワードを生成する。
// - 紛らわしい文字（0/O, 1/l/I など）を除いた英大小文字 + 数字のみ（記号なし＝口頭・メモで伝えやすく、コピペ事故も防ぐ）
// - 乱数は crypto.randomInt を使う（Math.random は予測可能なので使わない）
// - デフォルト 14 桁。55 文字のアルファベットで約 81bit のエントロピー
const ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generatePassword(length = 14): string {
  let out = ''
  for (let i = 0; i < length; i++) {
    out += ALPHABET[randomInt(ALPHABET.length)]
  }
  return out
}
