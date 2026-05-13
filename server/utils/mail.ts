import { Resend } from 'resend'

// 会員制（Phase 1〜）で利用するメール送信ヘルパー。
// プロバイダは Resend（月 3,000 通 / 日 100 通まで無料）。整骨院規模なら十分。
//
// env:
// - RESEND_API_KEY    : Resend ダッシュボードで発行する API キー
// - RESEND_FROM_EMAIL : "noreply@example.com" もしくは "整骨院名 <noreply@example.com>" 形式
// - APP_BASE_URL      : メール本文に埋め込むリンクのベース URL（例: https://yoyaku.example.com）
//
// 本番では Resend で送信ドメインを認証（DKIM/SPF）してから RESEND_FROM_EMAIL を独自ドメインに切り替える。

let cached: Resend | null = null

function getClient(): Resend {
  if (cached) return cached
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error('RESEND_API_KEY env が設定されていません。Resend で API キーを発行して .env に追加してください。')
  }
  cached = new Resend(apiKey)
  return cached
}

function getFrom(): string {
  const from = process.env.RESEND_FROM_EMAIL
  if (!from) {
    throw new Error('RESEND_FROM_EMAIL env が設定されていません（例: "整骨院名 <noreply@example.com>"）')
  }
  return from
}

export function getAppBaseUrl(): string {
  const base = process.env.APP_BASE_URL
  if (!base) {
    throw new Error('APP_BASE_URL env が設定されていません（例: https://yoyaku.example.com）')
  }
  return base.replace(/\/+$/, '')
}

type SendArgs = {
  to: string
  subject: string
  text: string
  html?: string
}

/**
 * 1 通だけ送る基本ヘルパー。失敗時は例外を投げる。
 * 呼び出し側でメアドや本文をログに出さないこと（個人情報・トークン漏洩防止）。
 */
export async function sendMail({ to, subject, text, html }: SendArgs): Promise<void> {
  const client = getClient()
  const from = getFrom()
  const result = await client.emails.send({
    from,
    to,
    subject,
    text,
    ...(html ? { html } : {}),
  })
  if (result.error) {
    // Resend 側のエラーオブジェクトには name / message が入る。メアドは含めずに投げ直す。
    throw new Error(`メール送信に失敗しました: ${result.error.name ?? 'UnknownError'}: ${result.error.message ?? ''}`)
  }
}
