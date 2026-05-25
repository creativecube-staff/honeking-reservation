// 予約完了メール送信ヘルパー。
// 失敗は呼び出し側で握りつぶしてもよい(予約自体は成立済なのでメール失敗は致命傷ではない)。

import { getAppBaseUrl, sendMail } from './mail'

type Args = {
  customerName: string // 平文(挨拶に使用)
  customerEmail: string // 平文(送信先)
  store: { name: string, address: string, phone: string | null, slug: string }
  menu: { name: string, durationMinutes: number, priceJpy: number }
  startAt: Date
  endAt: Date
  confirmationCode: string
  note: string | null
}

// honeking.jp ホストされたブランド画像 URL
const LOGO_URL = 'https://honeking.jp/wp/wp-content/themes/honeking/assets/img/common/header-icon@4x.png'
function storeImageUrl(slug: string): string {
  return `https://honeking.jp/wp/wp-content/themes/honeking/assets/img/shops/${slug}/${slug}-img@2x.jpg`
}

// JST 表示用
const JST_FORMATTER = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'short',
})
const JST_TIME_FORMATTER = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

function durationLabel(min: number): string {
  if (min < 60) return `${min}分`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h}時間` : `${h}時間${m}分`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * 環境変数 RESEND_API_KEY / RESEND_FROM_EMAIL / APP_BASE_URL が揃っていれば送信。
 * 未設定なら警告ログを出してスキップ(dev でメール環境がなくても予約は通る)。
 */
export async function sendReservationConfirmation(args: Args): Promise<void> {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL || !process.env.APP_BASE_URL) {
    console.warn('[reservationMail] メール送信 env が未設定のため送信スキップ', {
      reservationCode: args.confirmationCode,
    })
    return
  }

  const baseUrl = getAppBaseUrl()
  const dateText = JST_FORMATTER.format(args.startAt)
  const startTime = JST_TIME_FORMATTER.format(args.startAt)
  const endTime = JST_TIME_FORMATTER.format(args.endAt)
  const priceText = `¥${args.menu.priceJpy.toLocaleString('ja-JP')}`
  const durationText = durationLabel(args.menu.durationMinutes)
  const confirmUrl = `${baseUrl}/complete/${args.confirmationCode}`
  const phoneLine = args.store.phone ? `TEL: ${args.store.phone}` : ''

  const subject = `【ご予約完了】${args.store.name}のご予約を承りました`

  const text = `${args.customerName} 様

このたびはご予約いただき、誠にありがとうございます。
下記の内容でご来店をお待ちしております。

━━━━━━━━━━━━━━━━━━━━━━

■ 店舗
${args.store.name}
${args.store.address}
${phoneLine}

■ メニュー
${args.menu.name}
所要時間: ${durationText} / ${priceText}(税込)

■ ご予約日時
${dateText} ${startTime}〜${endTime}

■ 予約番号
${args.confirmationCode}
${args.note ? `\n■ ご要望\n${args.note}\n` : ''}
━━━━━━━━━━━━━━━━━━━━━━

▼ ご予約内容の確認
${confirmUrl}

▼ ご変更・キャンセル
お手数ですが、お電話にてご連絡をお願いいたします。
${phoneLine}

ご来店を心よりお待ちしております。

${args.store.name}
`

  const htmlNote = args.note
    ? `<tr><td style="padding:8px 0;color:#64748b;font-size:13px;">ご要望</td></tr><tr><td style="padding:0 0 12px;color:#0f172a;">${escapeHtml(args.note)}</td></tr>`
    : ''

  const html = `<!doctype html>
<html lang="ja">
<head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:24px;background:#fff8ee;font-family:-apple-system,BlinkMacSystemFont,'Hiragino Sans','Yu Gothic',sans-serif;color:#0f172a;line-height:1.7;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
    <!-- 予約完了ヘッダー(ロゴ + ご予約完了/店舗名 を横並び) -->
    <div style="background:#f97316;color:#fff;padding:14px 20px;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%" role="presentation">
        <tr>
          <td valign="middle" width="56" style="width:56px;">
            <a href="https://honeking.jp" style="display:inline-block;text-decoration:none;">
              <img src="${LOGO_URL}" alt="ほねキング整骨院" width="48" style="display:block;width:48px;height:auto;background:#fff;border-radius:50%;padding:4px;box-sizing:border-box;">
            </a>
          </td>
          <td valign="middle" style="padding-left:12px;">
            <p style="margin:0;font-size:12px;opacity:.9;line-height:1.3;">ご予約完了</p>
            <h1 style="margin:2px 0 0;font-size:18px;font-weight:bold;line-height:1.3;">${escapeHtml(args.store.name)}</h1>
          </td>
        </tr>
      </table>
    </div>
    <!-- 店舗外観写真(左右余白あり・角丸) -->
    <div style="padding:16px 20px 0;">
      <a href="https://honeking.jp" style="display:block;text-decoration:none;line-height:0;">
        <img src="${storeImageUrl(args.store.slug)}" alt="${escapeHtml(args.store.name)} の外観" style="display:block;width:100%;max-width:520px;height:auto;border-radius:8px;">
      </a>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 16px;font-size:15px;">${escapeHtml(args.customerName)} 様</p>
      <p style="margin:0 0 20px;font-size:14px;">このたびはご予約いただき、誠にありがとうございます。<br>下記の内容でご来店をお待ちしております。</p>

      <table cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;border-top:1px solid #fde68a;">
        <tr><td style="padding:12px 0 4px;color:#64748b;font-size:12px;">店舗</td></tr>
        <tr><td style="padding:0 0 4px;font-weight:bold;">${escapeHtml(args.store.name)}</td></tr>
        <tr><td style="padding:0 0 4px;color:#475569;">${escapeHtml(args.store.address)}</td></tr>
        ${args.store.phone ? `<tr><td style="padding:0 0 12px;color:#475569;">TEL: <a href="tel:${escapeHtml(args.store.phone)}" style="color:#c2410c;text-decoration:none;font-weight:bold;">${escapeHtml(args.store.phone)}</a></td></tr>` : ''}

        <tr><td style="padding:12px 0 4px;color:#64748b;font-size:12px;border-top:1px solid #fde68a;">メニュー</td></tr>
        <tr><td style="padding:0 0 4px;font-weight:bold;">${escapeHtml(args.menu.name)}</td></tr>
        <tr><td style="padding:0 0 12px;color:#475569;">所要時間 ${escapeHtml(durationText)} / <span style="color:#ea580c;font-weight:bold;">${escapeHtml(priceText)}</span>(税込)</td></tr>

        <tr><td style="padding:12px 0 4px;color:#64748b;font-size:12px;border-top:1px solid #fde68a;">ご予約日時</td></tr>
        <tr><td style="padding:0 0 12px;font-size:17px;font-weight:bold;color:#9a3412;">${escapeHtml(dateText)} ${escapeHtml(startTime)}〜${escapeHtml(endTime)}</td></tr>

        <tr><td style="padding:12px 0 4px;color:#64748b;font-size:12px;border-top:1px solid #fde68a;">予約番号</td></tr>
        <tr><td style="padding:0 0 12px;font-family:Menlo,Consolas,monospace;font-weight:bold;">${escapeHtml(args.confirmationCode)}</td></tr>
        ${htmlNote}
      </table>

      <div style="margin:24px 0 0;text-align:center;">
        <a href="${escapeHtml(confirmUrl)}" style="display:inline-block;padding:12px 24px;background:#f97316;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;">ご予約内容を確認する</a>
      </div>

      <div style="margin:24px 0 0;padding:14px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;font-size:13px;color:#475569;">
        <p style="margin:0 0 4px;font-weight:bold;color:#334155;">ご変更・キャンセルについて</p>
        <p style="margin:0;">お手数ですが、お電話にてご連絡をお願いいたします。${args.store.phone ? `<br><a href="tel:${escapeHtml(args.store.phone)}" style="color:#c2410c;font-weight:bold;text-decoration:none;">${escapeHtml(args.store.phone)}</a>` : ''}</p>
      </div>
    </div>
    <div style="padding:14px 24px;background:#fff7ed;color:#92400e;font-size:12px;text-align:center;">
      ご来店を心よりお待ちしております。
    </div>
  </div>
</body>
</html>`

  await sendMail({
    to: args.customerEmail,
    subject,
    text,
    html,
  })
}
