-- Replace the PF percentage-of-Basic rate with a flat monthly amount (same
-- for every employee), and add a gross-pay threshold below which
-- Professional Tax is zero.
ALTER TABLE "SalaryStructureConfig" DROP COLUMN "pfPercentOfBasic";
ALTER TABLE "SalaryStructureConfig" ADD COLUMN "pfMonthlyAmount" DOUBLE PRECISION NOT NULL DEFAULT 1800;
ALTER TABLE "SalaryStructureConfig" ADD COLUMN "professionalTaxThreshold" DOUBLE PRECISION NOT NULL DEFAULT 25000;
