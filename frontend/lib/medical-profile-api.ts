import { MedicalProfileFormValues } from "./medical-profile-schema";
import { fetchWithAuth } from "./auth-client";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "http://localhost:3001";

export async function patchMedicalProfile(
  payload: Record<string, unknown>,
): Promise<void> {
  const response = await fetchWithAuth(`${API_BASE_URL}/profile`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const fallback = "No se pudo guardar el perfil";
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

export async function uploadProfilePhoto(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetchWithAuth(`${API_BASE_URL}/profile/photo`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const fallback = "No se pudo subir la imagen";
    let message = fallback;
    try {
      const body = await response.json();
      message = body.message || fallback;
    } catch {
      message = fallback;
    }
    throw new Error(Array.isArray(message) ? message.join(", ") : message);
  }

  const data = (await response.json()) as { photoUrl: string };
  return data.photoUrl;
}

export function mapFormToBackend(values: MedicalProfileFormValues): Record<string, unknown> {
  return {
    firstName: values.firstName || undefined,
    lastName: values.lastName || undefined,
    birthDate: values.birthDate || undefined,
    weightKg: values.weightKg,
    heightCm: values.heightCm,
    address: values.address || undefined,
    profession: values.profession || undefined,
    photoUrl: values.photoUrl || undefined,
    bloodType: values.bloodType,
    allergies: values.allergies || undefined,
    isOrganDonor: values.isOrganDonor,
    hasInsurance: values.hasInsurance,
    insuranceName: values.hasInsurance ? values.insuranceName || undefined : undefined,
    policyNumber: values.hasInsurance ? values.policyNumber || undefined : undefined,
    hasChronicDiseases: values.hasChronicDiseases,
    chronicDiseases: values.hasChronicDiseases ? values.chronicDiseases || undefined : undefined,
    hasMedications: values.hasMedications,
    medications: values.hasMedications ? values.medications || undefined : undefined,
    hasImplants: values.hasImplants,
    implants: values.hasImplants ? values.implants || undefined : undefined,
    medicalUnit: values.medicalUnit || undefined,
    emergencyContacts: values.emergencyContacts,
  };
}
