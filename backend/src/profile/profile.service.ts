import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma, MedicalProfile } from "@prisma/client";
import { randomUUID } from "crypto";
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

    const { medicalProfile: _ignoredMedicalProfile, ...userData } = user;

    return {
      user: userData,
      medicalProfile,
    };
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
}
