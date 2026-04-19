import { IsLatitude, IsLongitude, IsOptional } from "class-validator";

export class SendAlertDto {
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;
}
