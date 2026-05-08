-- AlterTable
ALTER TABLE "Shift" ADD COLUMN     "workStoreId" INTEGER;

-- CreateIndex
CREATE INDEX "Shift_workStoreId_date_idx" ON "Shift"("workStoreId", "date");

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_workStoreId_fkey" FOREIGN KEY ("workStoreId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
