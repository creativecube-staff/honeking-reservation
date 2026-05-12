<script setup lang="ts">
// プライバシーポリシー（雛形）
// 本番運用前に弁護士・行政書士確認の上、最終内容に差し替えてください。
useHead({ title: 'プライバシーポリシー | honeking 予約' })
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 sm:px-6 py-10 text-slate-800 leading-relaxed">
    <h1 class="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
      プライバシーポリシー
    </h1>
    <p class="text-sm text-slate-500 mb-8">
      最終更新日: 2026年5月12日
    </p>

    <p class="mb-8">
      honeking（以下「当院」といいます）は、お客様の個人情報の保護を重要な責務と考え、関連法令を遵守するとともに、本プライバシーポリシーに従って適切に取り扱います。
    </p>

    <section class="mb-6">
      <h2 class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3">
        1. 取得する個人情報
      </h2>
      <p>当院は、お客様から以下の個人情報を取得することがあります。</p>
      <ul class="list-disc list-inside mt-2 space-y-1">
        <li>お名前</li>
        <li>電話番号</li>
        <li>メールアドレス</li>
        <li>ご予約日時・メニュー・ご要望</li>
      </ul>
    </section>

    <section class="mb-6">
      <h2 class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3">
        2. 利用目的
      </h2>
      <p>取得した個人情報は、以下の目的でのみ利用します。</p>
      <ul class="list-disc list-inside mt-2 space-y-1">
        <li>ご予約の受付・確認・変更・キャンセル対応</li>
        <li>施術の提供および施術記録の管理</li>
        <li>ご予約に関するご連絡（電話・メール）</li>
        <li>お問い合わせへの回答</li>
        <li>サービス改善のための統計分析（個人を特定しない形式に加工した上で）</li>
      </ul>
    </section>

    <section class="mb-6">
      <h2 class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3">
        3. 第三者提供
      </h2>
      <p>
        当院は、法令に基づく場合を除き、お客様の同意なく個人情報を第三者に提供しません。
      </p>
    </section>

    <section class="mb-6">
      <h2 class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3">
        4. 安全管理措置
      </h2>
      <p>
        当院は、お客様の個人情報の漏えい・滅失・毀損を防止するため、以下のような技術的・組織的安全管理措置を講じます。
      </p>
      <ul class="list-disc list-inside mt-2 space-y-1">
        <li>氏名・電話番号・メールアドレスは暗号化（AES-256-GCM）して保存します</li>
        <li>通信は HTTPS により暗号化します</li>
        <li>管理画面へのアクセスは IP 制限および二要素認証で保護します</li>
        <li>個人情報を取り扱う従業員に対し、定期的な教育を実施します</li>
      </ul>
    </section>

    <section class="mb-6">
      <h2 class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3">
        5. 個人情報の保管期間
      </h2>
      <p>
        ご予約に関する個人情報は、最終来院日から 5 年間保管した後、適切な方法で削除します。法令により保存が義務付けられている情報はその期間に従います。
      </p>
    </section>

    <section class="mb-6">
      <h2 class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3">
        6. 個人情報の開示・訂正・削除
      </h2>
      <p>
        お客様ご自身の個人情報について、開示・訂正・削除・利用停止のご請求があった場合、本人確認の上、合理的な範囲で速やかに対応します。下記「お問い合わせ」までご連絡ください。
      </p>
    </section>

    <section class="mb-6">
      <h2 class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3">
        7. Cookie について
      </h2>
      <p>
        本予約サイトでは、サービスの利便性向上のために Cookie を使用することがあります。お使いのブラウザの設定により、Cookie の受け入れを拒否することも可能ですが、その場合一部の機能がご利用いただけないことがあります。
      </p>
    </section>

    <section class="mb-6">
      <h2 class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3">
        8. 本ポリシーの改定
      </h2>
      <p>
        当院は、必要に応じて本プライバシーポリシーを改定することがあります。改定後の内容は本ページに掲載した時点から適用されます。
      </p>
    </section>

    <section class="mb-10">
      <h2 class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3">
        9. お問い合わせ
      </h2>
      <p>
        個人情報の取扱いに関するお問い合わせは、ご来院店舗または下記までお願いいたします。
      </p>
      <p class="mt-2 text-sm text-slate-600">
        運営: honeking（整骨院チェーン）<br>
        ※ 連絡先は本番公開前に追記
      </p>
    </section>

    <div class="border-t border-slate-200 pt-6">
      <NuxtLink to="/" class="text-sm text-slate-600 hover:text-orange-700 inline-flex items-center gap-1">
        <UIcon name="i-lucide-chevron-left" class="size-4" />
        トップへ戻る
      </NuxtLink>
    </div>
  </div>
</template>
