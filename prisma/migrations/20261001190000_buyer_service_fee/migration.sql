-- AlterTable
ALTER TABLE "EscrowTransaction" ADD COLUMN     "serviceFeeLamports" BIGINT,
ADD COLUMN     "serviceFeeRefunded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "serviceFeeThb" INTEGER NOT NULL DEFAULT 0;
