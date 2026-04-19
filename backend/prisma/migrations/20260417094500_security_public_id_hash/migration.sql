-- Add public identifier for external URLs
ALTER TABLE "medical_profiles"
ADD COLUMN "public_id" UUID;

UPDATE "medical_profiles"
SET "public_id" = "id"
WHERE "public_id" IS NULL;

ALTER TABLE "medical_profiles"
ALTER COLUMN "public_id" SET NOT NULL;

CREATE UNIQUE INDEX "medical_profiles_public_id_key"
ON "medical_profiles"("public_id");

-- Add hashed representation for activation codes (legacy-compatible nullable)
ALTER TABLE "activation_codes"
ADD COLUMN "code_hash" TEXT;

CREATE UNIQUE INDEX "activation_codes_code_hash_key"
ON "activation_codes"("code_hash");
