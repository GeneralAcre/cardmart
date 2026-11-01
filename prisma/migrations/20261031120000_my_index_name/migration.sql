-- The name a user gives their own index on the Market page. Null shows the
-- default, "My Index".

-- AlterTable
ALTER TABLE "User" ADD COLUMN "myIndexName" TEXT;
