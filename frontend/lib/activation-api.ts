import { ActivateValues, BasicDataValues } from "./activation-schemas";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "http://localhost:3001";

async function postJson<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const fallback = "No se pudo completar la solicitud";
    let message = fallback;

    try {
      const body = await response.json();
      message = body.message || fallback;
    } catch {
      message = fallback;
    }

    throw new Error(Array.isArray(message) ? message.join(", ") : message);
  }

  return response.json() as Promise<T>;
}

export async function activateAccount(values: ActivateValues) {
  if (!values.activationCode) {
    throw new Error("El codigo de activacion es requerido para este flujo.");
  }

  return postJson<{ token: string; user: { id: string; email: string; isVerified: boolean }; requiresEmailVerification: boolean }>(
    "/auth/activate",
    {
      email: values.email,
      password: values.password,
      activationCode: values.activationCode.toUpperCase(),
    },
  );
}

export async function registerBasicAccount(values: ActivateValues) {
  return postJson<{ token: string; user: { id: string; email: string; isVerified: boolean }; requiresEmailVerification: boolean }>(
    "/auth/register-basic",
    {
      activationCode: values.activationCode.toUpperCase(),
      email: values.email,
      password: values.password,
    },
  );
}

export async function getActivationCodeStatus(code: string): Promise<{ status: "FREE" | "USED" | "NOT_FOUND" }> {
  const normalizedCode = code.trim().toUpperCase();
  const response = await fetch(`${API_BASE_URL}/auth/check-code?code=${encodeURIComponent(normalizedCode)}`);

  if (!response.ok) {
    throw new Error("No se pudo validar el codigo de activacion");
  }

  return response.json() as Promise<{ status: "FREE" | "USED" | "NOT_FOUND" }>;
}

export async function loginAccount(email: string, password: string): Promise<{ token: string }> {
  return postJson<{ token: string }>("/auth/login", { email, password });
}

export async function sendEmailCode(userId: string, values: BasicDataValues) {
  return postJson<{ sent: true; expiresInSeconds: number; skippedApproval?: boolean }>("/auth/send-email", {
    userId,
    firstName: values.firstName,
    lastName: values.lastName,
    phoneNumber: values.phoneNumber,
  });
}

export async function verifyEmailCode(userId: string, code: string) {
  return postJson<{ verified: true; token: string }>("/auth/verify-email", {
    userId,
    code,
  });
}
