-- CreateEnum
CREATE TYPE "ProductKind" AS ENUM ('PRODUCT', 'VOUCHER');

-- CreateTable
CREATE TABLE "Product" (
    "id" SERIAL NOT NULL,
    "storeId" INTEGER,
    "kind" "ProductKind" NOT NULL DEFAULT 'PRODUCT',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceJpy" INTEGER NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "voucherTotalUses" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSale" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "storeId" INTEGER NOT NULL,
    "customerId" INTEGER NOT NULL,
    "reservationId" INTEGER,
    "quantity" INTEGER NOT NULL,
    "unitPriceJpyAtSale" INTEGER NOT NULL,
    "soldAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "soldByPractitionerId" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerVoucher" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "productSaleId" INTEGER NOT NULL,
    "totalUses" INTEGER NOT NULL,
    "remainingUses" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerVoucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoucherUsage" (
    "id" SERIAL NOT NULL,
    "customerVoucherId" INTEGER NOT NULL,
    "reservationId" INTEGER NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoucherUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Product_storeId_idx" ON "Product"("storeId");

-- CreateIndex
CREATE INDEX "Product_kind_idx" ON "Product"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "Product_storeId_name_key" ON "Product"("storeId", "name");

-- CreateIndex
CREATE INDEX "ProductSale_storeId_soldAt_idx" ON "ProductSale"("storeId", "soldAt");

-- CreateIndex
CREATE INDEX "ProductSale_customerId_idx" ON "ProductSale"("customerId");

-- CreateIndex
CREATE INDEX "ProductSale_reservationId_idx" ON "ProductSale"("reservationId");

-- CreateIndex
CREATE INDEX "ProductSale_productId_idx" ON "ProductSale"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerVoucher_productSaleId_key" ON "CustomerVoucher"("productSaleId");

-- CreateIndex
CREATE INDEX "CustomerVoucher_customerId_idx" ON "CustomerVoucher"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "VoucherUsage_reservationId_key" ON "VoucherUsage"("reservationId");

-- CreateIndex
CREATE INDEX "VoucherUsage_customerVoucherId_idx" ON "VoucherUsage"("customerVoucherId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSale" ADD CONSTRAINT "ProductSale_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSale" ADD CONSTRAINT "ProductSale_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSale" ADD CONSTRAINT "ProductSale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSale" ADD CONSTRAINT "ProductSale_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSale" ADD CONSTRAINT "ProductSale_soldByPractitionerId_fkey" FOREIGN KEY ("soldByPractitionerId") REFERENCES "Practitioner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerVoucher" ADD CONSTRAINT "CustomerVoucher_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerVoucher" ADD CONSTRAINT "CustomerVoucher_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerVoucher" ADD CONSTRAINT "CustomerVoucher_productSaleId_fkey" FOREIGN KEY ("productSaleId") REFERENCES "ProductSale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherUsage" ADD CONSTRAINT "VoucherUsage_customerVoucherId_fkey" FOREIGN KEY ("customerVoucherId") REFERENCES "CustomerVoucher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherUsage" ADD CONSTRAINT "VoucherUsage_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
