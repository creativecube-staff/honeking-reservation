<script setup lang="ts">
import { createStoreSchema, type CreateStoreInput } from '~~/shared/schemas/store'

definePageMeta({ layout: 'admin' })

const state = reactive<CreateStoreInput>({
  slug: '',
  prefecture: '',
  city: '',
  name: '',
  address: '',
  phone: '',
  email: '',
  displayOrder: 0,
  isActive: true,
})

const fieldErrors = ref<Record<string, string>>({})
const formError = ref<string | null>(null)
const submitting = ref(false)

// 作成完了後に 1 回だけ表示する自動発行ログイン情報（平文パスワードを含む）
type CreatedAccount = { username: string, password: string }
const createdAccount = ref<CreatedAccount | null>(null)
const copied = ref(false)

async function onSubmit() {
  fieldErrors.value = {}
  formError.value = null

  // phone は空文字なら null として送る
  const payload = {
    ...state,
    phone: state.phone && String(state.phone).trim() !== '' ? state.phone : null,
    email: state.email && String(state.email).trim() !== '' ? state.email : null,
  }

  const parsed = createStoreSchema.safeParse(payload)
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
    // 作成成功時はレスポンスに自動発行されたログイン情報が入る。すぐ遷移せずモーダルで控えてもらう。
    const res = await $fetch<{ account: CreatedAccount }>('/api/admin/stores', { method: 'POST', body: parsed.data })
    createdAccount.value = res.account
  }
  catch (e) {
    const err = e as { statusMessage?: string, data?: { statusMessage?: string } }
    formError.value = err.data?.statusMessage || err.statusMessage || '登録に失敗しました'
  }
  finally {
    submitting.value = false
  }
}

// ログイン情報を控え終えたら店舗一覧へ
function finishCreate() {
  navigateTo('/dashboard/stores')
}

// ログイン情報をクリップボードへコピー（ブラウザ API は script 側で扱う）
async function copyCredentials() {
  if (!createdAccount.value || !import.meta.client) return
  const text = `ログインID: ${createdAccount.value.username}\nパスワード: ${createdAccount.value.password}`
  try {
    await navigator.clipboard.writeText(text)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }
  catch {
    // クリップボード権限がない環境では何もしない（手で控えてもらう）
  }
}
</script>

<template>
  <div>
    <div class="flex items-center gap-3 mb-1">
      <h1 class="text-2xl font-semibold text-slate-900">
        新規店舗を追加
      </h1>
    </div>
    <p class="text-sm text-slate-600 mb-4">
      <NuxtLink to="/dashboard/stores" class="text-blue-700 hover:text-blue-900 hover:underline">
        ← 店舗一覧に戻る
      </NuxtLink>
    </p>

    <UAlert
      v-if="formError"
      color="error"
      icon="i-lucide-triangle-alert"
      :title="formError"
      class="mb-4"
    />

    <form class="space-y-4" @submit.prevent="onSubmit">
      <AdminStoreFormFields
        :state="state"
        :field-errors="fieldErrors"
        @update:state="(v) => Object.assign(state, v)"
      />

      <div class="flex items-center gap-2 pt-2">
        <button
          type="submit"
          :disabled="submitting"
          class="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-sm font-semibold rounded-sm shadow-sm"
        >
          {{ submitting ? '保存中...' : '保存' }}
        </button>
        <NuxtLink
          to="/dashboard/stores"
          class="px-4 py-2 border border-[#8c8f94] bg-white hover:bg-[#f6f7f7] text-slate-700 text-sm rounded-sm"
        >
          キャンセル
        </NuxtLink>
      </div>
    </form>

    <!-- 作成完了: 自動発行したログイン情報を 1 回だけ表示する -->
    <div v-if="createdAccount" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div class="bg-white rounded-md shadow-xl max-w-md w-full">
        <div class="px-5 py-4 border-b border-slate-200">
          <h2 class="text-lg font-semibold text-slate-900">
            店舗を作成しました
          </h2>
          <p class="text-sm text-slate-600 mt-0.5">
            この店舗のログイン情報です。<span class="font-semibold text-red-700">パスワードはこの画面でしか表示されません。</span>必ず控えてください。
          </p>
        </div>
        <div class="px-5 py-4 space-y-3">
          <div>
            <p class="text-xs text-slate-500 mb-1">
              ログイン ID
            </p>
            <p class="font-mono text-sm bg-slate-50 border border-slate-200 rounded-sm px-3 py-2 select-all">
              {{ createdAccount.username }}
            </p>
          </div>
          <div>
            <p class="text-xs text-slate-500 mb-1">
              パスワード
            </p>
            <p class="font-mono text-base bg-slate-50 border border-slate-200 rounded-sm px-3 py-2 select-all tracking-wide">
              {{ createdAccount.password }}
            </p>
          </div>
          <button
            type="button"
            class="text-sm text-blue-700 hover:text-blue-900 hover:underline"
            @click="copyCredentials"
          >
            {{ copied ? 'コピーしました ✓' : 'ログイン情報をコピー' }}
          </button>
        </div>
        <div class="px-5 py-3 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            class="px-4 py-2 text-sm rounded-sm text-white bg-orange-500 hover:bg-orange-600 font-semibold"
            @click="finishCreate"
          >
            控えました・店舗一覧へ
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
