import { IsEmail, IsString, Matches, MinLength } from "class-validator";

export class RegisterBasicDto {
  @IsString()
  @Matches(/^(SOS-[A-F0-9]{4}-[A-F0-9]{4}|[A-F0-9]{8})$/)
  activationCode!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}