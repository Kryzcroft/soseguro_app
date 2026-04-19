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