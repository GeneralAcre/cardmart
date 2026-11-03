-- The page tours each user has finished, for the tour XP task.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "toursDone" TEXT[] DEFAULT ARRAY[]::TEXT[];
