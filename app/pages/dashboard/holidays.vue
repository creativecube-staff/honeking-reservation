<script setup lang="ts">
// 管理者(全店)モード専用: 休日管理ページ。
// 全店共通の「店休日」と「祝日」を 1 ページに縦並びで集約する（タブなし）。
// - 店休日 (Holiday): 全店一括の追加・削除
// - 祝日 (PublicHoliday): 全店共通マスタの CRUD

definePageMeta({ layout: 'admin', requirePermission: 'store:view' })

useHead({ title: '休日管理' })
</script>

<template>
  <div class="holidays-page">
    <AdminDetailHeader
      title="休日管理"
      description="全店共通の店休日と、国民の祝日を管理します。"
    />

    <!-- ─────────────── 店休日（全店共通） ─────────────── -->
    <section class="space-y-3 mb-10">
      <h2 class="text-lg font-semibold text-slate-900">
        店休日
      </h2>
      <p class="text-sm text-slate-600">
        全店舗まとめて休業する日（年末年始・棚卸しなど）を登録します。登録した日は全店の予約枠がゼロになります。
      </p>
      <AdminScheduleHolidaysPanel />
    </section>

    <!-- ─────────────── 祝日（国民の祝日） ─────────────── -->
    <section class="space-y-3">
      <h2 class="text-lg font-semibold text-slate-900">
        祝日
      </h2>
      <p class="text-sm text-slate-600">
        国民の祝日を登録します。各店舗の「営業時間」タブで「祝」レンジを設定していればそれを、未設定なら日曜と同じ営業時間で運用されます。
      </p>
      <AdminPublicHolidaysPanel />
    </section>
  </div>
</template>
