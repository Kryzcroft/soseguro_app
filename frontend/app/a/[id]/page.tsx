"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { resolveSmartAccess } from "../../../lib/smart-access-api";

type AccessScreenState = "loading" | "invalid" | "error";

export default function SmartAccessPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const activationCode = params?.id?.trim().toUpperCase() || "";
  const [screenState, setScreenState] = useState<AccessScreenState>("loading");
  const [message, setMessage] = useState("Resolviendo etiqueta...");

  useEffect(() => {
    if (!activationCode) {
      setScreenState("invalid");
      setMessage("Este código no es válido o no pertenece a nuestro sistema.");
      return;
    }

    let active = true;

    const resolve = async () => {
      setScreenState("loading");
      try {
        const result = await resolveSmartAccess(activationCode);
        if (!active) {
          return;
        }

        if (result.state === "REGISTER") {
          router.replace(result.redirectPath);
          return;
        }

        if (result.state === "PUBLIC_PROFILE") {
          router.replace(result.redirectPath);
          return;
        }

        setScreenState("invalid");
        setMessage(result.message);
      } catch {
        if (active) {
          setScreenState("error");
          setMessage("No fue posible validar la etiqueta en este momento.");
        }
      }
    };

    resolve();

    return () => {
      active = false;
    };
  }, [activationCode, router]);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-12">
      <section className="mx-auto w-full max-w-xl rounded-xl bg-white p-6 text-center shadow-sm">
        {screenState === "loading" ? (
          <>
            <h1 className="text-2xl font-semibold text-slate-900">Validando etiqueta SOSeguro</h1>
            <p className="mt-2 text-slate-600">{message}</p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold text-red-700">Código inválido</h1>
            <p className="mt-2 text-slate-700">{message}</p>
            <p className="mt-2 text-sm text-slate-500">Si crees que es un error, contáctanos desde SOSeguro.</p>
            <div className="mt-6">
              <Link
                href="/activar"
                className="inline-flex rounded-md bg-slate-900 px-4 py-2 font-semibold text-white"
              >
                Ir a activación
              </Link>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
