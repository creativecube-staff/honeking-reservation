<script setup lang="ts">
// Step A 用の仮ダッシュボード。Step C で概要ウィジェット（店舗数・施術者数等）を実装する。
definePageMeta({ layout: 'admin' })

const { user } = useUserSession()
</script>

<template>
  <div>
    <h1 class="text-2xl font-semibold text-slate-900 mb-2">
      ダッシュボード
    </h1>
    <p class="text-sm text-slate-700 mb-6">
      ようこそ、{{ user?.username ?? '' }} さん。
    </p>

    <div class="bg-white border border-[#c3c4c7] rounded-sm p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <p class="text-sm text-slate-700">
        概要ウィジェット（店舗数・ベッド数・施術者数・メニュー数）は <strong>Step C</strong> で実装予定です。
      </p>
      <p class="text-sm text-slate-700 mt-2">
        左メニューから各管理画面へ遷移できます（中身は Step D 以降で実装）。
      </p>
    </div>
  </div>
</template>
