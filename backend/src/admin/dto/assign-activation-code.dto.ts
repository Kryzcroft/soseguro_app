import { IsString, Matches } from "class-validator";

export class AssignActivationCodeDto {
  @IsString()
  userId!: string;

  @IsString()
  @Matches(/^[A-Z0-9]{3}-[A-Z0-9]{4}-[A-Z0-9]{4}$/)
  code!: string;
}
