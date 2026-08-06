-- CreateEnum
CREATE TYPE "IncomeTaxComputationMode" AS ENUM ('PROJECTED', 'FINAL');

-- CreateTable
CREATE TABLE "IncomeTaxComputationGeneration" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "financialYear" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedById" INTEGER NOT NULL,
    "regime" "TaxRegime" NOT NULL,
    "mode" "IncomeTaxComputationMode" NOT NULL,
    "monthsElapsed" INTEGER NOT NULL,
    "grossSalary" DOUBLE PRECISION NOT NULL,
    "standardDeduction" DOUBLE PRECISION NOT NULL,
    "hraExemption" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "section80C" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "section80D" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "homeLoanInterest" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxableSalary" DOUBLE PRECISION NOT NULL,
    "otherIncomeSavingsInterest" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherIncomeFDInterest" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalIncome" DOUBLE PRECISION NOT NULL,
    "totalIncomeRounded" DOUBLE PRECISION NOT NULL,
    "slabTax" DOUBLE PRECISION NOT NULL,
    "rebate87A" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cess" DOUBLE PRECISION NOT NULL,
    "totalTaxLiability" DOUBLE PRECISION NOT NULL,
    "tdsDeductedSoFar" DOUBLE PRECISION NOT NULL,
    "taxPayable" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxRefundable" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "IncomeTaxComputationGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IncomeTaxComputationGeneration_userId_financialYear_idx" ON "IncomeTaxComputationGeneration"("userId", "financialYear");

-- AddForeignKey
ALTER TABLE "IncomeTaxComputationGeneration" ADD CONSTRAINT "IncomeTaxComputationGeneration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeTaxComputationGeneration" ADD CONSTRAINT "IncomeTaxComputationGeneration_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
