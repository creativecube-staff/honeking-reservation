import { z } from 'zod'

// 販売登録のバリデーション。
// 顧客は必須、予約は任意。回数券販売の場合は CustomerVoucher が自動発行される。
// 物販の場合、quantity 分だけ Product.stock を減算する。
export const createSaleSchema = z.object({
  productId: z.number().int().positive(),
  storeId: z.number().int().positive(),
  customerId: z.number().int().positive(),
  reservationId: z.number().int().positive().nullable().optional(),
  quantity: z.number().int().min(1).max(99),
  note: z.string().trim().max(500).optional(),
})

// 予約への回数券消費
export const useVoucherSchema = z.object({
  customerVoucherId: z.number().int().positive(),
})

// 物販クイック販売（複数商品・ゲスト購入対応）
// 顧客の指定方法:
//   - customerId: 既存顧客に紐付ける
//   - isGuestPurchase: true で「店頭ふらっと販売用」固定顧客に紐付ける
// どちらか一方が必要。
export const createBulkSaleSchema = z.object({
  storeId: z.number().int().positive(),
  customerId: z.number().int().positive().optional(),
  isGuestPurchase: z.boolean().optional(),
  items: z.array(z.object({
    productId: z.number().int().positive(),
    quantity: z.number().int().min(1).max(99),
    note: z.string().trim().max(500).optional(),
  })).min(1).max(20),
}).refine(
  v => (v.customerId != null) !== (v.isGuestPurchase === true),
  { message: '顧客指定が不正です（customerId または isGuestPurchase のどちらか一方を指定してください）' },
)

export type CreateSaleInput = z.input<typeof createSaleSchema>
export type CreateBulkSaleInput = z.input<typeof createBulkSaleSchema>
