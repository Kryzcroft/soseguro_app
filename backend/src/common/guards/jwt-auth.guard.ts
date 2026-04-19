import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

type JwtPayload = {
  sub?: string;
  email?: string;
  isVerified?: boolean;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization as string | undefined;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedException("Token no proporcionado.");
    }

    const token = authHeader.slice(7);

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.get<string>("JWT_SECRET") ?? "change-me",
      });

      if (!payload.sub) {
        throw new UnauthorizedException("Token invalido.");
      }

      request.user = {
        id: payload.sub,
        email: payload.email,
        isVerified: payload.isVerified,
      };

      return true;
    } catch {
      throw new UnauthorizedException("Token invalido o expirado.");
    }
  }
}
