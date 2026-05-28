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
  // 段落の配列。各要素は HTML として展開される（v-html）。
  // <ul> / <ol> / <strong> / <code> や、赤背景の警告ボックス（rounded-sm bg-red-50 ...）も使える。
  body: string[]
}
interface Category {
  id: string
  label: string
  icon: string
  description: string
  topics: Topic[]
  // true のときオーナーログインでだけ表示する（管理者専用マニュアル）
  ownerOnly?: boolean
  // true のとき赤系で強調表示する（個人情報など、絶対に守ってほしい運用ルール）
  important?: boolean
}

const categories: Category[] = [
  // ── ここから下はオーナー専用マニュアル（ownerOnly: true）。
  //    管理者ログインのときだけ表示される。
  //    label と icon は管理者(全店)モードのナビ（layouts/admin.vue の adminNavItems）と必ず揃えること。
  //    並び順もナビと同じ順序にする（店舗管理 → 休日管理 → 共通メニュー管理 → ...）。
  {
    id: 'basics',
    label: '基本操作',
    icon: 'i-lucide-compass',
    description: '管理画面の操作の基本。最初に読むと迷いません。',
    ownerOnly: true,
    topics: [
      {
        id: 'mode-switcher',
        title: '「管理者」と「個別店舗」のモードを切り替える',
        body: [
          '画面右上に <strong>店舗を切り替える選択ボタン（▼）</strong>があります。クリックすると一覧が出るので、見たいモードを選びます。',
          '<ul>'
          + '<li><strong>「管理者」を選ぶ</strong> → 全店共通の設定を扱うモード。ナビに「店舗管理・休日管理・共通メニュー管理・共通商品管理・ログイン管理・売上管理」が出ます。</li>'
          + '<li><strong>店舗名（例: 流山おおたかの森整骨院）を選ぶ</strong> → その店舗の日々のオペレーション用モード。ナビが「予約・販売・顧客・スタッフ・メニュー・商品・売上」に変わります。</li>'
          + '</ul>',
          '<div class="rounded-sm bg-amber-50 border border-amber-200 px-3 py-2 text-amber-900"><strong>💡 ヒント</strong>: 店舗を切り替えると自動的にダッシュボードに戻ります（前の画面の情報が新しい店舗で意味を持たない可能性があるため）。</div>',
        ],
      },
    ],
  },
  {
    id: 'admin-stores',
    label: '店舗管理',
    icon: 'i-lucide-building-2',
    description: '店舗の追加・編集・休止・削除など、店舗マスタの操作です。',
    ownerOnly: true,
    topics: [
      {
        id: 'admin-add-store',
        title: '新規店舗を追加する',
        body: [
          '画面右上で「<strong>管理者</strong>」を選び、「<strong>店舗管理</strong>」タブの右上「<strong>新規追加</strong>」ボタンを押します。',
          '<ol>'
          + '<li><strong>基本情報</strong>を入力<ul>'
          + '<li><strong>店舗名</strong>（例: 流山おおたかの森整骨院）</li>'
          + '<li><strong>スラッグ</strong>: 予約 URL に使う英字 ID（例: <code>otakanomori</code>）。一度決めたら変更しない方が無難です</li>'
          + '<li>都道府県・市区町村・住所・電話・メール（任意）</li>'
          + '</ul></li>'
          + '<li><strong>ベッド</strong>を設定<br>初期は「ベッド1」〜「ベッド4」の 4 台。追加・削除・名前変更ができます。</li>'
          + '<li><strong>営業時間</strong>を確認<br>標準時間（月〜金 9:30-12:30 + 15:00-20:30、土日 9:30-12:30 + 15:00-18:00）が初期表示されます。マウスで枠を動かして変更可能。</li>'
          + '<li><strong>「保存」</strong>を押すと、店舗・ベッド・営業時間・ログインアカウントがまとめて作成されます。作成した瞬間からお客様の予約受付が可能です。</li>'
          + '</ol>',
          '<div class="rounded-sm bg-red-50 border-2 border-red-300 px-3 py-2 text-red-800"><strong>⚠ 重要</strong><br>保存後、その店舗の<strong>ログイン ID とパスワードが 1 回だけ</strong>表示されます。「ログイン情報をコピー」ボタンでクリップボードにコピーできます。<br><strong>パスワードはこの画面でしか確認できない</strong>ので、必ず控えてから「控えました・店舗一覧へ」を押してください。</div>',
        ],
      },
      {
        id: 'admin-edit-store',
        title: '既存の店舗の情報を変更する',
        body: [
          '画面右上で「<strong>管理者</strong>」を選び、「<strong>店舗管理</strong>」タブの一覧から、変更したい店舗名（青いリンク）をクリックします。',
          '<ul>'
          + '<li><strong>基本情報</strong>（店舗名・住所・電話・メール・表示順）</li>'
          + '<li><strong>ベッド</strong>（追加・削除・名前変更）</li>'
          + '<li><strong>営業時間</strong>（曜日ごとの時間帯）</li>'
          + '</ul>'
          + 'をすべて 1 つの画面で編集できます。',
          '<div class="rounded-sm bg-amber-50 border border-amber-200 px-3 py-2 text-amber-900"><strong>💡 保存ルール</strong><br>・ベッドの追加・削除は<strong>その場で即時反映</strong>（更新ボタン不要）<br>・基本情報と営業時間は画面下の「<strong>更新</strong>」ボタンで保存<br>・未保存の変更があると「未保存の変更があります」と表示されます</div>',
        ],
      },
      {
        id: 'admin-filter-sort-stores',
        title: '店舗一覧を絞り込む・並び替える',
        body: [
          '店舗管理タブの一覧画面で:',
          '<ul>'
          + '<li><strong>右上の検索ボックス</strong>に店舗名・スラッグ・都道府県・市区町村のいずれかを入力 → 部分一致で絞り込み。スペース区切りで AND 検索（例: <code>流山 整骨</code>）</li>'
          + '<li><strong>列見出し</strong>「都道府県」「市区町村」「表示順」をクリックでソート（再クリックで昇順 ⇔ 降順）</li>'
          + '<li>上の<strong>タブ</strong>で「すべて / 有効 / 無効」を切り替え（無効化済みの店舗を含めるか）</li>'
          + '</ul>',
        ],
      },
      {
        id: 'admin-deactivate-vs-purge-store',
        title: '店舗の「無効化」と「完全削除」の違い',
        body: [
          '<div class="rounded-sm bg-green-50 border border-green-300 px-3 py-2 text-green-900"><strong>✅ 無効化（休止） — 普段はこちら</strong><br>一覧から見えるけれど、予約受付からは外れます。データは残ったままなので、「<strong>有効化</strong>」を押せば元に戻せます。店舗をしばらく閉める時はこちらを使ってください。</div>',
          '<div class="rounded-sm bg-red-50 border-2 border-red-300 px-3 py-2 text-red-800"><strong>⚠ 完全削除 — 取り消し不可</strong><br>店舗本体と関連データ（予約・ベッド・営業時間・店舗特別メニューなど）を<strong>すべて消去</strong>します。<br>誤操作を防ぐため:<ul><li>すでに<strong>無効化済みの店舗だけ</strong>が対象</li><li>確認画面で<strong>店舗名をそのまま入力</strong>する必要あり</li></ul></div>',
          '<div class="rounded-sm bg-amber-50 border border-amber-200 px-3 py-2 text-amber-900"><strong>💡 拒否される条件</strong><br>この店舗のスタッフが <strong>他店の予約を担当</strong>している場合、他店データを巻き込むため完全削除は拒否されます。先にその担当を整理してから削除してください。</div>',
        ],
      },
    ],
  },
  {
    id: 'admin-holidays',
    label: '休日管理',
    icon: 'i-lucide-calendar-x',
    description: '全店まとめて休む「店休日」と、国民の「祝日」を登録するページです。',
    ownerOnly: true,
    topics: [
      {
        id: 'holidays-overview',
        title: '「店休日」と「祝日」の違い',
        body: [
          '<ul>'
          + '<li><strong>店休日</strong> = 全店舗を<strong>まとめて休み</strong>にする日（年末年始・棚卸し・研修など）。登録するとその日の予約枠は全店でゼロになり、お客様の予約画面でも予約が取れません。</li>'
          + '<li><strong>祝日</strong> = 国民の祝日（元日・成人の日・海の日 など）。祝日は<strong>営業します</strong>。短縮営業にしたい場合は店舗ごとに祝日用の営業時間を設定できます（下のトピック参照）。</li>'
          + '</ul>',
          'どちらも画面右上の選択ボタン（▼）で「<strong>管理者</strong>」を選んだときに出る「休日管理」タブから登録します。個別店舗モードに切り替えるとこのタブは見えません。',
        ],
      },
      {
        id: 'holidays-add-edit',
        title: '店休日・祝日を追加・編集する',
        body: [
          '<ul>'
          + '<li><strong>追加</strong>: 各セクション右上の「<strong>＋ 店休日を追加</strong>」または「<strong>＋ 祝日を追加</strong>」ボタンで入力画面が開きます。日付とメモ（任意）を入れて「追加」。祝日は名称（例: 海の日）も必須。</li>'
          + '<li><strong>編集・削除</strong>: 一覧の行にマウスを乗せると右側に「<strong>編集 | 削除</strong>」が現れます。</li>'
          + '<li><strong>対象年プルダウン</strong>: 登録済みの年だけが並びます。2028 年の祝日を初めて追加すると自動で「2028年」が増え、画面もその年に切り替わります。</li>'
          + '</ul>',
          '<div class="rounded-sm bg-amber-50 border border-amber-200 px-3 py-2 text-amber-900"><strong>💡 店休日は全店一括</strong><br>店休日は 1 度の操作で<strong>全店ぶん同時に登録</strong>されます。「ある店舗だけ休み」という登録はできないので、その場合は予約管理画面でその日の予約枠を埋めて対応してください。</div>',
        ],
      },
      {
        id: 'holidays-business-hours-link',
        title: '祝日の営業時間を店舗ごとに変える',
        body: [
          '祝日のマスタ自体は全店共通ですが、<strong>祝日の営業時間は店舗ごとに別々に</strong>設定できます。',
          '<ol>'
          + '<li>画面右上で「<strong>管理者</strong>」を選び、「<strong>店舗管理</strong>」タブから対象店舗を開く</li>'
          + '<li>営業時間欄の一番下にある「<strong>祝</strong>」レンジに時間帯を入力</li>'
          + '<li>画面下の「<strong>更新</strong>」を押して保存</li>'
          + '</ol>',
          '<div class="rounded-sm bg-amber-50 border border-amber-200 px-3 py-2 text-amber-900"><strong>💡 空のままだと?</strong><br>「祝」レンジを空のままにしておくと、祝日は<strong>日曜と同じ営業時間</strong>で運用されます。</div>',
          '<div class="rounded-sm bg-sky-50 border border-sky-200 px-3 py-2 text-sky-900"><strong>📌 例: 祝日を土曜と同じ営業時間にしたい</strong><br>「祝」行にマウスを乗せて「<strong>土曜と同じ</strong>」プリセットボタンをクリック → 画面下「更新」。</div>',
        ],
      },
    ],
  },
  {
    id: 'admin-menus',
    label: '共通メニュー管理',
    icon: 'i-lucide-clipboard-list',
    description: '全店共通のメニューと、店舗ごとの特別メニュー（キャンペーンなど）を登録・編集するページです。',
    ownerOnly: true,
    topics: [
      {
        id: 'admin-common-vs-store-menus',
        title: '「共通メニュー」と「店舗特別メニュー」の違い',
        body: [
          '<ul>'
          + '<li><strong>共通メニュー</strong> = 全店舗で自動的にお客様の予約画面に出るメニュー（全身整体 60 分、骨盤矯正 など）。画面右上で「<strong>管理者</strong>」を選ぶとナビに「<strong>共通メニュー管理</strong>」タブが現れ、そこから登録・編集します。</li>'
          + '<li><strong>店舗特別メニュー</strong> = その店舗だけのメニュー（その店だけのキャンペーン・独自施術 など）。画面右上で<strong>対象店舗（例: 流山おおたかの森整骨院）</strong>を選ぶとナビが店舗用に切り替わり、「メニュー」タブから登録できます。</li>'
          + '</ul>',
          'お客様の予約画面では、共通メニューが先頭、その下に店舗特別メニューが並びます。お客様はどちらからでも選べます。',
        ],
      },
      {
        id: 'admin-menu-store-exclusion',
        title: '共通メニューを特定の店舗だけで「非表示」にする',
        body: [
          '「全店共通として登録しているけれど、この店舗だけは出したくない」というときに使います。',
          '<div class="rounded-sm bg-sky-50 border border-sky-200 px-3 py-2 text-sky-900"><strong>📌 使うシーン</strong><br>・マタニティ整体は専門研修を受けたスタッフが居る店舗だけで出したい<br>・新メニューを 1 店舗で先に試してから他店に展開したい</div>',
          '<ol>'
          + '<li>画面右上で「<strong>管理者</strong>」を選び、「<strong>共通メニュー管理</strong>」タブを開く</li>'
          + '<li>対象の共通メニューの「<strong>編集</strong>」を押す</li>'
          + '<li>編集画面の下部「<strong>以下の店舗では表示しない</strong>」チェックボックスで、非表示にしたい店舗にチェック</li>'
          + '<li>「更新」を押す</li>'
          + '</ol>',
          'チェックを入れた店舗の予約画面ではこのメニューが表示されなくなります。他の店舗では引き続き表示されます。一覧の「<strong>非表示店舗</strong>」列に現在の設定が見え、チェックを外せば再び表示されます。',
        ],
      },
      {
        id: 'admin-menu-replacement',
        title: '期間限定キャンペーンで共通メニューを「差し替える」',
        body: [
          'ある店舗だけ、ある期間だけ、共通メニューを<strong>別の価格・別の名前で出したい</strong>ときの仕組みです。',
          '<div class="rounded-sm bg-sky-50 border border-sky-200 px-3 py-2 text-sky-900"><strong>📌 例</strong><br>共通メニュー「全身整体 60 分（通常 8,000 円）」を、流山おおたかの森店だけオープン記念で 5,000 円で出したい。</div>',
          '<ol>'
          + '<li>画面右上で対象店舗（例: 流山おおたかの森整骨院）を選び、「<strong>メニュー</strong>」タブを開く</li>'
          + '<li>「<strong>＋ メニューを追加</strong>」で店舗特別メニュー「オープン記念キャンペーン 全身整体 60 分（5,000 円）」を作成</li>'
          + '<li>編集画面の「<strong>共通メニューと差し替える</strong>」ドロップダウンで「全身整体 60 分」を選択</li>'
          + '<li>「<strong>表示期間</strong>」の終了日を設定（例: 6/30 まで）</li>'
          + '</ol>',
          '<div class="rounded-sm bg-green-50 border border-green-300 px-3 py-2 text-green-900"><strong>✅ 自動で元に戻る</strong><br>期間中（〜 6/30）はその店舗の予約画面に<strong>キャンペーンメニューだけ</strong>が表示され、元の共通メニューは自動的に非表示。<br>終了日を過ぎたら<strong>自動的に元の共通メニューに戻ります</strong>。設定を手動で消す必要はありません。</div>',
          '管理画面のメニュー一覧の「<strong>差し替え対象</strong>」列に、その特別メニューがどの共通メニューを置き換えているかが表示されます。',
        ],
      },
      {
        id: 'admin-deactivate-vs-purge-menu',
        title: 'メニューの「無効化」と「完全削除」の違い',
        body: [
          '<div class="rounded-sm bg-green-50 border border-green-300 px-3 py-2 text-green-900"><strong>✅ 無効化（停止） — 普段はこちら</strong><br>お客様の予約画面からそのメニューが消えます。データは残るので、「<strong>有効化</strong>」を押せば元に戻せます。</div>',
          '<div class="rounded-sm bg-red-50 border-2 border-red-300 px-3 py-2 text-red-800"><strong>⚠ 完全削除 — 取り消し不可</strong><br>メニューデータ自体を消去します。無効化済みのメニューだけが対象で、確認画面でメニュー名をそのまま入力する必要があります。</div>',
          '<div class="rounded-sm bg-red-50 border-2 border-red-300 px-3 py-2 text-red-800"><strong>⚠ 重要: 履歴ある場合は拒否</strong><br>そのメニューを使った予約が <strong>1 件でも残っていれば、履歴保護のため完全削除は拒否</strong>されます。古いキャンペーン用メニューなど、本当に履歴ごと消したい場合だけ使ってください。</div>',
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
            <!-- ownerOnly カテゴリには「オーナー専用」バッジを 1 つだけ付ける（各トピックには付けない） -->
            <span
              v-if="cat.ownerOnly && !cat.important"
              class="ml-auto inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold text-orange-700 bg-orange-100 border border-orange-300 rounded-sm tracking-wide"
            >
              <UIcon name="i-lucide-crown" class="size-3" />
              オーナー専用
            </span>
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
            <!-- important カテゴリ（セキュリティ等）はアコーディオンを使わず常時展開。
                 絶対に読み飛ばされないように、開閉操作なしで全文が見える状態にする。 -->
            <template v-if="cat.important">
              <div class="px-4 py-3">
                <div class="text-sm font-semibold text-red-900 mb-2 flex items-center gap-2">
                  <UIcon name="i-lucide-shield-alert" class="size-4 text-red-600 flex-shrink-0" />
                  {{ topic.title }}
                </div>
                <div class="help-body pl-6 text-sm text-slate-700 space-y-3 leading-relaxed">
                  <!-- eslint-disable-next-line vue/no-v-html -->
                  <div v-for="(para, i) in topic.body" :key="i" v-html="para" />
                </div>
              </div>
            </template>
            <!-- 通常カテゴリはアコーディオン -->
            <template v-else>
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
              </button>
              <div v-if="isOpen(topic.id)" class="help-body px-4 pb-4 pl-10 text-sm text-slate-700 space-y-3 leading-relaxed">
                <!-- 各段落は v-html。<ul>/<ol>/<strong>/<code> や、赤背景の警告ボックスも展開できる -->
                <!-- eslint-disable-next-line vue/no-v-html -->
                <div v-for="(para, i) in topic.body" :key="i" v-html="para" />
              </div>
            </template>
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

<style scoped>
/* ヘルプ本文の v-html 展開部分に対するスタイル。Tailwind reset で list-style が消されるので明示的に戻す。 */
.help-body :deep(ul) {
  list-style: disc;
  padding-left: 1.25rem;
  margin: 0.25rem 0;
}
.help-body :deep(ol) {
  list-style: decimal;
  padding-left: 1.5rem;
  margin: 0.25rem 0;
}
.help-body :deep(li) {
  margin: 0.25rem 0;
}
.help-body :deep(code) {
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 3px;
  padding: 1px 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.875em;
}
</style>
