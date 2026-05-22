import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ActivationCodeStatus } from "@prisma/client";
import { randomBytes } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import {
  buildActivationCodeHash,
  normalizeActivationCode,
} from "../auth/activation-code-security";
import { buildAdminEmailSet } from "../common/admin-identity";

export type ProfileStatusFilter = "INCOMPLETO" | "COMPLETO";

const MAX_RETRY_ROUNDS = 10;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async getDashboard(profileStatus?: ProfileStatusFilter, search?: string) {
    const publicBaseUrl =
      this.configService.get<string>("PUBLIC_PROFILE_BASE_URL") || "http://localhost:3000/p";
    const pepper =
      this.configService.get<string>("ACTIVATION_CODE_PEPPER") ||
      this.configService.get<string>("JWT_SECRET") ||
      "change-me";
    const normalizedSearch = search?.trim();
    const searchHash = normalizedSearch
      ? buildActivationCodeHash(normalizedSearch, pepper)
      : undefined;

    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      where: normalizedSearch
        ? {
            OR: [
              {
                email: {
                  contains: normalizedSearch,
                  mode: "insensitive",
                },
              },
              {
                activationCodes: {
                  some: {
                    codeHash: searchHash,
                  },
                },
              },
            ],
          }
        : undefined,
      include: {
        medicalProfile: {
          include: {
            emergencyContacts: true,
          },
        },
        activationCodes: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    const inventory = users
      .map((user) => {
        const profile = user.medicalProfile;
        const latestActivationCode = user.activationCodes[0] || null;
        const profileStatusValue = this.isProfileComplete(profile) ? "COMPLETO" : "INCOMPLETO";

        const publicLink =
          profile?.publicLink ||
          (profile?.publicId
            ? `${publicBaseUrl.replace(/\/$/, "")}/${profile.publicId}`
            : null);

        return {
          userId: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profileStatus: profileStatusValue,
          profilePublicId: profile?.publicId || null,
          publicLink,
          isVerified: user.isVerified,
          activationCode: latestActivationCode
            ? {
                id: latestActivationCode.id,
                code: latestActivationCode.code,
                status: latestActivationCode.status,
                isUsed: latestActivationCode.isUsed,
                createdAt: latestActivationCode.createdAt,
                usedAt: latestActivationCode.usedAt,
              }
            : null,
        };
      })
      .filter((row) => (profileStatus ? row.profileStatus === profileStatus : true));

    const activationCodes = await this.prisma.activationCode.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    return {
      inventory,
      activationCodes: activationCodes.map((code) => ({
        id: code.id,
        code: code.code,
        status: code.status,
        isUsed: code.isUsed,
        createdAt: code.createdAt,
        usedAt: code.usedAt,
        userId: code.userId,
        userEmail: code.user?.email || null,
      })),
    };
  }

  async assignCodeAtomically(userId: string, code: string) {
    const normalizedCode = normalizeActivationCode(code);
    const pepper =
      this.configService.get<string>("ACTIVATION_CODE_PEPPER") ||
      this.configService.get<string>("JWT_SECRET") ||
      "change-me";
    const codeHash = buildActivationCodeHash(normalizedCode, pepper);

    if (!normalizedCode) {
      throw new BadRequestException("El codigo no puede estar vacio.");
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
        },
      });

      if (!user) {
        throw new NotFoundException("Usuario no encontrado.");
      }

      const existing = await tx.activationCode.findFirst({
        where: {
          codeHash,
        },
      });

      if (!existing) {
        const created = await tx.activationCode.create({
          data: {
            code: normalizedCode,
            codeHash,
            userId: user.id,
            status: ActivationCodeStatus.ACTIVE,
            activatedAt: new Date(),
            isUsed: true,
            usedAt: new Date(),
          },
        });

        return {
          code: created.code,
          userId: created.userId,
          usedAt: created.usedAt,
          createdAt: created.createdAt,
        };
      }

      if (existing.userId === user.id) {
        return {
          code: existing.code,
          userId: existing.userId,
          usedAt: existing.usedAt,
          createdAt: existing.createdAt,
        };
      }

      const updated = await tx.activationCode.update({
        where: { id: existing.id },
        data: {
          codeHash: existing.codeHash ?? codeHash,
          userId: user.id,
          status: ActivationCodeStatus.ACTIVE,
          activatedAt: existing.activatedAt ?? new Date(),
          isUsed: true,
          usedAt: existing.usedAt ?? new Date(),
        },
      });

      return {
        code: updated.code,
        userId: updated.userId,
        usedAt: updated.usedAt,
        createdAt: updated.createdAt,
      };
    });
  }

  async generateActivationCodes(quantity: number) {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new BadRequestException("La cantidad debe ser un entero positivo.");
    }

    const pepper =
      this.configService.get<string>("ACTIVATION_CODE_PEPPER") ||
      this.configService.get<string>("JWT_SECRET") ||
      "change-me";

    const codes = new Set<string>();
    let retries = 0;

    while (codes.size < quantity) {
      if (retries >= MAX_RETRY_ROUNDS) {
        throw new BadRequestException("No fue posible generar suficientes codigos unicos.");
      }

      const pending = quantity - codes.size;
      const candidates = Array.from({ length: pending }, () => this.generateActivationCode());
      const existing = await this.prisma.activationCode.findMany({
        where: { code: { in: candidates } },
        select: { code: true },
      });

      const existingCodes = new Set(existing.map((row) => row.code));
      for (const candidate of candidates) {
        if (!existingCodes.has(candidate)) {
          codes.add(candidate);
        }
      }

      retries += 1;
    }

    const rows = Array.from(codes).map((code) => ({
      code,
      codeHash: buildActivationCodeHash(code, pepper),
      status: ActivationCodeStatus.AVAILABLE,
      isUsed: false,
    }));

    await this.prisma.activationCode.createMany({
      data: rows,
      skipDuplicates: true,
    });

    return {
      requested: quantity,
      generated: rows.length,
      codes: rows.map((row) => row.code),
    };
  }

  async approveUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isVerified: true },
    });

    if (!user) {
      throw new NotFoundException("Usuario no encontrado.");
    }

    if (user.isVerified) {
      return { approved: true, alreadyApproved: true };
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { isVerified: true },
      select: { id: true },
    });

    return { approved: true, alreadyApproved: false };
  }

  async deleteUserWithRelatedData(userId: string) {
    const allowedAdminEmails = buildAdminEmailSet(this.configService.get<string>("ADMIN_EMAIL"));

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true },
      });

      if (!user) {
        throw new NotFoundException("Usuario no encontrado.");
      }

      if (allowedAdminEmails.has(user.email.toLowerCase())) {
        throw new BadRequestException("No se puede eliminar la cuenta administradora principal.");
      }

      const releasedCodes = await tx.activationCode.updateMany({
        where: { userId: user.id },
        data: {
          userId: null,
          status: ActivationCodeStatus.AVAILABLE,
          activatedAt: null,
          isUsed: false,
          usedAt: null,
        },
      });

      await tx.user.delete({ where: { id: user.id } });

      return {
        deleted: true,
        userId: user.id,
        releasedActivationCodes: releasedCodes.count,
      };
    });
  }

  private isProfileComplete(profile: {
    firstName: string | null;
    lastName: string | null;
    birthDate: Date | null;
    bloodType: string | null;
    emergencyContacts: Array<unknown>;
  } | null): boolean {
    if (!profile) {
      return false;
    }

    return Boolean(
      profile.firstName &&
        profile.lastName &&
        profile.birthDate &&
        profile.bloodType &&
        profile.emergencyContacts.length > 0,
    );
  }

  private generateActivationCode(): string {
    return randomBytes(16).toString("hex").toUpperCase();
  }
}
