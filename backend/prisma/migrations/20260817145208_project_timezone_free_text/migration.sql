-- AlterTable: Project.timezone moves from the ProjectTimezone enum to free
-- text, so admin can type any timezone label, not just the curated list.
-- Cast (not drop+recreate) so existing values ("IST", "US_EASTERN", ...)
-- survive as plain strings.
ALTER TABLE "Project" ALTER COLUMN "timezone" DROP DEFAULT;
ALTER TABLE "Project" ALTER COLUMN "timezone" TYPE TEXT USING ("timezone"::text);
ALTER TABLE "Project" ALTER COLUMN "timezone" SET DEFAULT 'IST';

-- DropEnum
DROP TYPE "ProjectTimezone";
