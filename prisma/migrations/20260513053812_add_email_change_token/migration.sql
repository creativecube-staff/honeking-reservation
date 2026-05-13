-- CreateTable
CREATE TABLE "EmailChangeToken" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "newEmail" TEXT NOT NULL,
    "newEmailHash" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailChangeToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailChangeToken_token_key" ON "EmailChangeToken"("token");

-- CreateIndex
CREATE INDEX "EmailChangeToken_customerId_idx" ON "EmailChangeToken"("customerId");

-- CreateIndex
CREATE INDEX "EmailChangeToken_newEmailHash_idx" ON "EmailChangeToken"("newEmailHash");

-- AddForeignKey
ALTER TABLE "EmailChangeToken" ADD CONSTRAINT "EmailChangeToken_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
