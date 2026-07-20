-- Replace the manually-tracked leaveYear number with a fiscalYearStartMonth
-- setting (default April) that the app now uses to compute the current
-- leave/payroll fiscal year automatically instead of requiring a manual update.
ALTER TABLE "CompanySettings" DROP COLUMN "leaveYear";
ALTER TABLE "CompanySettings" ADD COLUMN "fiscalYearStartMonth" INTEGER NOT NULL DEFAULT 4;
