<script setup lang="ts">
import type { Store } from '@prisma/client'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const router = useRouter()

const { data: stores } = await useFetch<Store[]>('/api/admin/stores', {
  query: { status: 'active' },
})

// ── 店舗セレクタ（URL クエリ ?storeId=N） ─────────────────
const storeId = computed<number | null>({
  get() {
    const q = Number(route.query.storeId)
    if (Number.isInteger(q) && q > 0) return q
    return (stores.value ?? [])[0]?.id ?? null
  },
  set(v) {
    if (v == null) return
    router.replace({ query: { ...route.query, storeId: String(v) } })
  },
})

// 初回読み込み時に storeId が URL になければ先頭店舗を反映
watchEffect(() => {
  const list = stores.value ?? []
  if (!route.query.storeId && list[0]) {
    router.replace({ query: { ...route.query, storeId: String(list[0].id) } })
  }
})

// ── タブ管理（URL クエリ ?tab=hours|holidays） ────────────
type TabId = 'hours' | 'holidays'
const tabs: { id: TabId, label: string }[] = [
  { id: 'hours', label: '営業時間' },
  { id: 'holidays', label: '店休日' },
]
const activeTab = computed<TabId>(() => {
  const t = String(route.query.tab ?? 'hours')
  return tabs.find(x => x.id === t)?.id ?? 'hours'
})
function setTab(id: TabId) {
  router.replace({ query: { ...route.query, tab: id } })
}
</script>

<template>
  <div>
    <div class="flex items-center gap-3 mb-1">
      <h1 class="text-2xl font-semibold text-slate-900">
        スケジュール管理
      </h1>
    </div>
    <p class="text-sm text-slate-600 mb-4">
      店舗ごとの営業時間と店休日を設定します。
    </p>

    <!-- 店舗セレクタ -->
    <div class="bg-white border border-[#c3c4c7] rounded-sm p-3 mb-4 flex items-center gap-3">
      <label class="text-sm font-semibold text-slate-900">店舗</label>
      <select
        v-model.number="storeId"
        class="px-2.5 py-1.5 text-sm border border-[#8c8f94] rounded-sm bg-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.07)] focus:outline-none focus:border-orange-500"
      >
        <option v-if="(stores ?? []).length === 0" :value="null">
          （店舗がまだありません）
        </option>
        <option
          v-for="s in stores ?? []"
          :key="s.id"
          :value="s.id"
        >
          {{ s.name }}
        </option>
      </select>
    </div>

    <div v-if="storeId == null" class="bg-white border border-[#c3c4c7] rounded-sm p-6 text-center text-slate-600">
      まず店舗を登録してください。
      <NuxtLink to="/admin/stores/new" class="text-blue-700 hover:text-blue-900 hover:underline">
        店舗を追加する →
      </NuxtLink>
    </div>

    <template v-else>
      <!-- WP 風水平タブ -->
      <div class="border-b border-[#c3c4c7] mb-5 flex">
        <button
          v-for="t in tabs"
          :key="t.id"
          type="button"
          class="px-4 py-2 text-sm -mb-px border border-transparent transition-colors"
          :class="activeTab === t.id
            ? 'border-[#c3c4c7] border-b-white bg-white text-slate-900 font-semibold rounded-t-sm'
            : 'text-blue-700 hover:text-blue-900 hover:bg-[#f6f7f7]'"
          @click="setTab(t.id)"
        >
          {{ t.label }}
        </button>
      </div>

      <div v-show="activeTab === 'hours'">
        <AdminScheduleBusinessHoursPanel
          v-if="activeTab === 'hours'"
          :key="`hours-${storeId}`"
          :store-id="storeId"
        />
      </div>
      <div v-show="activeTab === 'holidays'">
        <AdminScheduleHolidaysPanel
          v-if="activeTab === 'holidays'"
          :key="`holidays-${storeId}`"
          :store-id="storeId"
        />
      </div>
    </template>
  </div>
</template>
