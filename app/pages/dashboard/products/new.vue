<script setup lang="ts">
import { createProductSchema } from '~~/shared/schemas/product'

definePageMeta({ layout: 'admin', requirePermission: 'product:edit' })

// 登録先は店舗スイッチャーのコンテキストで決まる:
// 管理者(全店)モード = 共通商品（storeId=null）/ 店舗モード = その店の店舗特別商品。
const { selectedStoreId, canAccessAll, selectedStoreName } = useStoreContext()
const isAdminView = computed(() => canAccessAll.value && selectedStoreId.value === null)

const state = reactive({
  storeId: null as number | null,
  kind: 'PRODUCT' as 'PRODUCT' | 'VOUCHER',
  name: '',
  description: '',
  priceJpy: 0,
  stock: 0,
  voucherTotalUses: null as number | null,
  isActive: true,
  displayOrder: 0,
})

// コンテキストに応じて登録先 storeId を固定（管理者=共通=null / 店舗=その店）
watchEffect(() => {
  state.storeId = isAdminView.value ? null : selectedStoreId.value
})

const fieldErrors = ref<Record<string, string>>({})
const formError = ref<string | null>(null)
const submitting = ref(false)

async function onSubmit() {
  fieldErrors.value = {}
  formError.value = null

  const parsed = createProductSchema.safeParse(state)
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
    await $fetch('/api/admin/products', { method: 'POST', body: parsed.data })
    await navigateTo('/dashboard/products')
  }
  catch (e) {
    const err = e as { statusMessage?: string, data?: { statusMessage?: string } }
    formError.value = err.data?.statusMessage || err.statusMessage || '登録に失敗しました'
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <div>
    <div class="flex items-center gap-3 mb-1">
      <h1 class="text-2xl font-semibold text-slate-900">
        新規商品を追加
      </h1>
    </div>
    <p class="text-sm text-slate-600 mb-4">
      <NuxtLink to="/dashboard/products" class="text-blue-700 hover:text-blue-900 hover:underline">
        ← 商品一覧に戻る
      </NuxtLink>
    </p>

    <UAlert v-if="formError" color="error" icon="i-lucide-triangle-alert" :title="formError" class="mb-4" />

    <form class="space-y-5 max-w-2xl" @submit.prevent="onSubmit">
      <div>
        <label class="block text-sm font-semibold text-slate-900 mb-1.5">種別 <span class="text-red-600">*</span></label>
        <div class="flex gap-3">
          <label class="inline-flex items-center gap-2 text-sm">
            <input v-model="state.kind" type="radio" value="PRODUCT" class="h-4 w-4 text-orange-500">
            物販（在庫管理あり）
          </label>
          <label class="inline-flex items-center gap-2 text-sm">
            <input v-model="state.kind" type="radio" value="VOUCHER" class="h-4 w-4 text-orange-500">
            回数券
          </label>
        </div>
      </div>

      <div>
        <label class="block text-sm font-semibold text-slate-900 mb-1.5">商品名 <span class="text-red-600">*</span></label>
        <input
          v-model="state.name"
          type="text"
          placeholder="例: 腰用サポーター / 全身整体 10 回券"
          class="w-full px-2.5 py-2 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500"
        >
        <p v-if="fieldErrors.name" class="text-xs text-red-700 mt-1">
          {{ fieldErrors.name }}
        </p>
      </div>

      <div>
        <label class="block text-sm font-semibold text-slate-900 mb-1.5">登録先</label>
        <p class="text-sm text-slate-800 px-2.5 py-2 border border-[#dcdcde] rounded-sm bg-slate-50">
          {{ isAdminView ? '共通（全店舗で販売）' : `${selectedStoreName} のみ` }}
        </p>
        <p class="text-xs text-slate-500 mt-1">
          {{ isAdminView
            ? '管理者モードでは全店共通の商品として登録されます。店舗だけの商品は、ヘッダーで店舗を選んでから追加してください。'
            : 'この店舗だけで販売する店舗特別商品として登録されます。' }}
        </p>
      </div>

      <div>
        <label class="block text-sm font-semibold text-slate-900 mb-1.5">価格（円）<span class="text-red-600">*</span></label>
        <input
          v-model.number="state.priceJpy"
          type="number"
          min="0"
          class="w-full px-2.5 py-2 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500"
        >
        <p v-if="fieldErrors.priceJpy" class="text-xs text-red-700 mt-1">
          {{ fieldErrors.priceJpy }}
        </p>
      </div>

      <div v-if="state.kind === 'PRODUCT'">
        <label class="block text-sm font-semibold text-slate-900 mb-1.5">初期在庫数</label>
        <input
          v-model.number="state.stock"
          type="number"
          min="0"
          class="w-full px-2.5 py-2 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500"
        >
      </div>

      <div v-if="state.kind === 'VOUCHER'">
        <label class="block text-sm font-semibold text-slate-900 mb-1.5">利用可能回数 <span class="text-red-600">*</span></label>
        <input
          v-model.number="state.voucherTotalUses"
          type="number"
          min="1"
          placeholder="例: 10"
          class="w-full px-2.5 py-2 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500"
        >
        <p class="text-xs text-slate-500 mt-1">
          1 枚購入したら何回分の施術が受けられるか。
        </p>
        <p v-if="fieldErrors.voucherTotalUses" class="text-xs text-red-700 mt-1">
          {{ fieldErrors.voucherTotalUses }}
        </p>
      </div>

      <div>
        <label class="block text-sm font-semibold text-slate-900 mb-1.5">説明（任意）</label>
        <textarea
          v-model="state.description"
          rows="3"
          class="w-full px-2.5 py-2 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500"
        />
      </div>

      <div>
        <label class="block text-sm font-semibold text-slate-900 mb-1.5">表示順</label>
        <input
          v-model.number="state.displayOrder"
          type="number"
          min="0"
          class="w-32 px-2.5 py-2 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500"
        >
      </div>

      <div>
        <label class="inline-flex items-center gap-2 text-sm">
          <input v-model="state.isActive" type="checkbox" class="h-4 w-4 text-orange-500">
          有効にする
        </label>
      </div>

      <div class="flex items-center gap-2 pt-2">
        <button type="submit" :disabled="submitting" class="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-sm font-semibold rounded-sm">
          {{ submitting ? '保存中...' : '保存' }}
        </button>
        <NuxtLink to="/dashboard/products" class="px-4 py-2 border border-[#8c8f94] bg-white hover:bg-[#f6f7f7] text-slate-700 text-sm rounded-sm">
          キャンセル
        </NuxtLink>
      </div>
    </form>
  </div>
</template>
