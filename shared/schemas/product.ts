import { z } from 'zod'

// 商品マスタのバリデーション。
// kind=PRODUCT は在庫を持つ物販、kind=VOUCHER は回数券で voucherTotalUses が必須。
// storeId=null は全店舗共通商品（メニュー設計と同じ二階建て）。

export const productKindSchema = z.enum(['PRODUCT', 'VOUCHER'])

export const productBaseSchema = z.object({
  storeId: z.number().int().positive().nullable().default(null),
  kind: productKindSchema,
  name: z.string().min(1, '商品名は必須です').max(100, '100 文字以内で入力してください'),
  description: z.string().max(1000).optional().or(z.literal('')),
  priceJpy: z.number().int().min(0).max(10_000_000),
  stock: z.number().int().min(0).max(99_999).default(0),
  voucherTotalUses: z.number().int().min(1).max(999).nullable().optional(),
  isActive: z.boolean().default(true),
  displayOrder: z.number().int().min(0).max(9999).default(0),
}).superRefine((data, ctx) => {
  if (data.kind === 'VOUCHER') {
    if (!data.voucherTotalUses || data.voucherTotalUses < 1) {
      ctx.addIssue({ code: 'custom', path: ['voucherTotalUses'], message: '回数券は利用回数が必須です' })
    }
  }
})

export const createProductSchema = productBaseSchema
export const updateProductSchema = z.object({
  storeId: z.number().int().positive().nullable().optional(),
  kind: productKindSchema.optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional().or(z.literal('')),
  priceJpy: z.number().int().min(0).max(10_000_000).optional(),
  stock: z.number().int().min(0).max(99_999).optional(),
  voucherTotalUses: z.number().int().min(1).max(999).nullable().optional(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().min(0).max(9999).optional(),
})

// 在庫調整: 増減量 + 理由メモ
export const stockAdjustSchema = z.object({
  delta: z.number().int().refine(v => v !== 0, '増減量は 0 以外を指定してください'),
  note: z.string().trim().max(200).optional(),
})

export type ProductKindInput = z.input<typeof productKindSchema>
export type CreateProductInput = z.input<typeof createProductSchema>
export type UpdateProductInput = z.input<typeof updateProductSchema>
