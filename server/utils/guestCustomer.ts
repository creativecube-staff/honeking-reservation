import { encryptUtf8 } from './crypto'
import { hashName, hashPhone } from './hash'
import { prisma } from './prisma'

// 店頭ふらっと販売（=会員でも予約客でもないお客様）の物販を記録するための「ゲスト購入用」固定 Customer を取得 or 作成する。
//
// 設計判断:
// - Customer は phoneHash か emailHash どちらかが必須（DB CHECK 制約）。完全匿名 Customer は作れない。
// - そこで「予約顧客と絶対に衝突しないセンチネル文字列」を電話・名前のソースに使い、固定 1 件の Customer を使い回す。
// - 暗号化された name / phone は復号すると「店頭ふらっと販売」と分かる文字列にしておく（管理画面表示用）。
// - phoneHash の一意性を確保することで find or create が安全に動く。
//
// この Customer は管理画面の顧客一覧にも 1 件だけ現れる（仕様）。
// 詳細を開けばゲスト購入の合計が見られる副産物として残る。

const GUEST_NAME = '店頭ふらっと販売'
// hashPhone は数字以外を消すため、英字を含む文字列は空文字扱いになる。
// 完全に衝突しないよう、明示的に sentinel 用の数字列を採用する。
// 実電話番号としてあり得ない '0' で始まる長い番号にしておく。
const GUEST_PHONE_SENTINEL = '00000000000000000000'

let cachedGuestId: number | null = null

export async function getOrCreateGuestCustomer(): Promise<{ id: number }> {
  if (cachedGuestId !== null) return { id: cachedGuestId }

  const phoneHash = hashPhone(GUEST_PHONE_SENTINEL)
  const existing = await prisma.customer.findUnique({
    where: { phoneHash },
    select: { id: true },
  })
  if (existing) {
    cachedGuestId = existing.id
    return existing
  }

  const created = await prisma.customer.create({
    data: {
      name: encryptUtf8(GUEST_NAME),
      nameHash: hashName(GUEST_NAME),
      phone: encryptUtf8(GUEST_PHONE_SENTINEL),
      phoneHash,
      // メール・パスワード・会員情報はすべて null
    },
    select: { id: true },
  })
  cachedGuestId = created.id
  return created
}

export function isGuestCustomerName(decryptedName: string | null): boolean {
  return decryptedName === GUEST_NAME
}
