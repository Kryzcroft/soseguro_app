export const AUTH_TOKEN_KEY = "sos_token";
const LEGACY_TOKEN_KEY = "soseguro.authToken";

export class UnauthorizedError extends Error {
  constructor(message = "Sesion expirada") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (token) {
    return token;
  }

  const legacyToken = localStorage.getItem(LEGACY_TOKEN_KEY);
  if (legacyToken) {
    localStorage.setItem(AUTH_TOKEN_KEY, legacyToken);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    return legacyToken;
  }

  return null;
}

export function setAuthToken(token: string): void {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
}

export function clearAuthToken(): void {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
}

function decodeBase64Url(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4;
  const padded = padding === 0 ? normalized : normalized + "=".repeat(4 - padding);

  if (typeof window !== "undefined" && typeof window.atob === "function") {
    const binary = window.atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  return "";
}

export function getAuthEmailFromToken(token?: string | null): string | null {
  const rawToken = token ?? getAuthToken();
  if (!rawToken) {
    return null;
  }

  const parts = rawToken.split(".");
  if (parts.length < 2) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(parts[1])) as { email?: string };
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}

export async function fetchWithAuth(input: string, init: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();

  if (!token) {
    clearAuthToken();
    if (typeof window !== "undefined") {
      window.location.replace("/login");
    }
    throw new UnauthorizedError("No hay sesion activa");
  }

  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(input, {
    ...init,
    headers,
  });

  if (response.status === 401) {
    clearAuthToken();
    if (typeof window !== "undefined") {
      window.location.replace("/login");
    }
    throw new UnauthorizedError();
  }

  return response;
}