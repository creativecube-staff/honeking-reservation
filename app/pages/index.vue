<script setup lang="ts">
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
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 sm:px-6 py-10">
    <h1 class="text-2xl sm:text-3xl font-bold text-slate-900">
      ご予約・店舗選択
    </h1>
    <p class="text-slate-700 mt-2 mb-8">
      ご来店希望の店舗を選択してください。
    </p>

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

    <div v-else class="space-y-10">
      <section v-for="group in grouped" :key="group.prefecture">
        <h2 class="text-xl sm:text-2xl font-bold text-slate-900 border-b-2 border-amber-300 pb-2 mb-5">
          {{ group.prefecture }}
        </h2>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <NuxtLink
            v-for="store in group.items"
            :key="store.id"
            :to="`/${store.slug}`"
            class="block group"
          >
            <div class="h-full overflow-hidden rounded-xl border-2 border-amber-300 bg-[#fff3db] shadow-sm transition group-hover:bg-white group-hover:border-orange-500 group-hover:shadow-lg">
              <div class="aspect-[16/9] overflow-hidden bg-amber-100">
                <img
                  :src="imageUrl(store.slug)"
                  :alt="`${store.name} の外観`"
                  class="w-full h-full object-cover transition group-hover:scale-105"
                  loading="lazy"
                  @error="hideOnError"
                >
              </div>
              <div class="p-5">
                <p class="text-xs text-slate-600 mb-1">{{ store.city }}</p>
                <h3 class="text-lg sm:text-xl font-bold text-slate-900">
                  {{ store.name }}
                </h3>
                <p class="mt-2 text-sm text-slate-700">{{ store.address }}</p>
                <p v-if="store.phone" class="mt-1 text-sm text-slate-700">
                  📞 {{ store.phone }}
                </p>
                <div class="mt-5 inline-flex items-center gap-1 rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition group-hover:bg-orange-600">
                  この店舗で予約する
                  <UIcon name="i-lucide-chevron-right" />
                </div>
              </div>
            </div>
          </NuxtLink>
        </div>
      </section>
    </div>
  </div>
</template>
