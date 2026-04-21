import { IsString, Matches } from "class-validator";

export class AssignActivationCodeDto {
  @IsString()
  userId!: string;

  @IsString()
  @Matches(/^(SOS-[A-Z0-9]{4}-[A-Z0-9]{4}|[A-Z0-9]{8}|[A-Z0-9]{32})$/)
  code!: string;
}
