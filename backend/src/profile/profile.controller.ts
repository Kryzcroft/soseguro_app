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
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { CurrentUser, CurrentUserData } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PrivacyTermsGuard } from "../common/guards/privacy-terms.guard";
import { AcceptPrivacyDto } from "./dto/accept-privacy.dto";
import { UnlinkActivationCodeDto } from "./dto/unlink-activation-code.dto";
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
  constructor(private readonly profileService: ProfileService) {}

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

  @Post("unlink-label")
  @UseGuards(PrivacyTermsGuard)
  unlinkLabel(@CurrentUser() user: CurrentUserData, @Body() dto: UnlinkActivationCodeDto) {
    return this.profileService.unlinkActivationCode(user.id, dto.code);
  }

  @Post("photo")
  @UseGuards(PrivacyTermsGuard)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
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
    return this.profileService.saveProfilePhotoFile(user.id, file);
  }
}
