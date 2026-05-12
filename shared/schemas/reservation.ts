import { z } from 'zod'

// お客様側の予約作成リクエスト
// startAt は "YYYY-MM-DDTHHMM" 形式（URL に : を含めない 4 桁時刻）
export const createReservationSchema = z.object({
  storeSlug: z.string().min(1),
  menuId: z.number().int().positive(),
  startAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{4}$/, 'startAt は YYYY-MM-DDTHHMM 形式'),
  customer: z.object({
    name: z.string().trim().min(1, 'お名前を入力してください').max(100),
    phone: z.string().trim().max(30).optional().or(z.literal('')),
    email: z.string().trim().email('メールアドレスの形式が正しくありません').max(200).optional().or(z.literal('')),
    note: z.string().trim().max(1000).optional().or(z.literal('')),
  }).refine(
    c => (c.phone && c.phone.length > 0) || (c.email && c.email.length > 0),
    { message: '電話番号またはメールアドレスのどちらかは入力してください', path: ['phone'] },
  ),
})

export type CreateReservationInput = z.infer<typeof createReservationSchema>
