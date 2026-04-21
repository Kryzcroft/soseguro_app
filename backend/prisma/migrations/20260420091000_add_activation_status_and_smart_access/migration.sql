-- CreateEnum
CREATE TYPE "activation_code_status" AS ENUM ('AVAILABLE', 'ACTIVE', 'REVOKED');

-- AlterTable
ALTER TABLE "activation_codes"
ADD COLUMN "status" "activation_code_status" NOT NULL DEFAULT 'AVAILABLE',
ADD COLUMN "activated_at" TIMESTAMP(3);

-- Backfill from legacy fields
UPDATE "activation_codes"
SET "status" = 'ACTIVE',
    "activated_at" = COALESCE("used_at", NOW())
WHERE "user_id" IS NOT NULL OR "is_used" = true;

UPDATE "activation_codes"
SET "activated_at" = COALESCE("activated_at", "used_at")
WHERE "status" = 'ACTIVE';

-- Helpful index for smart access lookup
CREATE INDEX "activation_codes_status_code_idx" ON "activation_codes"("status", "code");
