-- AlterTable: add as nullable first so existing projects don't break the migration
ALTER TABLE "Project" ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "startDate" TIMESTAMP(3);

-- Backfill existing projects with placeholder dates (createdAt as start, +1
-- year as end) - admin can edit each one to the real dates via Edit project.
UPDATE "Project" SET "startDate" = "createdAt", "endDate" = "createdAt" + INTERVAL '365 days' WHERE "startDate" IS NULL;

-- Now that every row has a value, enforce NOT NULL going forward.
ALTER TABLE "Project" ALTER COLUMN "startDate" SET NOT NULL;
ALTER TABLE "Project" ALTER COLUMN "endDate" SET NOT NULL;
