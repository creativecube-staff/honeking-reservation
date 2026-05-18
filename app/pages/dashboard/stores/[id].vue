<script setup lang="ts">
import type { Store } from '@prisma/client'
import { storeBaseSchema, type StoreFormState } from '~~/shared/schemas/store'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const router = useRouter()
const id = Number(route.params.id)
if (!Number.isInteger(id) || id <= 0) {
  throw createError({ statusCode: 400, statusMessage: '不正な ID です' })
}

const { data: store, error: loadError } = await useFetch<Store>(`/api/admin/stores/${id}`)
if (loadError.value) {
  throw createError({ statusCode: 404, statusMessage: '店舗が見つかりません' })
}

// ── タブ管理 ────────────────────────────────────────────
type TabId = 'basic' | 'beds' | 'menus' | 'hours' | 'holidays'
const tabs: { id: TabId, label: string }[] = [
  { id: 'basic', label: '基本情報' },
  { id: 'beds', label: 'ベッド' },
  { id: 'menus', label: 'メニュー' },
  { id: 'hours', label: '営業時間' },
  { id: 'holidays', label: '店休日' },
]
const activeTab = computed<TabId>(() => {
  const t = String(route.query.tab ?? 'basic')
  return tabs.find(x => x.id === t)?.id ?? 'basic'
})
function setTab(id: TabId) {
  router.replace({ query: { ...route.query, tab: id } })
}

// ── 基本情報フォームの state ──────────────────────────────
const state = reactive<StoreFormState>({
  slug: store.value!.slug,
  prefecture: store.value!.prefecture,
  city: store.value!.city,
  name: store.value!.name,
  address: store.value!.address,
  phone: store.value!.phone ?? '',
  displayOrder: store.value!.displayOrder,
  isActive: store.value!.isActive,
})

const fieldErrors = ref<Record<string, string>>({})
const formError = ref<string | null>(null)
const submitting = ref(false)
const deleting = ref(false)

async function onSubmit() {
  fieldErrors.value = {}
  formError.value = null

  const payload = {
    ...state,
    phone: state.phone && String(state.phone).trim() !== '' ? state.phone : null,
  }

  const parsed = storeBaseSchema.safeParse(payload)
  if (!parsed.success) {
    const errors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.')
      if (!errors[key]) errors[key] = issue.message
    }
    fieldErrors.value = errors
    formError.value = '入力内容を確認してください'
    return
  }

  submitting.value = true
  try {
    await $fetch(`/api/admin/stores/${id}`, { method: 'PATCH', body: parsed.data })
    await navigateTo('/dashboard/stores')
  }
  catch (e) {
    const err = e as { statusMessage?: string, data?: { statusMessage?: string } }
    formError.value = err.data?.statusMessage || err.statusMessage || '保存に失敗しました'
  }
  finally {
    submitting.value = false
  }
}

async function onDelete() {
  if (!confirm(`店舗「${state.name}」を無効化しますか？\n（データは残り、一覧の「無効」フィルタから復活できます）`)) return
  deleting.value = true
  try {
    await $fetch(`/api/admin/stores/${id}`, { method: 'DELETE' })
    await navigateTo('/dashboard/stores')
  }
  catch (e) {
    const err = e as { statusMessage?: string, data?: { statusMessage?: string } }
    formError.value = err.data?.statusMessage || err.statusMessage || '無効化に失敗しました'
  }
  finally {
    deleting.value = false
  }
}
</script>

<template>
  <div>
    <div class="flex items-center gap-3 mb-1">
      <h1 class="text-2xl font-semibold text-slate-900">
        {{ store?.name }}
      </h1>
      <span
        v-if="store && !store.isActive"
        class="inline-flex items-center text-xs text-slate-700 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded-sm"
      >
        無効
      </span>
    </div>
    <p class="text-sm text-slate-600 mb-4">
      <NuxtLink to="/dashboard/stores" class="text-blue-700 hover:text-blue-900 hover:underline">
        ← 店舗一覧に戻る
      </NuxtLink>
    </p>

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

    <UAlert
      v-if="formError"
      color="error"
      icon="i-lucide-triangle-alert"
      :title="formError"
      class="mb-4"
    />

    <!-- 基本情報タブ -->
    <form v-show="activeTab === 'basic'" class="space-y-4" @submit.prevent="onSubmit">
      <AdminStoreFormFields
        :state="state"
        :field-errors="fieldErrors"
      />

      <div class="flex items-center justify-between pt-2">
        <div class="flex items-center gap-2">
          <button
            type="submit"
            :disabled="submitting || deleting"
            class="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-sm font-semibold rounded-sm shadow-sm"
          >
            {{ submitting ? '保存中...' : '更新' }}
          </button>
          <NuxtLink
            to="/dashboard/stores"
            class="px-4 py-2 border border-[#8c8f94] bg-white hover:bg-[#f6f7f7] text-slate-700 text-sm rounded-sm"
          >
            キャンセル
          </NuxtLink>
        </div>

        <button
          v-if="state.isActive"
          type="button"
          :disabled="submitting || deleting"
          class="px-3 py-1.5 text-sm text-red-700 hover:text-red-900 hover:underline disabled:text-slate-400"
          @click="onDelete"
        >
          {{ deleting ? '無効化中...' : 'この店舗を無効化（ゴミ箱）' }}
        </button>
      </div>
    </form>

    <!-- ベッドタブ -->
    <div v-show="activeTab === 'beds'">
      <AdminStoreBedsTab v-if="activeTab === 'beds'" :store-id="id" />
    </div>

    <!-- メニュータブ -->
    <div v-show="activeTab === 'menus'">
      <AdminStoreMenusTab v-if="activeTab === 'menus'" :store-id="id" />
    </div>

    <!-- 営業時間タブ -->
    <div v-show="activeTab === 'hours'">
      <AdminScheduleBusinessHoursPanel v-if="activeTab === 'hours'" :store-id="id" />
    </div>

    <!-- 店休日タブ -->
    <div v-show="activeTab === 'holidays'">
      <AdminScheduleHolidaysPanel v-if="activeTab === 'holidays'" :store-id="id" />
    </div>
  </div>
</template>
