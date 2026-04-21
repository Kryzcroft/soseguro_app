import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { buildAdminEmailSet } from "../admin-identity";

type RequestUser = {
  id: string;
  email?: string;
};

@Injectable()
export class AdminOnlyGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = request.user;

    if (!user?.id) {
      throw new ForbiddenException("Acceso restringido a administradores.");
    }

    const allowedEmails = buildAdminEmailSet(this.configService.get<string>("ADMIN_EMAIL"));

    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        email: true,
      },
    });

    if (!dbUser || !allowedEmails.has(dbUser.email.toLowerCase())) {
      throw new ForbiddenException("Acceso restringido a administradores.");
    }

    return true;
  }
}
