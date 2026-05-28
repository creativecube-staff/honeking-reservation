/*
  Warnings:

  - You are about to drop the `Closure` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Closure" DROP CONSTRAINT "Closure_storeId_fkey";

-- DropTable
DROP TABLE "Closure";
