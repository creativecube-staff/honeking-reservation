import { getAppBaseUrl } from './mail'

// 会員制のメール本文テンプレ。
// プレーンテキスト + 簡易 HTML の 2 種類を返す。HTML はテキストに改行 → <br> 程度の最小実装。
// 凝った装飾は後回し（整骨院規模ならテキストメールで十分通用する）。

const SUPPORT_FOOTER = `
本メールに心当たりがない場合は破棄してください。
このメールアドレスは送信専用です。返信されても対応できません。
`.trim()

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&': return '&amp;'
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '"': return '&quot;'
      case '\'': return '&#39;'
      default: return c
    }
  })
}

function toSimpleHtml(text: string): string {
  return escapeHtml(text).replace(/\n/g, '<br>')
}

type EmailContent = {
  subject: string
  text: string
  html: string
}

/**
 * 会員登録（仮登録）→ メール認証用のリンクメール。
 * verifyPath は "/verify-email/<token>" を想定。getAppBaseUrl と組み合わせて絶対 URL にする。
 */
export function renderEmailVerification(args: { customerName: string, token: string }): EmailContent {
  const url = `${getAppBaseUrl()}/verify-email/${args.token}`
  const subject = '【会員登録の確認】メールアドレスの認証をお願いします'
  const text = `${args.customerName} 様

会員登録ありがとうございます。
以下のリンクを 24 時間以内にクリックして、メールアドレスの認証を完了してください。

${url}

リンクをクリックすると本登録が完了し、次回からのご予約時にお名前・連絡先の入力が不要になります。

${SUPPORT_FOOTER}
`
  return { subject, text, html: toSimpleHtml(text) }
}

/**
 * パスワードリセット用のリンクメール。
 * resetPath は "/password-reset/<token>" を想定。
 */
export function renderPasswordReset(args: { customerName: string, token: string }): EmailContent {
  const url = `${getAppBaseUrl()}/password-reset/${args.token}`
  const subject = '【パスワード再設定】お手続きのリンクをお送りします'
  const text = `${args.customerName} 様

パスワード再設定のリクエストを受け付けました。
以下のリンクを 1 時間以内にクリックして、新しいパスワードを設定してください。

${url}

リクエストした覚えがない場合、このメールは破棄してください。第三者がパスワードを変更することはできません。

${SUPPORT_FOOTER}
`
  return { subject, text, html: toSimpleHtml(text) }
}
