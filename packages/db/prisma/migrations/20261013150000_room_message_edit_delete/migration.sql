-- AlterTable
ALTER TABLE "RoomMessage" ADD COLUMN "editedAt" TIMESTAMP(3),
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedById" TEXT;
