-- AlterTable
ALTER TABLE "RoomMember" ADD COLUMN "registeredAt" TIMESTAMP(3);

-- People who put their own name down before this had no inviter. Keep them registered.
UPDATE "RoomMember" SET "registeredAt" = "createdAt" WHERE "state" = 'INVITED' AND "invitedById" IS NULL AND "role" = 'MEMBER';
