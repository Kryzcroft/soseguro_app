import { IsString, Matches } from "class-validator";

export class ReleaseActivationCodeDto {
  @IsString()
  @Matches(/^(SOS-[A-Z0-9]{4}-[A-Z0-9]{4}|[A-Z0-9]{8}|[A-Z0-9]{32})$/)
  code!: string;
}