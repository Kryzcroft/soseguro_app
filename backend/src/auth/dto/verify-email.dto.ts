import { IsString, Length, Matches } from "class-validator";

export class VerifyEmailDto {
  @IsString()
  userId!: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  code!: string;
}
