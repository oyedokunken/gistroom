-- CreateEnum
CREATE TYPE "RoomChatMode" AS ENUM ('EVERYONE', 'MODERATORS', 'OFF');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RoomModAction" ADD VALUE 'MUTE_VIDEO';
ALTER TYPE "RoomModAction" ADD VALUE 'SETTINGS';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "expiresAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "cameraAllowed" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "chatMode" "RoomChatMode" NOT NULL DEFAULT 'EVERYONE',
ADD COLUMN     "joinMuted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "media" "MediaKind" NOT NULL DEFAULT 'AUDIO',
ADD COLUMN     "membersCanShare" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "messageCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "peakParticipants" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reactionCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reactionsOn" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "slowModeSec" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "unmuteLocked" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "RoomReaction" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomReaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoomReaction_roomId_idx" ON "RoomReaction"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomReaction_messageId_userId_emoji_key" ON "RoomReaction"("messageId", "userId", "emoji");

-- AddForeignKey
ALTER TABLE "RoomReaction" ADD CONSTRAINT "RoomReaction_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomReaction" ADD CONSTRAINT "RoomReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "RoomMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
