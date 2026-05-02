import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { ActivationCodeStatus, User } from "@prisma/client";
import * as argon2 from "argon2";
import { createHash, randomBytes, randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { ActivateDto } from "./dto/activate.dto";
import { AdminResetPasswordDto } from "./dto/admin-reset-password.dto";
import { LoginDto } from "./dto/login.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { RegisterBasicDto } from "./dto/register-basic.dto";
import { SendEmailDto } from "./dto/send-email.dto";
import { VerifyEmailDto } from "./dto/verify-email.dto";
import {
  buildActivationCodeHash,
  normalizeActivationCode,
} from "./activation-code-security";
import { EmailService } from "./email.service";

type PendingSessionPayload = {
  sub: string;
  email: string;
  isVerified: boolean;
  scope: "pending_verification";
};

type RegisterOrActivateResponse = {
  token: string;
  user: Pick<User, "id" | "email" | "isVerified">;
  requiresEmailVerification: boolean;
};

@Injectable()
export class AuthService {
  private readonly activationCodePepper: string;
  private readonly requireEmailVerification: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {
    this.activationCodePepper =
      this.configService.get<string>("ACTIVATION_CODE_PEPPER") ||
      this.configService.get<string>("JWT_SECRET") ||
      "change-me";

    const rawRequireEmailVerification =
      this.configService.get<string>("REQUIRE_EMAIL_VERIFICATION") ?? "true";
    this.requireEmailVerification = rawRequireEmailVerification.trim().toLowerCase() !== "false";
  }

  async activate(dto: ActivateDto): Promise<RegisterOrActivateResponse> {
    const result = await this.createPendingUserWithActivationCode(
      dto.email,
      dto.password,
      dto.activationCode,
    );

    const token = await this.signPendingSessionToken(result.id, result.email, result.isVerified);

    return { token, user: result, requiresEmailVerification: this.requireEmailVerification };
  }

  async registerBasic(
    dto: RegisterBasicDto,
  ): Promise<RegisterOrActivateResponse> {
    const user = await this.createPendingUserWithActivationCode(
      dto.email,
      dto.password,
      dto.activationCode,
    );

    const token = await this.signPendingSessionToken(user.id, user.email, user.isVerified);
    return { token, user, requiresEmailVerification: this.requireEmailVerification };
  }

  async getActivationCodeStatus(code: string): Promise<{ status: "FREE" | "USED" | "NOT_FOUND" }> {
    const normalizedCode = normalizeActivationCode(code);
    if (!normalizedCode) {
      return { status: "NOT_FOUND" };
    }

    const candidates = this.buildActivationCodeCandidates(normalizedCode);
    const hashes = candidates.map((candidate) =>
      buildActivationCodeHash(candidate, this.activationCodePepper),
    );

    const activations = await this.prisma.activationCode.findMany({
      where: {
        OR: [
          { codeHash: { in: hashes } },
          { code: { in: candidates } },
        ],
      },
      select: { code: true, isUsed: true, status: true },
      take: 5,
    });

    const activation =
      activations.find((row) => row.code.trim().toUpperCase() === normalizedCode) ||
      activations[0];

    if (!activation) {
      return { status: "NOT_FOUND" };
    }

    const isFree = activation.status === ActivationCodeStatus.AVAILABLE && !activation.isUsed;
    return { status: isFree ? "FREE" : "USED" };
  }

  async sendEmail(dto: SendEmailDto): Promise<{ sent: true; expiresInSeconds: number; skippedApproval?: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user) {
      throw new BadRequestException("Usuario no encontrado.");
    }

    if (user.isVerified) {
      throw new BadRequestException("El usuario ya fue verificado.");
    }

    await this.prisma.user.update({
      where: { id: dto.userId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phoneNumber: dto.phoneNumber,
      },
    });

    if (!this.requireEmailVerification) {
      return {
        sent: true,
        expiresInSeconds: 0,
        skippedApproval: true,
      };
    }

    const code = this.generateSixDigitsCode();
    const expiresInSeconds = Number(this.configService.get("EMAIL_CODE_TTL_SECONDS") ?? 600);
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    await this.prisma.verificationCode.create({
      data: {
        userId: dto.userId,
        phone: user.email,
        code,
        expiresAt,
      },
    });

    await this.emailService.sendVerificationCode(user.email, code);

    return {
      sent: true,
      expiresInSeconds,
    };
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<{ verified: true; token: string }> {
    if (!this.requireEmailVerification) {
      throw new BadRequestException("La verificacion por correo esta desactivada en este entorno.");
    }

    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user) {
      throw new BadRequestException("Usuario no encontrado.");
    }

    const now = new Date();

    const match = await this.prisma.verificationCode.findFirst({
      where: {
        userId: dto.userId,
        code: dto.code,
        usedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!match) {
      throw new BadRequestException("Codigo de verificacion invalido o expirado.");
    }

    await this.prisma.$transaction([
      this.prisma.verificationCode.update({
        where: { id: match.id },
        data: { usedAt: now },
      }),
      this.prisma.user.update({
        where: { id: dto.userId },
        data: { isVerified: true },
      }),
    ]);

    const token = await this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        isVerified: true,
        scope: "full_access",
      },
      {
        expiresIn: this.configService.get<string>("JWT_EXPIRES_IN") ?? "7d",
      },
    );

    return { verified: true, token };
  }

  async login(dto: LoginDto): Promise<{ token: string }> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      throw new UnauthorizedException("Credenciales invalidas.");
    }

    const isValid = await argon2.verify(user.password, dto.password);
    if (!isValid) {
      throw new UnauthorizedException("Credenciales invalidas.");
    }

    if (!user.isVerified) {
      throw new ForbiddenException(
        this.requireEmailVerification
          ? "Debes verificar tu correo antes de iniciar sesion."
          : "Tu cuenta esta pendiente de aprobacion por el administrador.",
      );
    }

    const token = await this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        isVerified: true,
        scope: "full_access",
      },
      {
        expiresIn: this.configService.get<string>("JWT_EXPIRES_IN") ?? "7d",
      },
    );

    return { token };
  }

  async createPasswordResetLink(adminUserId: string, dto: AdminResetPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: {
        id: true,
        email: true,
      },
    });

    if (!user) {
      throw new BadRequestException("Usuario no encontrado.");
    }

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = this.hashPasswordResetToken(rawToken);
    const expiresInMinutes = Number(this.configService.get<string>("PASSWORD_RESET_TTL_MINUTES") ?? 60);
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    await this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.deleteMany({
        where: {
          userId: user.id,
          usedAt: null,
        },
      });

      await tx.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
          requestedByAdminId: adminUserId,
        },
      });
    });

    return {
      userId: user.id,
      email: user.email,
      resetUrl: this.buildPasswordResetUrl(rawToken),
      expiresAt,
      expiresInMinutes,
    };
  }

  async validatePasswordResetToken(token: string) {
    const passwordResetToken = await this.findActivePasswordResetToken(token);

    if (!passwordResetToken) {
      throw new BadRequestException("El enlace de restablecimiento no es valido o ya expiro.");
    }

    return {
      valid: true,
      expiresAt: passwordResetToken.expiresAt,
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const passwordResetToken = await this.findActivePasswordResetToken(dto.token);

    if (!passwordResetToken) {
      throw new BadRequestException("El enlace de restablecimiento no es valido o ya expiro.");
    }

    const hashedPassword = await argon2.hash(dto.password);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: passwordResetToken.userId },
        data: {
          password: hashedPassword,
          passwordChangedAt: now,
        },
      });

      await tx.passwordResetToken.update({
        where: { id: passwordResetToken.id },
        data: {
          usedAt: now,
        },
      });

      await tx.passwordResetToken.deleteMany({
        where: {
          userId: passwordResetToken.userId,
          usedAt: null,
          id: { not: passwordResetToken.id },
        },
      });
    });

    return { reset: true };
  }

  async acceptTerms(userId: string, termsVersion?: string) {
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

  getAuthConfig(): { requireEmailVerification: boolean } {
    return { requireEmailVerification: this.requireEmailVerification };
  }

  private generateSixDigitsCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async signPendingSessionToken(
    userId: string,
    email: string,
    isVerified: boolean,
  ): Promise<string> {
    return this.jwtService.signAsync(
      {
        sub: userId,
        email,
        isVerified,
        scope: "pending_verification",
      } satisfies PendingSessionPayload,
      {
        expiresIn: this.configService.get<string>("JWT_PENDING_EXPIRES_IN") ?? "20m",
      },
    );
  }

  private async createPendingUserWithActivationCode(
    email: string,
    password: string,
    rawActivationCode: string,
  ): Promise<Pick<User, "id" | "email" | "isVerified">> {
    const normalizedCode = normalizeActivationCode(rawActivationCode);
    const candidates = this.buildActivationCodeCandidates(normalizedCode);
    const hashes = candidates.map((candidate) =>
      buildActivationCodeHash(candidate, this.activationCodePepper),
    );

    return this.prisma.$transaction(async (tx) => {
      const activations = await tx.activationCode.findMany({
        where: {
          OR: [
            { codeHash: { in: hashes } },
            { code: { in: candidates } },
          ],
        },
        select: {
          id: true,
          code: true,
          isUsed: true,
          status: true,
        },
        take: 5,
      });

      const activation =
        activations.find((row) => row.code.trim().toUpperCase() === normalizedCode) ||
        activations[0];

      if (
        !activation ||
        activation.isUsed ||
        activation.status !== ActivationCodeStatus.AVAILABLE
      ) {
        throw new ForbiddenException("Código de activación inválido o ya utilizado");
      }

      const existingUser = await tx.user.findUnique({ where: { email } });
      if (existingUser) {
        throw new BadRequestException("El email ya esta registrado.");
      }

      const hashedPassword = await argon2.hash(password);
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
        },
        select: {
          id: true,
          email: true,
          isVerified: true,
        },
      });

      await tx.medicalProfile.create({
        data: {
          userId: user.id,
          slug: `perfil-${randomUUID().slice(0, 8).toLowerCase()}`,
        },
        select: { id: true },
      });

      const updateResult = await tx.activationCode.updateMany({
        where: {
          id: activation.id,
          isUsed: false,
        },
        data: {
          isUsed: true,
          status: ActivationCodeStatus.ACTIVE,
          activatedAt: new Date(),
          usedAt: new Date(),
          userId: user.id,
        },
      });

      if (updateResult.count !== 1) {
        throw new ForbiddenException("Código de activación inválido o ya utilizado");
      }

      return user;
    });
  }

  private buildActivationCodeCandidates(normalizedCode: string): string[] {
    const upper = normalizedCode.trim().toUpperCase();
    const candidates = [upper];

    if (/^[A-F0-9]{8}$/.test(upper)) {
      candidates.push(`SOS-${upper.slice(0, 4)}-${upper.slice(4)}`);
    }

    return candidates;
  }

  private async findActivePasswordResetToken(token: string) {
    const tokenHash = this.hashPasswordResetToken(token);
    const now = new Date();

    return this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
      },
    });
  }

  private hashPasswordResetToken(token: string): string {
    return createHash("sha256").update(token.trim()).digest("hex");
  }

  private buildPasswordResetUrl(token: string): string {
    const rawSiteBase =
      this.configService.get<string>("PUBLIC_SITE_URL") ||
      this.configService.get<string>("PUBLIC_PROFILE_BASE_URL") ||
      "http://localhost:3000";
    const normalizedBase = rawSiteBase.replace(/\/$/, "");
    const siteBase = normalizedBase.endsWith("/p") ? normalizedBase.slice(0, -2) : normalizedBase;

    return `${siteBase}/reset-password/${encodeURIComponent(token)}`;
  }
}
