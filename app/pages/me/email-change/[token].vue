<script setup lang="ts">
// マイページ: メアド変更確定（リンククリック後の処理）

definePageMeta({ middleware: 'member-auth' })
useHead({ title: 'メールアドレス変更の確認 | マイページ' })

const route = useRoute()
const token = computed(() => String(route.params.token ?? ''))
const { refresh: refreshMember } = useMember()

const status = ref<'loading' | 'success' | 'error'>('loading')
const errorMessage = ref<string | null>(null)

onMounted(async () => {
  if (!token.value) {
    status.value = 'error'
    errorMessage.value = 'トークンが指定されていません。'
    return
  }
  try {
    await $fetch('/api/member/email-change/confirm', {
      method: 'POST',
      body: { token: token.value },
    })
    await refreshMember()
    status.value = 'success'
  }
  catch (e) {
    const err = e as { statusMessage?: string, data?: { statusMessage?: string } }
    errorMessage.value = err.data?.statusMessage || err.statusMessage || 'メールアドレス変更に失敗しました'
    status.value = 'error'
  }
})
</script>

<template>
  <div class="mx-auto max-w-md px-4 sm:px-6 py-12">
    <div v-if="status === 'loading'" class="text-center text-slate-600">
      <UIcon name="i-lucide-loader-circle" class="size-10 mx-auto animate-spin text-orange-500 mb-3" />
      <p>変更を確定しています...</p>
    </div>

    <div v-else-if="status === 'success'" class="rounded-xl border-2 border-green-300 bg-green-50 p-6 text-center">
      <UIcon name="i-lucide-circle-check" class="size-12 text-green-600 mx-auto mb-3" />
      <h1 class="text-lg font-bold text-slate-900 mb-2">
        メールアドレスを変更しました
      </h1>
      <p class="text-sm text-slate-700 leading-relaxed">
        次回からはこの新しいメールアドレスでログインしてください。
      </p>
      <NuxtLink
        to="/me"
        class="inline-block mt-5 px-4 py-2 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-md transition"
      >
        マイページへ
      </NuxtLink>
    </div>

    <div v-else class="rounded-xl border-2 border-red-300 bg-red-50 p-6 text-center">
      <UIcon name="i-lucide-circle-alert" class="size-12 text-red-600 mx-auto mb-3" />
      <h1 class="text-lg font-bold text-slate-900 mb-2">
        変更に失敗しました
      </h1>
      <p class="text-sm text-slate-700 leading-relaxed">
        {{ errorMessage }}
      </p>
      <NuxtLink to="/me/email-change" class="inline-block mt-5 text-sm text-orange-700 underline hover:text-orange-800">
        メールアドレス変更をやり直す
      </NuxtLink>
    </div>
  </div>
</template>
