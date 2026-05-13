import { z } from 'zod'

// お客様側の予約作成リクエスト
// startAt は "YYYY-MM-DDTHHMM" 形式（URL に : を含めない 4 桁時刻）
//
// customer は ゲスト予約用 / 会員ログイン中はサーバが session.member から DB を引くため body は無視されるが、
// バリデーション通過のため値は埋めて送ること（クライアント側は member.name/phone/email を流用する）。
export const createReservationSchema = z.object({
  storeSlug: z.string().min(1),
  menuId: z.number().int().positive(),
  startAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{4}$/, 'startAt は YYYY-MM-DDTHHMM 形式'),
  customer: z.object({
    name: z.string().trim().min(1, 'お名前を入力してください').max(100),
    phone: z.string().trim().min(1, '電話番号を入力してください').max(30),
    email: z.string().trim().toLowerCase().email('メールアドレスの形式が正しくありません').max(200),
    note: z.string().trim().max(1000).optional().or(z.literal('')),
  }),
})

export type CreateReservationInput = z.infer<typeof createReservationSchema>
