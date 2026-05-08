-- BusinessHour を「1 日 1 行（営業 + 休憩 1 つ）」から「1 日に複数のレンジを持てる」モデルへ作り直す。
-- 店休 = 該当 (storeId, dayOfWeek) の行が 0 件
-- 中抜け休憩 = 2 つのレンジで表現（例: 9:30-12:30, 15:00-20:30）

-- 1. 新カラムを nullable で追加
ALTER TABLE "BusinessHour" ADD COLUMN "startTime" TEXT;
ALTER TABLE "BusinessHour" ADD COLUMN "endTime" TEXT;

-- 2. 旧 unique を削除（複合 unique に置き換える）
DROP INDEX IF EXISTS "BusinessHour_storeId_dayOfWeek_key";

-- 3. 旧 index を削除
DROP INDEX IF EXISTS "BusinessHour_storeId_idx";

-- 4. データ移行 - 既存営業日の「最初のレンジ」: open〜breakStart（休憩なしなら open〜close）
UPDATE "BusinessHour"
SET "startTime" = "openTime",
    "endTime"   = COALESCE("breakStartTime", "closeTime")
WHERE "isClosed" = false
  AND "openTime"  IS NOT NULL
  AND "closeTime" IS NOT NULL;

-- 5. データ移行 - 休憩がある場合は「2 つ目のレンジ」を追加: breakEnd〜close
INSERT INTO "BusinessHour" ("storeId", "dayOfWeek", "startTime", "endTime", "isClosed", "createdAt", "updatedAt")
SELECT "storeId", "dayOfWeek", "breakEndTime", "closeTime", false, NOW(), NOW()
FROM "BusinessHour"
WHERE "isClosed" = false
  AND "breakStartTime" IS NOT NULL
  AND "breakEndTime"   IS NOT NULL
  AND "closeTime"      IS NOT NULL;

-- 6. 店休行（旧 isClosed=true / 時刻 NULL）を削除（新仕様では「行 0 件」で店休を表現）
DELETE FROM "BusinessHour"
WHERE "isClosed" = true
   OR "openTime"  IS NULL
   OR "closeTime" IS NULL;

-- 7. 旧カラムを削除
ALTER TABLE "BusinessHour" DROP COLUMN "openTime";
ALTER TABLE "BusinessHour" DROP COLUMN "closeTime";
ALTER TABLE "BusinessHour" DROP COLUMN "breakStartTime";
ALTER TABLE "BusinessHour" DROP COLUMN "breakEndTime";
ALTER TABLE "BusinessHour" DROP COLUMN "isClosed";

-- 8. NOT NULL 化
ALTER TABLE "BusinessHour" ALTER COLUMN "startTime" SET NOT NULL;
ALTER TABLE "BusinessHour" ALTER COLUMN "endTime"   SET NOT NULL;

-- 9. 新 unique（同一 storeId × dayOfWeek 内で startTime 重複を防ぐ）
CREATE UNIQUE INDEX "BusinessHour_storeId_dayOfWeek_startTime_key"
  ON "BusinessHour"("storeId", "dayOfWeek", "startTime");

-- 10. 新 index
CREATE INDEX "BusinessHour_storeId_dayOfWeek_idx"
  ON "BusinessHour"("storeId", "dayOfWeek");

-- 11. CHECK 制約: startTime < endTime
ALTER TABLE "BusinessHour"
  ADD CONSTRAINT "business_hour_time_order"
  CHECK ("startTime" < "endTime");
