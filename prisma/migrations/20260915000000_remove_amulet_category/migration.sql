-- Scope cut: the platform is TCG-only going forward. Removes the AMULET
-- category and its GPRA grading institute. Existing rows are disposable
-- demo/seed data, so clear dependent tables first rather than trying to
-- migrate amulet rows to a category that no longer exists.
DELETE FROM "GradingSubmission";
DELETE FROM "InboundPackage";
DELETE FROM "EscrowTransaction";
DELETE FROM "ProvenanceEvent";
DELETE FROM "VerificationPhoto";
DELETE FROM "Asset";

-- Recreate AssetCategory without AMULET (Postgres has no DROP VALUE for enums).
ALTER TYPE "AssetCategory" RENAME TO "AssetCategory_old";
CREATE TYPE "AssetCategory" AS ENUM ('TRADING_CARD', 'SPORTS_CARD', 'COMIC');
ALTER TABLE "Asset" ALTER COLUMN "category" TYPE "AssetCategory" USING ("category"::text::"AssetCategory");
ALTER TABLE "GradingSubmission" ALTER COLUMN "category" TYPE "AssetCategory" USING ("category"::text::"AssetCategory");
DROP TYPE "AssetCategory_old";

-- Recreate GradingCompany without GPRA (it existed only to certify amulets).
ALTER TYPE "GradingCompany" RENAME TO "GradingCompany_old";
CREATE TYPE "GradingCompany" AS ENUM ('PSA', 'BGS', 'CGC', 'RAW');
ALTER TABLE "Asset" ALTER COLUMN "gradingCompany" TYPE "GradingCompany" USING ("gradingCompany"::text::"GradingCompany");
ALTER TABLE "InboundPackage" ALTER COLUMN "declaredGradingCompany" TYPE "GradingCompany" USING ("declaredGradingCompany"::text::"GradingCompany");
ALTER TABLE "InboundPackage" ALTER COLUMN "officialGradingCompany" TYPE "GradingCompany" USING ("officialGradingCompany"::text::"GradingCompany");
ALTER TABLE "GradingSubmission" ALTER COLUMN "gradingCompany" TYPE "GradingCompany" USING ("gradingCompany"::text::"GradingCompany");
DROP TYPE "GradingCompany_old";
