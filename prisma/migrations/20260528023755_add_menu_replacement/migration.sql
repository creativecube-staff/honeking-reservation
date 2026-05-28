-- AlterTable
ALTER TABLE "Menu" ADD COLUMN     "replacesMenuId" INTEGER;

-- AddForeignKey
ALTER TABLE "Menu" ADD CONSTRAINT "Menu_replacesMenuId_fkey" FOREIGN KEY ("replacesMenuId") REFERENCES "Menu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
