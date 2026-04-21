const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "http://localhost:3001";

export type SmartAccessResolution =
  | {
      state: "INVALID";
      message: string;
    }
  | {
      state: "REGISTER";
      activationCode: string;
      redirectPath: string;
    }
  | {
      state: "PUBLIC_PROFILE";
      activationCode: string;
      publicId: string;
      redirectPath: string;
    };

export async function resolveSmartAccess(activationCode: string): Promise<SmartAccessResolution> {
  const normalizedCode = activationCode.trim().toUpperCase();
  const response = await fetch(
    `${API_BASE_URL}/public/access/${encodeURIComponent(normalizedCode)}`,
    {
      method: "GET",
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error("No fue posible resolver el acceso de la etiqueta.");
  }

  return response.json() as Promise<SmartAccessResolution>;
}
