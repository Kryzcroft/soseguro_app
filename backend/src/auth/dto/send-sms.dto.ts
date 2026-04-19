import { IsString, Matches } from "class-validator";

export class SendSmsDto {
  @IsString()
  userId!: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/)
  phoneNumber!: string;
}
