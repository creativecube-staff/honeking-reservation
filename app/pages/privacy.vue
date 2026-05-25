<script setup lang="ts">
// プライバシーポリシー（雛形・徹底版）
//
// 整骨院チェーン「ほねキング整骨院グループ・海道整骨院」の Web 予約システム + 会員制 を前提に作成。
// 個人情報保護法（令和 4 年改正対応）に沿って、以下を網羅:
// - 取得項目（暗号化済み氏名/電話/メアド/パスワード ハッシュ/予約情報 等）
// - 取得方法・利用目的
// - 第三者提供 / 業務委託（Resend・Supabase 等）/ 外国第三者提供
// - 安全管理措置（AES-256-GCM、HTTPS、IP 制限、2FA）
// - 保管期間（来店ベース / 会員ベース）
// - 開示・訂正・削除・利用停止請求への対応
// - Cookie / ローカルストレージ / アクセス解析
// - 個人情報保護管理者・苦情窓口
// - 改定方法
//
// ★本番公開前に行政書士・弁護士のチェックを推奨。
useHead({ title: "プライバシーポリシー | ほねキング整骨院 予約" });

const POLICY_VERSION = "v2.1-2026-05-25";
const LAST_UPDATED = "2026年5月25日";
</script>

<template>
  <div
    class="mx-auto max-w-5xl px-4 sm:px-6 py-10 text-slate-800 leading-relaxed"
  >
    <div class="max-w-3xl mx-auto">
    <h1 class="text-2xl sm:text-3xl font-bold text-slate-900 mb-2 flex items-center gap-2">
      <UIcon name="i-lucide-shield-check" class="size-6 sm:size-7 text-orange-500" />
      プライバシーポリシー
    </h1>
    <p class="text-sm text-slate-500 mb-8">
      最終更新日: {{ LAST_UPDATED }}（バージョン {{ POLICY_VERSION }}）
    </p>

    <p class="mb-8">
      株式会社
      Umi&apos;ts（以下「当社」といいます）は、当社が運営する「ほねキング整骨院グループ」および「海道整骨院」（以下「当院」と総称します）の
      Web
      予約システムおよび会員制サービス（以下「本サービス」といいます）におけるお客様の個人情報の保護を重要な責務と考え、個人情報の保護に関する法律（以下「個人情報保護法」）その他の関連法令を遵守するとともに、本プライバシーポリシーに従って適切に取り扱います。
    </p>

    <section class="mb-6">
      <h2
        class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3"
      >
        1. 取得する個人情報
      </h2>
      <p>
        当社は、本サービスの提供に必要な範囲で、以下の個人情報を取得することがあります。
      </p>
      <div class="mt-3 space-y-3">
        <div>
          <p class="font-semibold text-slate-900">
            (1) 予約時に取得する情報（ゲスト予約・会員予約共通）
          </p>
          <ul class="list-disc list-inside mt-1 space-y-1">
            <li>お名前</li>
            <li>電話番号</li>
            <li>メールアドレス</li>
            <li>ご予約日時・店舗・施術メニュー・ご要望・備考</li>
          </ul>
        </div>
        <div>
          <p class="font-semibold text-slate-900">
            (2) 会員登録時に取得する情報（会員のみ）
          </p>
          <ul class="list-disc list-inside mt-1 space-y-1">
            <li>
              パスワード（ハッシュ化して保存し、当社は平文パスワードを保持しません）
            </li>
            <li>メール認証・パスワード再設定のための一時トークン</li>
            <li>会員登録日時・最終ログイン日時</li>
            <li>本規約および本ポリシーへの同意日時・同意したバージョン</li>
          </ul>
        </div>
        <div>
          <p class="font-semibold text-slate-900">
            (3) ご来店・施術提供時に取得する情報
          </p>
          <ul class="list-disc list-inside mt-1 space-y-1">
            <li>施術記録（症状・既往症・施術内容のメモ等）</li>
            <li>来店履歴</li>
          </ul>
        </div>
        <div>
          <p class="font-semibold text-slate-900">(4) 自動的に取得する情報</p>
          <ul class="list-disc list-inside mt-1 space-y-1">
            <li>
              IP
              アドレス、ブラウザの種類、リファラ、アクセス日時等のアクセスログ
            </li>
            <li>
              Cookie・セッション
              ID（ログイン状態の維持・予約進行状態の保持に使用）
            </li>
          </ul>
        </div>
        <div>
          <p class="font-semibold text-slate-900">
            (5) 外部サービス（LINE）との連携により取得する情報
          </p>
          <p class="mt-1">
            お客様が本サービスの会員登録またはログインに際して LINE
            アカウントによる連携（LINE Login）を選択された場合、お客様の同意のもと、LINE
            株式会社から以下の情報を取得します。
          </p>
          <ul class="list-disc list-inside mt-1 space-y-1">
            <li>LINE ユーザー識別子（LINE が当サービス向けに発行する一意の ID）</li>
            <li>LINE プロフィール表示名</li>
            <li>
              LINE 登録メールアドレス（お客様が当該情報の提供に同意した場合に限ります）
            </li>
          </ul>
          <p class="mt-1 text-sm text-slate-600">
            ※ LINE
            連携はお客様の任意であり、連携しない場合でも従来のメールアドレス・パスワードによる会員登録・ログインをご利用いただけます。連携の解除はマイページからいつでも行うことができます。
          </p>
        </div>
      </div>
    </section>

    <section class="mb-6">
      <h2
        class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3"
      >
        2. 取得の方法
      </h2>
      <p>当社は、以下の方法でお客様の個人情報を取得します。</p>
      <ul class="list-disc list-inside mt-2 space-y-1">
        <li>
          本サービスの Web フォーム（予約フォーム・会員登録フォーム等）への入力
        </li>
        <li>来店時の問診票・カルテ等の記入</li>
        <li>電話・メールその他の方法による直接のお申し出</li>
        <li>本サービスの利用に伴う自動取得（Cookie・アクセスログ等）</li>
        <li>
          外部サービスとの認証連携（LINE Login（OAuth 2.0））により、お客様の同意のもとに LINE 株式会社から取得
        </li>
      </ul>
    </section>

    <section class="mb-6">
      <h2
        class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3"
      >
        3. 利用目的
      </h2>
      <p>取得した個人情報は、以下の目的でのみ利用します。</p>
      <ul class="list-disc list-inside mt-2 space-y-1">
        <li>ご予約の受付・確認・変更・キャンセル対応</li>
        <li>施術の提供および施術記録の管理</li>
        <li>ご予約・施術に関するご連絡（電話・メール）</li>
        <li>会員登録のためのメール認証および本人確認</li>
        <li>会員ログイン・会員機能の提供・パスワード再設定</li>
        <li>
          LINE アカウントによる会員認証および当社サービス上の会員アカウントとの紐付け
        </li>
        <li>
          将来的に LINE プッシュメッセージ等による通知を実施する場合における通知の送信（当該機能の提供にあたってはお客様の追加の同意を取得します）
        </li>
        <li>
          会員向けのお知らせ・キャンペーン情報の送信（会員が事前に同意した場合に限ります）
        </li>
        <li>料金の請求・受領・売上管理</li>
        <li>お問い合わせ・苦情・開示請求等への対応</li>
        <li>本サービスの不正利用・規約違反の検知および防止</li>
        <li>
          本サービスの改善のための統計分析（個人を特定しない形式に加工した上で）
        </li>
        <li>法令に基づく対応（捜査機関・監督官庁等からの照会対応を含む）</li>
      </ul>
    </section>

    <section class="mb-6">
      <h2
        class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3"
      >
        4. 第三者への提供
      </h2>
      <ol class="list-decimal list-inside space-y-1">
        <li>
          当社は、次の場合を除き、あらかじめお客様の同意を得ることなく、お客様の個人情報を第三者に提供しません。
          <ul class="list-disc list-inside ml-4 mt-1 space-y-1">
            <li>法令に基づく場合</li>
            <li>
              人の生命・身体・財産の保護のために必要があり、お客様の同意を得ることが困難である場合
            </li>
            <li>
              公衆衛生の向上または児童の健全な育成の推進のために特に必要があり、お客様の同意を得ることが困難である場合
            </li>
            <li>
              国の機関・地方公共団体またはその委託を受けた者が法令の定める事務を遂行することに対して協力する必要がある場合
            </li>
          </ul>
        </li>
        <li>
          当社は、第三者提供に該当する場合、個人情報保護法に基づき、提供記録の作成・保存を行います。
        </li>
      </ol>
    </section>

    <section class="mb-6">
      <h2
        class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3"
      >
        5. 業務委託
      </h2>
      <p>
        当社は、利用目的の達成に必要な範囲で個人情報の取扱いを以下の事業者に委託する場合があります。当社は、委託先について個人情報保護法に基づく必要かつ適切な監督を行います。
      </p>
      <div class="mt-3 overflow-x-auto">
        <table class="min-w-full text-sm border border-slate-200 bg-white">
          <thead class="bg-slate-50">
            <tr>
              <th
                class="px-3 py-2 text-left font-semibold border-b border-slate-200"
              >
                委託先
              </th>
              <th
                class="px-3 py-2 text-left font-semibold border-b border-slate-200"
              >
                委託業務
              </th>
              <th
                class="px-3 py-2 text-left font-semibold border-b border-slate-200"
              >
                所在国
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="px-3 py-2 border-b border-slate-200">
                Supabase, Inc.
              </td>
              <td class="px-3 py-2 border-b border-slate-200">
                データベース基盤の提供・運用（東京リージョンで保管）
              </td>
              <td class="px-3 py-2 border-b border-slate-200">
                アメリカ合衆国（データ保管: 日本国内）
              </td>
            </tr>
            <tr>
              <td class="px-3 py-2 border-b border-slate-200">Resend, Inc.</td>
              <td class="px-3 py-2 border-b border-slate-200">
                電子メール送信サービス（予約確認・会員認証・パスワード再設定メール等の送信）
              </td>
              <td class="px-3 py-2 border-b border-slate-200">
                アメリカ合衆国
              </td>
            </tr>
            <tr>
              <td class="px-3 py-2 border-b border-slate-200">
                エックスサーバー株式会社
              </td>
              <td class="px-3 py-2 border-b border-slate-200">
                メール受信サーバの提供・お問い合わせ用メールアドレスの運用
              </td>
              <td class="px-3 py-2 border-b border-slate-200">日本</td>
            </tr>
            <tr>
              <td class="px-3 py-2 border-b border-slate-200">
                本サービスを稼働させる VPS（仮想専用サーバ）事業者
              </td>
              <td class="px-3 py-2 border-b border-slate-200">本サービスのアプリケーションサーバ運用</td>
              <td class="px-3 py-2 border-b border-slate-200">日本</td>
            </tr>
            <tr>
              <td class="px-3 py-2">LINE 株式会社</td>
              <td class="px-3 py-2">
                LINE Login による会員認証連携の提供（お客様が当該連携機能をご利用になる場合に限ります）
              </td>
              <td class="px-3 py-2">日本</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="mt-3 text-xs text-slate-500">
        ※
        委託先は本サービスの仕様・運用変更に応じて変更されることがあります。重要な変更があった場合は本ポリシーを改定し本ページに掲示します。
      </p>
      <p class="mt-2 text-xs text-slate-500">
        ※ LINE 株式会社による LINE Login
        サービスの提供にあたって取得・利用される情報の取扱いについては、同社が定める <a
          href="https://terms2.line.me/LINE_Privacy_Policy?lang=ja"
          target="_blank"
          rel="noopener noreferrer"
          class="text-orange-700 underline"
        >LINE プライバシーポリシー</a> をご参照ください。
      </p>
    </section>

    <section class="mb-6">
      <h2
        class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3"
      >
        6. 外国にある第三者への個人情報の提供
      </h2>
      <ol class="list-decimal list-inside space-y-1">
        <li>
          当社は、前条のとおり、業務委託に伴い外国（アメリカ合衆国）に所在する委託先のサーバを経由して個人情報を取り扱う場合があります。
        </li>
        <li>
          当該外国における個人情報保護に関する制度の概要等の情報については、個人情報保護委員会の公表する情報（<a
            href="https://www.ppc.go.jp/personalinfo/legal/kaiseihogohou/"
            target="_blank"
            rel="noopener noreferrer"
            class="text-orange-700 underline"
            >https://www.ppc.go.jp/personalinfo/legal/kaiseihogohou/</a
          >）をご参照ください。
        </li>
        <li>
          当社は、委託先との間で、個人情報保護法および同法施行規則に定める基準に相当する措置（暗号化通信、アクセス制御、監査ログ等）を講じる契約を締結しています。
        </li>
      </ol>
    </section>

    <section class="mb-6">
      <h2
        class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3"
      >
        7. 安全管理措置
      </h2>
      <p>
        当社は、お客様の個人情報の漏えい・滅失・毀損を防止するため、以下の技術的・組織的安全管理措置を講じます。
      </p>
      <div class="mt-3 space-y-3">
        <div>
          <p class="font-semibold text-slate-900">(1) 組織的安全管理措置</p>
          <ul class="list-disc list-inside mt-1 space-y-1">
            <li>個人情報保護管理者を選任し、責任体制を明確化</li>
            <li>個人情報を取り扱う従業者を限定し、定期的な教育・監督を実施</li>
            <li>個人情報の取扱いに関する規程の整備と定期的な見直し</li>
          </ul>
        </div>
        <div>
          <p class="font-semibold text-slate-900">(2) 技術的安全管理措置</p>
          <ul class="list-disc list-inside mt-1 space-y-1">
            <li>
              氏名・電話番号・メールアドレスはアプリケーション層で AES-256-GCM
              により暗号化して保存
            </li>
            <li>
              パスワードは bcrypt
              等の一方向ハッシュ関数により保存（平文では保存しない）
            </li>
            <li>ブラウザと当社サーバ間の通信は HTTPS（TLS）により暗号化</li>
            <li>
              管理画面へのアクセスは IP
              アドレス制限および二要素認証（TOTP）により保護
            </li>
            <li>不正アクセス検知のためのアクセスログを保管</li>
          </ul>
        </div>
        <div>
          <p class="font-semibold text-slate-900">
            (3) 物理的・人的安全管理措置
          </p>
          <ul class="list-disc list-inside mt-1 space-y-1">
            <li>個人情報を保管するサーバ機器・端末への物理的アクセスを制限</li>
            <li>従業者との間で機密保持に関する誓約を締結</li>
            <li>個人情報の取扱状況について定期的な点検を実施</li>
          </ul>
        </div>
      </div>
    </section>

    <section class="mb-6">
      <h2
        class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3"
      >
        8. 個人情報の保管期間
      </h2>
      <ol class="list-decimal list-inside space-y-1">
        <li>
          ゲスト予約のみのお客様の個人情報は、最終来店日から 5
          年間保管した後、適切な方法で削除します。
        </li>
        <li>
          会員のお客様の個人情報は、退会日または最終ログイン日から 5
          年経過するまでのいずれか早い時点まで保管し、その後適切な方法で削除します。
        </li>
        <li>
          施術記録については、医療類似行為に関する記録として、法令上の保存義務に従い保管します。
        </li>
        <li>
          会計・税務に関する記録は、法人税法・所得税法等の定めにより 7
          年間保管します。
        </li>
        <li>
          本条にかかわらず、法令により保存が義務付けられている情報は当該法令の定める期間に従います。
        </li>
      </ol>
    </section>

    <section class="mb-6">
      <h2
        class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3"
      >
        9. 個人情報の開示・訂正・削除・利用停止
      </h2>
      <ol class="list-decimal list-inside space-y-1">
        <li>
          お客様ご自身の個人情報について、開示・訂正・追加・削除・利用停止・第三者提供の停止の請求があった場合、本人確認の上、個人情報保護法の定めに従い、合理的な範囲で速やかに対応します。
        </li>
        <li>
          請求の方法および手数料については、第 14
          条のお問い合わせ窓口までご連絡ください。
        </li>
        <li>
          会員のお客様は、本サービスのマイページから、氏名・電話番号・メールアドレス・パスワードを随時変更することができます。退会もマイページから行うことができます。
        </li>
        <li>
          当社は、個人情報保護法その他の法令に定める場合を除き、お客様の請求に応じる義務を負わない場合がありますが、その場合はお客様にその理由をお知らせします。
        </li>
      </ol>
    </section>

    <section class="mb-6">
      <h2
        class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3"
      >
        10. Cookie その他の自動取得情報
      </h2>
      <ol class="list-decimal list-inside space-y-1">
        <li>
          本サービスでは、サービスの利便性向上のため Cookie
          およびこれに類する技術（セッションストレージ・ローカルストレージ等）を使用します。
        </li>
        <li>
          具体的には以下の目的で利用します。
          <ul class="list-disc list-inside ml-4 mt-1 space-y-1">
            <li>会員のログイン状態を維持するため（セッション Cookie）</li>
            <li>
              予約フローの進行状態（選択中の店舗・メニュー・日時等）を一時的に保持するため
            </li>
            <li>不正アクセス・なりすましの検知</li>
          </ul>
        </li>
        <li>
          お客様はブラウザの設定により Cookie
          の受入れを拒否することができますが、その場合本サービスの一部機能（ログイン状態の維持等）がご利用いただけないことがあります。
        </li>
        <li>
          本サービスは、利用状況の把握およびサービス改善のため、Google LLC
          が提供するアクセス解析ツール「Google Analytics」を使用します。
          <ul class="list-disc list-inside ml-4 mt-1 space-y-1">
            <li>
              取得する情報: ブラウザの種類・端末情報・IP アドレス・閲覧履歴・遷移経路など、お客様個人を特定しない統計情報
            </li>
            <li>取得方法: Google Analytics が発行する Cookie を利用</li>
            <li>
              取得した情報の管理は Google LLC のプライバシーポリシーに従います。
              詳細は
              <a
                href="https://policies.google.com/privacy?hl=ja"
                target="_blank"
                rel="noopener"
                class="text-orange-700 hover:underline"
              >Google プライバシーポリシー</a>
              および
              <a
                href="https://marketingplatform.google.com/about/analytics/terms/jp/"
                target="_blank"
                rel="noopener"
                class="text-orange-700 hover:underline"
              >Google アナリティクス利用規約</a>
              をご参照ください。
            </li>
            <li>
              オプトアウト: ブラウザのアドオン「<a
                href="https://tools.google.com/dlpage/gaoptout?hl=ja"
                target="_blank"
                rel="noopener"
                class="text-orange-700 hover:underline"
              >Google Analytics オプトアウト アドオン</a>」をインストールするか、ブラウザの設定で Cookie の受入れを拒否することで、Google Analytics による情報収集を停止できます。
            </li>
            <li>
              取得した統計情報は、本サービスの改善およびマーケティング以外の目的では利用しません。
            </li>
          </ul>
        </li>
      </ol>
    </section>

    <section class="mb-6">
      <h2
        class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3"
      >
        11. 個人情報保護管理者
      </h2>
      <p>
        当社は、個人情報の適切な管理のため、以下の者を個人情報保護管理者として選任しています。
      </p>
      <div
        class="mt-3 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-md p-4"
      >
        役職・氏名: 代表取締役 海野 和也（兼任）
      </div>
    </section>

    <section class="mb-6">
      <h2
        class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3"
      >
        12. 未成年者の個人情報
      </h2>
      <p>
        未成年者が本サービスを利用する場合、親権者その他の法定代理人の同意を得たうえで個人情報を提供してください。当社が未成年者から個人情報を取得した場合、法定代理人の同意があったものとみなします。
      </p>
    </section>

    <section class="mb-6">
      <h2
        class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3"
      >
        13. 本ポリシーの改定
      </h2>
      <ol class="list-decimal list-inside space-y-1">
        <li>
          当社は、法令の改正、本サービスの内容・運用の変更等に応じて、本ポリシーを随時改定することがあります。
        </li>
        <li>
          改定後の本ポリシーは、本ページに掲示した時点から効力を生じます。ただし、お客様の権利義務に重大な影響を及ぼす改定については、合理的な事前通知期間を設けます。
        </li>
        <li>
          お客様は、本ポリシー改定後も本サービスを継続してご利用いただくことにより、改定後の本ポリシーに同意したものとみなします。
        </li>
      </ol>
    </section>

    <section class="mb-10">
      <h2
        class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3"
      >
        14. お問い合わせ・苦情窓口
      </h2>
      <p>
        個人情報の取扱いに関するお問い合わせ・苦情・開示請求等は、下記までご連絡ください。
      </p>
      <div
        class="mt-3 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-md p-4 space-y-1"
      >
        <p>
          運営会社:
          <span class="font-semibold">株式会社 Umi&apos;ts（ウミッツ）</span>
        </p>
        <p>代表者: <span class="font-semibold">代表取締役 海野 和也</span></p>
        <p>
          屋号:
          <span class="font-semibold"
            >ほねキング整骨院グループ・海道整骨院</span
          >
        </p>
        <p>
          本社所在地:
          <span class="font-semibold">〒125-0061 東京都葛飾区亀有 3-3-7</span>
        </p>
        <p>電話番号: <span class="font-semibold">047-701-7729</span></p>
        <p>
          個人情報保護管理者:
          <span class="font-semibold">代表取締役 海野 和也（兼任）</span>
        </p>
        <p>
          お問い合わせ用メールアドレス:
          <span class="font-semibold">reserved@honeking.jp</span>
        </p>
      </div>
    </section>

    <div class="border-t border-slate-200 pt-6">
      <NuxtLink
        to="/"
        class="text-sm text-slate-600 hover:text-orange-700 inline-flex items-center gap-1"
      >
        <UIcon name="i-lucide-chevron-left" class="size-4" />
        トップへ戻る
      </NuxtLink>
    </div>
    </div>
  </div>
</template>
