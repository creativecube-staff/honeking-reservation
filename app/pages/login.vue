<script setup lang="ts">
// 共有ログインページ。ホスト名で会員ログイン / スタッフログインを切替える。
// - reserve.honeking.* → 会員ログイン（お客様向け）
// - admin.honeking.*   → スタッフログイン（管理画面向け）
//
// 1 ファイルでホスト判定するため、layout も両者で全く違う（admin はカード型、会員はノーマル）。
// それぞれの中身はコンポーネントに切り出し済み。
const url = useRequestURL()
// TEMP(LAN動作確認用): IP 直アクセスもスタッフフォーム扱い。戻すときは `git checkout app/pages/login.vue`
const isAdminHost = computed(() => {
  const h = url.hostname
  return h.startsWith('admin.') || /^\d{1,3}(\.\d{1,3}){3}$/.test(h)
})

// admin ホストでは default layout を無効化（admin は独自カードレイアウト）
definePageMeta({ layout: false })

// admin ホストでは admin layout が適用されないため、ここでモノクロファビコンを直接指定する。
// admin layout の指定とパスを揃えること(public/admin-favicon-*.png)。
useHead({
  title: isAdminHost.value
    ? 'ログイン | honeking 管理画面'
    : 'ログイン | ほねキング整骨院 予約',
  link: isAdminHost.value
    ? [
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/admin-favicon-32.png' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/admin-favicon-32.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/admin-favicon-180.png' },
      ]
    : [],
})
</script>

<template>
  <NuxtLayout v-if="!isAdminHost" name="default">
    <LoginMemberLoginForm />
  </NuxtLayout>
  <LoginStaffLoginForm v-else />
</template>
