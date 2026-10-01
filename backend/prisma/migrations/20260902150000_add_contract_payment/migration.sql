-- CreateTable
CREATE TABLE "ContractPaymentStructure" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "grossPayment" DOUBLE PRECISION NOT NULL,
    "tdsRatePercent" DOUBLE PRECISION NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" INTEGER,

    CONSTRAINT "ContractPaymentStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractPayment" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "grossPayment" DOUBLE PRECISION NOT NULL,
    "tdsRatePercent" DOUBLE PRECISION NOT NULL,
    "tdsAmount" DOUBLE PRECISION NOT NULL,
    "netPayment" DOUBLE PRECISION NOT NULL,
    "pdfUrl" TEXT,
    "generatedById" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContractPaymentStructure_userId_effectiveFrom_idx" ON "ContractPaymentStructure"("userId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "ContractPayment_userId_idx" ON "ContractPayment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractPayment_userId_month_year_key" ON "ContractPayment"("userId", "month", "year");

-- AddForeignKey
ALTER TABLE "ContractPaymentStructure" ADD CONSTRAINT "ContractPaymentStructure_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractPaymentStructure" ADD CONSTRAINT "ContractPaymentStructure_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractPayment" ADD CONSTRAINT "ContractPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractPayment" ADD CONSTRAINT "ContractPayment_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
