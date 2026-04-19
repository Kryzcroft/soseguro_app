"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

type PublicProfileViewProps = {
  publicId: string;
};

type PublicProfile = {
  slug: string;
  fullName: string;
  birthDate: string | null;
  address: string | null;
  profession: string | null;
  heightCm: string | null;
  weightKg: string | null;
  bloodType: string | null;
  allergies: string | null;
  isOrganDonor: boolean | null;
  insuranceName: string | null;
  policyNumber: string | null;
  chronicDiseases: string | null;
  medications: string | null;
  implants: string | null;
  medicalUnit: string | null;
  photoUrl: string | null;
  emergencyContacts: Array<{
    name: string;
    relationship: string;
    phone: string;
  }>;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "http://localhost:3001";
const PLACEHOLDER_PHOTO = "/avatar-placeholder.svg";
const SOS_LOGO = "/sos-logo-light.png";

function bloodTypeLabel(value: string | null): string {
  if (!value) return "No especificado";
  return value
    .replace("_POSITIVE", "+")
    .replace("_NEGATIVE", "-")
    .replace("_", "");
}

function buildEmergencyMessage(fullName: string, latitude?: number, longitude?: number) {
  const hasCoords = typeof latitude === "number" && typeof longitude === "number";
  const locationLine = hasCoords
    ? `Ubicacion: https://www.google.com/maps?q=${latitude},${longitude}`
    : "Ubicacion: Ubicacion no disponible, por favor intentar contactar al usuario directamente";

  return `EMERGENCIA de ${fullName}: Hola. El usuario tiene una emergencia en esta ubicacion.\n${locationLine}\nEnviado desde App SOSeguro.`;
}

function getAgeLabel(birthDate: string | null): string {
  if (!birthDate) return "No especificado";

  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return "No especificado";

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }

  return `${age}`;
}

function formatMetric(value: string | null, unit: string): string {
  if (!value) return "No especificado";
  return `${value} ${unit}`;
}

export function PublicProfileView({ publicId }: PublicProfileViewProps) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);
  const [locationStatus, setLocationStatus] = useState<
    "idle" | "requesting" | "granted" | "denied" | "unavailable"
  >("idle");

  const [showChannels, setShowChannels] = useState(false);
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [alertSent, setAlertSent] = useState(false);
  const [alertResult, setAlertResult] = useState<string | null>(null);
  const [isPhotoBroken, setIsPhotoBroken] = useState(false);

  useEffect(() => {
    if (!publicId) return;

    let active = true;

    const fetchProfile = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetch(`${API_BASE_URL}/public/profile/${publicId}`);
        if (!response.ok) {
          try {
            const body = await response.json();
            throw new Error(body.message || "No se pudo cargar el perfil publico.");
          } catch {
            throw new Error("No se pudo cargar el perfil publico.");
          }
        }
        const data = (await response.json()) as PublicProfile;
        if (active) {
          setProfile(data);
        }
      } catch (error) {
        if (active) {
          setErrorMessage(error instanceof Error ? error.message : "Error inesperado");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    fetchProfile();

    return () => {
      active = false;
    };
  }, [publicId]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus("unavailable");
      return;
    }

    setLocationStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
        setLocationStatus("granted");
      },
      () => {
        setLocationStatus("denied");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      },
    );
  }, []);

  const messagePreview = useMemo(
    () => buildEmergencyMessage(profile?.fullName || "Usuario SOSeguro", latitude, longitude),
    [profile?.fullName, latitude, longitude],
  );

  const profilePhotoSrc = useMemo(() => {
    const raw = profile?.photoUrl?.trim();
    if (!raw) {
      return PLACEHOLDER_PHOTO;
    }

    if (/^https?:\/\//i.test(raw)) {
      return raw;
    }

    if (raw.startsWith("/")) {
      return `${API_BASE_URL}${raw}`;
    }

    return `${API_BASE_URL}/${raw}`;
  }, [profile?.photoUrl]);

  useEffect(() => {
    setIsPhotoBroken(false);
  }, [profilePhotoSrc]);

  const mapEmbedUrl =
    typeof latitude === "number" && typeof longitude === "number"
      ? `https://maps.google.com/maps?q=${latitude},${longitude}&z=16&output=embed`
      : null;

  const handleSendSmsAlert = async () => {
    if (!publicId || alertSent || isSendingSms) {
      return;
    }

    setIsSendingSms(true);
    setAlertResult(null);

    try {
      const response = await fetch(`${API_BASE_URL}/public/alert/${publicId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ latitude, longitude }),
      });

      if (!response.ok) {
        throw new Error("No fue posible enviar la alerta por SMS.");
      }

      const data = (await response.json()) as { sentCount: number; channel: string };
      setAlertSent(true);
      setAlertResult(`Alerta enviada a ${data.sentCount} contacto(s) por ${data.channel}.`);
    } catch (error) {
      setAlertResult(error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setIsSendingSms(false);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-soseguro-light p-6 text-soseguro-navy">
        <p className="text-xl font-bold">Cargando informacion medica...</p>
      </main>
    );
  }

  if (errorMessage || !profile) {
    return (
      <main className="min-h-screen bg-soseguro-light p-6 text-soseguro-navy">
        <p className="text-xl font-bold text-soseguro-emergency">{errorMessage || "Perfil no encontrado"}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-soseguro-light px-4 py-6 text-soseguro-navy md:px-8">
      <section className="mx-auto max-w-4xl space-y-4">
        <motion.header
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="rounded-[10px] border border-soseguro-navy/10 bg-white p-5 shadow-sm"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-soseguro-navy/70">Perfil publico de emergencia</p>
            </div>
            <img src={SOS_LOGO} alt="Logo SOSeguro" className="h-16 w-auto md:h-20" />
          </div>
          <div className="mb-5 flex justify-center">
            <div className="h-40 w-40 overflow-hidden rounded-full border-4 border-white shadow-xl ring-4 ring-soseguro-navy/10">
              <img
                src={isPhotoBroken ? PLACEHOLDER_PHOTO : profilePhotoSrc}
                alt={`Foto de ${profile.fullName}`}
                className="h-full w-full object-cover"
                onError={() => setIsPhotoBroken(true)}
              />
            </div>
          </div>

          <h1 className="mt-1 text-3xl font-extrabold leading-tight md:text-4xl">{profile.fullName}</h1>
          {profile.address ? <p className="mt-1 text-lg font-semibold">{profile.address}</p> : null}

          <div className="mt-4 grid grid-cols-1 gap-2 text-base font-medium text-soseguro-navy/85 md:grid-cols-2">
            <p>
              <span className="font-bold">Edad:</span> {getAgeLabel(profile.birthDate)}
            </p>
            <p>
              <span className="font-bold">Altura:</span> {formatMetric(profile.heightCm, "cm")}
            </p>
            <p>
              <span className="font-bold">Peso:</span> {formatMetric(profile.weightKg, "kg")}
            </p>
            <p>
              <span className="font-bold">Profesion:</span> {profile.profession || "No especificado"}
            </p>
          </div>
        </motion.header>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.05 }}
          className="rounded-[10px] border border-soseguro-navy/10 bg-white p-5"
        >
          <h2 className="text-2xl font-extrabold text-soseguro-navy">Datos Criticos</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <article className="rounded-[10px] border border-soseguro-navy/10 bg-white p-4">
              <p className="text-sm font-bold uppercase text-soseguro-navy">Grupo sanguineo</p>
              <p className="mt-1 text-3xl font-extrabold">{bloodTypeLabel(profile.bloodType)}</p>
            </article>
            <article className="rounded-[10px] border border-soseguro-emergency/30 bg-[#FFF1F3] p-4">
              <p className="text-sm font-bold uppercase text-soseguro-emergency">Alergias</p>
              <p className="mt-1 text-xl font-bold text-soseguro-emergency">{profile.allergies || "No especificado"}</p>
            </article>
          </div>
        </motion.section>

        <section className="rounded-[10px] border border-soseguro-navy/10 bg-white p-5">
          <h2 className="text-2xl font-bold">Informacion Medica</h2>
          <div className="mt-3 grid grid-cols-1 gap-2 text-lg">
            <p>
              <span className="font-bold">Donante de organos:</span>{" "}
              {profile.isOrganDonor === null ? "No especificado" : profile.isOrganDonor ? "Si" : "No"}
            </p>
            <p>
              <span className="font-bold">Enfermedades cronicas:</span> {profile.chronicDiseases || "No especificado"}
            </p>
            <p>
              <span className="font-bold">Medicamentos:</span> {profile.medications || "No especificado"}
            </p>
            <p>
              <span className="font-bold">Implantes:</span> {profile.implants || "No especificado"}
            </p>
            <p>
              <span className="font-bold">Unidad de Atención Médica:</span> {profile.medicalUnit || "No especificado"}
            </p>
          </div>
        </section>

        {profile.policyNumber?.trim() ? (
          <section className="rounded-[10px] border border-soseguro-navy/10 bg-white p-5">
            <h2 className="text-2xl font-bold">Seguro</h2>
            <div className="mt-3 grid grid-cols-1 gap-2 text-lg">
              <p>
                <span className="font-bold">Nombre de la aseguradora:</span> {profile.insuranceName || "No especificado"}
              </p>
              <p>
                <span className="font-bold">Numero de poliza:</span> {profile.policyNumber}
              </p>
            </div>
          </section>
        ) : null}

        <section className="rounded-[10px] border border-soseguro-navy/10 bg-white p-5">
          <h2 className="text-2xl font-bold">Ubicacion del Incidente</h2>
          <p className="mt-1 text-base">
            {locationStatus === "granted"
              ? "Ubicacion detectada."
              : "Ubicacion no disponible, por favor intentar contactar al usuario directamente."}
          </p>
          {mapEmbedUrl ? (
            <iframe
              title="Mapa de incidente"
              src={mapEmbedUrl}
              className="mt-3 h-64 w-full rounded-lg border"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : null}
        </section>

        <section className="rounded-[10px] border border-soseguro-navy bg-soseguro-navy p-5 text-white">
          <h2 className="text-2xl font-extrabold">Boton de Panico</h2>
          <p className="mt-2 text-base font-medium">
            Notifica a contactos de emergencia con un solo toque. Evita pulsarlo varias veces.
          </p>

          <button
            type="button"
            className="mt-4 w-full rounded-[10px] bg-soseguro-emergency px-5 py-4 text-xl font-extrabold text-white transition-transform duration-150 active:scale-[0.99] flex items-center justify-between"
            onClick={() => setShowChannels((v) => !v)}
            disabled={alertSent}
          >
            <span>{alertSent ? "Alerta ya enviada" : "Notificar a Contactos de Emergencia"}</span>
            <ChevronDown
              size={24}
              className={`transition-transform duration-300 ${showChannels ? "rotate-180" : "rotate-0"}`}
            />
          </button>

          {showChannels && !alertSent ? (
            <div className="mt-4 space-y-4 rounded-[10px] bg-white p-4 text-soseguro-navy">
              <h3 className="text-lg font-bold">Selecciona canal</h3>

              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {profile.emergencyContacts.map((contact) => {
                  const url = `https://wa.me/${contact.phone.replace(/\D/g, "")}?text=${encodeURIComponent(messagePreview)}`;
                  return (
                    <a
                      key={`${contact.phone}-${contact.name}`}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full rounded-[10px] border border-[#1FAF38] bg-[#25D366] px-4 py-3 text-lg font-bold text-white shadow-sm transition-colors hover:bg-[#1DA851]"
                    >
                      WhatsApp: {contact.name}
                    </a>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={handleSendSmsAlert}
                disabled={isSendingSms || alertSent}
                className="w-full rounded-[10px] bg-soseguro-emergency px-4 py-3 text-lg font-bold text-white disabled:opacity-50"
              >
                {isSendingSms ? "Enviando SMS..." : "Enviar SMS automatico"}
              </button>
            </div>
          ) : null}

          {alertResult ? <p className="mt-3 text-sm font-semibold">{alertResult}</p> : null}
        </section>

        <section className="overflow-hidden rounded-[18px] border border-soseguro-navy/10 bg-white shadow-[0_10px_30px_rgba(13,27,42,0.08)]">
          <div className="border-b border-soseguro-navy/10 bg-gradient-to-r from-[#F4F8FC] to-[#EEF5FA] p-5">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-soseguro-navy/60">Respuesta rapida</p>
            <h2 className="mt-1 text-2xl font-extrabold text-soseguro-navy">Contactos de Emergencia</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-soseguro-navy/70">
              Personas que deben recibir el aviso primero. Toca el Botón para realizar la llamada.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
            {profile.emergencyContacts.map((contact) => {
              return (
                <article
                  key={`${contact.phone}-${contact.name}`}
                  className="rounded-[16px] border border-soseguro-navy/10 bg-[#FBFDFF] p-4 transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-extrabold text-soseguro-navy">{contact.name}</p>
                      <p className="mt-1 text-sm font-medium text-soseguro-navy/65">{contact.relationship}</p>
                    </div>
                    <span className="rounded-full bg-soseguro-navy/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-soseguro-navy/70">
                      Emergencia
                    </span>
                  </div>

                  <a
                    href={`tel:${contact.phone}`}
                    className="mt-4 block rounded-[12px] bg-white px-4 py-3 text-center text-lg font-extrabold text-soseguro-navy ring-1 ring-soseguro-navy/10 transition-colors hover:bg-soseguro-light"
                  >
                    {contact.phone}
                  </a>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <a
                      href={`tel:${contact.phone}`}
                      className="col-span-2 rounded-[12px] bg-soseguro-navy px-3 py-3 text-center text-sm font-bold text-white transition-colors hover:bg-[#123657]"
                    >
                      Llamar
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* Autoridades Section */}
        <section className="mt-8 rounded-[16px] bg-white px-5 py-6 shadow-sm ring-1 ring-gray-200">
          <h3 className="text-lg font-bold text-soseguro-navy">Llamadas de Emergencia</h3>
          <p className="mt-2 text-sm text-gray-600">Presione el botón para llamar a una autoridad</p>

          <div className="mt-6 grid grid-cols-3 gap-3">
            {/* Cruz Roja */}
            <a
              href="tel:8002222668"
              className="flex flex-col items-center gap-2 rounded-[14px] bg-gradient-to-b from-red-50 to-red-100 px-3 py-4 transition-transform hover:scale-105 active:scale-95"
            >
              <span className="text-4xl">🚑</span>
              <span className="text-xs font-bold text-red-700">Cruz Roja</span>
            </a>

            {/* Guardia Nacional */}
            <a
              href="tel:088"
              className="flex flex-col items-center gap-2 rounded-[14px] bg-gradient-to-b from-blue-50 to-blue-100 px-3 py-4 transition-transform hover:scale-105 active:scale-95"
            >
              <span className="text-4xl">👮</span>
              <span className="text-xs font-bold text-blue-700">Guardia Nac.</span>
            </a>

            {/* Policía */}
            <a
              href="tel:911"
              className="flex flex-col items-center gap-2 rounded-[14px] bg-gradient-to-b from-red-50 to-red-100 px-3 py-4 transition-transform hover:scale-105 active:scale-95"
            >
              <span className="text-4xl">🚓</span>
              <span className="text-xs font-bold text-red-700">Policía</span>
            </a>
          </div>
        </section>
      </section>
    </main>
  );
}
