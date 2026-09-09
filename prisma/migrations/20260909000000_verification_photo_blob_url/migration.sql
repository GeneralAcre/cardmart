-- Verification photos now live in Vercel Blob storage; Postgres only keeps
-- the URL. Existing rows are disposable demo/seed data, so clear them before
-- swapping the column rather than trying to backfill real URLs for them.
DELETE FROM "VerificationPhoto";

ALTER TABLE "VerificationPhoto" DROP COLUMN "dataUrl";
ALTER TABLE "VerificationPhoto" ADD COLUMN "url" TEXT NOT NULL;
