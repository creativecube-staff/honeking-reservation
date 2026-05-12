// シフト管理画面で「店舗ごとの折りたたみ/表示」状態を保持する composable。
// 日ビュー（アコーディオン）、週ビュー（アコーディオン）、月ビュー（チップフィルター）で
// 同じ状態を共有する。
//
// 注意: useState のシリアライズは JSON.stringify を通すので Set はそのままだと壊れる。
// 内部は number[] で持ち、参照は Set にした computed 経由で行う。

const STORAGE_KEY = 'honeking-shifts-collapsed-stores'

function loadFromStorage(): number[] {
  if (import.meta.server) return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x: unknown): x is number => typeof x === 'number')
  }
  catch {
    return []
  }
}

function saveToStorage(ids: number[]) {
  if (import.meta.server) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  }
  catch {
    // QuotaExceeded 等は無視（ベストエフォート）
  }
}

export function useShiftStoreCollapse() {
  const collapsedIds = useState<number[]>('shift-store-collapsed', () => [])
  const collapsedSet = computed(() => new Set(collapsedIds.value))

  // クライアントマウント時に localStorage から復元
  onMounted(() => {
    collapsedIds.value = loadFromStorage()
  })

  function isCollapsed(storeId: number): boolean {
    return collapsedSet.value.has(storeId)
  }

  function toggle(storeId: number) {
    const set = new Set(collapsedIds.value)
    if (set.has(storeId)) {
      set.delete(storeId)
    }
    else {
      set.add(storeId)
    }
    const next = Array.from(set)
    collapsedIds.value = next
    saveToStorage(next)
  }

  function expandAll() {
    collapsedIds.value = []
    saveToStorage([])
  }

  function collapseAll(storeIds: number[]) {
    const unique = Array.from(new Set(storeIds))
    collapsedIds.value = unique
    saveToStorage(unique)
  }

  return {
    collapsed: collapsedSet,
    isCollapsed,
    toggle,
    expandAll,
    collapseAll,
  }
}
