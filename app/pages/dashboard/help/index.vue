<script setup lang="ts">
// 管理画面のヘルプページ。
// 現場スタッフ（受付・施術者）向けの操作マニュアル。
// ログイン中のスタッフがいつでも参照できるよう、サイドナビから常時アクセス可能。
//
// 構造:
//   - 各トピックはタイトル + 本文（複数行）の組
//   - カテゴリごとに分けて表示
//   - 上部の検索ボックスでタイトル + 本文の部分一致フィルタ
//
// 編集ポリシー:
//   - 機能を追加・変更したらここの該当トピックも併せて更新する
//   - 個人情報の取り扱いに関わる箇所は赤字（class="text-red-700"）で強調

definePageMeta({ layout: 'admin' })

interface Topic {
  id: string
  title: string
  body: string[] // 段落の配列
  audience?: '受付' | '施術者' | '店長以上' // 主な対象（任意）
}
interface Category {
  id: string
  label: string
  icon: string
  description: string
  topics: Topic[]
}

const categories: Category[] = [
  {
    id: 'reception',
    label: '受付業務',
    icon: 'i-lucide-clipboard-check',
    description: '電話・店頭での予約受付や、来店中のお客様対応で使う機能。',
    topics: [
      {
        id: 'view-reservations',
        title: '予約を確認する',
        audience: '受付',
        body: [
          '左サイドバーの「予約・販売管理」をクリックすると予約一覧が表示されます。',
          '初期表示は「予約済」タブで、今日以降のまだ来店していない予約だけが見えます。過去の完了予約や、キャンセルされた予約を見たいときは、上部のピル形タブから「完了」「無断キャンセル」「キャンセル」「すべて」を選んでください。',
          '日付・店舗・ベッド・顧客名/電話番号/メール/予約番号でも絞り込めます。お客様から「先週予約した山田です」と電話があれば、開始日を空欄にして「すべて」タブを選び、顧客名で検索すると過去予約も探せます。',
        ],
      },
      {
        id: 'schedule-view',
        title: '今日のスケジュール（ベッド × 時間軸）を見る',
        audience: '受付',
        body: [
          '「予約・販売管理」画面の右上にある「スケジュール」ボタンを押すと、ベッド × 時間軸のガントチャート表示に切り替わります。',
          '店舗を選ぶと、その日のベッドの空き状況・予約が一目で分かります。緑が今後の予約、青が完了した予約です。キャンセル / 無断キャンセルは表示されません（見間違い防止）。',
          '予約ブロックをクリックすると、その予約の詳細画面に遷移します。日付の前後送りは右上の「← / 今日 / →」ボタン、または日付ピッカーから。',
        ],
      },
      {
        id: 'cancel-reservation',
        title: '予約をキャンセル・無断キャンセル（No-Show）にする',
        audience: '受付',
        body: [
          '予約一覧から対象の予約をクリック → 予約詳細画面でステータスを変更します。',
          '「キャンセル」: お客様からキャンセル連絡を受けた場合。「無断キャンセル」: 連絡なしで来店しなかった場合（お客様の来店率を把握するために区別します）。',
          'キャンセルした予約の枠は他のお客様の予約に使えるようになります（DB レベルで自動的に解放）。',
        ],
      },
      {
        id: 'add-manual-reservation',
        title: '電話・店頭で受けた予約を手動で追加する',
        audience: '受付',
        body: [
          '予約・販売管理画面の右上「手動で予約を追加」ボタンから、新規予約フォームに移動します。',
          '店舗 → メニュー → 日時 → お客様情報の順に入力。お客様情報は「既存顧客から検索」または「新規入力」を選択できます。',
          '時間帯のダブルブッキングは DB レベルで防止されているので、もし重複する時間を選ぶとエラーが出ます。その場合は別の時間帯を選んでください。',
        ],
      },
      {
        id: 'view-customer-contact',
        title: 'お客様の連絡先を確認する',
        audience: '受付',
        body: [
          '予約一覧で対象予約の顧客名をクリックすると、その顧客の詳細画面が開きます。電話・メールはここで確認できます。',
          '電話番号をタップで電話発信、メールをタップでメーラー起動（スマホ・タブレットで）。',
          '個人情報は DB に暗号化して保存されているため、画面上だけで復号して表示されます。スクリーンショットの取り扱いには注意してください。',
        ],
      },
    ],
  },
  {
    id: 'sales',
    label: '物販・回数券の販売',
    icon: 'i-lucide-shopping-cart',
    description: '物販商品・回数券の販売と、回数券の消費（来店時の利用）。',
    topics: [
      {
        id: 'sell-to-current-customer',
        title: 'ご来店中のお客様（予約あり）に販売する',
        audience: '受付',
        body: [
          '今日の予約をスケジュールビューまたは一覧から開き、予約詳細画面の下部にある「物販を販売」セクションから登録します。',
          'この場合、販売記録は予約に紐付き、お客様の購入履歴にも記録されます。',
          '回数券を販売した場合は、自動的にそのお客様の保有回数券として登録されます。',
        ],
      },
      {
        id: 'sell-guest',
        title: 'ふらっと来たお客様（予約なし）に販売する',
        audience: '受付',
        body: [
          '予約・販売管理画面の右上「物販販売を追加」ボタン → お客様タブで「ゲスト購入」を選びます。',
          '名前を聞かなくても登録できます。「店頭ふらっと販売」という共通の顧客に集約される仕組みです。',
          'もし常連のお客様の場合は「既存顧客に紐付ける」を選んで検索すると、購入履歴を蓄積できます（マーケティングや回数券の管理に便利）。',
        ],
      },
      {
        id: 'sell-multiple',
        title: '複数の商品をまとめて販売する',
        audience: '受付',
        body: [
          '物販販売フォームの「+ 商品を追加」ボタンで行を増やせます。違う商品でも、同じ商品の複数行でも OK。',
          '右側に小計と合計金額が出るので、お会計の確認に使えます。',
          '「販売する」ボタン 1 回で全部まとめて登録されます（途中で 1 つだけ失敗 = 全部失敗、データ不整合は起きません）。',
        ],
      },
      {
        id: 'sell-voucher',
        title: '回数券を販売する',
        audience: '受付',
        body: [
          '物販販売フォームで、回数券（紫色の【回数券】タグ付き）を選択して数量 1 で「販売する」。',
          '販売した時点で、そのお客様の保有回数券として登録されます（残回数 = 総回数）。',
          '回数券販売の売上は販売時点で計上され、施術での消費時には売上ゼロ扱い（二重計上防止）です。',
        ],
      },
      {
        id: 'use-voucher',
        title: '回数券で施術を消費する',
        audience: '受付',
        body: [
          'お客様が回数券を持って来店した予約を開き、予約詳細画面の「回数券で消費」セクションから利用する回数券を選びます。',
          '1 予約 = 1 回数券消費（複数回数券の合算消費はできません）。',
          '消費後はその予約は売上ゼロになります（回数券販売時に売上計上済みのため）。',
        ],
      },
    ],
  },
  {
    id: 'customer',
    label: '顧客管理',
    icon: 'i-lucide-users',
    description: '会員・ゲスト顧客の一括管理と、接客に役立つメモ機能。',
    topics: [
      {
        id: 'search-customer',
        title: 'お客様を検索する',
        audience: '受付',
        body: [
          '左サイドバー「顧客管理」を開く。検索ボックスに名前の一部や電話番号の一部を入れて「検索」を押すと該当のお客様が出てきます（部分一致検索）。',
          '物販販売フォームの顧客検索も同じで、こちらは入力中に自動で候補が下にドロップダウン表示されます。',
          '正確な電話番号やメアドが分かっていれば、それで一発検索もできます（完全一致が先に走ります）。',
        ],
      },
      {
        id: 'customer-detail',
        title: 'お客様の来店履歴・購入履歴を見る',
        audience: '受付',
        body: [
          '顧客一覧でお客様の名前をクリックすると詳細画面が開きます。',
          '上部のメトリクスで「来店回数（完了）/ 最終来店日 / 予約中 / 累計支払額 / 保有回数券」が一目で分かります。',
          '下のタブで「来店履歴」「物販・回数券販売」「保有回数券」を切り替えできます。各テーブルは列見出しをクリックでソート可能。',
        ],
      },
      {
        id: 'customer-note',
        title: '接客メモを書く',
        audience: '受付',
        body: [
          '顧客詳細の「基本情報」タブの下に「接客メモ」セクションがあります。施術時の注意点や、お客様の好み・体調傾向を残せます。',
          '<strong class="text-red-700">⚠ 個人情報（電話・住所・既往症の詳細など）はここに書かないでください。</strong>暗号化されていません。',
          '例: 「左肩のみ施術可」「腰痛持ち」「お子様の話で盛り上がる」など。'
          ,
        ],
      },
      {
        id: 'membership-types',
        title: '会員区分（バッジ）の見方',
        body: [
          '<strong>本会員</strong>（緑）: メールアドレス認証まで完了した会員。マイページからログインしてご自身で予約できます。',
          '<strong>仮登録</strong>（黄）: 会員登録はしたが、まだメール認証が済んでいない方。リマインダーが必要な場合があります。',
          '<strong>ゲスト</strong>（グレー）: 会員登録せずに予約だけしたお客様。Web 予約フォームで名前と連絡先を入れて 1 回だけ予約した状態。',
          '<strong>退会済</strong>（暗グレー）: 自分で退会した方。来店履歴は保持していますが、会員機能は使えません。',
          '<strong>休眠</strong>（タブのみ）: 過去に来店歴があるが、最終来店日が一定期間（既定 30 日）以前のお客様。再来促進の DM ターゲットに使えます。',
        ],
      },
    ],
  },
  {
    id: 'personal',
    label: '自分のシフト・パスワード',
    icon: 'i-lucide-user-circle',
    description: '自分自身の勤務情報やパスワード管理。',
    topics: [
      {
        id: 'view-my-shift',
        title: '今日・今週のシフトを確認する',
        audience: '施術者',
        body: [
          '左サイドバー「シフト管理」を開くと、上部で「月 / 週 / 日 / スタッフ別」を切替できます。',
          '「スタッフ別」を選び、自分の名前で絞り込むと自分のシフトだけ見られます。',
          'ヘルプ先店舗（普段と違う店舗で勤務する日）には小さく「→ 店舗名」が表示されます。',
        ],
      },
      {
        id: 'forgot-password',
        title: 'パスワードを変更したい・忘れた',
        body: [
          'ログイン中の場合はオーナーまたは店長に依頼してパスワードを再発行してもらってください。',
          'ログインできない場合も同様にスタッフ管理画面から再設定可能です（自己リセット機能は現状ありません）。',
        ],
      },
    ],
  },
  {
    id: 'manager',
    label: '店長・オーナー向け',
    icon: 'i-lucide-shield',
    description: '店舗・スタッフ・メニュー・商品の管理。一部の機能は店長以上のみ操作できます。',
    topics: [
      {
        id: 'add-staff',
        title: 'スタッフを追加・編集する',
        audience: '店長以上',
        body: [
          '左サイドバー「スタッフ管理」→「新規追加」。',
          '「予約に割り当てられるか」「ログインできるか」を別々に設定できます。受付スタッフはログインのみ、施術しない経営者はログインのみ、施術者で管理画面を触らない人は予約割当のみ、というように使い分けてください。',
          '役職（オーナー / 店長 / 受付 / 施術者）を選ぶとデフォルト権限が割り当てられます。個別に権限を追加することも可能です。',
        ],
      },
      {
        id: 'manage-shift',
        title: 'スタッフのシフトを登録する',
        audience: '店長以上',
        body: [
          '左サイドバー「シフト管理」→「日」ビュー → 該当日付を開き、各スタッフの列で空白部分を縦にドラッグして時間範囲を作成します。',
          '人手不足で他店舗を手伝うときは、シフトのバーをクリックして「ヘルプ先店舗」を指定できます。',
          'シフトを登録していないスタッフは、メイン店舗の営業時間で薄く「ゴースト表示」されます（参考表示で、登録されたシフトではありません）。',
        ],
      },
      {
        id: 'manage-menu-product',
        title: 'メニュー・商品を管理する',
        audience: '店長以上',
        body: [
          'メニューは「共通メニュー」（全店舗で使う）と「店舗特別メニュー」（その店舗だけ）の 2 階建てです。共通メニューは左サイドバー「メニュー管理」、店舗特別メニューは「店舗管理」→ 該当店舗 →「メニュー」タブで管理します。',
          '商品（物販・回数券）も同じく「共通商品」と「店舗特別商品」の 2 階建て。「商品管理」から登録します。',
          'メニューや商品の表示期間（キャンペーン用）を設定すると、お客様側はその期間中のみメニューを選べるようになります。',
        ],
      },
      {
        id: 'manage-store',
        title: '営業時間・店休日・部分閉店を変更する',
        audience: '店長以上',
        body: [
          '「店舗管理」→ 該当店舗 →「営業時間」タブで曜日別の営業時間を設定。中抜け休憩は 2 つのレンジで表現します（例: 9:30-12:30 と 15:00-20:30）。',
          '終日休みは「店休日」タブ、一時的に閉める（設備点検など）は「部分閉店」タブから登録。',
          '国民の祝日は自動的に「日曜扱い」になります（短縮営業）。',
        ],
      },
      {
        id: 'check-sales',
        title: '売上を確認する',
        audience: '店長以上',
        body: [
          '左サイドバー「売上管理」で店舗別・日別・商品別の集計が見られます。',
          'ダッシュボードのカードでも今日・今月のサマリが表示されます。',
        ],
      },
    ],
  },
  {
    id: 'security',
    label: 'セキュリティ・個人情報',
    icon: 'i-lucide-shield-alert',
    description: '法人運用上、特に守ってほしいルール。',
    topics: [
      {
        id: 'pii-policy',
        title: '個人情報の取り扱い',
        body: [
          '<strong class="text-red-700">⚠ お客様の氏名・電話・メールは画面でも口頭でも、必要な相手以外に伝えないでください。</strong>',
          'DB には AES-256-GCM で暗号化されて保存されており、管理画面でのみ復号表示されます。',
          '<strong class="text-red-700">⚠ 接客メモには個人情報や既往症の詳細を書かないでください。</strong>暗号化されていないため、別のスタッフからも見えます。',
          'スクリーンショットや印刷物の取り扱いには注意してください。共用スペースに置きっぱなしにしない、退店時は必ず管理画面からログアウト。',
        ],
      },
      {
        id: 'logout',
        title: 'ログアウト',
        body: [
          '画面右上の自分の名前部分に「ログアウト」ボタンがあります。',
          '共用端末を使う場合は、業務終了時に必ずログアウトしてください。',
        ],
      },
    ],
  },
]

// ── 検索（タイトル + 本文の部分一致でフィルタ） ─────────
const query = ref('')
const normalizedQuery = computed(() => query.value.trim().toLowerCase())

function topicMatches(t: Topic): boolean {
  const q = normalizedQuery.value
  if (!q) return true
  const haystack = (t.title + ' ' + t.body.join(' ')).toLowerCase()
  return haystack.includes(q)
}

const visibleCategories = computed(() =>
  categories
    .map(c => ({ ...c, topics: c.topics.filter(topicMatches) }))
    .filter(c => c.topics.length > 0),
)

const totalHits = computed(() =>
  visibleCategories.value.reduce((sum, c) => sum + c.topics.length, 0),
)

// アコーディオン: 検索中は全展開、通常は閉じた状態がデフォルト
const openTopic = ref<Set<string>>(new Set())
function toggleTopic(id: string) {
  if (openTopic.value.has(id)) openTopic.value.delete(id)
  else openTopic.value.add(id)
  // reactivity 強制
  openTopic.value = new Set(openTopic.value)
}
function expandAll() {
  const all = new Set<string>()
  for (const c of categories) for (const t of c.topics) all.add(t.id)
  openTopic.value = all
}
function collapseAll() {
  openTopic.value = new Set()
}

// 検索中は自動展開
watch(normalizedQuery, (q) => {
  if (q.length > 0) {
    const all = new Set<string>()
    for (const c of visibleCategories.value) for (const t of c.topics) all.add(t.id)
    openTopic.value = all
  }
})

function isOpen(id: string): boolean {
  return openTopic.value.has(id)
}

function audienceBadge(a: NonNullable<Topic['audience']>): { label: string, class: string } {
  if (a === '店長以上') return { label: '店長以上', class: 'bg-purple-100 text-purple-800 border-purple-300' }
  if (a === '施術者') return { label: '施術者向け', class: 'bg-blue-100 text-blue-800 border-blue-300' }
  return { label: '受付向け', class: 'bg-green-100 text-green-800 border-green-300' }
}
</script>

<template>
  <div>
    <div class="flex items-center gap-3 mb-1">
      <h1 class="text-2xl font-semibold text-slate-900 inline-flex items-center gap-2">
        <UIcon name="i-lucide-circle-help" class="size-6 text-orange-500" />
        ヘルプ
      </h1>
    </div>
    <p class="text-sm text-slate-600 mb-4">
      管理画面の操作マニュアルです。困ったときはまずここを検索してみてください。
    </p>

    <!-- 検索ボックス + 一括操作 -->
    <div class="bg-white border border-[#c3c4c7] rounded-sm p-3 mb-4 flex flex-wrap items-center gap-3">
      <div class="relative flex-1 min-w-[260px]">
        <UIcon
          name="i-lucide-search"
          class="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none"
        />
        <input
          v-model="query"
          type="text"
          placeholder="キーワードで検索（例: キャンセル / 回数券 / メモ）"
          class="w-full pl-8 pr-2.5 py-2 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500"
        >
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="px-3 py-1.5 text-xs border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-sm"
          @click="expandAll"
        >
          すべて開く
        </button>
        <button
          type="button"
          class="px-3 py-1.5 text-xs border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-sm"
          @click="collapseAll"
        >
          すべて閉じる
        </button>
      </div>
    </div>

    <!-- 検索結果サマリ -->
    <div v-if="normalizedQuery" class="mb-3 text-sm text-slate-600">
      <span v-if="totalHits === 0">該当する項目が見つかりません。別のキーワードを試してください。</span>
      <span v-else>
        <strong class="tabular-nums">{{ totalHits }}</strong> 件の項目がヒット
      </span>
    </div>

    <!-- カテゴリ一覧 -->
    <div class="space-y-4">
      <section
        v-for="cat in visibleCategories"
        :key="cat.id"
        class="bg-white border border-[#c3c4c7] rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
      >
        <div class="px-4 py-3 border-b border-[#dcdcde] bg-[#f6f7f7]">
          <h2 class="flex items-center gap-2 text-base font-semibold text-slate-900">
            <UIcon :name="cat.icon" class="size-5 text-orange-500" />
            {{ cat.label }}
          </h2>
          <p class="text-xs text-slate-600 mt-0.5">
            {{ cat.description }}
          </p>
        </div>
        <ul class="divide-y divide-[#f0f0f1]">
          <li v-for="topic in cat.topics" :key="topic.id">
            <button
              type="button"
              class="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-orange-50/40"
              @click="toggleTopic(topic.id)"
            >
              <UIcon
                :name="isOpen(topic.id) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                class="size-4 flex-shrink-0 text-slate-500"
              />
              <span class="flex-1 text-sm font-semibold text-slate-900">{{ topic.title }}</span>
              <span
                v-if="topic.audience"
                class="inline-block text-[10px] px-1.5 py-0.5 rounded border font-semibold"
                :class="audienceBadge(topic.audience).class"
              >
                {{ audienceBadge(topic.audience).label }}
              </span>
            </button>
            <div v-if="isOpen(topic.id)" class="px-4 pb-4 pl-10 text-sm text-slate-700 space-y-2">
              <!-- eslint-disable-next-line vue/no-v-html -->
              <p v-for="(para, i) in topic.body" :key="i" v-html="para" />
            </div>
          </li>
        </ul>
      </section>
    </div>

    <!-- フッター -->
    <div class="mt-6 bg-amber-50 border border-amber-200 rounded-sm p-3 text-sm text-amber-900">
      <div class="font-semibold mb-1 inline-flex items-center gap-1.5">
        <UIcon name="i-lucide-info" class="size-4" />
        ここに載っていない操作・不具合
      </div>
      <p class="text-xs leading-relaxed">
        ヘルプに記載のない操作や、画面の表示がおかしい・エラーが出るなどの問題があれば、事業主まで連絡してください。
        個別の権限変更・退会会員の復旧などはオーナーまたは店長権限が必要です。
      </p>
    </div>
  </div>
</template>
