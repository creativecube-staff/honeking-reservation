<script setup lang="ts">
// 会員規約（雛形・徹底版）
//
// 整骨院チェーン「ほねキング整骨院」の Web 予約システム会員制を前提に作成。
// 民法 548 条の 2（定型約款）として効力を持たせる構成で、抜けがないよう以下を網羅:
// - 規約への同意・変更
// - 会員登録〜退会・資格停止
// - 予約・キャンセル料・無断キャンセル・遅刻
// - 施術提供（医療行為ではない旨）
// - 回数券（店頭販売のみ）
// - 第三者サービス連携（将来 LINE ログイン等を想定）
// - 反社会的勢力の排除
// - 免責・損害賠償の制限
// - 準拠法・合意管轄
//
// ★本ファイル内の [TODO: ...] プレースホルダは本番公開前に必ず実値に置換すること。
// ★本番公開前に行政書士・弁護士のチェックを推奨。
useHead({ title: '会員規約 | ほねキング整骨院 予約' })

// 規約バージョン。改定時は日付を更新。Customer.termsVersionAgreedAt 等に保存する想定。
const TERMS_VERSION = 'v1.0-2026-05-13'
const LAST_UPDATED = '2026年5月13日'
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 sm:px-6 py-10 text-slate-800 leading-relaxed">
    <h1 class="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
      会員規約
    </h1>
    <p class="text-sm text-slate-500 mb-8">
      最終更新日: {{ LAST_UPDATED }}（バージョン {{ TERMS_VERSION }}）
    </p>

    <p class="mb-8">
      本会員規約（以下「本規約」といいます）は、株式会社 Umi&apos;ts（以下「当社」といいます）が運営する整骨院「ほねキング整骨院グループ」「海道整骨院」（以下「当院」と総称します）およびその Web 予約システム（以下「本サービス」といいます）における会員制度の利用条件を定めるものです。本サービスをご利用いただく会員（以下「会員」といいます）は、本規約に同意のうえ本サービスをご利用ください。
    </p>

    <section class="mb-6">
      <h2 class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3">
        第 1 条（適用）
      </h2>
      <ol class="list-decimal list-inside space-y-1">
        <li>本規約は、本サービスの会員機能の利用に関する一切の関係に適用されます。</li>
        <li>本規約は、民法第 548 条の 2 に規定する「定型約款」に該当するものとし、会員が本サービスの会員機能を利用した時点で、本規約の各条項に同意したものとみなします。</li>
        <li>当院が本サービス上で別途定める個別の利用条件・ガイドライン・プライバシーポリシー等は、本規約の一部を構成します。</li>
        <li>本規約と個別の利用条件等の内容が矛盾する場合は、特段の定めがない限り個別の利用条件等が優先するものとします。</li>
      </ol>
    </section>

    <section class="mb-6">
      <h2 class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3">
        第 2 条（定義）
      </h2>
      <p>本規約において、以下の用語は次の意味で使用します。</p>
      <ul class="list-disc list-inside mt-2 space-y-1">
        <li>「当社」: 株式会社 Umi&apos;ts</li>
        <li>「当院」: 当社が運営する「ほねキング整骨院グループ」および「海道整骨院」の総称</li>
        <li>「会員」: 本規約に同意のうえ、当院所定の手続により会員登録を完了した個人</li>
        <li>「会員情報」: 会員が本サービスに登録した氏名・電話番号・メールアドレス・パスワード等の情報</li>
        <li>「本サービス」: 当社が提供するインターネット予約サービスおよびこれに付随する会員向け機能の総称</li>
        <li>「予約」: 本サービスを通じて行う、当院の施術メニューに関する来店予約</li>
        <li>「施術」: 当院の柔道整復師・あん摩マッサージ指圧師等が提供する施術行為</li>
      </ul>
    </section>

    <section class="mb-6">
      <h2 class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3">
        第 3 条（規約の変更）
      </h2>
      <ol class="list-decimal list-inside space-y-1">
        <li>当院は、民法第 548 条の 4 の規定に基づき、必要に応じて会員の同意を要することなく本規約を変更できるものとします。</li>
        <li>本規約を変更する場合、当院は変更内容および効力発生日を本サービス上に掲示するか、会員の登録メールアドレスに通知するなど合理的な方法で会員に周知します。</li>
        <li>変更後の本規約は、本サービス上に掲示した時点または別途定めた効力発生日のいずれか遅い時点から効力を生じるものとします。</li>
        <li>会員が変更後の本規約に同意できない場合、第 9 条に定める方法により退会することができます。</li>
      </ol>
    </section>

    <section class="mb-6">
      <h2 class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3">
        第 4 条（会員登録の申込）
      </h2>
      <ol class="list-decimal list-inside space-y-1">
        <li>会員登録の申込みは、申込者本人が本サービスの所定のフォームに正確な情報（氏名、電話番号、メールアドレス、パスワード）を入力し、本規約およびプライバシーポリシーに同意することにより行うものとします。</li>
        <li>申込者は、登録するメールアドレスが申込者本人のものであり、かつ受信可能な状態にあることを保証するものとします。</li>
        <li>当院は、次の各号に該当する申込みについて、その理由を開示することなく登録を拒否することができます。
          <ul class="list-disc list-inside ml-4 mt-1 space-y-1">
            <li>申込者が過去に本規約違反等により会員資格を取り消されたことがある場合</li>
            <li>申込者が反社会的勢力等（第 20 条に定義）に該当する場合</li>
            <li>申込内容に虚偽・誤記・記入漏れがある場合</li>
            <li>同一人物が複数の会員登録を行っている、または行おうとしている場合</li>
            <li>その他、当院が会員として不適切と判断した場合</li>
          </ul>
        </li>
      </ol>
    </section>

    <section class="mb-6">
      <h2 class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3">
        第 5 条（会員契約の成立）
      </h2>
      <ol class="list-decimal list-inside space-y-1">
        <li>申込者は、第 4 条の申込み後、当院から送信される確認メール内のリンクをクリックしてメールアドレスの認証を完了した時点で、会員資格を取得し、当院との間に会員契約が成立するものとします。</li>
        <li>確認メール送信から 24 時間以内にメールアドレス認証が完了しない場合、当該申込みは無効となります。再度登録を希望する場合は、改めて申込みを行うものとします。</li>
        <li>メールアドレス認証が完了するまでの間、申込者は会員ではなく、会員向け機能を利用することはできません。</li>
      </ol>
    </section>

    <section class="mb-6">
      <h2 class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3">
        第 6 条（会員資格）
      </h2>
      <ol class="list-decimal list-inside space-y-1">
        <li>会員資格は会員本人に帰属するものとし、会員はこれを第三者に譲渡・貸与・売買・質入れ・相続その他の方法で処分することはできません。</li>
        <li>1 名の自然人は、1 つの会員アカウントのみ保有できるものとします。</li>
        <li>未成年者が会員登録を行う場合は、親権者その他の法定代理人の同意を得るものとします。本規約への同意は、法定代理人の同意があったものとみなします。</li>
      </ol>
    </section>

    <section class="mb-6">
      <h2 class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3">
        第 7 条（登録情報の変更）
      </h2>
      <ol class="list-decimal list-inside space-y-1">
        <li>会員は、登録情報に変更があった場合、速やかに本サービスのマイページ等を通じて変更手続きを行うものとします。</li>
        <li>会員が登録情報の変更を怠ったことにより、当院からの通知が到達しない・遅延する等の不利益が生じた場合、当院は一切の責任を負いません。</li>
      </ol>
    </section>

    <section class="mb-6">
      <h2 class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3">
        第 8 条（アカウント・パスワードの管理）
      </h2>
      <ol class="list-decimal list-inside space-y-1">
        <li>会員は、自己の責任において会員アカウントおよびパスワードを管理し、第三者に開示・貸与・共有してはなりません。</li>
        <li>当院は、登録されたメールアドレスとパスワードの組合せによる認証が成功した場合、当該操作を会員本人によるものとして取り扱うことができます。</li>
        <li>会員アカウントの第三者による使用により会員または第三者に生じた損害について、当院に故意または重大な過失がある場合を除き、当院は責任を負いません。</li>
        <li>会員は、アカウントが第三者により不正利用されている、またはそのおそれがあると認識した場合、直ちに当院に通知するとともに、パスワードを変更する等の措置を講じるものとします。</li>
      </ol>
    </section>

    <section class="mb-6">
      <h2 class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3">
        第 9 条（退会）
      </h2>
      <ol class="list-decimal list-inside space-y-1">
        <li>会員は、本サービス上の所定の手続きにより、いつでも退会することができます。</li>
        <li>退会した時点で会員資格は消滅し、会員向け機能を利用することはできなくなります。</li>
        <li>退会後の会員情報の取扱いは、当院のプライバシーポリシーの定めによります。</li>
        <li>退会前に成立した予約のうち、退会時点で未消化のものは、当該予約に関しては会員ではない一般のお客様としてキャンセル料等の規定が適用されます。</li>
      </ol>
    </section>

    <section class="mb-6">
      <h2 class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3">
        第 10 条（会員資格の停止・取消）
      </h2>
      <ol class="list-decimal list-inside space-y-1">
        <li>当院は、会員が次の各号のいずれかに該当する場合、事前通知なく当該会員の会員資格を一時停止または取消すことができます。
          <ul class="list-disc list-inside ml-4 mt-1 space-y-1">
            <li>本規約に違反した場合</li>
            <li>登録情報に虚偽の記載があったことが判明した場合</li>
            <li>当院または第三者に損害を与えた、または与えるおそれがある場合</li>
            <li>無断キャンセル・遅刻を繰返し、当院の業務に支障をきたした場合（第 13 条）</li>
            <li>当院の従業員その他関係者に対し、暴行・脅迫・差別的言動・セクシュアルハラスメントその他迷惑行為を行った場合</li>
            <li>反社会的勢力等に該当した場合（第 19 条）</li>
            <li>最終来店日または最終ログイン日から 3 年間、本サービスの利用がない場合</li>
            <li>その他、当院が会員として不適切と判断した場合</li>
          </ul>
        </li>
        <li>会員資格を取消された会員は、その時点で予約済みであった一切の権利を失うものとし、当院に対して何らの請求もできないものとします。</li>
        <li>会員資格の停止・取消により会員に生じた損害について、当院は一切の責任を負いません。</li>
      </ol>
    </section>

    <section class="mb-6">
      <h2 class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3">
        第 11 条（予約・予約変更・キャンセル）
      </h2>
      <ol class="list-decimal list-inside space-y-1">
        <li>会員は、本サービスを通じて、当院所定の方法により予約を行うことができます。</li>
        <li>予約は当院の予約管理システムに登録された時点で成立するものとし、当院から予約確認メールが送信されます。</li>
        <li>予約の変更・キャンセルは、本サービスのマイページ、または各店舗への電話連絡により受付けます。</li>
        <li>当院は、施術者の急病・天災・設備故障・その他やむを得ない事情により、予約済みの予約を中止または変更することがあります。この場合、当院は会員に速やかに連絡し、代替日時の調整に協力します。</li>
      </ol>
    </section>

    <section class="mb-6">
      <h2 class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3">
        第 12 条（キャンセル・無断キャンセル）
      </h2>
      <ol class="list-decimal list-inside space-y-1">
        <li>会員は、予約をキャンセルする場合、できる限り早めに本サービスのマイページまたは各店舗への電話連絡によりキャンセル手続きを行うものとします。</li>
        <li>キャンセル料は原則として発生しません。</li>
        <li>ただし、予約時刻を経過しても来店せず、かつ連絡もない場合（以下「無断キャンセル」といいます）を繰返した場合、当院は第 10 条に基づき会員資格を停止または取消すことができます。</li>
        <li>当院は、無断キャンセル・直前キャンセルが頻繁に発生する会員に対し、今後の予約受付を制限することがあります。</li>
      </ol>
    </section>

    <section class="mb-6">
      <h2 class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3">
        第 13 条（遅刻）
      </h2>
      <ol class="list-decimal list-inside space-y-1">
        <li>会員が予約時刻に遅刻した場合、当院は施術時間を短縮して提供することがあります。この場合も施術料金は規定料金の全額を申し受けます。</li>
        <li>予約時刻から 15 分以上の遅刻があった場合、当院は会員への連絡なく予約をキャンセルとして扱い、無断キャンセル料を適用することがあります。</li>
      </ol>
    </section>

    <section class="mb-6">
      <h2 class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3">
        第 14 条（施術の提供）
      </h2>
      <ol class="list-decimal list-inside space-y-1">
        <li>当院は、有資格者（柔道整復師等）が、関係法令の範囲内で施術を提供します。</li>
        <li>当院の施術は医療行為ではなく、医師による診療・治療・診断を代替するものではありません。重篤な疾患・外傷の疑いがある場合は、必ず医療機関の受診をご検討ください。</li>
        <li>会員は、施術前に既往症・服薬中の薬剤・体調等を当院に申告するものとします。会員が申告しなかった事実に起因して生じた症状の悪化等について、当院は一切の責任を負いません。</li>
        <li>当院は、会員の身体的・精神的状態、その他の事情により施術を提供することが適切でないと判断した場合、施術の提供を断ることがあります。</li>
        <li>当院は、感染症等の症状がある会員に対し、来店の延期を求めることがあります。</li>
      </ol>
    </section>

    <section class="mb-6">
      <h2 class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3">
        第 15 条（料金および支払方法）
      </h2>
      <ol class="list-decimal list-inside space-y-1">
        <li>施術料金は、当院が本サービスおよび店頭に掲示する料金表のとおりとします。</li>
        <li>施術料金の支払いは、施術提供後に店頭にて、当院が指定する方法（現金・クレジットカード・電子マネー等）により行うものとします。</li>
        <li>料金は予告なく改定されることがあります。改定後の料金は、改定日以降に行う予約から適用されます。</li>
      </ol>
    </section>

    <section class="mb-6">
      <h2 class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3">
        第 16 条（個人情報の取扱い）
      </h2>
      <p>当院は、会員の個人情報を別途定める「<NuxtLink to="/privacy" class="text-orange-700 font-semibold underline hover:text-orange-800">プライバシーポリシー</NuxtLink>」に従って適切に取り扱います。会員は、会員登録の時点で当該プライバシーポリシーの内容に同意するものとします。</p>
    </section>

    <section class="mb-6">
      <h2 class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3">
        第 17 条（会員への通知）
      </h2>
      <ol class="list-decimal list-inside space-y-1">
        <li>当院から会員への通知は、登録メールアドレス宛の電子メール送信、本サービス上での掲示、その他当院が適当と認める方法により行います。</li>
        <li>電子メールによる通知は、当院がメールを送信した時点で会員に到達したものとみなします。会員のメールサーバの障害、迷惑メールフィルタによる遮断、登録メールアドレス変更の未届出その他会員側の事由により通知が到達しなかった場合も同様とします。</li>
      </ol>
    </section>

    <section class="mb-6">
      <h2 class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3">
        第 18 条（禁止事項）
      </h2>
      <p>会員は、本サービスの利用にあたり、次の各号に該当する行為またはそのおそれのある行為を行ってはなりません。</p>
      <ul class="list-disc list-inside mt-2 space-y-1">
        <li>虚偽の情報により会員登録を行うこと、または他人の情報を用いて会員登録を行うこと</li>
        <li>1 名で複数の会員アカウントを保有すること</li>
        <li>他人のアカウントを使用すること、または自己のアカウントを他人に使用させること</li>
        <li>本サービスの運営を妨害する行為、当院のサーバまたはネットワークに過度の負荷を与える行為</li>
        <li>本サービスに関連するシステムへの不正アクセス、リバースエンジニアリング、解析、改変</li>
        <li>当院または第三者の知的財産権・プライバシー権・名誉権その他の権利を侵害する行為</li>
        <li>当院の従業員・他の利用者に対する誹謗中傷・差別的言動・脅迫・暴行・セクシュアルハラスメントその他迷惑行為</li>
        <li>同業他社による営業情報収集・スクレイピング・調査目的の利用</li>
        <li>法令または公序良俗に違反する行為</li>
        <li>その他、当院が不適切と判断する行為</li>
      </ul>
    </section>

    <section class="mb-6">
      <h2 class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3">
        第 19 条（反社会的勢力の排除）
      </h2>
      <ol class="list-decimal list-inside space-y-1">
        <li>会員は、現在および将来にわたって、暴力団・暴力団員・暴力団準構成員・暴力団関係企業・総会屋・社会運動標榜ゴロ・特殊知能暴力集団等、その他これらに準ずる者（以下「反社会的勢力等」）に該当しないこと、および反社会的勢力等と社会的に非難されるべき関係を有しないことを表明し、保証するものとします。</li>
        <li>会員が前項に違反した場合、当院は何らの催告なく直ちに会員資格を取消すことができるものとし、これにより会員に生じた損害について当院は一切の責任を負いません。</li>
      </ol>
    </section>

    <section class="mb-6">
      <h2 class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3">
        第 20 条（本サービスの停止・中断・終了）
      </h2>
      <ol class="list-decimal list-inside space-y-1">
        <li>当院は、次の各号に該当する場合、会員への事前通知なく本サービスの全部または一部の提供を停止または中断することがあります。
          <ul class="list-disc list-inside ml-4 mt-1 space-y-1">
            <li>本サービス用の設備・システムの保守点検または更新を行う場合</li>
            <li>火災・停電・天災等の不可抗力により本サービスの提供が困難となった場合</li>
            <li>通信回線・コンピュータの障害、外部からの不正アクセス・サイバー攻撃等により本サービスの提供に支障が生じた場合</li>
            <li>その他、当院が本サービスの停止または中断が必要と判断した場合</li>
          </ul>
        </li>
        <li>当院は、相当の予告期間をもって会員に通知することにより、本サービスを終了することができます。</li>
        <li>本条に基づく本サービスの停止・中断・終了により会員に生じた損害について、当院は一切の責任を負いません。</li>
      </ol>
    </section>

    <section class="mb-6">
      <h2 class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3">
        第 21 条（第三者サービスとの連携）
      </h2>
      <ol class="list-decimal list-inside space-y-1">
        <li>本サービスは、外部の第三者が提供するサービス（以下「外部サービス」といいます）と連携することがあります。会員が外部サービスを通じて本サービスにログインまたは情報連携を行う場合、当該外部サービスの利用規約・プライバシーポリシーが適用されます。</li>
        <li>外部サービスの利用により会員に生じた損害について、当該損害が当院の故意または重大な過失に起因する場合を除き、当院は責任を負いません。</li>
        <li>会員は、マイページの所定の手続きにより、外部サービスとの連携をいつでも解除できます。連携解除後も、当院に登録された会員情報は退会手続きを行うまで保持されます。</li>
      </ol>
    </section>

    <section class="mb-6">
      <h2 class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3">
        第 22 条（知的財産権）
      </h2>
      <ol class="list-decimal list-inside space-y-1">
        <li>本サービスおよびこれに関連するコンテンツ（文章・画像・ロゴ・デザイン・プログラム等）の著作権・商標権その他の知的財産権は、当院または正当な権利者に帰属します。</li>
        <li>会員は、本サービスの利用にあたり、当院または正当な権利者の事前の書面による承諾なく、これらのコンテンツを複製・転載・改変・公衆送信・販売・配布・営利目的の利用その他権利者の権利を侵害する行為を行ってはなりません。</li>
      </ol>
    </section>

    <section class="mb-6">
      <h2 class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3">
        第 23 条（免責事項）
      </h2>
      <ol class="list-decimal list-inside space-y-1">
        <li>当院は、本サービスの内容・機能・継続性・特定の目的への適合性・第三者の権利を侵害しないこと等について、明示または黙示を問わず一切の保証をしません。</li>
        <li>当院は、本サービスに事実上または法律上の瑕疵（安全性・信頼性・正確性・完全性・有効性・特定の目的への適合性・セキュリティ等に関する欠陥、エラーやバグ、権利侵害等を含みます）があった場合でも、当該瑕疵を除去して本サービスを提供する義務を負わないものとします。</li>
        <li>当院は、本サービスに起因して会員に生じたあらゆる損害について、一切の責任を負いません。ただし、当院に故意または重大な過失がある場合はこの限りではありません。</li>
        <li>前項のただし書きにより当院が責任を負う場合であっても、当院の責任は、会員が当該損害発生の直近 12 ヶ月間に当院に対し実際に支払った施術料金の総額を上限とします（ただし、消費者契約法その他強行法規によりこの制限が無効とされる場合を除きます）。</li>
        <li>本サービスから他のウェブサイト・サービスへのリンクまたは他のウェブサイト・サービスからのリンクが提供されている場合でも、当院は当院以外のサイト・サービスおよびそこから得られる情報について一切の責任を負いません。</li>
      </ol>
    </section>

    <section class="mb-6">
      <h2 class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3">
        第 24 条（権利義務の譲渡禁止）
      </h2>
      <p>会員は、本規約に基づく一切の権利義務を、当院の事前の書面による承諾なく、第三者に譲渡・移転・担保提供その他の処分をすることはできません。</p>
    </section>

    <section class="mb-6">
      <h2 class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3">
        第 25 条（分離可能性）
      </h2>
      <p>本規約のいずれかの条項またはその一部が、消費者契約法その他の法令により無効または執行不能と判断された場合であっても、本規約の残りの規定および無効または執行不能と判断された規定の残りの部分は、引き続き完全に効力を有するものとします。</p>
    </section>

    <section class="mb-6">
      <h2 class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3">
        第 26 条（準拠法）
      </h2>
      <p>本規約の成立・効力・解釈・履行は、日本法に準拠するものとします。</p>
    </section>

    <section class="mb-6">
      <h2 class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3">
        第 27 条（合意管轄）
      </h2>
      <p>本サービスまたは本規約に起因または関連して当社と会員との間で生じた紛争については、訴額に応じて<span class="font-semibold">東京地方裁判所</span>または<span class="font-semibold">東京簡易裁判所</span>を第一審の専属的合意管轄裁判所とします。</p>
    </section>

    <section class="mb-6">
      <h2 class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3">
        第 28 条（協議解決）
      </h2>
      <p>本規約に定めのない事項、または本規約の解釈について疑義が生じた場合、当院と会員は信義誠実の原則に従い協議の上、円満に解決を図るものとします。</p>
    </section>

    <section class="mb-10">
      <h2 class="text-lg font-bold text-slate-900 border-l-4 border-orange-500 pl-3 mb-3">
        第 29 条（お問い合わせ窓口）
      </h2>
      <p>本規約・本サービスに関するお問い合わせ、苦情・相談、個人情報の取扱いに関するお問い合わせは、下記までご連絡ください。</p>
      <div class="mt-3 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-md p-4 space-y-1">
        <p>運営会社: <span class="font-semibold">株式会社 Umi&apos;ts（ウミッツ）</span></p>
        <p>代表者: <span class="font-semibold">代表取締役 海野 和也</span></p>
        <p>屋号: <span class="font-semibold">ほねキング整骨院グループ・海道整骨院</span></p>
        <p>本社所在地: <span class="font-semibold">〒125-0061 東京都葛飾区亀有 3-3-7</span></p>
        <p>電話番号: <span class="font-semibold">047-701-7729</span></p>
        <p>個人情報保護管理者: <span class="font-semibold">代表取締役 海野 和也（兼任）</span></p>
        <p>お問い合わせ: <span class="font-semibold">reservation@honeking.jp</span></p>
      </div>
      <p class="mt-3 text-xs text-slate-500">
        ※ 本規約は法令の改正、本サービスの追加・変更、当院の事業環境の変化等に応じて随時改定されます。改定後の規約は本ページに掲示した時点から適用されます。
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
