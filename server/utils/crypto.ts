import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

// 個人情報（氏名・電話・メール）の AES-256-GCM 暗号化ユーティリティ。
// 鍵は env から取得。生成は `openssl rand -base64 32` 等で 32 バイト → base64 32 文字（パディング込みで 44 文字）。
//
// 保存形式: base64( iv(12B) || authTag(16B) || ciphertext )
// 復号時は逆順に切り出して decryptUtf8 する。

const IV_LEN = 12 // GCM 推奨は 12 バイト
const TAG_LEN = 16

function getKey(): Buffer {
  const raw = process.env.RESERVATION_ENCRYPTION_KEY
  if (!raw) {
    throw new Error('RESERVATION_ENCRYPTION_KEY env が設定されていません。`openssl rand -base64 32` で生成して .env に追加してください。')
  }
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) {
    throw new Error(`RESERVATION_ENCRYPTION_KEY は base64 デコード後 32 バイトである必要があります（現在 ${key.length} バイト）`)
  }
  return key
}

/** 平文（UTF-8）を AES-256-GCM で暗号化し、base64 文字列として返す。 */
export function encryptUtf8(plain: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64')
}

/** encryptUtf8 で得た base64 文字列を復号する。改ざんがあれば例外。 */
export function decryptUtf8(encoded: string): string {
  const key = getKey()
  const buf = Buffer.from(encoded, 'base64')
  if (buf.length < IV_LEN + TAG_LEN) {
    throw new Error('暗号化値が短すぎます')
  }
  const iv = buf.subarray(0, IV_LEN)
  const authTag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN)
  const ciphertext = buf.subarray(IV_LEN + TAG_LEN)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return plain.toString('utf8')
}
