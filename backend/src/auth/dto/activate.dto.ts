import { IsEmail, IsString, MinLength, Matches } from "class-validator";

export class ActivateDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @Matches(/^(SOS-[A-F0-9]{4}-[A-F0-9]{4}|[A-F0-9]{8})$/)
  activationCode!: string;
}
