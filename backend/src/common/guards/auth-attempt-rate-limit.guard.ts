import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  HttpException,
  Injectable,
} from "@nestjs/common";

type AttemptWindow = {
  count: number;
  resetAt: number;
};

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const store = new Map<string, AttemptWindow>();

function extractClientIp(request: {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}): string {
  const forwarded = request.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }

  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0]?.split(",")[0]?.trim() || "unknown";
  }

  return request.ip || request.socket?.remoteAddress || "unknown";
}

function assertRateLimit(key: string): void {
  const now = Date.now();
  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    store.set(key, {
      count: 1,
      resetAt: now + WINDOW_MS,
    });
    return;
  }

  if (current.count >= MAX_ATTEMPTS) {
    throw new HttpException(
      "Demasiados intentos. Intenta de nuevo en 15 minutos.",
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  current.count += 1;
  store.set(key, current);
}

@Injectable()
export class AuthActivateRateLimitGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const ip = extractClientIp(request);
    assertRateLimit(`activate:${ip}`);
    return true;
  }
}

@Injectable()
export class AuthCheckCodeRateLimitGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const ip = extractClientIp(request);
    assertRateLimit(`check-code:${ip}`);
    return true;
  }
}
