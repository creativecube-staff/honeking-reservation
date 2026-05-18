<script setup lang="ts">
import type { Store } from '@prisma/client'

// WordPress 風の店舗一覧画面（wp-list-table 模倣）
definePageMeta({ layout: 'admin' })

type Status = 'all' | 'active' | 'inactive'
const status = ref<Status>('all')

const { data: stores, refresh, error } = await useFetch<Store[]>('/api/admin/stores', {
  query: { status: 'all' },
})

const counts = computed(() => {
  const list = stores.value ?? []
  return {
    all: list.length,
    active: list.filter(s => s.isActive).length,
    inactive: list.filter(s => !s.isActive).length,
  }
})

const filtered = computed(() => {
  const list = stores.value ?? []
  if (status.value === 'active') return list.filter(s => s.isActive)
  if (status.value === 'inactive') return list.filter(s => !s.isActive)
  return list
})

const tabs: { v: Status, label: string }[] = [
  { v: 'all', label: 'すべて' },
  { v: 'active', label: '有効' },
  { v: 'inactive', label: '無効' },
]

const busy = ref<number | null>(null)

async function softDelete(id: number, name: string) {
  if (!confirm(`店舗「${name}」を無効化しますか？\n（データは残り、フィルタ「無効」から復活できます）`)) return
  busy.value = id
  try {
    await $fetch(`/api/admin/stores/${id}`, { method: 'DELETE' })
    await refresh()
  }
  finally {
    busy.value = null
  }
}

async function activate(id: number) {
  busy.value = id
  try {
    await $fetch(`/api/admin/stores/${id}`, {
      method: 'PATCH',
      body: { isActive: true },
    })
    await refresh()
  }
  finally {
    busy.value = null
  }
}

const dateFmt = new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
</script>

<template>
  <div>
    <div class="flex items-center gap-3 mb-1">
      <h1 class="text-2xl font-semibold text-slate-900">
        店舗管理
      </h1>
      <NuxtLink
        to="/dashboard/stores/new"
        class="inline-flex items-center px-3 py-1 border border-[#8c8f94] bg-[#f6f7f7] hover:bg-white text-slate-700 hover:text-slate-900 text-sm rounded-sm"
      >
        新規追加
      </NuxtLink>
    </div>
    <p class="text-sm text-slate-600 mb-4">
      店舗の追加・編集・無効化を行います。
    </p>

    <!-- WP 風ステータスフィルタ（subsubsub） -->
    <ul class="text-sm mb-3 flex items-center">
      <li v-for="(tab, i) in tabs" :key="tab.v" class="flex items-center">
        <button
          class="hover:underline"
          :class="status === tab.v
            ? 'text-slate-900 font-semibold'
            : 'text-blue-700 hover:text-blue-900'"
          @click="status = tab.v"
        >
          {{ tab.label }}
          <span :class="status === tab.v ? 'text-slate-500' : 'text-slate-400'">
            ({{ counts[tab.v] }})
          </span>
        </button>
        <span v-if="i < tabs.length - 1" class="text-slate-300 mx-2">|</span>
      </li>
    </ul>

    <!-- エラー -->
    <UAlert
      v-if="error"
      color="error"
      icon="i-lucide-triangle-alert"
      :title="`一覧の取得に失敗しました: ${error.message}`"
      class="mb-3"
    />

    <!-- WP 風テーブル -->
    <div class="bg-white border border-[#c3c4c7] rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-[#f6f7f7] text-slate-900">
          <tr>
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7]">
              店舗名
            </th>
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7]">
              スラッグ
            </th>
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7]">
              都道府県
            </th>
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7]">
              市区町村
            </th>
            <th class="px-3 py-2.5 text-right font-semibold border-b border-[#c3c4c7]">
              表示順
            </th>
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7]">
              状態
            </th>
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7]">
              作成日
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="filtered.length === 0">
            <td colspan="7" class="px-3 py-6 text-center text-slate-500">
              該当する店舗はありません。
            </td>
          </tr>
          <tr
            v-for="s in filtered"
            :key="s.id"
            class="group border-b border-[#f0f0f1] last:border-b-0 hover:bg-[#f6f7f7]"
          >
            <td class="px-3 py-2.5 align-top">
              <NuxtLink
                :to="`/dashboard/stores/${s.id}`"
                class="font-semibold text-blue-700 hover:text-blue-900 hover:underline"
              >
                {{ s.name }}
              </NuxtLink>
              <!-- WP 風のホバー時行アクション -->
              <div class="text-xs text-slate-600 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <NuxtLink
                  :to="`/dashboard/stores/${s.id}`"
                  class="text-blue-700 hover:text-blue-900 hover:underline"
                >
                  編集
                </NuxtLink>
                <span class="text-slate-300 mx-1.5">|</span>
                <button
                  v-if="s.isActive"
                  :disabled="busy === s.id"
                  class="text-red-700 hover:text-red-900 hover:underline disabled:text-slate-400"
                  @click="softDelete(s.id, s.name)"
                >
                  無効化
                </button>
                <button
                  v-else
                  :disabled="busy === s.id"
                  class="text-green-700 hover:text-green-900 hover:underline disabled:text-slate-400"
                  @click="activate(s.id)"
                >
                  復活
                </button>
              </div>
            </td>
            <td class="px-3 py-2.5 align-top">
              <code class="text-xs bg-[#f0f0f1] px-1.5 py-0.5 rounded-sm">{{ s.slug }}</code>
            </td>
            <td class="px-3 py-2.5 align-top">
              {{ s.prefecture }}
            </td>
            <td class="px-3 py-2.5 align-top">
              {{ s.city }}
            </td>
            <td class="px-3 py-2.5 align-top text-right tabular-nums">
              {{ s.displayOrder }}
            </td>
            <td class="px-3 py-2.5 align-top">
              <span
                v-if="s.isActive"
                class="inline-flex items-center gap-1 text-xs text-green-800 bg-green-50 border border-green-200 px-2 py-0.5 rounded-sm"
              >
                有効
              </span>
              <span
                v-else
                class="inline-flex items-center gap-1 text-xs text-slate-700 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded-sm"
              >
                無効
              </span>
            </td>
            <td class="px-3 py-2.5 align-top text-slate-700">
              {{ dateFmt.format(new Date(s.createdAt)) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
