import { IsOptional, IsString } from "class-validator";

export class AcceptPrivacyDto {
  @IsOptional()
  @IsString()
  termsVersion?: string;
}
