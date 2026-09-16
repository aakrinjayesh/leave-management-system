-- CreateEnum
CREATE TYPE "InvoiceFormat" AS ENUM ('PDF', 'WORD');

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "format" "InvoiceFormat" NOT NULL DEFAULT 'PDF';
ALTER TABLE "Invoice" ADD COLUMN "documentUrl" TEXT;

-- Preserve existing pdfUrl values before dropping the column
UPDATE "Invoice" SET "documentUrl" = "pdfUrl";

-- AlterTable
ALTER TABLE "Invoice" DROP COLUMN "pdfUrl";
