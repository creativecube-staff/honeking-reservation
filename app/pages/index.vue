<script setup lang="ts">
// お客様トップ(店舗選択)。reserve. ホスト用のタイトル・OGP を設定。
useHead({
  title: 'ご予約 | ほねキング整骨院グループ・海道整骨院',
  meta: [
    { name: 'description', content: '千葉県・流山おおたかの森の整骨院。Web から 24 時間いつでもご予約を承ります。LINE 連携で次回からのご予約もスムーズに。' },
    { property: 'og:title', content: 'ご予約 | ほねキング整骨院グループ・海道整骨院' },
    { property: 'og:description', content: '千葉県・流山おおたかの森の整骨院。Web から 24 時間いつでもご予約を承ります。' },
    { property: 'og:type', content: 'website' },
  ],
})

const { data: stores, status, error } = await useFetch('/api/stores')

type StoreItem = NonNullable<typeof stores.value>[number]

// 都道府県でグルーピング（市区町村は店舗カードに含めるため見出しは挟まない、本サイト準拠）
const grouped = computed(() => {
  if (!stores.value) return []
  const map = new Map<string, StoreItem[]>()
  for (const s of stores.value) {
    if (!map.has(s.prefecture)) map.set(s.prefecture, [])
    map.get(s.prefecture)!.push(s)
  }
  return Array.from(map.entries()).map(([prefecture, items]) => ({ prefecture, items }))
})

// honeking.jp の店舗外観画像 URL (slug ベースで一意に決まる)
const imageUrl = (slug: string) =>
  `https://honeking.jp/wp/wp-content/themes/honeking/assets/img/shops/${slug}/${slug}-img@2x.jpg`

// 画像読み込み失敗時は <img> を非表示にして、背景色のプレースホルダだけ残す
function hideOnError(event: Event) {
  const img = event.target as HTMLImageElement
  img.style.display = 'none'
}

// 都道府県と市区町村は別に表示するので、住所からは省く
function shortAddress(store: StoreItem): string {
  return store.address.replace(store.prefecture, '').replace(store.city, '').trim()
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 sm:px-6 py-10">
    <ReservationStepIndicator :current="1" class="mb-8" />

    <div class="text-center mb-10">
      <h1 class="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
        ご利用の<span class="text-orange-600">店舗</span>を選んでください
      </h1>
      <p class="mt-3 inline-flex items-center gap-1.5 text-xs sm:text-sm text-slate-700 bg-amber-50 border border-amber-200 rounded-full px-3.5 py-1.5">
        <UIcon name="i-lucide-mouse-pointer-click" class="shrink-0 w-3.5 h-3.5 text-orange-600" />
        タップして「メニュー選択」へ進みます
      </p>
      <div class="mt-4 flex justify-center">
        <UIcon name="i-lucide-chevron-down" class="w-6 h-6 text-orange-500 animate-bounce" />
      </div>
    </div>

    <div v-if="status === 'pending'" class="text-slate-600">
      読み込み中...
    </div>

    <UAlert
      v-else-if="error"
      color="error"
      icon="i-lucide-triangle-alert"
      :title="`店舗一覧の取得に失敗しました: ${error.message}`"
    />

    <UAlert
      v-else-if="stores && stores.length === 0"
      color="warning"
      icon="i-lucide-info"
      title="現在利用可能な店舗がありません。しばらく経ってから再度お試しください。"
    />

    <div v-else class="space-y-12">
      <section v-for="group in grouped" :key="group.prefecture">
        <h2 class="flex items-center gap-3 mb-6">
          <span class="block w-2 h-9 sm:h-10 rounded-full bg-orange-500" />
          <span class="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            {{ group.prefecture }}
          </span>
        </h2>
        <div class="grid gap-4 md:grid-cols-2">
          <NuxtLink
            v-for="store in group.items"
            :key="store.id"
            :to="`/${store.slug}`"
            class="block group"
          >
            <div class="h-full flex overflow-hidden rounded-xl border-2 border-amber-300 bg-[#fff3db] shadow-sm transition group-hover:bg-white group-hover:border-orange-500 group-hover:shadow-lg">
              <div class="relative w-36 sm:w-48 shrink-0 overflow-hidden bg-amber-100">
                <img
                  :src="imageUrl(store.slug)"
                  :alt="`${store.name} の外観`"
                  class="w-full h-full object-cover transition group-hover:scale-105"
                  loading="lazy"
                  @error="hideOnError"
                >
                <span class="absolute top-1.5 left-1.5 rounded bg-orange-500 px-1.5 py-0.5 text-[10px] sm:text-xs font-bold text-white shadow">
                  {{ store.city }}
                </span>
              </div>
              <div class="flex-1 min-w-0 p-3 sm:p-4 grid gap-1.5 content-center">
                <h3 class="text-sm sm:text-xl font-bold text-orange-700 leading-tight whitespace-nowrap sm:whitespace-normal sm:text-balance">
                  {{ store.name }}
                </h3>
                <div class="flex items-center gap-1.5 min-w-0">
                  <UIcon name="i-lucide-map" class="shrink-0 w-4 h-4 text-slate-500" />
                  <p class="text-xs sm:text-sm text-slate-700 truncate">{{ shortAddress(store) }}</p>
                </div>
                <div v-if="store.phone" class="flex items-center gap-1.5">
                  <UIcon name="i-lucide-phone" class="shrink-0 w-4 h-4 text-orange-600" />
                  <span class="text-base sm:text-lg font-bold text-slate-900 tracking-wide">
                    {{ store.phone }}
                  </span>
                </div>
                <div class="mt-1 flex items-center justify-center gap-1 rounded-md bg-orange-500 px-3 py-2 text-sm font-semibold text-white shadow-sm transition group-hover:bg-orange-600">
                  この店舗で予約する
                  <UIcon name="i-lucide-chevron-right" class="w-4 h-4" />
                </div>
              </div>
            </div>
          </NuxtLink>
        </div>
      </section>
    </div>
  </div>
</template>
