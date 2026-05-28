<script setup lang="ts">
import type { Store } from '@prisma/client'
import { storeBaseSchema, type StoreFormState } from '~~/shared/schemas/store'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const id = Number(route.params.id)
if (!Number.isInteger(id) || id <= 0) {
  throw createError({ statusCode: 400, statusMessage: '不正な ID です' })
}

const { data: store, error: loadError } = await useFetch<Store>(`/api/admin/stores/${id}`)
if (loadError.value) {
  throw createError({ statusCode: 404, statusMessage: '店舗が見つかりません' })
}

// 管理者(全店)モードの店舗設定。基本情報・ベッド・営業時間を 1 ページに縦並び（タブ廃止）。
// 保存は最下部の「更新」1 つに集約し、基本情報と営業時間の変更をまとめて保存する。
// （ベッドの追加・削除は操作即時反映で「更新」対象外。店舗特別メニュー/店休日は店舗モードで扱う）

const state = reactive<StoreFormState>({
  slug: store.value!.slug,
  prefecture: store.value!.prefecture,
  city: store.value!.city,
  name: store.value!.name,
  address: store.value!.address,
  phone: store.value!.phone ?? '',
  email: store.value!.email ?? '',
  displayOrder: store.value!.displayOrder,
  isActive: store.value!.isActive,
})

// 基本情報の変更検知用スナップショット
function snapshot(): string {
  return JSON.stringify({
    slug: state.slug,
    prefecture: state.prefecture,
    city: state.city,
    name: state.name,
    address: state.address,
    phone: state.phone ?? '',
    email: state.email ?? '',
    displayOrder: state.displayOrder,
    isActive: state.isActive,
  })
}
const baseline = ref(snapshot())
const basicDirty = computed(() => snapshot() !== baseline.value)

// 営業時間パネル（保存・リセットを親から制御。dirty は emit で受け取る）
const hoursPanel = ref<{ save: () => Promise<void>, reset: () => void } | null>(null)
const hoursDirty = ref(false)

// どこかに未保存変更があるか（「更新」ボタンの有効/無効に使う）
const anyDirty = computed(() => basicDirty.value || hoursDirty.value)

const fieldErrors = ref<Record<string, string>>({})
const formError = ref<string | null>(null)
const submitting = ref(false)
const deleting = ref(false)
const saved = ref(false)

// 更新: 基本情報と営業時間の変更をまとめて保存する
async function onUpdate() {
  if (!anyDirty.value || submitting.value) return
  fieldErrors.value = {}
  formError.value = null
  saved.value = false

  // 基本情報に変更があれば検証してペイロードを作る
  let basicPayload: Record<string, unknown> | null = null
  if (basicDirty.value) {
    const payload = {
      ...state,
      phone: state.phone && String(state.phone).trim() !== '' ? state.phone : null,
      email: state.email && String(state.email).trim() !== '' ? state.email : null,
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
    basicPayload = parsed.data
  }

  submitting.value = true
  try {
    if (basicPayload) {
      // 更新後の店舗を受け取り、見出し等の表示も最新に
      store.value = await $fetch<Store>(`/api/admin/stores/${id}`, { method: 'PATCH', body: basicPayload })
    }
    if (hoursDirty.value && hoursPanel.value) {
      await hoursPanel.value.save() // 失敗時は例外を投げる
    }
    // 成功: 基本情報のベースライン更新（営業時間側は内部 refresh で dirty が解除される）
    baseline.value = snapshot()
    saved.value = true
  }
  catch (e) {
    const err = e as { statusMessage?: string, message?: string, data?: { statusMessage?: string } }
    formError.value = err.data?.statusMessage || err.statusMessage || err.message || '保存に失敗しました'
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
  <div class="store-detail">
    <AdminDetailHeader :title="store?.name" back-to="/dashboard/stores" back-label="店舗一覧に戻る">
      <span
        v-if="store && !store.isActive"
        class="inline-flex items-center text-xs text-slate-700 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded-sm"
      >
        無効
      </span>
    </AdminDetailHeader>

    <!-- 基本情報。ベッド管理は FormFields のカード枠内（#extra スロット）に差し込む -->
    <section class="store-detail-basic mb-8">
      <AdminStoreFormFields
        :state="state"
        :field-errors="fieldErrors"
      >
        <template #extra>
          <!-- ベッド管理（基本情報の枠内・コンパクト表示。追加/削除は即時反映） -->
          <div class="store-detail-beds">
            <h3 class="store-detail-beds-title text-sm font-semibold text-slate-700 mb-2">
              ベッド
            </h3>
            <AdminStoreBedsTab :store-id="id" />
          </div>
        </template>
      </AdminStoreFormFields>
    </section>

    <!-- 営業時間（保存は下部の「更新」にまとめる） -->
    <section class="store-detail-hours mb-8">
      <h2 class="store-detail-hours-title text-lg font-semibold text-slate-900 mb-3">
        営業時間
      </h2>
      <AdminScheduleBusinessHoursPanel
        ref="hoursPanel"
        :store-id="id"
        @update:dirty="hoursDirty = $event"
      />
    </section>

    <!-- 下部アクションバー: 更新 / キャンセル / 無効化 -->
    <AdminDetailActions :error="formError">
      <button
        type="button"
        :disabled="submitting || deleting || !anyDirty"
        class="store-detail-update px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-sm shadow-sm"
        @click="onUpdate"
      >
        {{ submitting ? '保存中...' : '更新' }}
      </button>
      <NuxtLink
        to="/dashboard/stores"
        class="store-detail-cancel px-4 py-2 border border-[#8c8f94] bg-white hover:bg-[#f6f7f7] text-slate-700 text-sm rounded-sm"
      >
        キャンセル
      </NuxtLink>
      <span v-if="saved && !anyDirty" class="store-detail-saved text-sm text-green-700">
        ✓ 保存しました
      </span>
      <span v-else-if="anyDirty" class="store-detail-dirty text-sm text-slate-500">
        未保存の変更があります
      </span>

      <template #danger>
        <button
          v-if="state.isActive"
          type="button"
          :disabled="submitting || deleting"
          class="store-detail-deactivate px-3 py-1.5 text-sm text-red-700 hover:text-red-900 hover:underline disabled:text-slate-400"
          @click="onDelete"
        >
          {{ deleting ? '無効化中...' : 'この店舗を無効化（ゴミ箱）' }}
        </button>
      </template>
    </AdminDetailActions>
  </div>
</template>
