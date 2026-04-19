import { Body, Controller, Get, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser, CurrentUserData } from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/public.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import {
  AuthActivateRateLimitGuard,
  AuthCheckCodeRateLimitGuard,
} from "../common/guards/auth-attempt-rate-limit.guard";
import { AuthService } from "./auth.service";
import { ActivateDto } from "./dto/activate.dto";
import { LoginDto } from "./dto/login.dto";
import { RegisterBasicDto } from "./dto/register-basic.dto";
import { SendEmailDto } from "./dto/send-email.dto";
import { VerifyEmailDto } from "./dto/verify-email.dto";
import { AcceptPrivacyDto } from "../profile/dto/accept-privacy.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("activate")
  @Public()
  @UseGuards(AuthActivateRateLimitGuard)
  activate(@Body() dto: ActivateDto) {
    return this.authService.activate(dto);
  }

  @Post("register-basic")
  @Public()
  registerBasic(@Body() dto: RegisterBasicDto) {
    return this.authService.registerBasic(dto);
  }

  @Get("config")
  @Public()
  getAuthConfig() {
    return this.authService.getAuthConfig();
  }

  @Get("activation-code-status")
  @Public()
  @UseGuards(AuthCheckCodeRateLimitGuard)
  getActivationCodeStatus(@Query("code") code?: string) {
    return this.authService.getActivationCodeStatus(code ?? "");
  }

  @Get("check-code")
  @Public()
  @UseGuards(AuthCheckCodeRateLimitGuard)
  checkCode(@Query("code") code?: string) {
    return this.authService.getActivationCodeStatus(code ?? "");
  }

  @Post("send-email")
  @Public()
  sendEmail(@Body() dto: SendEmailDto) {
    return this.authService.sendEmail(dto);
  }

  @Post("verify-email")
  @Public()
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Post("login")
  @Public()
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Patch("accept-terms")
  @UseGuards(JwtAuthGuard)
  acceptTerms(@CurrentUser() user: CurrentUserData, @Body() dto: AcceptPrivacyDto) {
    return this.authService.acceptTerms(user.id, dto.termsVersion);
  }
}
