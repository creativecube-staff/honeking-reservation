-- 既存メニュー（5 メニュー × 2 店舗 = 10 行）を一旦削除し、seed で「共通メニュー 5 つ」を再投入する。
-- Reservation が 1 件もないことを事前確認済（FK 衝突なし）。
DELETE FROM "Menu";

-- AlterTable: storeId を nullable に変更
ALTER TABLE "Menu" ALTER COLUMN "storeId" DROP NOT NULL;

-- 共通メニュー（storeId IS NULL）の name 重複防止用の部分 unique index。
-- 既存の @@unique([storeId, name]) は (NULL, name) 同士を重複扱いしないため、別途必要。
CREATE UNIQUE INDEX "Menu_common_name_unique" ON "Menu"("name") WHERE "storeId" IS NULL;
