import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PrismaModule } from "../prisma/prisma.module";
import { AdminOnlyGuard } from "../common/guards/admin-only.guard";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";

@Module({
  imports: [PrismaModule, ConfigModule, JwtModule.register({})],
  controllers: [AdminController],
  providers: [AdminService, JwtAuthGuard, AdminOnlyGuard],
})
export class AdminModule {}
