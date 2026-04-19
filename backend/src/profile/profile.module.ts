import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PrismaModule } from "../prisma/prisma.module";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PrivacyTermsGuard } from "../common/guards/privacy-terms.guard";
import { ProfileController } from "./profile.controller";
import { ProfileService } from "./profile.service";

@Module({
  imports: [PrismaModule, ConfigModule, JwtModule.register({})],
  controllers: [ProfileController],
  providers: [ProfileService, JwtAuthGuard, PrivacyTermsGuard],
  exports: [ProfileService],
})
export class ProfileModule {}
