-- CreateEnum
CREATE TYPE "ResidentialStatus" AS ENUM ('RESIDENT', 'NON_RESIDENT', 'RESIDENT_NOT_ORDINARILY_RESIDENT');

-- AlterTable
ALTER TABLE "SalaryStructureHistory" RENAME CONSTRAINT "SalaryCtcHistory_pkey" TO "SalaryStructureHistory_pkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "micrCode" TEXT,
ADD COLUMN     "residentialAddress" TEXT,
ADD COLUMN     "residentialStatus" "ResidentialStatus",
ADD COLUMN     "wardNo" TEXT;

-- CreateTable
CREATE TABLE "TaxDeclaration" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "financialYear" INTEGER NOT NULL,
    "rentPaidAnnual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isMetroCity" BOOLEAN NOT NULL DEFAULT false,
    "section80C" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "section80D" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "homeLoanInterest" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherIncomeSavingsInterest" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherIncomeFDInterest" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "recordedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxDeclaration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaxDeclaration_userId_idx" ON "TaxDeclaration"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TaxDeclaration_userId_financialYear_key" ON "TaxDeclaration"("userId", "financialYear");

-- RenameForeignKey
ALTER TABLE "SalaryStructureHistory" RENAME CONSTRAINT "SalaryCtcHistory_recordedById_fkey" TO "SalaryStructureHistory_recordedById_fkey";

-- RenameForeignKey
ALTER TABLE "SalaryStructureHistory" RENAME CONSTRAINT "SalaryCtcHistory_userId_fkey" TO "SalaryStructureHistory_userId_fkey";

-- AddForeignKey
ALTER TABLE "TaxDeclaration" ADD CONSTRAINT "TaxDeclaration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxDeclaration" ADD CONSTRAINT "TaxDeclaration_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "SalaryCtcHistory_userId_effectiveFrom_idx" RENAME TO "SalaryStructureHistory_userId_effectiveFrom_idx";
