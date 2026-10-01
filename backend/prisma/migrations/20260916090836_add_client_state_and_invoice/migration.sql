-- CreateEnum
CREATE TYPE "InvoiceTaxType" AS ENUM ('IGST', 'CGST_SGST');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "clientState" TEXT;

-- CreateTable
CREATE TABLE "Invoice" (
    "id" SERIAL NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "projectId" INTEGER,
    "clientFullName" TEXT NOT NULL,
    "clientAddress" TEXT,
    "clientState" TEXT,
    "clientGstNumber" TEXT,
    "hsnCode" TEXT,
    "description" TEXT NOT NULL,
    "totalTaxableValue" DOUBLE PRECISION NOT NULL,
    "taxType" "InvoiceTaxType" NOT NULL,
    "igstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cgstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sgstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalInvoiceValue" DOUBLE PRECISION NOT NULL,
    "amountInWords" TEXT,
    "bankName" TEXT,
    "bankAccountNumber" TEXT,
    "bankIfscCode" TEXT,
    "bankBranch" TEXT,
    "declarationText" TEXT,
    "pdfUrl" TEXT,
    "generatedById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Invoice_projectId_idx" ON "Invoice"("projectId");

-- CreateIndex
CREATE INDEX "Invoice_invoiceNo_idx" ON "Invoice"("invoiceNo");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
