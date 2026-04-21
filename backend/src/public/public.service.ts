import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ActivationCodeStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { Twilio } from "twilio";

type PublicProfileResponse = {
  slug: string;
  fullName: string;
  birthDate: Date | null;
  address: string | null;
  profession: string | null;
  heightCm: string | null;
  weightKg: string | null;
  bloodType: string | null;
  allergies: string | null;
  isOrganDonor: boolean | null;
  insuranceName: string | null;
  policyNumber: string | null;
  chronicDiseases: string | null;
  medications: string | null;
  implants: string | null;
  medicalUnit: string | null;
  photoUrl: string | null;
  emergencyContacts: Array<{
    name: string;
    relationship: string;
    phone: string;
  }>;
};

export type SmartAccessResolution =
  | {
      state: "INVALID";
      message: string;
    }
  | {
      state: "REGISTER";
      activationCode: string;
      redirectPath: string;
    }
  | {
      state: "PUBLIC_PROFILE";
      activationCode: string;
      publicId: string;
      redirectPath: string;
    };

@Injectable()
export class PublicService {
  private twilioClient: Twilio | null = null;
  private readonly twilioFromWhatsApp: string | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const sid = this.configService.get<string>("TWILIO_SID");
    const token = this.configService.get<string>("TWILIO_AUTH_TOKEN");
    const rawFrom =
      this.configService.get<string>("TWILIO_WHATSAPP_FROM") ??
      this.configService.get<string>("TWILIO_FROM_PHONE") ??
      null;
    this.twilioFromWhatsApp = rawFrom
      ? rawFrom.startsWith("whatsapp:")
        ? rawFrom
        : `whatsapp:${rawFrom}`
      : null;

    if (sid && token && this.twilioFromWhatsApp) {
      this.twilioClient = new Twilio(sid, token);
    }
  }

  async getPublicProfileByPublicId(publicId: string): Promise<PublicProfileResponse> {
    const profile = await this.prisma.medicalProfile.findUnique({
      where: {
        publicId,
      },
      include: {
        user: {
          select: {
            isPublic: true,
          },
        },
        emergencyContacts: {
          orderBy: { createdAt: "asc" },
          take: 3,
        },
      },
    });

    if (!profile) {
      throw new NotFoundException("Perfil no encontrado.");
    }

    await this.prisma.publicProfileAccessLog.create({
      data: {
        medicalProfileId: profile.id,
      },
    });

    if (!profile.isPublic) {
      throw new ForbiddenException("Este perfil ha sido desactivado temporalmente por el usuario");
    }

    await this.prisma.medicalProfile.update({
      where: { id: profile.id },
      data: { viewCount: { increment: 1 } },
      select: { id: true },
    });

    const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim() || "Usuario SOSeguro";

    return {
      slug: profile.publicId,
      fullName,
      birthDate: profile.birthDate,
      address: profile.address,
      profession: profile.profession,
      heightCm: profile.heightCm ? profile.heightCm.toString() : null,
      weightKg: profile.weightKg ? profile.weightKg.toString() : null,
      bloodType: profile.bloodType,
      allergies: profile.allergies,
      isOrganDonor: profile.isOrganDonor,
      insuranceName: profile.insuranceName,
      policyNumber: profile.policyNumber,
      chronicDiseases: profile.chronicDiseases,
      medications: profile.medications,
      implants: profile.implants,
      medicalUnit: profile.medicalUnit,
      photoUrl: profile.photoUrl,
      emergencyContacts: profile.emergencyContacts.map((contact) => ({
        name: contact.name,
        relationship: contact.relationship,
        phone: this.formatPublicPhone(contact.countryCode, contact.phoneNumber),
      })),
    };
  }

  async resolveSmartAccess(rawCode: string): Promise<SmartAccessResolution> {
    const activationCode = rawCode.trim().toUpperCase();
    if (!activationCode) {
      return {
        state: "INVALID",
        message: "Este codigo no es valido o no pertenece a nuestro sistema.",
      };
    }

    const activation = await this.prisma.activationCode.findUnique({
      where: { code: activationCode },
      select: {
        code: true,
        status: true,
        userId: true,
        user: {
          select: {
            medicalProfile: {
              select: {
                publicId: true,
              },
            },
          },
        },
      },
    });

    if (!activation || activation.status === ActivationCodeStatus.REVOKED) {
      return {
        state: "INVALID",
        message: "Este codigo no es valido o no pertenece a nuestro sistema.",
      };
    }

    const normalizedDbCode = activation.code.trim().toUpperCase();

    if (!activation.userId || activation.status === ActivationCodeStatus.AVAILABLE) {
      return {
        state: "REGISTER",
        activationCode: normalizedDbCode,
        redirectPath: `/registro?code=${encodeURIComponent(normalizedDbCode)}`,
      };
    }

    const publicId = activation.user?.medicalProfile?.publicId;
    if (!publicId) {
      return {
        state: "INVALID",
        message: "Este codigo no es valido o no pertenece a nuestro sistema.",
      };
    }

    return {
      state: "PUBLIC_PROFILE",
      activationCode: normalizedDbCode,
      publicId,
      redirectPath: `/p/${publicId}`,
    };
  }

  async sendEmergencyAlert(publicId: string, latitude?: number, longitude?: number) {
    const profile = await this.prisma.medicalProfile.findUnique({
      where: {
        publicId,
      },
      include: {
        user: {
          select: {
            isPublic: true,
          },
        },
        emergencyContacts: {
          orderBy: { createdAt: "asc" },
          take: 3,
        },
      },
    });

    if (!profile) {
      throw new NotFoundException("Perfil no encontrado.");
    }

    if (!profile.isPublic) {
      throw new ForbiddenException("Este perfil ha sido desactivado temporalmente por el usuario");
    }

    if (!profile.emergencyContacts.length) {
      throw new BadRequestException("El perfil no tiene contactos de emergencia.");
    }

    const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim() || "Usuario SOSeguro";
    const message = this.buildAlertMessage(fullName, latitude, longitude);

    const phones = profile.emergencyContacts.map((c) => this.formatPublicPhone(c.countryCode, c.phoneNumber));

    if (!this.twilioClient || !this.twilioFromWhatsApp) {
      phones.forEach((phone) => {
        console.log(`[DEV_WHATSAPP_MOCK] to=whatsapp:${phone} message=${message}`);
      });

      return {
        sent: true,
        channel: "mock_whatsapp",
        sentCount: phones.length,
      };
    }

    await Promise.all(
      phones.map((phone) =>
        this.twilioClient!.messages.create({
          to: `whatsapp:${phone}`,
          from: this.twilioFromWhatsApp!,
          body: message,
        }),
      ),
    );

    return {
      sent: true,
      channel: "twilio_whatsapp",
      sentCount: phones.length,
    };
  }

  buildAlertMessage(fullName: string, latitude?: number, longitude?: number): string {
    const hasCoordinates = typeof latitude === "number" && typeof longitude === "number";
    const locationText = hasCoordinates
      ? `Ubicacion: https://www.google.com/maps?q=${latitude},${longitude}`
      : "Ubicacion: Ubicacion no disponible, por favor intentar contactar al usuario directamente";

    return [
      `🚨 EMERGENCIA de ${fullName}: ¡Hola! El usuario tiene una emergencia en esta ubicacion.`,
      locationText,
      "Enviado desde App SOSeguro.",
    ].join("\n");
  }

  private formatPublicPhone(countryCode: string, phoneNumber: string): string {
    if (phoneNumber.startsWith("+")) {
      return phoneNumber;
    }

    return `${countryCode}${phoneNumber}`;
  }
}
