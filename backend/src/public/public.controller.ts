import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { Public } from "../common/decorators/public.decorator";
import { SmartAccessRateLimitGuard } from "../common/guards/auth-attempt-rate-limit.guard";
import { SendAlertDto } from "./dto/send-alert.dto";
import { PublicService } from "./public.service";

@Controller("public")
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Public()
  @UseGuards(SmartAccessRateLimitGuard)
  @Get("access/:activationCode")
  resolveAccess(@Param("activationCode") activationCode: string) {
    return this.publicService.resolveSmartAccess(activationCode);
  }

  @Public()
  @Get("profile/:publicId")
  getPublicProfile(@Param("publicId") publicId: string) {
    return this.publicService.getPublicProfileByPublicId(publicId);
  }

  @Public()
  @Post("alert/:publicId")
  sendAlert(@Param("publicId") publicId: string, @Body() dto: SendAlertDto) {
    return this.publicService.sendEmergencyAlert(publicId, dto.latitude, dto.longitude);
  }
}
