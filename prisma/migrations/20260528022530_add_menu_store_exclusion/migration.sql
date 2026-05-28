-- CreateTable
CREATE TABLE "MenuStoreExclusion" (
    "menuId" INTEGER NOT NULL,
    "storeId" INTEGER NOT NULL,

    CONSTRAINT "MenuStoreExclusion_pkey" PRIMARY KEY ("menuId","storeId")
);

-- CreateIndex
CREATE INDEX "MenuStoreExclusion_storeId_idx" ON "MenuStoreExclusion"("storeId");

-- AddForeignKey
ALTER TABLE "MenuStoreExclusion" ADD CONSTRAINT "MenuStoreExclusion_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuStoreExclusion" ADD CONSTRAINT "MenuStoreExclusion_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
