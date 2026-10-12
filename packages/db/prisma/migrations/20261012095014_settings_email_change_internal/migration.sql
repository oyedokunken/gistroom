-- AlterEnum
ALTER TYPE "OtpPurpose" ADD VALUE 'CHANGE_EMAIL';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarKey" TEXT,
ADD COLUMN     "isInternal" BOOLEAN NOT NULL DEFAULT false;
