import { fetchWithAuth } from "./auth-client";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "http://localhost:3001";

export type DashboardAccount = {
  user: {
    id: string;
    email: string;
    isVerified: boolean;
    privacyAccepted: boolean;
    termsAcceptedAt: string | null;
    termsVersion: string | null;
    isPublic: boolean;
  };
  medicalProfile: {
    id: string;
    userId: string;
    publicId: string;
    publicLink: string | null;
    slug: string;
    isPublic: boolean;
    birthDate: string | null;
    weightKg: number | null;
    heightCm: number | null;
    address: string | null;
    profession: string | null;
    bloodType: string | null;
    allergies: string | null;
    isOrganDonor: boolean;
    insuranceName: string | null;
    policyNumber: string | null;
    chronicDiseases: string | null;
    medications: string | null;
    implants: string | null;
    medicalUnit: string | null;
    emergencyContacts: Array<{
      id: string;
      name: string;
      relationship: string;
      countryCode: string;
      phoneNumber: string;
    }>;
    photoUrl: string | null;
    firstName: string | null;
    lastName: string | null;
  } | null;
};

export async function fetchDashboardProfile(): Promise<DashboardAccount | null> {
  const response = await fetchWithAuth(`${API_BASE_URL}/profile/me`);

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error("No se pudo cargar el dashboard");
  }

  return response.json() as Promise<DashboardAccount>;
}

export async function acceptPrivacyTerms(termsVersion: string): Promise<{ privacyAccepted: boolean; termsAcceptedAt: string | null; termsVersion: string | null }> {
  const response = await fetchWithAuth(`${API_BASE_URL}/auth/accept-terms`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ termsVersion }),
  });

  if (!response.ok) {
    throw new Error("No se pudo registrar la aceptacion legal");
  }

  return response.json() as Promise<{ privacyAccepted: boolean; termsAcceptedAt: string | null; termsVersion: string | null }>;
}

export async function updateProfileVisibility(isPublic: boolean): Promise<{ slug: string; isPublic: boolean }> {
  const response = await fetchWithAuth(`${API_BASE_URL}/profile/visibility`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ isPublic }),
  });

  if (!response.ok) {
    throw new Error("No se pudo actualizar la visibilidad");
  }

  return response.json() as Promise<{ slug: string; isPublic: boolean }>;
}
