import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class PrivacyTermsGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id as string | undefined;

    if (!userId) {
      throw new ForbiddenException("Sesion invalida.");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        privacyAccepted: true,
        termsVersion: true,
      },
    });

    const currentTermsVersion = this.configService.get<string>("LEGAL_TERMS_VERSION") ?? "2026-04-15";

    if (!user || !user.privacyAccepted || user.termsVersion !== currentTermsVersion) {
      throw new ForbiddenException("Debes aceptar los terminos de Exposicion Publica de Datos de Salud.");
    }

    return true;
  }
}
