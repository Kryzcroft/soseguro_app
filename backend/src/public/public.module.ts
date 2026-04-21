import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { SmartAccessRateLimitGuard } from "../common/guards/auth-attempt-rate-limit.guard";
import { PrismaModule } from "../prisma/prisma.module";
import { PublicController } from "./public.controller";
import { PublicService } from "./public.service";

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [PublicController],
  providers: [PublicService, SmartAccessRateLimitGuard],
  exports: [PublicService],
})
export class PublicModule {}
