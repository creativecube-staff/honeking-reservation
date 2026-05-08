import { z } from 'zod'

const timeRegex = /^(?:[01]\d|2[0-3]):[0-5]\d$/
const dateRegex = /^\d{4}-\d{2}-\d{2}$/

// シフト upsert (practitionerId × date unique を活かして新規/上書きを 1 エンドポイントで処理)
export const upsertShiftSchema = z
  .object({
    practitionerId: z.number().int().min(1),
    date: z.string().regex(dateRegex, '日付は YYYY-MM-DD 形式で指定してください'),
    startTime: z.string().regex(timeRegex, '時刻は HH:MM 形式で指定してください'),
    endTime: z.string().regex(timeRegex, '時刻は HH:MM 形式で指定してください'),
    // null ならメイン店舗で勤務、指定があればヘルプ先店舗で勤務
    workStoreId: z.number().int().min(1).nullable().optional(),
  })
  .refine(d => d.startTime < d.endTime, {
    message: '退勤時刻は出勤時刻より後にしてください',
    path: ['endTime'],
  })

export type UpsertShiftInput = z.input<typeof upsertShiftSchema>
