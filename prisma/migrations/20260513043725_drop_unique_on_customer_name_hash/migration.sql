-- DropIndex
DROP INDEX "Customer_nameHash_key";

-- CreateIndex
CREATE INDEX "Customer_nameHash_idx" ON "Customer"("nameHash");
