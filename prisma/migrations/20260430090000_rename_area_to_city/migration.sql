-- area カラムを city にリネーム（粒度を駅・地区名 → 市区町村に変更）
-- 値は seed で再投入されるため、ここでは構造のみ変更
ALTER TABLE "Store" RENAME COLUMN "area" TO "city";
