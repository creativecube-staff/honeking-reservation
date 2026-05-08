-- メニューに表示期間（任意）を追加。
-- 予約対象日が [availableFrom, availableUntil] の範囲内のときのみお客様側に表示する。
-- 両方 NULL = 期間制限なし（既存の挙動）

ALTER TABLE "Menu" ADD COLUMN "availableFrom"  DATE;
ALTER TABLE "Menu" ADD COLUMN "availableUntil" DATE;

-- 両方指定されている場合のみ、開始日 <= 終了日 を保証
ALTER TABLE "Menu"
  ADD CONSTRAINT "menu_available_period_order"
  CHECK (
    "availableFrom" IS NULL
    OR "availableUntil" IS NULL
    OR "availableFrom" <= "availableUntil"
  );
