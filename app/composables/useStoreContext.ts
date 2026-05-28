// 管理画面の「現在の店舗」コンテキスト。
// ヘッダーの店舗スイッチャーと、各操作系ページ（ダッシュボード等）が共有する。
//
// - selectedStoreId: 選択中の店舗 ID。null = 「全店舗」(OWNER のみ)
// - 選択は cookie(admin_store) で保持。'all' = 全店舗
// - OWNER 以外は所属店舗 1 件に固定される（store-context API が 1 件しか返さないため）
export type StoreOption = { id: number, name: string }

export function useStoreContext() {
  // アクセス可能な店舗一覧 + 全店可否
  const { data } = useFetch<{ canAccessAll: boolean, stores: StoreOption[] }>('/api/admin/store-context', {
    key: 'admin-store-context',
    default: () => ({ canAccessAll: false, stores: [] }),
  })
  const stores = computed<StoreOption[]>(() => data.value?.stores ?? [])
  const canAccessAll = computed(() => data.value?.canAccessAll ?? false)

  // 選択中店舗(null=全店)。cookie で永続化。
  const cookie = useCookie<string | null>('admin_store', {
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  })
  const selectedStoreId = useState<number | null>('admin-selected-store', () => {
    if (cookie.value === 'all') return null
    const n = Number(cookie.value)
    return Number.isInteger(n) && n > 0 ? n : null
  })

  // 店舗一覧が確定したら選択を正規化する。
  // - 全店不可(自店固定): アクセス可能な唯一の店舗に強制
  // - 全店可(OWNER): null=全店 はOK、店舗指定は存在チェックのみ
  watch([stores, canAccessAll], () => {
    const ids = stores.value.map(s => s.id)
    if (!canAccessAll.value) {
      const only = ids[0] ?? null
      if (selectedStoreId.value == null || !ids.includes(selectedStoreId.value)) {
        selectedStoreId.value = only
      }
    }
    else if (selectedStoreId.value != null && !ids.includes(selectedStoreId.value)) {
      selectedStoreId.value = null
    }
  }, { immediate: true })

  function setStore(id: number | null) {
    selectedStoreId.value = id
    cookie.value = id == null ? 'all' : String(id)
    // 店舗切替時はダッシュボードに戻す（現在表示中のページが切替後のスコープで意味を成さない可能性があるため）
    if (import.meta.client) navigateTo('/dashboard')
  }

  const selectedStoreName = computed(() => {
    if (selectedStoreId.value == null) return '管理者'
    return stores.value.find(s => s.id === selectedStoreId.value)?.name ?? ''
  })

  return { stores, canAccessAll, selectedStoreId, selectedStoreName, setStore }
}
