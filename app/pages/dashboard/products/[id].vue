<script setup lang="ts">
import type { Store } from '@prisma/client'
import { updateProductSchema } from '~~/shared/schemas/product'

definePageMeta({ layout: 'admin', requirePermission: 'product:edit' })

const route = useRoute()
const id = Number(route.params.id)

type ProductDetail = {
  id: number
  storeId: number | null
  kind: 'PRODUCT' | 'VOUCHER'
  name: string
  description: string | null
  priceJpy: number
  stock: number
  voucherTotalUses: number | null
  isActive: boolean
  displayOrder: number
  store: { id: number, name: string, slug: string } | null
  createdAt: string
  updatedAt: string
}

const { data: product, refresh, error: loadError } = await useFetch<ProductDetail>(`/api/admin/products/${id}`)
if (loadError.value) {
  throw createError({ statusCode: 404, statusMessage: '商品が見つかりません' })
}

const { data: stores } = await useFetch<Store[]>('/api/admin/stores', { query: { status: 'active' } })

const state = reactive({
  storeId: product.value!.storeId,
  name: product.value!.name,
  description: product.value!.description ?? '',
  priceJpy: product.value!.priceJpy,
  voucherTotalUses: product.value!.voucherTotalUses,
  isActive: product.value!.isActive,
  displayOrder: product.value!.displayOrder,
})

const fieldErrors = ref<Record<string, string>>({})
const formError = ref<string | null>(null)
const formSuccess = ref<string | null>(null)
const submitting = ref(false)

async function onSubmit() {
  fieldErrors.value = {}
  formError.value = null
  formSuccess.value = null

  const parsed = updateProductSchema.safeParse(state)
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
    await $fetch(`/api/admin/products/${id}`, { method: 'PATCH', body: parsed.data })
    formSuccess.value = '保存しました'
    await refresh()
  }
  catch (e) {
    const err = e as { statusMessage?: string, data?: { statusMessage?: string } }
    formError.value = err.data?.statusMessage || err.statusMessage || '保存に失敗しました'
  }
  finally {
    submitting.value = false
  }
}

// 在庫調整
const stockDelta = ref<number>(1)
const stockNote = ref('')
const stockError = ref<string | null>(null)
const stockSubmitting = ref(false)

async function adjustStock(direction: 1 | -1) {
  stockError.value = null
  if (!Number.isInteger(stockDelta.value) || stockDelta.value === 0) {
    stockError.value = '増減量は 0 以外の整数を指定してください'
    return
  }
  const delta = Math.abs(stockDelta.value) * direction
  stockSubmitting.value = true
  try {
    await $fetch(`/api/admin/products/${id}/stock`, { method: 'POST', body: { delta, note: stockNote.value || undefined } })
    stockNote.value = ''
    await refresh()
  }
  catch (e) {
    const err = e as { statusMessage?: string, data?: { statusMessage?: string } }
    stockError.value = err.data?.statusMessage || err.statusMessage || '在庫調整に失敗しました'
  }
  finally {
    stockSubmitting.value = false
  }
}

function yen(n: number): string { return n.toLocaleString('ja-JP') }
</script>

<template>
  <div>
    <AdminDetailHeader :title="product?.name" back-to="/dashboard/products" back-label="商品一覧に戻る">
      <span class="inline-flex items-center text-xs px-2 py-0.5 rounded-sm border" :class="product?.kind === 'VOUCHER' ? 'bg-purple-50 text-purple-800 border-purple-300' : 'bg-slate-100 text-slate-700 border-slate-300'">
        {{ product?.kind === 'VOUCHER' ? '回数券' : '物販' }}
      </span>
      <span v-if="product && !product.isActive" class="inline-flex items-center text-xs text-slate-700 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded-sm">
        無効
      </span>
    </AdminDetailHeader>

    <div v-if="product" class="max-w-2xl space-y-8">
      <!-- 基本情報フォーム -->
      <div>
        <UAlert v-if="formError" color="error" icon="i-lucide-triangle-alert" :title="formError" class="mb-3" />
        <UAlert v-if="formSuccess" color="success" icon="i-lucide-check" :title="formSuccess" class="mb-3" />

        <form class="space-y-5" @submit.prevent="onSubmit">
          <div>
            <label class="block text-sm font-semibold text-slate-900 mb-1.5">商品名</label>
            <input
              v-model="state.name"
              type="text"
              class="w-full px-2.5 py-2 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500"
            >
            <p v-if="fieldErrors.name" class="text-xs text-red-700 mt-1">
              {{ fieldErrors.name }}
            </p>
          </div>

          <div>
            <label class="block text-sm font-semibold text-slate-900 mb-1.5">店舗</label>
            <select v-model.number="state.storeId" class="w-full px-2.5 py-2 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500">
              <option :value="null">
                共通（全店舗で販売）
              </option>
              <option v-for="store in stores ?? []" :key="store.id" :value="store.id">
                {{ store.name }} のみ
              </option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-semibold text-slate-900 mb-1.5">価格（円）</label>
            <input v-model.number="state.priceJpy" type="number" min="0" class="w-full px-2.5 py-2 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500">
          </div>

          <div v-if="product.kind === 'VOUCHER'">
            <label class="block text-sm font-semibold text-slate-900 mb-1.5">利用可能回数</label>
            <input v-model.number="state.voucherTotalUses" type="number" min="1" class="w-full px-2.5 py-2 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500">
            <p class="text-xs text-slate-500 mt-1">
              既に販売済みの回数券には影響しません（販売時のスナップショットを使用）。
            </p>
          </div>

          <div>
            <label class="block text-sm font-semibold text-slate-900 mb-1.5">説明</label>
            <textarea v-model="state.description" rows="3" class="w-full px-2.5 py-2 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500" />
          </div>

          <div>
            <label class="block text-sm font-semibold text-slate-900 mb-1.5">表示順</label>
            <input v-model.number="state.displayOrder" type="number" min="0" class="w-32 px-2.5 py-2 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500">
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

      <!-- 在庫調整（物販のみ） -->
      <div v-if="product.kind === 'PRODUCT'" class="border-t border-[#c3c4c7] pt-6">
        <h2 class="text-lg font-semibold text-slate-900 mb-2">
          在庫調整
        </h2>
        <p class="text-sm text-slate-600 mb-3">
          現在の在庫: <strong class="text-2xl tabular-nums text-slate-900">{{ product.stock }}</strong>
        </p>

        <UAlert v-if="stockError" color="error" icon="i-lucide-triangle-alert" :title="stockError" class="mb-3" />

        <div class="flex items-end gap-2 flex-wrap">
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">数量</label>
            <input
              v-model.number="stockDelta"
              type="number"
              min="1"
              class="w-24 px-2.5 py-2 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500"
            >
          </div>
          <div class="flex-1 min-w-[200px]">
            <label class="block text-xs font-semibold text-slate-700 mb-1">理由メモ（任意）</label>
            <input
              v-model="stockNote"
              type="text"
              placeholder="例: 入荷 / 棚卸し補正"
              class="w-full px-2.5 py-2 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500"
            >
          </div>
          <button type="button" :disabled="stockSubmitting" class="px-3 py-2 text-sm rounded-sm border border-green-300 bg-green-50 hover:bg-green-100 text-green-800 disabled:opacity-50" @click="adjustStock(1)">
            + 増やす
          </button>
          <button type="button" :disabled="stockSubmitting" class="px-3 py-2 text-sm rounded-sm border border-red-300 bg-red-50 hover:bg-red-100 text-red-800 disabled:opacity-50" @click="adjustStock(-1)">
            − 減らす
          </button>
        </div>
        <p class="text-xs text-slate-500 mt-2">
          ※ 販売時は自動で減ります。ここでは入荷・棚卸し補正用の手動調整を行います。
        </p>
      </div>
    </div>
  </div>
</template>
