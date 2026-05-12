import { randomInt } from 'node:crypto'

// 予約コード生成。8 文字英数字（0/O/1/I を除外して誤認防止）。
// 衝突確率: 32^8 ≈ 1.1 兆通り。実運用想定（数万件/年）なら無視できる。
// 念のため呼び出し側で「DB に該当コードがあるか」を確認し、衝突したら再生成すること。

const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

export function generateReservationCode(length = 8): string {
  let out = ''
  for (let i = 0; i < length; i++) {
    out += ALPHABET[randomInt(0, ALPHABET.length)]
  }
  return out
}
