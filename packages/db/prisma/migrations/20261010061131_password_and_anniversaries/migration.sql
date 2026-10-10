-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OtpPurpose" ADD VALUE 'SIGN_UP';
ALTER TYPE "OtpPurpose" ADD VALUE 'RESET_PASSWORD';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "passwordUpdatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Friendship" ADD COLUMN     "celebratedYears" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "nextAnniversaryAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Friendship_nextAnniversaryAt_idx" ON "Friendship"("nextAnniversaryAt");
