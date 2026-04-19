import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { BloodType } from "@prisma/client";

export class EmergencyContactDto {
  @IsString()
  name!: string;

  @IsString()
  relationship!: string;

  @IsString()
  @Matches(/^\+52$/)
  countryCode!: string;

  @IsString()
  @Matches(/^\+52\d{10}$/)
  phoneNumber!: string;
}

export class UpsertProfileDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(500)
  weightKg?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(140)
  @Max(200)
  heightCm?: number;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  profession?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  @IsEnum(BloodType)
  bloodType?: BloodType;

  @IsOptional()
  @IsString()
  allergies?: string;

  @IsOptional()
  @IsBoolean()
  isOrganDonor?: boolean;

  @IsOptional()
  @IsBoolean()
  hasInsurance?: boolean;

  @IsOptional()
  @IsString()
  insuranceName?: string;

  @IsOptional()
  @IsString()
  policyNumber?: string;

  @IsOptional()
  @IsBoolean()
  hasChronicDiseases?: boolean;

  @IsOptional()
  @IsString()
  chronicDiseases?: string;

  @IsOptional()
  @IsBoolean()
  hasMedications?: boolean;

  @IsOptional()
  @IsString()
  medications?: string;

  @IsOptional()
  @IsBoolean()
  hasImplants?: boolean;

  @IsOptional()
  @IsString()
  implants?: string;

  @IsOptional()
  @IsString()
  medicalUnit?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmergencyContactDto)
  emergencyContacts?: EmergencyContactDto[];
}
