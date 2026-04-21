"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuthEmailFromToken, getAuthToken, setAuthToken } from "../../lib/auth-client";
import { loginAccount } from "../../lib/activation-api";
import { fetchDashboardProfile } from "../../lib/dashboard-api";

function isProfileComplete(profile: Awaited<ReturnType<typeof fetchDashboardProfile>>["medicalProfile"]): boolean {
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

const ADMIN_EMAIL = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || "c.reyes@soseguro.com").trim().toLowerCase();

function isAdminEmail(email?: string | null): boolean {
  return (email || "").trim().toLowerCase() === ADMIN_EMAIL;
}

async function resolvePostLoginRoute(email?: string | null): Promise<"/admin/dashboard" | "/perfil-medico" | "/dashboard"> {
  if (isAdminEmail(email)) {
    return "/admin/dashboard";
  }

  const tokenEmail = getAuthEmailFromToken();
  if (isAdminEmail(tokenEmail)) {
    return "/admin/dashboard";
  }

  try {
    const account = await fetchDashboardProfile();
    return isProfileComplete(account?.medicalProfile ?? null) ? "/dashboard" : "/perfil-medico";
  } catch {
    return "/dashboard";
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const redirectIfLoggedIn = async () => {
      if (!getAuthToken()) {
        return;
      }

      const route = await resolvePostLoginRoute();
      if (active) {
        router.replace(route);
      }
    };

    void redirectIfLoggedIn();

    return () => {
      active = false;
    };
  }, [router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const result = await loginAccount(email, password);
      setAuthToken(result.token);
      const route = await resolvePostLoginRoute(email);
      router.push(route);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo iniciar sesion");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <section className="mx-auto w-full max-w-md rounded-xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Iniciar sesion</h1>
        <p className="mt-1 text-sm text-slate-600">Accede para editar tu perfil medico y dashboard.</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Contrasena</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
              required
            />
          </div>

          {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-md bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
          >
            {isLoading ? "Ingresando..." : "Entrar"}
          </button>
        </form>
      </section>
    </main>
  );
}