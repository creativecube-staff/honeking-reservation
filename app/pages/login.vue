<script setup lang="ts">
// 共有ログインページ。ホスト名で会員ログイン / スタッフログインを切替える。
// - reserve.honeking.* → 会員ログイン（お客様向け）
// - admin.honeking.*   → スタッフログイン（管理画面向け）
//
// 1 ファイルでホスト判定するため、layout も両者で全く違う（admin はカード型、会員はノーマル）。
// それぞれの中身はコンポーネントに切り出し済み。
const url = useRequestURL()
const isAdminHost = computed(() => url.hostname.startsWith('admin.'))

// admin ホストでは default layout を無効化（admin は独自カードレイアウト）
definePageMeta({ layout: false })

useHead({
  title: isAdminHost.value
    ? 'ログイン | honeking 管理画面'
    : 'ログイン | ほねキング整骨院 予約',
})
</script>

<template>
  <NuxtLayout v-if="!isAdminHost" name="default">
    <LoginMemberLoginForm />
  </NuxtLayout>
  <LoginStaffLoginForm v-else />
</template>
