import { z } from 'zod'

const dateRegex = /^\d{4}-\d{2}-\d{2}$/
const timeRegex = /^(?:[01]\d|2[0-3]):[0-5]\d$/

// 部分閉店（イレギュラーで一定時間だけ休み）
export const createClosureSchema = z
  .object({
    date: z.string().regex(dateRegex, '日付は YYYY-MM-DD 形式で指定してください'),
    startTime: z.string().regex(timeRegex, 'HH:MM 形式'),
    endTime: z.string().regex(timeRegex, 'HH:MM 形式'),
    note: z.string().max(200, '200 文字以内で入力してください').nullable().optional(),
  })
  .refine(d => d.startTime < d.endTime, {
    message: '終了時刻は開始時刻より後にしてください',
    path: ['endTime'],
  })

export type CreateClosureInput = z.input<typeof createClosureSchema>
