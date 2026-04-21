import { IsString, Matches } from "class-validator";

export class UnlinkActivationCodeDto {
  @IsString()
  @Matches(/^(SOS-[A-F0-9]{4}-[A-F0-9]{4}|[A-F0-9]{8}|[A-F0-9]{32})$/)
  code!: string;
}
