-- Rename medical_profiles.observations -> medical_unit preserving existing data.
ALTER TABLE "medical_profiles"
RENAME COLUMN "observations" TO "medical_unit";
