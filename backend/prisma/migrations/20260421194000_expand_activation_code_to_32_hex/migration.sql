-- Expand activation codes to support 32 hex characters (128 bits).
ALTER TABLE "activation_codes"
ALTER COLUMN "code" TYPE CHAR(32);