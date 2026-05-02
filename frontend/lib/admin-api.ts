import { fetchWithAuth } from "./auth-client";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "http://localhost:3001";

export type ProfileStatus = "INCOMPLETO" | "COMPLETO";

export type AdminInventoryItem = {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profileStatus: ProfileStatus;
  profilePublicId: string | null;
  publicLink: string | null;
  isVerified: boolean;
  activationCode: {
    id: string;
    code: string;
    status?: "AVAILABLE" | "ACTIVE" | "REVOKED";
    isUsed: boolean;
    createdAt: string;
    usedAt: string | null;
    activatedAt?: string | null;
  } | null;
};

export type AdminActivationCodeRow = {
  id: string;
  code: string;
  status?: "AVAILABLE" | "ACTIVE" | "REVOKED";
  isUsed: boolean;
  createdAt: string;
  usedAt: string | null;
  activatedAt?: string | null;
  userId: string | null;
  userEmail: string | null;
};

export type AdminDashboardResponse = {
  inventory: AdminInventoryItem[];
  activationCodes: AdminActivationCodeRow[];
};

export type AdminPasswordResetLinkResponse = {
  userId: string;
  email: string;
  resetUrl: string;
  expiresAt: string;
  expiresInMinutes: number;
};

export async function fetchAdminDashboard(
  profileStatus?: ProfileStatus,
  search?: string,
): Promise<AdminDashboardResponse> {
  const params = new URLSearchParams();
  if (profileStatus) {
    params.set("profileStatus", profileStatus);
  }
  if (search?.trim()) {
    params.set("search", search.trim());
  }

  const response = await fetchWithAuth(
    `${API_BASE_URL}/admin/dashboard${params.toString() ? `?${params.toString()}` : ""}`,
  );

  if (response.status === 403) {
    throw new Error("Acceso denegado: esta vista solo esta habilitada para Cristian.");
  }

  if (!response.ok) {
    throw new Error("No se pudo cargar el inventario administrativo.");
  }

  return response.json() as Promise<AdminDashboardResponse>;
}

export async function assignActivationCode(userId: string, code: string): Promise<void> {
  const response = await fetchWithAuth(`${API_BASE_URL}/admin/dashboard/assign-code`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId, code: code.trim().toUpperCase() }),
  });

  if (response.status === 403) {
    throw new Error("Acceso denegado: esta vista solo esta habilitada para Cristian.");
  }

  if (!response.ok) {
    const fallback = "No se pudo asignar el codigo de activacion.";
    let message = fallback;

    try {
      const body = await response.json();
      message = body.message || fallback;
    } catch {
      message = fallback;
    }

    throw new Error(Array.isArray(message) ? message.join(", ") : message);
  }
}

export async function generateActivationCodes(quantity: number): Promise<{ requested: number; generated: number; codes: string[] }> {
  const response = await fetchWithAuth(`${API_BASE_URL}/admin/dashboard/generate-codes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ quantity }),
  });

  if (response.status === 403) {
    throw new Error("Acceso denegado: esta vista solo esta habilitada para Cristian.");
  }

  if (!response.ok) {
    const fallback = "No se pudieron generar codigos de activacion.";
    let message = fallback;

    try {
      const body = await response.json();
      message = body.message || fallback;
    } catch {
      message = fallback;
    }

    throw new Error(Array.isArray(message) ? message.join(", ") : message);
  }

  return response.json() as Promise<{ requested: number; generated: number; codes: string[] }>;
}

export async function approveUser(userId: string): Promise<{ approved: boolean; alreadyApproved: boolean }> {
  const response = await fetchWithAuth(`${API_BASE_URL}/admin/dashboard/approve-user`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId }),
  });

  if (response.status === 403) {
    throw new Error("Acceso denegado: esta vista solo esta habilitada para Cristian.");
  }

  if (!response.ok) {
    const fallback = "No se pudo aprobar la cuenta.";
    let message = fallback;

    try {
      const body = await response.json();
      message = body.message || fallback;
    } catch {
      message = fallback;
    }

    throw new Error(Array.isArray(message) ? message.join(", ") : message);
  }

  return response.json() as Promise<{ approved: boolean; alreadyApproved: boolean }>;
}

export async function deleteUserWithRelatedData(userId: string): Promise<{ deleted: boolean; userId: string; releasedActivationCodes: number }> {
  const response = await fetchWithAuth(`${API_BASE_URL}/admin/dashboard/delete-user`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId }),
  });

  if (response.status === 403) {
    throw new Error("Acceso denegado: esta vista solo esta habilitada para Cristian.");
  }

  if (!response.ok) {
    const fallback = "No se pudo eliminar la cuenta.";
    let message = fallback;

    try {
      const body = await response.json();
      message = body.message || fallback;
    } catch {
      message = fallback;
    }

    throw new Error(Array.isArray(message) ? message.join(", ") : message);
  }

  return response.json() as Promise<{ deleted: boolean; userId: string; releasedActivationCodes: number }>;
}

export async function createPasswordResetLink(userId: string): Promise<AdminPasswordResetLinkResponse> {
  const response = await fetchWithAuth(`${API_BASE_URL}/admin/dashboard/reset-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId }),
  });

  if (response.status === 403) {
    throw new Error("Acceso denegado: esta vista solo esta habilitada para Cristian.");
  }

  if (!response.ok) {
    const fallback = "No se pudo generar el enlace de restablecimiento.";
    let message = fallback;

    try {
      const body = await response.json();
      message = body.message || fallback;
    } catch {
      message = fallback;
    }

    throw new Error(Array.isArray(message) ? message.join(", ") : message);
  }

  return response.json() as Promise<AdminPasswordResetLinkResponse>;
}
