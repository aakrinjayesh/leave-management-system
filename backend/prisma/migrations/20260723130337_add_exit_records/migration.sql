-- AlterTable
ALTER TABLE "User" ADD COLUMN     "exitDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ExitRecord" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "exitDate" TIMESTAMP(3) NOT NULL,
    "relievingLetterText" TEXT NOT NULL,
    "recordedById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExitRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExitRecord_userId_idx" ON "ExitRecord"("userId");

-- AddForeignKey
ALTER TABLE "ExitRecord" ADD CONSTRAINT "ExitRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExitRecord" ADD CONSTRAINT "ExitRecord_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
