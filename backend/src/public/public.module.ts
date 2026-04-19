import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "../prisma/prisma.module";
import { PublicController } from "./public.controller";
import { PublicService } from "./public.service";

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [PublicController],
  providers: [PublicService],
  exports: [PublicService],
})
export class PublicModule {}
