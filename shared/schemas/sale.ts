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

export type CreateSaleInput = z.input<typeof createSaleSchema>
