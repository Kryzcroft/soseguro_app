import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PrismaModule } from "../prisma/prisma.module";
import {
  AuthActivateRateLimitGuard,
  AuthCheckCodeRateLimitGuard,
} from "../common/guards/auth-attempt-rate-limit.guard";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { EmailService } from "./email.service";

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>("JWT_SECRET") ?? "change-me",
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, EmailService, AuthActivateRateLimitGuard, AuthCheckCodeRateLimitGuard],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
