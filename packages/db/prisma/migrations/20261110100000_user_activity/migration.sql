-- AlterTable
ALTER TABLE "User" ADD COLUMN "lastActiveAt" TIMESTAMP(3),
ADD COLUMN "showBadges" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "badgesPublic" JSONB NOT NULL DEFAULT '[]';

-- AlterEnum
ALTER TYPE "OtpPurpose" ADD VALUE IF NOT EXISTS 'VERIFY_EMAIL';

-- CreateTable
CREATE TABLE "ActivityDay" (
    "userId" TEXT NOT NULL,
    "day" DATE NOT NULL,

    CONSTRAINT "ActivityDay_pkey" PRIMARY KEY ("userId","day")
);

-- CreateTable
CREATE TABLE "BadgeGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badge" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "source" JSONB,
    "evaluator" INTEGER NOT NULL DEFAULT 1,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,

    CONSTRAINT "BadgeGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FriendSuggestionDismissal" (
    "userId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FriendSuggestionDismissal_pkey" PRIMARY KEY ("userId","targetId")
);

-- CreateIndex
CREATE UNIQUE INDEX "BadgeGrant_userId_badge_ordinal_key" ON "BadgeGrant"("userId", "badge", "ordinal");

-- CreateIndex
CREATE INDEX "BadgeGrant_userId_revokedAt_idx" ON "BadgeGrant"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "User_lastActiveAt_idx" ON "User"("lastActiveAt");

-- AddForeignKey
ALTER TABLE "ActivityDay" ADD CONSTRAINT "ActivityDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BadgeGrant" ADD CONSTRAINT "BadgeGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FriendSuggestionDismissal" ADD CONSTRAINT "FriendSuggestionDismissal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
