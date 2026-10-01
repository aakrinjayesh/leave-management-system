-- AlterTable
ALTER TABLE "CompanySettings" ADD COLUMN "supportContactName" TEXT,
ADD COLUMN "supportContactEmail" TEXT,
ADD COLUMN "supportContactPhone" TEXT;

-- Seed the existing row (if any) with the values that were previously
-- hardcoded in the frontend welcome banner.
UPDATE "CompanySettings"
SET "supportContactName" = 'Krishna Dadi',
    "supportContactEmail" = 'krishna.dadi@aakrin.com',
    "supportContactPhone" = '+91 90000 00000'
WHERE "supportContactName" IS NULL
  AND "supportContactEmail" IS NULL
  AND "supportContactPhone" IS NULL;
