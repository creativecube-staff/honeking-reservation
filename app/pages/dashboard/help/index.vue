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
  audience?: '受付' | '施術者' | '店長以上' | 'オーナー専用' // 主な対象（任意）
}
interface Category {
  id: string
  label: string
  icon: string
  description: string
  topics: Topic[]
  // true のときオーナーログインでだけ表示する（管理者専用マニュアル）
  ownerOnly?: boolean
}

const categories: Category[] = [
  // ── ここから下はオーナー専用マニュアル（ownerOnly: true）。
  //    管理者ログインのときだけ表示される。
  {
    id: 'admin-stores',
    label: '店舗管理（オーナー向け）',
    icon: 'i-lucide-store',
    description: '店舗の新規追加・編集・無効化・完全削除に関するオーナー向けマニュアル。',
    ownerOnly: true,
    topics: [
      {
        id: 'admin-add-store',
        title: '新規店舗を追加する',
        audience: 'オーナー専用',
        body: [
          'ヘッダーの店舗スイッチャーで「管理者（全店）」を選び、「店舗管理」タブ → タイトル隣の「新規追加」ボタンを押します。',
          '基本情報（店舗名・スラッグ・住所・電話・メールなど）に加えて、<strong>ベッド数</strong>と<strong>営業時間</strong>を同じフォーム上で設定します。保存すると、店舗・ログインアカウント・ベッド連番（ベッド1～N）・標準営業時間（月〜金 9:30-12:30 + 15:00-20:30 / 土日 9:30-12:30 + 15:00-18:00）が1つのトランザクションで一括登録されます。<strong>作成した瞬間からお客様の予約受付が可能</strong>な状態になります。',
          'ベッドはこの画面でも個別に名前変更や追加・削除ができます。営業時間も枠をドラッグして変更できます（あとから店舗詳細でも変更可）。',
          '保存に成功すると、その店舗のログイン情報（ID とパスワード）が1回だけ表示されます。<span class="text-red-700 font-semibold">パスワードはこの画面でしか見られない</span>ので、必ず控えてから「控えました・店舗一覧へ」を押してください。',
        ],
      },
      {
        id: 'admin-filter-sort-stores',
        title: '店舗一覧を絞り込む・並び替える',
        audience: 'オーナー専用',
        body: [
          '「店舗管理」一覧の右上「あいまい検索」窓に、店舗名・スラッグ・都道府県・市区町村のいずれかを入力すると部分一致で絞り込めます。スペース区切りで AND 検索になります（例: <code>流山 整骨</code>）。',
          '列見出し「都道府県」「市区町村」「表示順」をクリックでソート（再クリックで昇順 ⇔ 降順）。アクティブな列はオレンジのシェブロンが表示されます。',
          '上部のステータスタブで「すべて / 有効 / 無効」を切替。件数は検索結果に追従するので、絞り込んだあとに何件あるかすぐ把握できます。',
        ],
      },
      {
        id: 'admin-deactivate-vs-purge-store',
        title: '店舗の「無効化」と「完全削除」の違い',
        audience: 'オーナー専用',
        body: [
          '<strong>無効化（ソフト削除）</strong>: データを残したまま予約受付から外す。後で「有効化」を押せば戻せます。普段はこちらを使ってください。',
          '<strong>完全削除（物理削除）</strong>: 店舗本体と関連データ（予約・ベッド・営業時間・店舗特別メニュー等）を一括で物理削除します。<span class="text-red-700 font-semibold">取り消し不可</span>。誤爆防止のため、無効化済みの店舗だけが対象で、確認モーダルで店舗名を完全に入力する必要があります。',
          'この店舗のスタッフが「他店の予約」を担当している場合は、他店データを巻き込むため完全削除は拒否されます。先にその担当を整理してください。',
        ],
      },
    ],
  },
  {
    id: 'admin-menus',
    label: 'メニュー管理（オーナー向け）',
    icon: 'i-lucide-list',
    description: '共通メニューと店舗特別メニューの関係・キャンペーン運用・削除に関するオーナー向けマニュアル。',
    ownerOnly: true,
    topics: [
      {
        id: 'admin-common-vs-store-menus',
        title: '共通メニューと店舗特別メニューの違い',
        audience: 'オーナー専用',
        body: [
          '<strong>共通メニュー</strong>: 全店舗で自動的に利用可能。ヘッダーの店舗スイッチャーで「管理者（全店）」を選び、「メニュー管理」から登録します。',
          '<strong>店舗特別メニュー</strong>: その店舗だけのメニュー。店舗スイッチャーで対象店舗に切り替えてから「メニュー管理」を開くと、その店舗の特別メニュー一覧になります。',
          'お客様側の予約画面では、共通メニューが先頭、その下に店舗特別メニューが並びます。お客様は両方からメニューを選べます。',
        ],
      },
      {
        id: 'admin-menu-store-exclusion',
        title: '共通メニューを特定の店舗で「非表示」にする',
        audience: 'オーナー専用',
        body: [
          '「全店共通だけど、この店舗だけは出したくない」というケース（機材・スタッフスキルの都合、新メニューの段階展開など）に使います。',
          '共通メニューを編集 → モーダル下部の「<strong>以下の店舗では表示しない</strong>」チェックボックスでその店舗にチェックを入れて更新します。お客様側のその店舗の予約画面ではこの共通メニューが表示されなくなります（他店ではそのまま表示）。',
          'メニュー一覧の「<strong>非表示店舗</strong>」列に現在の設定が表示されます。チェックを外せば再び表示されるようになります。',
        ],
      },
      {
        id: 'admin-menu-replacement',
        title: '期間限定キャンペーン: 店舗特別メニューで共通メニューを差し替える',
        audience: 'オーナー専用',
        body: [
          'たとえば共通メニュー「全身整体 60 分（通常価格 8,000円）」を、特定店舗で期間限定割引価格で出したいとき。',
          '店舗スイッチャーでその店舗に切替 → 店舗特別メニューとして「オープン記念キャンペーン 全身整体 60 分（5,000円）」を作成 → 編集モーダルの「<strong>共通メニューと差し替える</strong>」ドロップダウンで「全身整体 60 分」を選択 → 「表示期間」の終了日を設定（例: 6/30 まで）。',
          '期間中（〜 6/30）はその店舗のお客様予約画面に<strong>キャンペーン特別メニューだけ</strong>が表示され、対象の共通メニューは自動的に非表示になります。',
          '<strong>終了日を過ぎたら自動的に共通メニューに戻ります</strong>（設定を消す手間なし）。「共通メニュー側で除外して、終わったら戻す」ような二度手間が不要です。',
          'メニュー一覧の「<strong>差し替え対象</strong>」列に、その特別メニューがどの共通メニューを置き換えているか表示されます。',
        ],
      },
      {
        id: 'admin-deactivate-vs-purge-menu',
        title: 'メニューの「無効化」と「完全削除」の違い',
        audience: 'オーナー専用',
        body: [
          '<strong>無効化</strong>: お客様の予約画面に出なくなる。後で「有効化」で戻せます。普段はこちらで運用してください。',
          '<strong>完全削除</strong>: 物理削除。無効化済みのメニューだけが対象で、確認モーダルでメニュー名の完全タイプ入力が必要です。',
          'そのメニューを使った予約が <strong>1 件でも残っていれば、履歴保護のため完全削除は拒否</strong>されます。古いキャンペーン用メニューなど、本当に履歴ごと消したい場合だけ使ってください。',
        ],
      },
    ],
  },
  {
    id: 'security',
    important: true,
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

// ── ロール（オーナーか否か）でカテゴリを絞る ─────────
// canAccessAll = OWNER 判定。オーナーログインのときだけ ownerOnly カテゴリを見せる。
const { canAccessAll } = useStoreContext()
const categoriesForRole = computed(() =>
  categories.filter(c => !c.ownerOnly || canAccessAll.value),
)

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
  categoriesForRole.value
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
  // 自分のロールで見えるカテゴリだけ展開対象にする（非表示のものは無視）
  const all = new Set<string>()
  for (const c of categoriesForRole.value) for (const t of c.topics) all.add(t.id)
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
  if (a === 'オーナー専用') return { label: 'オーナー専用', class: 'bg-orange-100 text-orange-800 border-orange-300' }
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
        :class="cat.important
          ? 'bg-white border-2 border-red-400 rounded-sm shadow-[0_2px_8px_rgba(220,38,38,0.1)]'
          : 'bg-white border border-[#c3c4c7] rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)]'"
      >
        <!-- カテゴリヘッダ。important なカテゴリは赤系で強調表示する（個人情報など、絶対に守ってほしい運用ルール） -->
        <div
          :class="cat.important
            ? 'px-4 py-3 border-b border-red-200 bg-red-50'
            : 'px-4 py-3 border-b border-[#dcdcde] bg-[#f6f7f7]'"
        >
          <h2 class="flex items-center gap-2 text-base font-semibold text-slate-900">
            <UIcon
              :name="cat.icon"
              :class="cat.important ? 'size-5 text-red-600' : 'size-5 text-orange-500'"
            />
            <span :class="cat.important ? 'text-red-900' : ''">{{ cat.label }}</span>
            <span
              v-if="cat.important"
              class="ml-auto inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold text-red-700 bg-red-100 border border-red-300 rounded-sm tracking-wide"
            >
              <UIcon name="i-lucide-alert-triangle" class="size-3.5" />
              重要
            </span>
          </h2>
          <p :class="cat.important ? 'text-xs text-red-800 mt-0.5 font-medium' : 'text-xs text-slate-600 mt-0.5'">
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
