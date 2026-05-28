<script setup lang="ts">
import type { Store } from '@prisma/client'
import { ROLE_LABEL, type Permission, type RoleName } from '~~/shared/permissions'

definePageMeta({ layout: 'admin', requirePermission: 'staff:view' })

type StaffWithStore = {
  id: number
  storeId: number
  name: string
  displayOrder: number
  isActive: boolean
  isAssignable: boolean
  canLogin: boolean
  username: string | null
  role: RoleName | null
  permissions: Permission[]
  createdAt: string
  updatedAt: string
  store: Pick<Store, 'id' | 'name' | 'slug'>
}

type Status = 'all' | 'active' | 'inactive'
const status = ref<Status>('all')
const storeFilter = ref<number | 'all'>('all')

const { data: stores } = await useFetch<Store[]>('/api/admin/stores', {
  query: { status: 'active' },
})

const { data: staffList, refresh, error } = await useFetch<StaffWithStore[]>('/api/admin/staff', {
  query: { status: 'all' },
})

const counts = computed(() => {
  const list = staffList.value ?? []
  return {
    all: list.length,
    active: list.filter(s => s.isActive).length,
    inactive: list.filter(s => !s.isActive).length,
  }
})

const filtered = computed(() => {
  const list = staffList.value ?? []
  return list
    .filter((s) => {
      if (status.value === 'active') return s.isActive
      if (status.value === 'inactive') return !s.isActive
      return true
    })
    .filter((s) => {
      if (storeFilter.value === 'all') return true
      return s.storeId === storeFilter.value
    })
})

const tabs: { v: Status, label: string }[] = [
  { v: 'all', label: 'すべて' },
  { v: 'active', label: '有効' },
  { v: 'inactive', label: '無効' },
]

const busy = ref<number | null>(null)

async function softDelete(s: StaffWithStore) {
  if (!confirm(`スタッフ「${s.name}」を無効化しますか？`)) return
  busy.value = s.id
  try {
    await $fetch(`/api/admin/staff/${s.id}`, { method: 'DELETE' })
    await refresh()
  }
  finally {
    busy.value = null
  }
}

async function activate(s: StaffWithStore) {
  busy.value = s.id
  try {
    await $fetch(`/api/admin/staff/${s.id}`, {
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
        スタッフ管理
      </h1>
      <NuxtLink
        to="/dashboard/staff/new"
        class="inline-flex items-center px-3 py-1 border border-[#8c8f94] bg-[#f6f7f7] hover:bg-white text-slate-700 hover:text-slate-900 text-sm rounded-sm"
      >
        新規追加
      </NuxtLink>
    </div>
    <p class="text-sm text-slate-600 mb-4">
      全店舗のスタッフを横断的に管理します。シフトでの他店舗ヘルプは「シフト管理」で設定します。
    </p>

    <!-- WP 風ステータスフィルタ -->
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

    <!-- 店舗フィルタ -->
    <div class="flex items-center gap-2 mb-3 text-sm">
      <label class="text-slate-700">メイン店舗で絞り込み:</label>
      <select
        v-model="storeFilter"
        class="px-2 py-1 text-sm border border-[#8c8f94] rounded-sm bg-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.07)] focus:outline-none focus:border-orange-500"
      >
        <option value="all">
          すべての店舗
        </option>
        <option
          v-for="store in stores ?? []"
          :key="store.id"
          :value="store.id"
        >
          {{ store.name }}
        </option>
      </select>
    </div>

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
              スタッフ名
            </th>
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7]">
              メイン店舗
            </th>
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7]">
              役職 / ログイン
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
            <td colspan="5" class="px-3 py-6 text-center text-slate-500">
              該当するスタッフはいません。
            </td>
          </tr>
          <tr
            v-for="s in filtered"
            :key="s.id"
            class="group border-b border-[#f0f0f1] last:border-b-0 hover:bg-[#f6f7f7]"
          >
            <td class="px-3 py-2.5 align-top">
              <NuxtLink
                :to="`/dashboard/staff/${s.id}`"
                class="font-semibold text-blue-700 hover:text-blue-900 hover:underline"
              >
                {{ s.name }}
              </NuxtLink>
              <div class="text-xs text-slate-600 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <NuxtLink
                  :to="`/dashboard/staff/${s.id}`"
                  class="text-blue-700 hover:text-blue-900 hover:underline"
                >
                  編集
                </NuxtLink>
                <span class="text-slate-300 mx-1.5">|</span>
                <button
                  v-if="s.isActive"
                  type="button"
                  :disabled="busy === s.id"
                  class="text-red-700 hover:text-red-900 hover:underline disabled:text-slate-400"
                  @click="softDelete(s)"
                >
                  無効化
                </button>
                <button
                  v-else
                  type="button"
                  :disabled="busy === s.id"
                  class="text-green-700 hover:text-green-900 hover:underline disabled:text-slate-400"
                  @click="activate(s)"
                >
                  有効化
                </button>
              </div>
            </td>
            <td class="px-3 py-2.5 align-top">
              {{ s.store.name }}
              <div v-if="!s.isAssignable" class="text-xs text-slate-500 mt-1">
                予約割当なし
              </div>
            </td>
            <td class="px-3 py-2.5 align-top">
              <div v-if="s.canLogin && s.role" class="flex flex-col gap-1">
                <span class="inline-flex items-center text-xs text-slate-700 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded-sm w-fit">
                  {{ ROLE_LABEL[s.role] }}
                </span>
                <span class="text-xs text-slate-500">
                  ID: {{ s.username }}
                </span>
              </div>
              <span v-else class="text-xs text-slate-400">
                ログイン不可
              </span>
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
