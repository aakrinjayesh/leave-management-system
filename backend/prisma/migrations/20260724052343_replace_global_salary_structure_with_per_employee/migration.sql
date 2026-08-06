-- Rename SalaryCtcHistory to SalaryStructureHistory (now holds per-employee
-- structure percentages alongside CTC, not just CTC)
ALTER TABLE "SalaryCtcHistory" RENAME TO "SalaryStructureHistory";

-- Add the structure columns, nullable first so we can backfill existing rows
ALTER TABLE "SalaryStructureHistory" ADD COLUMN "basicPercentOfCtc" DOUBLE PRECISION;
ALTER TABLE "SalaryStructureHistory" ADD COLUMN "hraPercentOfBasic" DOUBLE PRECISION;
ALTER TABLE "SalaryStructureHistory" ADD COLUMN "ltaPercentOfBasic" DOUBLE PRECISION;
ALTER TABLE "SalaryStructureHistory" ADD COLUMN "guaranteedAllowancePercentOfBasic" DOUBLE PRECISION;
ALTER TABLE "SalaryStructureHistory" ADD COLUMN "conveyanceMonthly" DOUBLE PRECISION;
ALTER TABLE "SalaryStructureHistory" ADD COLUMN "pfMonthlyAmount" DOUBLE PRECISION;
ALTER TABLE "SalaryStructureHistory" ADD COLUMN "professionalTax" DOUBLE PRECISION;
ALTER TABLE "SalaryStructureHistory" ADD COLUMN "professionalTaxThreshold" DOUBLE PRECISION;

-- Backfill existing rows with the exact values the (now-removed) global
-- SalaryStructureConfig had, so past payslip calculations remain unchanged
UPDATE "SalaryStructureHistory" SET
  "basicPercentOfCtc" = 0,
  "hraPercentOfBasic" = 0,
  "ltaPercentOfBasic" = 0,
  "guaranteedAllowancePercentOfBasic" = 0,
  "conveyanceMonthly" = 0,
  "pfMonthlyAmount" = 1800,
  "professionalTax" = 200,
  "professionalTaxThreshold" = 25000;

ALTER TABLE "SalaryStructureHistory" ALTER COLUMN "basicPercentOfCtc" SET NOT NULL;
ALTER TABLE "SalaryStructureHistory" ALTER COLUMN "hraPercentOfBasic" SET NOT NULL;
ALTER TABLE "SalaryStructureHistory" ALTER COLUMN "ltaPercentOfBasic" SET NOT NULL;
ALTER TABLE "SalaryStructureHistory" ALTER COLUMN "guaranteedAllowancePercentOfBasic" SET NOT NULL;
ALTER TABLE "SalaryStructureHistory" ALTER COLUMN "conveyanceMonthly" SET NOT NULL;
ALTER TABLE "SalaryStructureHistory" ALTER COLUMN "pfMonthlyAmount" SET NOT NULL;
ALTER TABLE "SalaryStructureHistory" ALTER COLUMN "professionalTax" SET NOT NULL;
ALTER TABLE "SalaryStructureHistory" ALTER COLUMN "professionalTaxThreshold" SET NOT NULL;

-- Global config is fully replaced by per-employee SalaryStructureHistory
DROP TABLE "SalaryStructureConfig";
