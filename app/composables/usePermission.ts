// 管理画面のクライアント側 permission ヘルパー。
// useUserSession の薄いラッパー。template で v-if に使うと reactive に再評価される。
import type { Permission } from '~~/shared/permissions'

/** 現在ログインしているユーザー（未ログインなら null）の reactive ref を返す。 */
export function useCurrentUser() {
  const { user } = useUserSession()
  return user
}

/** 指定 permission を持っているか。テンプレートで `v-if="hasPermission('reservation:edit')"` のように使う。 */
export function hasPermission(permission: Permission): boolean {
  const { user } = useUserSession()
  return user.value?.permissions?.includes(permission) ?? false
}
