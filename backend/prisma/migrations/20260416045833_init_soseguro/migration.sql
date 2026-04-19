-- CreateEnum
CREATE TYPE "blood_type" AS ENUM ('A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "phone_number" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "privacy_accepted" BOOLEAN NOT NULL DEFAULT false,
    "terms_accepted_at" TIMESTAMP(3),
    "terms_version" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activation_codes" (
    "id" UUID NOT NULL,
    "code" CHAR(13) NOT NULL,
    "is_used" BOOLEAN NOT NULL DEFAULT false,
    "user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "used_at" TIMESTAMP(3),

    CONSTRAINT "activation_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "first_name" TEXT,
    "last_name" TEXT,
    "birth_date" TIMESTAMP(3),
    "weight_kg" DECIMAL(5,2),
    "height_cm" DECIMAL(5,2),
    "address" TEXT,
    "profession" TEXT,
    "photo_url" TEXT,
    "blood_type" "blood_type",
    "allergies" TEXT,
    "is_organ_donor" BOOLEAN,
    "insurance_name" TEXT,
    "policy_number" TEXT,
    "chronic_diseases" TEXT,
    "medications" TEXT,
    "implants" TEXT,
    "observations" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medical_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_contacts" (
    "id" UUID NOT NULL,
    "medical_profile_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "country_code" VARCHAR(5) NOT NULL,
    "phone_number" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emergency_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_codes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "code" CHAR(6) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_profile_access_logs" (
    "id" UUID NOT NULL,
    "medical_profile_id" UUID NOT NULL,
    "accessed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "public_profile_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "activation_codes_code_key" ON "activation_codes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "medical_profiles_user_id_key" ON "medical_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "medical_profiles_slug_key" ON "medical_profiles"("slug");

-- CreateIndex
CREATE INDEX "medical_profiles_slug_idx" ON "medical_profiles"("slug");

-- CreateIndex
CREATE INDEX "emergency_contacts_profile_id_idx" ON "emergency_contacts"("medical_profile_id");

-- CreateIndex
CREATE INDEX "verification_codes_user_phone_idx" ON "verification_codes"("user_id", "phone");

-- CreateIndex
CREATE INDEX "verification_codes_user_code_idx" ON "verification_codes"("user_id", "code");

-- CreateIndex
CREATE INDEX "public_profile_access_logs_profile_id_idx" ON "public_profile_access_logs"("medical_profile_id");

-- AddForeignKey
ALTER TABLE "activation_codes" ADD CONSTRAINT "activation_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_profiles" ADD CONSTRAINT "medical_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_contacts" ADD CONSTRAINT "emergency_contacts_medical_profile_id_fkey" FOREIGN KEY ("medical_profile_id") REFERENCES "medical_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_codes" ADD CONSTRAINT "verification_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_profile_access_logs" ADD CONSTRAINT "public_profile_access_logs_medical_profile_id_fkey" FOREIGN KEY ("medical_profile_id") REFERENCES "medical_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
