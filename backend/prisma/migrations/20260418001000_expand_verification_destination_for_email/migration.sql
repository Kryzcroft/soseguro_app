-- Allow storing full email addresses in verification destination field.
ALTER TABLE "verification_codes"
ALTER COLUMN "phone" TYPE TEXT;
