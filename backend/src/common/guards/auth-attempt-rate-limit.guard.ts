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

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS_ACTIVATE = 8;
const MAX_ATTEMPTS_CHECK_CODE = 60;
const MAX_ATTEMPTS_LOGIN = 5;
const MAX_ATTEMPTS_SEND_EMAIL = 3;
const MAX_ATTEMPTS_SMART_ACCESS = 30;

// Store with automatic cleanup every hour
const store = new Map<string, AttemptWindow>();

// Cleanup old entries every hour to prevent memory leak
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [key, value] of store.entries()) {
    if (value.resetAt <= now) {
      store.delete(key);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.log(`[RATE_LIMIT] Cleaned ${cleaned} expired entries from store`);
  }
}, 60 * 60 * 1000); // Every hour

function extractClientIp(request: {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}): string {
  // Check X-Forwarded-For header (Railway sets this)
  const forwarded = request.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }

  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0]?.split(",")[0]?.trim() || "unknown";
  }

  // Fallback to Express IP
  return request.ip || request.socket?.remoteAddress || "unknown";
}

function assertRateLimit(key: string, maxAttempts: number): void {
  const now = Date.now();
  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    // Window expired or first attempt
    store.set(key, {
      count: 1,
      resetAt: now + WINDOW_MS,
    });
    return;
  }

  if (current.count >= maxAttempts) {
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
    assertRateLimit(`activate:${ip}`, MAX_ATTEMPTS_ACTIVATE);
    return true;
  }
}

@Injectable()
export class AuthCheckCodeRateLimitGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const ip = extractClientIp(request);
    assertRateLimit(`check-code:${ip}`, MAX_ATTEMPTS_CHECK_CODE);
    return true;
  }
}

@Injectable()
export class AuthLoginRateLimitGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const ip = extractClientIp(request);
    assertRateLimit(`login:${ip}`, MAX_ATTEMPTS_LOGIN);
    return true;
  }
}

@Injectable()
export class AuthSendEmailRateLimitGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const ip = extractClientIp(request);
    assertRateLimit(`send-email:${ip}`, MAX_ATTEMPTS_SEND_EMAIL);
    return true;
  }
}

@Injectable()
export class SmartAccessRateLimitGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const ip = extractClientIp(request);
    assertRateLimit(`smart-access:${ip}`, MAX_ATTEMPTS_SMART_ACCESS);
    return true;
  }
}
