-- A cover photo behind the profile, and a short bio under the name.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "coverImage" TEXT,
ADD COLUMN "bio" TEXT;
