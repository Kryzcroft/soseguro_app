"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type PrivacyWallProps = {
  isOpen: boolean;
  termsVersion: string;
  onAccept: () => Promise<void>;
  title?: string;
  subtitle?: string;
};

export function PrivacyWall({
  isOpen,
  termsVersion,
  onAccept,
  title = "Consentimiento para la Visualización Pública de Información de Salud",
  subtitle = "Al activar su ficha médica, usted acepta y reconoce que su información de salud será visible públicamente para personal de emergencia mediante el escaneo del código QR o tecnología NFC vinculada a SOSeguro.",
}: PrivacyWallProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [publicExposureChecked, setPublicExposureChecked] = useState(false);
  const [liabilityChecked, setLiabilityChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const storageKey = useMemo(() => `soseguro.privacywall.${termsVersion}`, [termsVersion]);

  useEffect(() => {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as {
        privacyChecked?: boolean;
        publicExposureChecked?: boolean;
        liabilityChecked?: boolean;
      };
      setPrivacyChecked(Boolean(parsed.privacyChecked));
      setPublicExposureChecked(Boolean(parsed.publicExposureChecked));
      setLiabilityChecked(Boolean(parsed.liabilityChecked));
    } catch {
      localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  useEffect(() => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({ privacyChecked, publicExposureChecked, liabilityChecked }),
    );
  }, [liabilityChecked, privacyChecked, publicExposureChecked, storageKey]);

  const allChecked = privacyChecked && publicExposureChecked && liabilityChecked;

  const termsVersionLabel = useMemo(() => {
    const match = termsVersion.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      return termsVersion;
    }

    const [, year, month, day] = match;
    return `${year[0]}.${year.slice(1)}.${month}.${day}`;
  }, [termsVersion]);

  if (!isOpen) {
    return null;
  }

  const handleAccept = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await onAccept();
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : "No se pudo registrar la aceptacion");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl max-h-[82vh] overflow-y-auto">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Consentimiento legal</p>
        <h2 className="mt-2 text-2xl font-bold text-slate-900">{title}</h2>
        <p className="mt-2 text-sm text-slate-600">{subtitle}</p>

        <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
          <p className="font-semibold">Versión: {termsVersionLabel}</p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              <span className="font-semibold">Propósito:</span> Facilitar la atención médica inmediata en caso de incidente.
            </li>
            <li>
              <span className="font-semibold">Control Total:</span> Usted puede ocultar su perfil o revocar la visibilidad pública en cualquier momento desde el Panel de Control (Dashboard).
            </li>
            <li>
              <span className="font-semibold">Trazabilidad:</span> SOSeguro almacena únicamente el registro de su consentimiento, la fecha y la versión de los términos aceptados para fines de auditoría y seguridad.
            </li>
          </ul>
          <p className="text-sm text-slate-600">
            <span className="font-semibold">Aviso de Privacidad Integral:</span> Sus datos de salud son tratados exclusivamente para la gestión de su perfil de emergencia. Para más información, consulte nuestro Aviso de Privacidad.
          </p>
          <p className="mt-3 text-xs text-slate-500">
            <Link href="/aviso-privacidad" className="underline">Aviso de Privacidad.</Link>
          </p>
        </div>

        <div className="mt-4 space-y-3">
          <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={privacyChecked}
              onChange={(event) => setPrivacyChecked(event.target.checked)}
              className="mt-1"
            />
            <span>Acepto el Aviso de Privacidad y el tratamiento minimo de mis datos.</span>
          </label>

          <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={publicExposureChecked}
              onChange={(event) => setPublicExposureChecked(event.target.checked)}
              className="mt-1"
            />
            <span>Acepto la Autorizacion de Exposicion Publica de mis datos de salud mediante QR/NFC.</span>
          </label>

          <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={liabilityChecked}
              onChange={(event) => setLiabilityChecked(event.target.checked)}
              className="mt-1"
            />
            <span>Acepto el Deslinde de Responsabilidad sobre la veracidad de la informacion cargada.</span>
          </label>
        </div>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={handleAccept}
            disabled={!allChecked || isSubmitting}
            className="rounded-md bg-[#0A5E7A] px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            {isSubmitting ? "Guardando consentimiento..." : "Acepto y continuar"}
          </button>
        </div>
      </div>
    </div>
  );
}
