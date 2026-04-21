"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardSkeleton } from "../../components/dashboard/DashboardSkeleton";
import { QRCard } from "../../components/dashboard/QRCard";
import { PrivacyWall } from "../../components/legal/PrivacyWall";
import {
  acceptPrivacyTerms,
  fetchDashboardProfile,
  unlinkActivationCode,
  updateProfileVisibility,
} from "../../lib/dashboard-api";
import { getAuthToken } from "../../lib/auth-client";
import { CURRENT_TERMS_VERSION } from "../../lib/legal";

const SOS_LOGO = "/sos-logo-light.png";

function bloodTypeLabel(value?: string | null): string {
  if (!value) {
    return "N/A";
  }

  return value
    .replace("_POSITIVE", " +")
    .replace("_NEGATIVE", " -")
    .replace("_", "");
}

function isMedicalProfileComplete(profile: Awaited<ReturnType<typeof fetchDashboardProfile>>["medicalProfile"]): boolean {
  if (!profile) {
    return false;
  }

  return Boolean(
    profile.firstName?.trim() &&
      profile.lastName?.trim() &&
      profile.birthDate &&
      profile.bloodType &&
      profile.address?.trim() &&
      profile.emergencyContacts.length > 0,
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [hasSession, setHasSession] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [account, setAccount] = useState<Awaited<ReturnType<typeof fetchDashboardProfile>>>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);
  const [isUnlinkingLabel, setIsUnlinkingLabel] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      router.replace("/login");
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
    const load = async () => {
      setIsLoading(true);
      setMessage(null);
      try {
        const data = await fetchDashboardProfile();
        if (active) {
          if (!isMedicalProfileComplete(data?.medicalProfile ?? null)) {
            router.replace("/perfil-medico");
            return;
          }

          setAccount(data);
        }
      } catch (error) {
        if (active) {
          setMessage(error instanceof Error ? error.message : "Error inesperado");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [hasSession, isReady, router]);

  const profileUrl = useMemo(() => {
    const dbPublicLink = account?.medicalProfile?.publicLink?.trim();
    if (dbPublicLink) {
      return dbPublicLink;
    }

    const publicId = account?.medicalProfile?.publicId || account?.medicalProfile?.slug;
    if (!publicId) return "";
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
      (typeof window !== "undefined" ? window.location.origin : "");
    return `${baseUrl}/p/${publicId}`;
  }, [account?.medicalProfile?.publicLink, account?.medicalProfile?.publicId, account?.medicalProfile?.slug]);

  const requiresPrivacyConsent = Boolean(
    account && (!account.user.privacyAccepted || account.user.termsVersion !== CURRENT_TERMS_VERSION),
  );

  const medicalProfile = account?.medicalProfile;
  const isProfilePublic = Boolean(account?.medicalProfile?.isPublic);
  const emergencyContactsCount = medicalProfile?.emergencyContacts.length || 0;
  const completionChecks = [
    Boolean(medicalProfile?.firstName?.trim()),
    Boolean(medicalProfile?.lastName?.trim()),
    Boolean(medicalProfile?.birthDate),
    Boolean(medicalProfile?.bloodType),
    Boolean(medicalProfile?.address?.trim()),
    emergencyContactsCount > 0,
  ];
  const completionScore = Math.round((completionChecks.filter(Boolean).length / completionChecks.length) * 100);
  const hasAllergies = Boolean(medicalProfile?.allergies?.trim());
  const hasClinicalFlags = Boolean(
    hasAllergies ||
      medicalProfile?.chronicDiseases?.trim() ||
      medicalProfile?.medications?.trim() ||
      medicalProfile?.implants?.trim(),
  );

  const handleVisibilityToggle = async () => {
    if (!account?.medicalProfile) return;
    setIsUpdatingVisibility(true);
    setMessage(null);
    try {
      const result = await updateProfileVisibility(!isProfilePublic);
      setAccount({
        ...account,
        user: {
          ...account.user,
          isPublic: result.isPublic,
        },
        medicalProfile: {
          ...account.medicalProfile,
          isPublic: result.isPublic,
        },
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar la visibilidad");
    } finally {
      setIsUpdatingVisibility(false);
    }
  };

  const handleAcceptTerms = async () => {
    try {
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
    } finally {
    }
  };

  const handleUnlinkLabel = async () => {
    const linkedCode = account?.linkedActivationCode?.code;
    if (!linkedCode) {
      setMessage("No tienes una etiqueta vinculada para desvincular.");
      return;
    }

    const confirmed = window.confirm(
      `¿Desvincular la etiqueta ${linkedCode}? Quedará disponible para otra activación.`,
    );
    if (!confirmed) {
      return;
    }

    setIsUnlinkingLabel(true);
    setMessage(null);
    try {
      await unlinkActivationCode(linkedCode);
      setAccount((current) =>
        current
          ? {
              ...current,
              linkedActivationCode: null,
            }
          : current,
      );
      setMessage("Etiqueta desvinculada correctamente. Ahora puedes activar una nueva etiqueta desde /a/:id.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo desvincular la etiqueta");
    } finally {
      setIsUnlinkingLabel(false);
    }
  };

  if (!isReady || isLoading) {
    return <DashboardSkeleton />;
  }

  if (!hasSession) {
    return <DashboardSkeleton />;
  }

  if (!account) {
    return (
      <main className="min-h-screen bg-[#F5F7FA] p-6">
        <div className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-6 text-slate-700">
          No se encontro un perfil medico asociado a esta cuenta.
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-soseguro-light px-4 py-8 text-soseguro-navy md:px-8">
      <section className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-[10px] bg-soseguro-navy px-6 py-5 text-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/80">Kryzcroft Defender</p>
            <img src={SOS_LOGO} alt="Logo SOSeguro" className="h-11 w-auto rounded-md bg-white p-1" />
          </div>
          <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-bold">Dashboard SOSeguro</h1>
              <p className="mt-1 text-sm text-white/85">Gestion de identidad, QR y visibilidad publica.</p>
            </div>
            <div
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                account.user.isVerified ? "bg-emerald-500/90 text-white" : "bg-soseguro-emergency text-white"
              }`}
            >
              Cuenta: {account.user.isVerified ? "Verificada" : "Pendiente"}
            </div>
          </div>
        </header>

        <PrivacyWall
          isOpen={requiresPrivacyConsent}
          termsVersion={CURRENT_TERMS_VERSION}
          onAccept={handleAcceptTerms}
        />

        {message ? (
          <div className="rounded-[10px] border border-soseguro-emergency/40 bg-[#FFF1F3] px-4 py-3 text-sm text-soseguro-emergency">{message}</div>
        ) : null}

        <section className="rounded-[10px] border border-soseguro-navy/10 bg-white p-5 shadow-sm">
          <div className="flex justify-center">
            <Link
              href="/emergencia"
              className="inline-flex w-full max-w-md items-center justify-center rounded-[10px] bg-soseguro-emergency px-8 py-4 text-lg font-bold tracking-[0.04em] text-white shadow-sm transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]"
            >
              ACTIVAR SOS
            </Link>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-3">
          <section className="rounded-[10px] border border-soseguro-navy/10 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold uppercase text-slate-500">Resumen</p>
              <span className="rounded-full bg-soseguro-navy/10 px-3 py-1 text-xs font-semibold text-soseguro-navy">
                Perfil {completionScore}%
              </span>
            </div>

            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-soseguro-navy" style={{ width: `${completionScore}%` }} />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Tipo de sangre</p>
                <p className="mt-1 text-lg font-bold text-soseguro-navy">{bloodTypeLabel(account.medicalProfile?.bloodType)}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Alergias</p>
                <p className={`mt-1 text-sm font-semibold ${hasAllergies ? "text-soseguro-emergency" : "text-emerald-600"}`}>
                  {hasAllergies ? "Declaradas" : "Sin registro"}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Contactos</p>
                <p className="mt-1 text-lg font-bold text-soseguro-navy">{emergencyContactsCount}</p>
              </div>
            </div>

            {hasClinicalFlags ? (
              <div className="mt-4 rounded-lg border border-soseguro-emergency/20 bg-[#FFF5F6] px-3 py-2 text-xs text-soseguro-emergency">
                Se detectaron datos medicos sensibles. Revisa que la informacion critica este actualizada.
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                Sin alertas clinicas registradas.
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <Link
                href="/perfil-medico"
                className="inline-flex w-full items-center justify-center rounded-md border border-soseguro-navy bg-soseguro-navy px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#1A2E44]"
              >
                Actualizar datos medicos
              </Link>
            </div>
          </section>

          {account.medicalProfile ? (
            <QRCard profileUrl={profileUrl} logoUrl={SOS_LOGO} title={`SOSeguro ${account.medicalProfile.slug}`} />
          ) : (
            <section className="rounded-[10px] border border-soseguro-navy/10 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Codigo QR</h3>
              <p className="mt-2 text-sm text-slate-600">Aun no existe una ficha medica completa. Completa el perfil para generar tu QR.</p>
            </section>
          )}

          <section className="rounded-[10px] border border-soseguro-navy/10 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold uppercase text-slate-500">Privacidad</p>
            <div className="mt-3 flex items-center justify-between gap-4">
              <div>
                <p className="text-lg font-semibold">Perfil publico</p>
                <p className="text-sm text-slate-600">
                  {isProfilePublic ? "Visible al escanear QR/NFC" : "Desactivado temporalmente"}
                </p>
              </div>
              <button
                type="button"
                onClick={handleVisibilityToggle}
                disabled={isUpdatingVisibility}
                className={`relative inline-flex h-10 w-20 items-center rounded-full transition ${isProfilePublic ? "bg-emerald-500" : "bg-slate-300"}`}
              >
                <span
                  className={`inline-block h-8 w-8 transform rounded-full bg-white transition ${isProfilePublic ? "translate-x-11" : "translate-x-1"}`}
                />
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-500">Este switch desactiva instantaneamente la visibilidad de tu perfil.</p>
          </section>

          <section className="rounded-[10px] border border-soseguro-navy/10 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold uppercase text-slate-500">Etiqueta vinculada</p>
            {account.linkedActivationCode ? (
              <>
                <p className="mt-2 text-lg font-bold text-soseguro-navy">{account.linkedActivationCode.code}</p>
                <p className="mt-1 text-sm text-slate-600">
                  Estado: {account.linkedActivationCode.status} · Activada: {account.linkedActivationCode.activatedAt ? new Date(account.linkedActivationCode.activatedAt).toLocaleString("es-MX") : "N/A"}
                </p>
                <button
                  type="button"
                  onClick={handleUnlinkLabel}
                  disabled={isUnlinkingLabel}
                  className="mt-4 inline-flex w-full items-center justify-center rounded-md border border-soseguro-emergency px-3 py-2 text-sm font-semibold text-soseguro-emergency transition hover:bg-[#FFF1F3] disabled:opacity-50"
                >
                  {isUnlinkingLabel ? "Desvinculando..." : "Desvincular etiqueta"}
                </button>
              </>
            ) : (
              <p className="mt-2 text-sm text-slate-600">No hay etiqueta activa vinculada a tu cuenta.</p>
            )}
          </section>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-[10px] border border-soseguro-navy/10 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold uppercase text-slate-500">Soporte</p>
            <div className="mt-3 space-y-3">
              <a
                href="mailto:soporte@soseguro.app?subject=Soporte%20SOSeguro"
                className="flex items-center justify-between gap-4 rounded-[10px] border border-soseguro-navy/20 bg-gradient-to-r from-soseguro-navy to-[#1A2E44] px-4 py-4 text-white shadow-sm transition duration-150 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
              >
                <span>
                  <span className="block text-sm font-semibold">Reportar problema con NFC</span>
                  <span className="mt-1 block text-xs text-white/80">Escribe al equipo si el chip no abre tu perfil o falla la activacion.</span>
                </span>
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white">
                  Soporte
                </span>
              </a>
            </div>
          </section>
        </div>

        <footer className="rounded-[10px] border border-soseguro-navy/10 bg-white px-4 py-3 text-xs text-slate-500 shadow-sm">
          SOSeguro no verifica la veracidad de los datos. El usuario es responsable de su informacion.
        </footer>
      </section>
    </main>
  );
}
