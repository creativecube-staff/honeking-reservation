-- AlterTable: 一時 DEFAULT を付けて NOT NULL カラムを追加（既存行の NOT NULL 違反を回避）
ALTER TABLE "Store" ADD COLUMN "slug" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Store" ADD COLUMN "prefecture" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Store" ADD COLUMN "area" TEXT NOT NULL DEFAULT '';

-- 既存 2 店舗のデータを補填
UPDATE "Store"
  SET "slug" = 'otakanomori', "prefecture" = '千葉県', "area" = '流山おおたかの森'
WHERE "name" LIKE '%流山%';

UPDATE "Store"
  SET "slug" = 'matsudo-higashi', "prefecture" = '千葉県', "area" = '松戸'
WHERE "name" LIKE '%松戸%';

-- DEFAULT を解除（schema.prisma との整合性を保つ）
ALTER TABLE "Store" ALTER COLUMN "slug" DROP DEFAULT;
ALTER TABLE "Store" ALTER COLUMN "prefecture" DROP DEFAULT;
ALTER TABLE "Store" ALTER COLUMN "area" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "Store_slug_key" ON "Store"("slug");
