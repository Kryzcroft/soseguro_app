import { IsEmail, IsString, Length, MinLength, Matches } from "class-validator";

export class ActivateDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @Length(13, 13)
  @Matches(/^SOS-[A-F0-9]{4}-[A-F0-9]{4}$/)
  activationCode!: string;
}
