"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { clearAuthToken } from "../../../lib/auth-client";
import { resetPassword, validatePasswordResetToken } from "../../../lib/activation-api";

export default function ResetPasswordPage() {
  const router = useRouter();
  const params = useParams<{ token?: string | string[] }>();
  const token = useMemo(() => {
    const raw = params?.token;
    return Array.isArray(raw) ? raw[0] : raw || "";
  }, [params?.token]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const validate = async () => {
      if (!token) {
        setMessage("El enlace de restablecimiento no es valido.");
        setIsLoading(false);
        return;
      }

      try {
        const result = await validatePasswordResetToken(token);
        if (!active) {
          return;
        }

        setIsTokenValid(true);
        setExpiresAt(result.expiresAt);
        setMessage(null);
      } catch (error) {
        if (!active) {
          return;
        }

        setIsTokenValid(false);
        setMessage(error instanceof Error ? error.message : "No se pudo validar el enlace.");
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void validate();

    return () => {
      active = false;
    };
  }, [token]);

  const expiresText = useMemo(() => {
    if (!expiresAt) {
      return null;
    }

    return new Intl.DateTimeFormat("es-MX", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(expiresAt));
  }, [expiresAt]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    if (password !== confirmPassword) {
      setMessage("Las contrasenas no coinciden.");
      return;
    }

    if (password.length < 8) {
      setMessage("La nueva contrasena debe tener al menos 8 caracteres.");
      return;
    }

    setIsSubmitting(true);

    try {
      await resetPassword(token, password);
      clearAuthToken();
      setMessage("Contrasena actualizada. Ya puedes iniciar sesion.");
      window.setTimeout(() => {
        router.replace("/login");
      }, 1400);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar la contrasena.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-700 px-4 py-10 text-white">
      <section className="mx-auto flex w-full max-w-lg flex-col gap-6 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 backdrop-blur">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-200">Restablecimiento seguro</p>
          <h1 className="mt-2 text-3xl font-bold">Crear nueva contrasena</h1>
          <p className="mt-2 text-sm text-slate-300">
            Usa este enlace temporal para definir una nueva contrasena. El enlace solo sirve una vez.
          </p>
        </div>

        {isLoading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-sm text-slate-200">
            Validando enlace...
          </div>
        ) : !isTokenValid ? (
          <div className="space-y-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-5 text-sm text-rose-100">
            <p>{message || "El enlace ya no es valido."}</p>
            <Link href="/login" className="inline-block rounded-full border border-rose-200/40 px-4 py-2 font-semibold text-white">
              Volver al inicio de sesion
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="rounded-xl bg-sky-500/10 px-4 py-3 text-xs text-sky-100">
              {expiresText ? <p>El enlace vence el {expiresText}.</p> : <p>El enlace tiene una vigencia limitada.</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-100">Nueva contrasena</label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-white outline-none ring-0 placeholder:text-slate-500 focus:border-sky-300"
                placeholder="Mínimo 8 caracteres"
                minLength={8}
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-100">Confirmar contrasena</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-white outline-none ring-0 placeholder:text-slate-500 focus:border-sky-300"
                placeholder="Repite la nueva contrasena"
                minLength={8}
                required
              />
            </div>

            {message ? <p className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-100">{message}</p> : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-sky-400 px-4 py-3 font-semibold text-slate-950 transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Actualizando..." : "Cambiar contrasena"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}