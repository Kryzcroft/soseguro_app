import { BadRequestException, Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ActivationCodeStatus, Prisma, MedicalProfile } from "@prisma/client";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { extname, join } from "path";
import { createClient } from "@supabase/supabase-js";
import { PrismaService } from "../prisma/prisma.service";
import { UpsertProfileDto } from "./dto/upsert-profile.dto";

type DashboardMedicalProfile = Prisma.MedicalProfileGetPayload<{
  include: { emergencyContacts: true };
}>;

type DashboardAccount = {
  user: {
    id: string;
    email: string;
    isVerified: boolean;
    privacyAccepted: boolean;
    termsAcceptedAt: Date | null;
    termsVersion: string | null;
    isPublic: boolean;
  };
  linkedActivationCode: {
    code: string;
    status: ActivationCodeStatus;
    activatedAt: Date | null;
  } | null;
  activeActivationCodes: Array<{
    code: string;
    status: ActivationCodeStatus;
    activatedAt: Date | null;
  }>;
  medicalProfile: DashboardMedicalProfile | null;
};

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async getProfileByUserId(userId: string): Promise<DashboardAccount | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        isVerified: true,
        privacyAccepted: true,
        termsAcceptedAt: true,
        termsVersion: true,
        isPublic: true,
        activationCodes: {
          where: {
            status: ActivationCodeStatus.ACTIVE,
          },
          orderBy: [{ activatedAt: "desc" }, { createdAt: "desc" }],
          select: {
            code: true,
            status: true,
            activatedAt: true,
          },
        },
        medicalProfile: {
          include: {
            emergencyContacts: true,
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    let medicalProfile = user.medicalProfile;

    if (medicalProfile && !medicalProfile.publicLink) {
      const publicLink = this.buildPublicProfileLink(medicalProfile.publicId);
      medicalProfile = await this.prisma.medicalProfile.update({
        where: { id: medicalProfile.id },
        data: { publicLink },
        include: {
          emergencyContacts: true,
        },
      });
    }

    const { medicalProfile: _ignoredMedicalProfile, activationCodes, ...userData } = user;

    return {
      user: userData,
      linkedActivationCode: activationCodes[0]
        ? {
            code: activationCodes[0].code.trim().toUpperCase(),
            status: activationCodes[0].status,
            activatedAt: activationCodes[0].activatedAt,
          }
        : null,
      activeActivationCodes: activationCodes.map((activationCode) => ({
        code: activationCode.code.trim().toUpperCase(),
        status: activationCode.status,
        activatedAt: activationCode.activatedAt,
      })),
      medicalProfile,
    };
  }

  async unlinkActivationCode(
    userId: string,
    rawCode: string,
  ): Promise<{ unlinked: boolean; code: string; profileDeleted: boolean }> {
    const code = rawCode.trim().toUpperCase();
    if (!code) {
      throw new BadRequestException("El codigo es requerido para desvincular.");
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.activationCode.updateMany({
        where: {
          code,
          userId,
        },
        data: {
          userId: null,
          status: ActivationCodeStatus.AVAILABLE,
          isUsed: false,
          activatedAt: null,
          usedAt: null,
        },
      });

      if (updated.count < 1) {
        throw new BadRequestException("No se encontro una etiqueta activa con ese codigo para tu cuenta.");
      }

      const deletedProfile = await tx.medicalProfile.deleteMany({
        where: { userId },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          firstName: null,
          lastName: null,
          phoneNumber: null,
        },
      });

      return {
        unlinked: true,
        code,
        profileDeleted: deletedProfile.count > 0,
      };
    });
  }

  async acceptPrivacyTerms(userId: string, termsVersion?: string) {
    const currentTermsVersion = termsVersion ?? this.configService.get<string>("LEGAL_TERMS_VERSION") ?? "2026-04-15";

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        privacyAccepted: true,
        termsAcceptedAt: new Date(),
        termsVersion: currentTermsVersion,
      },
      select: {
        id: true,
        privacyAccepted: true,
        termsAcceptedAt: true,
        termsVersion: true,
      },
    });
  }

  async updateVisibility(userId: string, isPublic: boolean) {
    const profile = await this.prisma.medicalProfile.findUnique({ where: { userId }, select: { id: true } });

    if (!profile) {
      throw new BadRequestException("No existe perfil medico para este usuario.");
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { isPublic },
      });

      return tx.medicalProfile.update({
        where: { userId },
        data: { isPublic },
        select: {
          slug: true,
          publicLink: true,
          isPublic: true,
        },
      });
    });
  }

  async upsertPartialProfile(userId: string, dto: UpsertProfileDto): Promise<MedicalProfile> {
    if (dto.emergencyContacts && dto.emergencyContacts.length > 3) {
      throw new BadRequestException("Solo se permiten hasta 3 contactos de emergencia.");
    }

    const publicIdForCreate = randomUUID();
    const updateData: Prisma.MedicalProfileUpdateInput = {};
    const createData: Prisma.MedicalProfileCreateInput = {
      user: { connect: { id: userId } },
      publicId: publicIdForCreate,
      publicLink: this.buildPublicProfileLink(publicIdForCreate),
      slug: this.generateSlug(dto.firstName, dto.lastName),
    };

    const mapScalar = <K extends keyof UpsertProfileDto>(
      key: K,
      transform?: (value: NonNullable<UpsertProfileDto[K]>) => unknown,
    ) => {
      const value = dto[key];
      if (value === undefined) {
        return;
      }
      const transformed = transform ? transform(value as NonNullable<UpsertProfileDto[K]>) : value;
      (updateData as Record<string, unknown>)[key as string] = transformed;
      (createData as Record<string, unknown>)[key as string] = transformed;
    };

    mapScalar("firstName");
    mapScalar("lastName");
    mapScalar("birthDate", (value) => new Date(value as string));
    mapScalar("weightKg", (value) => new Prisma.Decimal(value as number));
    mapScalar("heightCm", (value) => new Prisma.Decimal(value as number));
    mapScalar("address");
    mapScalar("profession");
    mapScalar("photoUrl");
    mapScalar("bloodType");
    mapScalar("allergies");
    mapScalar("isOrganDonor");
    mapScalar("insuranceName");
    mapScalar("policyNumber");
    mapScalar("chronicDiseases");
    mapScalar("medications");
    mapScalar("implants");
    mapScalar("medicalUnit");

    if (dto.hasInsurance === false) {
      updateData.insuranceName = null;
      updateData.policyNumber = null;
      createData.insuranceName = null;
      createData.policyNumber = null;
    }

    if (dto.hasChronicDiseases === false) {
      updateData.chronicDiseases = null;
      createData.chronicDiseases = null;
    }

    if (dto.hasMedications === false) {
      updateData.medications = null;
      createData.medications = null;
    }

    if (dto.hasImplants === false) {
      updateData.implants = null;
      createData.implants = null;
    }

    if (dto.emergencyContacts !== undefined) {
      updateData.emergencyContacts = {
        deleteMany: {},
        create: dto.emergencyContacts,
      };

      createData.emergencyContacts = {
        create: dto.emergencyContacts,
      };
    }

    const profile = await this.prisma.medicalProfile.upsert({
      where: { userId },
      update: updateData,
      create: createData,
      include: { emergencyContacts: true },
    });

    if (profile.publicLink) {
      return profile;
    }

    return this.prisma.medicalProfile.update({
      where: { id: profile.id },
      data: { publicLink: this.buildPublicProfileLink(profile.publicId) },
      include: { emergencyContacts: true },
    });
  }

  async saveProfilePhoto(userId: string, photoUrl: string): Promise<{ photoUrl: string }> {
    await this.upsertPartialProfile(userId, { photoUrl });
    return { photoUrl };
  }

  async saveProfilePhotoFile(userId: string, file: Express.Multer.File): Promise<{ photoUrl: string }> {
    if (!file?.buffer?.length) {
      throw new BadRequestException("Archivo de imagen invalido.");
    }

    const photoUrl = await this.storeProfilePhoto(userId, file);
    return this.saveProfilePhoto(userId, photoUrl);
  }

  private generateSlug(firstName?: string, lastName?: string): string {
    const base = [firstName, lastName]
      .filter(Boolean)
      .join("-")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const suffix = randomUUID().slice(0, 6).toLowerCase();
    return `${base || "perfil"}-${suffix}`;
  }

  private buildPublicProfileLink(publicId: string): string {
    const baseUrl =
      this.configService.get<string>("PUBLIC_PROFILE_BASE_URL") || "http://localhost:3000/p";
    return `${baseUrl.replace(/\/$/, "")}/${publicId}`;
  }

  private async storeProfilePhoto(userId: string, file: Express.Multer.File): Promise<string> {
    const supabaseUrl = this.configService.get<string>("SUPABASE_URL")?.trim();
    const supabaseServiceRoleKey = this.configService
      .get<string>("SUPABASE_SERVICE_ROLE_KEY")
      ?.trim();
    const bucket = this.configService.get<string>("SUPABASE_STORAGE_BUCKET")?.trim() || "profile-photos";

    if (supabaseUrl && supabaseServiceRoleKey) {
      const extension = extname(file.originalname || "").toLowerCase() || this.extensionFromMime(file.mimetype);
      const objectPath = `${userId}/${Date.now()}-${randomUUID()}${extension}`;

      const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { error } = await supabase.storage.from(bucket).upload(objectPath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

      if (error) {
        throw new InternalServerErrorException(`No se pudo subir la imagen a storage: ${error.message}`);
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(bucket).getPublicUrl(objectPath);

      if (!publicUrl) {
        throw new InternalServerErrorException("No se pudo generar URL publica para la imagen.");
      }

      return publicUrl;
    }

    const destination = process.env.PROFILE_UPLOAD_DIR || "uploads/profile";
    await mkdir(destination, { recursive: true });

    const extension = extname(file.originalname || "").toLowerCase() || this.extensionFromMime(file.mimetype);
    const filename = `${randomUUID()}${extension}`;
    await writeFile(join(destination, filename), file.buffer);

    const publicBaseUrl = this.configService.get<string>("PROFILE_UPLOAD_PUBLIC_BASE_URL") ?? "";
    const normalizedBase = publicBaseUrl.replace(/\/$/, "");
    return normalizedBase ? `${normalizedBase}/${filename}` : `/uploads/profile/${filename}`;
  }

  private extensionFromMime(mimeType: string): string {
    if (mimeType === "image/png") {
      return ".png";
    }
    if (mimeType === "image/webp") {
      return ".webp";
    }
    return ".jpg";
  }
}
