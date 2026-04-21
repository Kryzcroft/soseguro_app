"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MedicalProfileForm } from "../../components/medical-profile/MedicalProfileForm";
import { PrivacyWall } from "../../components/legal/PrivacyWall";
import { acceptPrivacyTerms, fetchDashboardProfile } from "../../lib/dashboard-api";
import { isAdminEmail } from "../../lib/admin-identity";
import { getAuthEmailFromToken, getAuthToken, UnauthorizedError } from "../../lib/auth-client";
import { CURRENT_TERMS_VERSION } from "../../lib/legal";
import { MedicalProfileFormValues } from "../../lib/medical-profile-schema";
import { MX_COUNTRY_CODE, toMxE164FromBackend } from "../../lib/mx-phone";

const emptyFormValues: MedicalProfileFormValues = {
  firstName: "",
  lastName: "",
  birthDate: "",
  weightKg: undefined,
  heightCm: undefined,
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

const BLOOD_TYPES = [
  "A_POSITIVE",
  "A_NEGATIVE",
  "B_POSITIVE",
  "B_NEGATIVE",
  "AB_POSITIVE",
  "AB_NEGATIVE",
  "O_POSITIVE",
  "O_NEGATIVE",
] as const;

function toBloodType(value: string | null | undefined): MedicalProfileFormValues["bloodType"] {
  if (!value) {
    return undefined;
  }

  return (BLOOD_TYPES as readonly string[]).includes(value)
    ? (value as MedicalProfileFormValues["bloodType"])
    : undefined;
}

function toFormValues(account: Awaited<ReturnType<typeof fetchDashboardProfile>>): MedicalProfileFormValues {
  const profile = account?.medicalProfile;
  if (!profile) {
    return emptyFormValues;
  }

  return {
    firstName: profile.firstName || "",
    lastName: profile.lastName || "",
    birthDate: profile.birthDate ? String(profile.birthDate).slice(0, 10) : "",
    weightKg: profile.weightKg !== null ? Number(profile.weightKg) : undefined,
    heightCm: profile.heightCm !== null ? Number(profile.heightCm) : undefined,
    address: profile.address || "",
    profession: profile.profession || "",
    photoUrl: profile.photoUrl || "",
    bloodType: toBloodType(profile.bloodType),
    allergies: profile.allergies || "",
    isOrganDonor: profile.isOrganDonor ?? false,
    hasInsurance: Boolean(profile.insuranceName || profile.policyNumber),
    insuranceName: profile.insuranceName || "",
    policyNumber: profile.policyNumber || "",
    hasChronicDiseases: Boolean(profile.chronicDiseases),
    chronicDiseases: profile.chronicDiseases || "",
    hasMedications: Boolean(profile.medications),
    medications: profile.medications || "",
    hasImplants: Boolean(profile.implants),
    implants: profile.implants || "",
    medicalUnit: profile.medicalUnit || "",
    emergencyContacts:
      profile.emergencyContacts.length > 0
        ? profile.emergencyContacts.map((contact) => ({
            name: contact.name,
            relationship: contact.relationship,
            countryCode: MX_COUNTRY_CODE,
            phoneNumber: toMxE164FromBackend(contact.countryCode, contact.phoneNumber),
          }))
        : emptyFormValues.emergencyContacts,
  };
}

export default function PerfilMedicoPage() {
  const router = useRouter();
  const [hasSession, setHasSession] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [account, setAccount] = useState<Awaited<ReturnType<typeof fetchDashboardProfile>>>(null);
  const [isLoadingAccount, setIsLoadingAccount] = useState(false);
  const [initialValues, setInitialValues] = useState<MedicalProfileFormValues>(emptyFormValues);

  useEffect(() => {
    const saved = getAuthToken();
    if (!saved) {
      router.replace("/login");
      return;
    }

    const email = getAuthEmailFromToken(saved);
    if (isAdminEmail(email)) {
      router.replace("/admin/dashboard");
      return;
    }

    setHasSession(true);
    setIsReady(true);
  }, [router]);

  useEffect(() => {
    if (!isReady || !hasSession) {
      return;
    }

    let active = true;
    const loadAccount = async () => {
      setIsLoadingAccount(true);
      try {
        const data = await fetchDashboardProfile();
        if (active) {
          setAccount(data);
          setInitialValues(toFormValues(data));
        }
      } catch (error) {
        if (error instanceof UnauthorizedError) {
          return;
        }
      } finally {
        if (active) {
          setIsLoadingAccount(false);
        }
      }
    };

    loadAccount();

    return () => {
      active = false;
    };
  }, [hasSession, isReady]);

  const requiresPrivacyConsent = Boolean(
    account && (!account.user.privacyAccepted || account.user.termsVersion !== CURRENT_TERMS_VERSION),
  );

  const handleAcceptTerms = async () => {
    const result = await acceptPrivacyTerms(CURRENT_TERMS_VERSION);
    setAccount((current) =>
      current
        ? {
            ...current,
            user: {
              ...current.user,
              privacyAccepted: result.privacyAccepted,
              termsAcceptedAt: result.termsAcceptedAt,
              termsVersion: result.termsVersion,
            },
          }
        : current,
    );
  };

  if (!isReady || !hasSession) {
    return <main className="mx-auto max-w-xl p-6">Cargando...</main>;
  }

  return (
    <main className="min-h-screen bg-[#F3F7FB] px-4 py-10">
      <section className="mx-auto w-full max-w-4xl space-y-6">
        <header className="rounded-xl bg-[#0A2A43] px-6 py-5 text-white">
          <h1 className="text-2xl font-semibold">Perfil Medico SOSeguro</h1>
          <p className="mt-1 text-sm text-[#CBE8F1]">
            Completa tu informacion. Se guarda automaticamente mientras escribes.
          </p>
        </header>

        <PrivacyWall
          isOpen={requiresPrivacyConsent}
          termsVersion={CURRENT_TERMS_VERSION}
          onAccept={handleAcceptTerms}
        />

        <MedicalProfileForm initialValues={initialValues} />

        {isLoadingAccount ? (
          <div className="rounded-xl border border-[#D8DEE8] bg-white p-5 text-sm text-[#49657A]">
            Verificando consentimiento legal...
          </div>
        ) : null}
      </section>
    </main>
  );
}
