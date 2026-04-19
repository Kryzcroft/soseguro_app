import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { Type } from "class-transformer";
import { IsBoolean } from "class-validator";
import { ConfigService } from "@nestjs/config";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname } from "path";
import { randomUUID } from "crypto";
import { mkdirSync } from "fs";
import { CurrentUser, CurrentUserData } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PrivacyTermsGuard } from "../common/guards/privacy-terms.guard";
import { AcceptPrivacyDto } from "./dto/accept-privacy.dto";
import { UpsertProfileDto } from "./dto/upsert-profile.dto";
import { ProfileService } from "./profile.service";

class VisibilityDto {
  @Type(() => Boolean)
  @IsBoolean()
  isPublic!: boolean;
}

@Controller("profile")
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(
    private readonly profileService: ProfileService,
    private readonly configService: ConfigService,
  ) {}

  @Get("me")
  getMyProfile(@CurrentUser() user: CurrentUserData) {
    return this.profileService.getProfileByUserId(user.id);
  }

  @Patch("privacy-consent")
  acceptPrivacyConsent(@CurrentUser() user: CurrentUserData, @Body() dto: AcceptPrivacyDto) {
    return this.profileService.acceptPrivacyTerms(user.id, dto.termsVersion);
  }

  @Patch()
  @UseGuards(PrivacyTermsGuard)
  upsertProfile(@CurrentUser() user: CurrentUserData, @Body() dto: UpsertProfileDto) {
    return this.profileService.upsertPartialProfile(user.id, dto);
  }

  @Patch("visibility")
  @UseGuards(PrivacyTermsGuard)
  updateVisibility(@CurrentUser() user: CurrentUserData, @Body() body: VisibilityDto) {
    return this.profileService.updateVisibility(user.id, Boolean(body.isPublic));
  }

  @Post("photo")
  @UseGuards(PrivacyTermsGuard)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const destination = process.env.PROFILE_UPLOAD_DIR || "uploads/profile";
          mkdirSync(destination, { recursive: true });
          cb(null, destination);
        },
        filename: (_req, file, cb) => {
          const extension = extname(file.originalname).toLowerCase();
          cb(null, `${randomUUID()}${extension}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        const allowed = ["image/jpeg", "image/png", "image/webp"];
        if (!allowed.includes(file.mimetype)) {
          cb(new Error("Formato no permitido. Usa JPG, PNG o WEBP."), false);
          return;
        }
        cb(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  async uploadPhoto(
    @CurrentUser() user: CurrentUserData,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const publicBaseUrl = this.configService.get<string>("PROFILE_UPLOAD_PUBLIC_BASE_URL") ?? "";
    const normalizedBase = publicBaseUrl.replace(/\/$/, "");
    const photoUrl = normalizedBase
      ? `${normalizedBase}/${file.filename}`
      : `/uploads/profile/${file.filename}`;

    return this.profileService.saveProfilePhoto(user.id, photoUrl);
  }
}
