<script setup lang="ts">
// マイページ: 退会（確認 → 実行 → トップへリダイレクト）
// 退会後は session も破棄され、未ログイン状態でトップに戻る

definePageMeta({ middleware: 'member-auth' })
useHead({ title: '退会のお手続き | マイページ' })

const { refresh: refreshMember } = useMember()

const confirmed = ref(false)
const submitting = ref(false)
const errorMessage = ref<string | null>(null)

async function onWithdraw() {
  if (submitting.value) return
  submitting.value = true
  errorMessage.value = null
  try {
    await $fetch('/api/member/withdraw', { method: 'POST' })
    await refreshMember()
    await navigateTo('/?withdrew=1')
  }
  catch (e) {
    const err = e as { statusMessage?: string, data?: { statusMessage?: string } }
    errorMessage.value = err.data?.statusMessage || err.statusMessage || '退会処理に失敗しました'
    submitting.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 sm:px-6 py-8">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
        <UIcon name="i-lucide-user-x" class="size-6 text-red-500" />
        退会のお手続き
      </h1>
      <NuxtLink to="/me" class="text-sm text-slate-600 hover:text-orange-700 inline-flex items-center gap-1">
        <UIcon name="i-lucide-chevron-left" class="size-4" />
        マイページ
      </NuxtLink>
    </div>

    <div class="max-w-lg mx-auto">
      <UAlert
        v-if="errorMessage"
        color="error"
        icon="i-lucide-triangle-alert"
        :title="errorMessage"
        class="mb-4"
      />

      <div class="rounded-xl border-2 border-red-300 bg-red-50 p-5 mb-6">
        <h2 class="text-base sm:text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
          <UIcon name="i-lucide-triangle-alert" class="size-5 text-red-600" />
          退会前にご確認ください
        </h2>
        <ul class="list-disc list-inside text-sm sm:text-base text-slate-700 space-y-1.5">
          <li>会員機能(ログイン・会員予約・予約履歴閲覧)が利用できなくなります</li>
          <li>過去のご来店記録は店舗側で施術記録として保管されます</li>
          <li>すでに確定している今後のご予約は引き続き有効です</li>
          <li>同じメールアドレスで再度会員登録することが可能です</li>
        </ul>
        <p class="mt-3 text-xs text-slate-500">
          ※ 個人情報の完全削除をご希望の場合は、退会後に店舗までお電話ください。
        </p>
      </div>

      <label class="flex items-start gap-2 mb-5 text-sm text-slate-700">
        <input
          v-model="confirmed"
          type="checkbox"
          class="mt-1 size-4 border-slate-300 rounded text-red-500 focus:ring-red-500"
        >
        <span>上記の内容を理解した上で退会します</span>
      </label>

      <button
        type="button"
        :disabled="!confirmed || submitting"
        class="w-full inline-flex items-center justify-center gap-2 py-3.5 text-base font-bold text-white bg-red-600 hover:bg-red-700 disabled:bg-slate-300 rounded-lg shadow-sm transition cursor-pointer"
        @click="onWithdraw"
      >
        <UIcon
          :name="submitting ? 'i-lucide-loader-2' : 'i-lucide-user-x'"
          class="size-5"
          :class="submitting ? 'animate-spin' : ''"
        />
        {{ submitting ? '処理中…' : '退会する' }}
      </button>

      <div class="mt-4 text-center">
        <NuxtLink to="/me" class="text-sm text-slate-600 hover:text-orange-700 underline">
          やめてマイページに戻る
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
