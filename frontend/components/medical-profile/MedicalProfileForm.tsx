"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { patchMedicalProfile } from "../../lib/medical-profile-api";
import {
  MedicalProfileFormValues,
  medicalProfileSchema,
} from "../../lib/medical-profile-schema";
import { MX_COUNTRY_CODE, normalizeToMxE164 } from "../../lib/mx-phone";
import { useAutoSave } from "../../hooks/useAutoSave";
import { EmergencyContactsSection } from "./EmergencyContactsSection";
import { MedicalInfoSection } from "./MedicalInfoSection";
import { PersonalInfoSection } from "./PersonalInfoSection";

type MedicalProfileFormProps = {
  initialValues?: MedicalProfileFormValues;
};

const defaultValues: MedicalProfileFormValues = {
  firstName: "",
  lastName: "",
  birthDate: "",
  weightKg: undefined,
  address: "",
  profession: "",
  photoUrl: "",
  bloodType: undefined,
  allergies: "",
  isOrganDonor: false,
  hasInsurance: false,
  insuranceName: "",
  policyNumber: "",
  hasChronicDiseases: false,
  chronicDiseases: "",
  hasMedications: false,
  medications: "",
  hasImplants: false,
  implants: "",
  medicalUnit: "",
  emergencyContacts: [
    {
      name: "",
      relationship: "",
      countryCode: "+52",
      phoneNumber: "",
    },
  ],
};

function buildPartialPayload(
  values: MedicalProfileFormValues,
  dirtyFields: Record<string, unknown>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  const has = (key: string) => Boolean(dirtyFields[key]);

  if (has("firstName")) payload.firstName = values.firstName || undefined;
  if (has("lastName")) payload.lastName = values.lastName || undefined;
  if (has("birthDate")) payload.birthDate = values.birthDate || undefined;
  if (has("weightKg")) payload.weightKg = values.weightKg;
  if (has("heightCm")) payload.heightCm = values.heightCm;
  if (has("address")) payload.address = values.address || undefined;
  if (has("profession")) payload.profession = values.profession || undefined;
  if (has("photoUrl")) payload.photoUrl = values.photoUrl || undefined;

  if (has("bloodType")) payload.bloodType = values.bloodType;
  if (has("allergies")) payload.allergies = values.allergies || undefined;
  if (has("isOrganDonor")) payload.isOrganDonor = values.isOrganDonor;

  if (has("hasInsurance") || has("insuranceName") || has("policyNumber")) {
    payload.hasInsurance = values.hasInsurance;
    payload.insuranceName = values.hasInsurance ? values.insuranceName || undefined : undefined;
    payload.policyNumber = values.hasInsurance ? values.policyNumber || undefined : undefined;
  }

  if (has("hasChronicDiseases") || has("chronicDiseases")) {
    payload.hasChronicDiseases = values.hasChronicDiseases;
    payload.chronicDiseases = values.hasChronicDiseases
      ? values.chronicDiseases || undefined
      : undefined;
  }

  if (has("hasMedications") || has("medications")) {
    payload.hasMedications = values.hasMedications;
    payload.medications = values.hasMedications ? values.medications || undefined : undefined;
  }

  if (has("hasImplants") || has("implants")) {
    payload.hasImplants = values.hasImplants;
    payload.implants = values.hasImplants ? values.implants || undefined : undefined;
  }

  if (has("medicalUnit")) payload.medicalUnit = values.medicalUnit || undefined;

  if (has("emergencyContacts")) {
    payload.emergencyContacts = values.emergencyContacts.map((contact) => ({
      ...contact,
      countryCode: MX_COUNTRY_CODE,
      phoneNumber: normalizeToMxE164(contact.phoneNumber),
    }));
  }

  return payload;
}

export function MedicalProfileForm({ initialValues }: MedicalProfileFormProps) {
  const router = useRouter();
  const [finalMessage, setFinalMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const form = useForm<MedicalProfileFormValues>({
    resolver: zodResolver(medicalProfileSchema),
    defaultValues,
    mode: "onTouched",
  });

  useEffect(() => {
    if (!initialValues) {
      return;
    }
    form.reset({
      ...defaultValues,
      ...initialValues,
    });
  }, [form, initialValues]);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setToastMessage(null);
    }, 2800);

    return () => window.clearTimeout(timeoutId);
  }, [toastMessage]);

  const address = form.watch("address") || "";
  const mapsUrl = useMemo(
    () => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
    [address],
  );

  const savePartial = useCallback(
    async (values: MedicalProfileFormValues, dirty: Record<string, unknown>) => {
      const payload = buildPartialPayload(values, dirty);
      if (Object.keys(payload).length === 0) {
        return;
      }
      await patchMedicalProfile(payload);
    },
    [],
  );

  const autoSave = useAutoSave({
    form,
    debounceMs: 2000,
    enabled: true,
    onSave: savePartial,
  });

  const handleFinalize = form.handleSubmit(async (values) => {
    if (values.emergencyContacts.length < 1) {
      form.setError("emergencyContacts", {
        type: "manual",
        message: "Agrega al menos 1 contacto para finalizar.",
      });
      setToastMessage({ type: "error", text: "Agrega al menos 1 contacto para finalizar." });
      return;
    }

    try {
      await patchMedicalProfile({
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
        emergencyContacts: values.emergencyContacts.map((contact) => ({
          ...contact,
          countryCode: MX_COUNTRY_CODE,
          phoneNumber: normalizeToMxE164(contact.phoneNumber),
        })),
      });

      setFinalMessage("Perfil medico finalizado correctamente.");
      setToastMessage({ type: "success", text: "Perfil guardado correctamente" });
      window.setTimeout(() => {
        router.push("/dashboard");
      }, 700);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo guardar el perfil.";
      setToastMessage({ type: "error", text: message });
      setFinalMessage(null);
    }
  });

  return (
    <form className="space-y-5" onSubmit={handleFinalize}>
      {toastMessage ? (
        <div
          className={`fixed right-4 top-4 z-50 rounded-lg px-4 py-3 text-sm font-medium shadow-lg transition-opacity ${
            toastMessage.type === "success"
              ? "bg-emerald-600 text-white"
              : "bg-rose-600 text-white"
          }`}
        >
          {toastMessage.text}
        </div>
      ) : null}

      <div className="rounded-lg border border-[#CDE3EA] bg-[#EDF8FC] px-4 py-3 text-sm text-[#1E4D65]">
        <p className="font-medium">Tus cambios se guardan automaticamente.</p>
        <p className="mt-1">
          {isUploadingPhoto
            ? "Subiendo foto..."
            : autoSave.status === "saving"
              ? "Guardando..."
              : autoSave.status === "saved"
                ? "Cambios guardados"
                : autoSave.status === "error"
                  ? `Error al guardar: ${autoSave.error}`
                  : "Sin cambios pendientes"}
        </p>
        {uploadError ? <p className="mt-1 text-[#9D2D2F]">{uploadError}</p> : null}
      </div>

      <PersonalInfoSection
        form={form}
        mapsUrl={mapsUrl}
        onUploadStateChange={(isUploading, error) => {
          setIsUploadingPhoto(isUploading);
          setUploadError(error);
        }}
      />

      <MedicalInfoSection form={form} />

      <EmergencyContactsSection form={form} />

      {form.formState.errors.emergencyContacts?.message ? (
        <p className="text-sm text-[#9D2D2F]">{form.formState.errors.emergencyContacts.message}</p>
      ) : null}

      {finalMessage ? <p className="text-sm text-[#176038]">{finalMessage}</p> : null}

      <button
        type="submit"
        disabled={form.watch("emergencyContacts").length < 1}
        className="rounded-md bg-[#0A5E7A] px-5 py-2 text-white disabled:opacity-50"
      >
        Finalizar
      </button>
    </form>
  );
}
