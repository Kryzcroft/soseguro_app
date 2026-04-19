import { IsString, Matches } from "class-validator";

export class SendEmailDto {
  @IsString()
  userId!: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsString()
  @Matches(/^\+52\d{10}$/)
  phoneNumber!: string;
}
