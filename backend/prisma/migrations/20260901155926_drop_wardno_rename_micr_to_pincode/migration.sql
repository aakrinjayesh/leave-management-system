-- Drop the unused ward number column
ALTER TABLE "User" DROP COLUMN "wardNo";

-- Repurpose the old MICR code column as a PIN code (values carried over)
ALTER TABLE "User" RENAME COLUMN "micrCode" TO "pinCode";
