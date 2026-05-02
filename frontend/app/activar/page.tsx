"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getActivationCodeStatus,
  registerBasicAccount,
  sendEmailCode,
  verifyEmailCode,
} from "../../lib/activation-api";
import { clearAuthToken, getAuthToken, setAuthToken } from "../../lib/auth-client";
import {
  ActivateValues,
  BasicDataValues,
  VerifySmsValues,
} from "../../lib/activation-schemas";
import { fetchDashboardProfile } from "../../lib/dashboard-api";
import { StepBasicDataForm } from "../../components/activation/StepBasicDataForm";
import { StepSmsVerificationForm } from "../../components/activation/StepSmsVerificationForm";

type ActivationState = {
  step: 1 | 2 | 3;
  userId: string | null;
  pendingToken: string | null;
  requiresEmailVerification: boolean;
  activateValues: ActivateValues;
  basicDataValues: BasicDataValues;
  verifiedToken: string | null;
};

const STORAGE_KEY = "soseguro.activation.state.v1";
type GateStatus = "idle" | "validating" | "validated" | "invalid";

const initialState: ActivationState = {
  step: 1,
  userId: null,
  pendingToken: null,
  requiresEmailVerification: true,
  activateValues: {
    email: "",
    password: "",
    activationCode: "",
  },
  basicDataValues: {
    firstName: "",
    lastName: "",
    phoneNumber: "",
  },
  verifiedToken: null,
};

export default function ActivarPage() {
  const router = useRouter();
  const [state, setState] = useState<ActivationState>(initialState);
  const [isBootstrapped, setIsBootstrapped] = useState(false);
  const [isHydratingState, setIsHydratingState] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [gateCodeInput, setGateCodeInput] = useState("");
  const [gateStatus, setGateStatus] = useState<GateStatus>("idle");

  useEffect(() => {
    // Always start activation without a previous user/admin token.
    clearAuthToken();
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<ActivationState>;
        const hydratedState: ActivationState = {
          ...initialState,
          ...parsed,
          activateValues: {
            ...initialState.activateValues,
            ...(parsed.activateValues || {}),
          },
          basicDataValues: {
            ...initialState.basicDataValues,
            ...(parsed.basicDataValues || {}),
          },
        };

        setState(hydratedState);
        setGateCodeInput(hydratedState.activateValues.activationCode || "");
      } catch {
        setState(initialState);
        setGateCodeInput("");
      }
    } else {
      setGateCodeInput("");
    }

    setIsHydratingState(false);
    setIsBootstrapped(true);
  }, []);

  useEffect(() => {
    if (!isBootstrapped) {
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, isBootstrapped]);

  const resetToStepOne = (message?: string) => {
    setState((prev) => ({
      ...initialState,
      activateValues: {
        ...initialState.activateValues,
        activationCode: prev.activateValues.activationCode || "",
      },
    }));
    setGateStatus("idle");
    setErrorMessage(message || null);
  };

  const normalizeActivationCode = (raw: string): string | null => {
    const direct = raw.trim().toUpperCase();
    if (/^SOS-[A-F0-9]{4}-[A-F0-9]{4}$/.test(direct)) {
      return direct;
    }

    if (/^[A-F0-9]{8}$/.test(direct)) {
      return direct;
    }

    if (/^[A-F0-9]{32}$/.test(direct)) {
      return direct;
    }

    const compact = direct.replace(/[^A-F0-9]/g, "");
    if (/^[A-F0-9]{32}$/.test(compact)) {
      return compact;
    }

    if (!/^[A-F0-9]{8}$/.test(compact)) {
      return null;
    }

    return compact;
  };

  const validateCodeWithBackend = async (normalizedCode: string): Promise<"FREE" | "USED" | "NOT_FOUND"> => {
    const result = await getActivationCodeStatus(normalizedCode);
    return result.status;
  };

  useEffect(() => {
    if (!isBootstrapped || isHydratingState) {
      return;
    }

    const queryCode = new URLSearchParams(window.location.search).get("code")?.trim().toUpperCase() || "";
    if (!queryCode) {
      setGateStatus("idle");
      return;
    }

    if (getAuthToken()) {
      router.replace("/dashboard");
      return;
    }

    const normalized = normalizeActivationCode(queryCode);
    if (!normalized) {
      setGateStatus("invalid");
      setErrorMessage("Codigo invalido.");
      return;
    }

    setGateCodeInput(normalized);
    setState((prev) => {
      if (prev.activateValues.activationCode === normalized) {
        return prev;
      }

      return {
        ...prev,
        activateValues: {
          ...prev.activateValues,
          activationCode: normalized,
        },
      };
    });

    let active = true;
    const verifyCodeState = async () => {
      setGateStatus("validating");
      try {
        const status = await validateCodeWithBackend(normalized);
        if (!active) {
          return;
        }

        if (status === "FREE") {
          setGateStatus("validated");
          setErrorMessage(null);
          setInfoMessage("Codigo validado. Continua con tus credenciales.");
          return;
        }

        if (status === "USED") {
          if (state.userId && state.activateValues.activationCode.trim().toUpperCase() === normalized) {
            setGateStatus("validated");
            setErrorMessage(null);
            return;
          }

          setGateStatus("invalid");
          setErrorMessage("Este codigo ya fue activado. Inicia sesion con tu cuenta.");
          return;
        }

        setGateStatus("invalid");
        setErrorMessage("El codigo de activacion no existe o no esta disponible.");
      } catch {
        if (active) {
          setGateStatus("invalid");
          setErrorMessage("No se pudo validar el codigo de activacion.");
        }
      }
    };

    verifyCodeState();

    return () => {
      active = false;
    };
  }, [isBootstrapped, isHydratingState, router, state.step, state.userId]);

  useEffect(() => {
    if (!isBootstrapped || isHydratingState) {
      return;
    }

    if (state.step < 2) {
      return;
    }

    const normalized = normalizeActivationCode(state.activateValues.activationCode || "");
    if (!normalized) {
      resetToStepOne("Debes validar un codigo para continuar.");
      return;
    }

    let active = true;
    const protectStep = async () => {
      setGateStatus("validating");
      try {
        const status = await validateCodeWithBackend(normalized);
        if (!active) {
          return;
        }

        if (status === "USED" && state.userId) {
          setGateStatus("validated");
          return;
        }

        if (status === "FREE" && !state.userId) {
          setGateStatus("validated");
          return;
        }

        resetToStepOne("Tu codigo ya no es valido para continuar. Ingresa uno nuevo.");
      } catch {
        if (active) {
          resetToStepOne("No se pudo validar tu codigo. Intenta de nuevo.");
        }
      }
    };

    protectStep();

    return () => {
      active = false;
    };
  }, [isBootstrapped, isHydratingState, state.step, state.userId, state.activateValues.activationCode]);

  const stepLabel = useMemo(() => {
    if (state.step === 1) return "Paso 1: Debes Ingresar el Codigo que el equipo de Activacion de proporcionó.";
    if (state.step === 2) return "Paso 2: Datos basicos";
    return state.requiresEmailVerification ? "Paso 3: Verificacion por email" : "Paso 3: Pendiente de aprobacion";
  }, [state.step, state.requiresEmailVerification]);

  const handleValidateCode = async () => {
    const normalized = normalizeActivationCode(gateCodeInput);
    if (!normalized) {
      setGateStatus("invalid");
      setErrorMessage("Ingresa un codigo valido de 32 caracteres (ej: A1B2C3D4E5F60718293A4B5C6D7E8F90).");
      return;
    }

    setErrorMessage(null);
    setInfoMessage(null);
    setGateStatus("validating");

    try {
      const status = await validateCodeWithBackend(normalized);
      if (status !== "FREE") {
        setGateStatus("invalid");
        setErrorMessage("Codigo de activacion invalido o ya utilizado.");
        return;
      }

      setState((prev) => ({
        ...prev,
        step: 1,
        activateValues: {
          ...prev.activateValues,
          activationCode: normalized,
        },
      }));
      setGateStatus("validated");
      setInfoMessage("Codigo validado. Continua con tus credenciales.");
    } catch {
      setGateStatus("invalid");
      setErrorMessage("No se pudo validar el codigo de activacion.");
    }
  };

  const handleCredentialsSubmit = async (values: ActivateValues) => {
    if (gateStatus !== "validated") {
      setErrorMessage("Primero debes validar tu codigo SOSeguro.");
      return;
    }

    setErrorMessage(null);
    setInfoMessage(null);
    setIsLoading(true);
    try {
      const normalizedCode = values.activationCode.trim().toUpperCase();
      const result = await registerBasicAccount({
        ...values,
        activationCode: normalizedCode,
      });

      // Evita revalidaciones por query param ya consumido al avanzar de paso.
      if (typeof window !== "undefined" && window.location.search) {
        window.history.replaceState({}, "", window.location.pathname);
      }

      setState((prev) => ({
        ...prev,
        activateValues: {
          ...values,
          activationCode: normalizedCode,
        },
        userId: result.user.id,
        pendingToken: result.token,
        requiresEmailVerification: result.requiresEmailVerification,
        step: 2,
      }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBasicDataSubmit = async (values: BasicDataValues) => {
    if (!state.userId) {
      setErrorMessage("Sesion incompleta. Reinicia el flujo.");
      return;
    }

    setErrorMessage(null);
    setInfoMessage(null);
    setIsLoading(true);
    try {
      const response = await sendEmailCode(state.userId, values);

      if (response.skippedApproval) {
        clearAuthToken();
        localStorage.removeItem(STORAGE_KEY);
        setInfoMessage("Cuenta creada. Esta pendiente de aprobacion por el administrador.");
        setErrorMessage(null);
        window.setTimeout(() => {
          router.replace("/login");
        }, 1200);
        return;
      }

      setInfoMessage("Informacion enviada.");
      setState((prev) => ({
        ...prev,
        basicDataValues: values,
        step: 3,
      }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifySubmit = async (values: VerifySmsValues) => {
    if (!state.userId) {
      setErrorMessage("Sesion incompleta. Reinicia el flujo.");
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);
    try {
      const result = await verifyEmailCode(state.userId, values.code);
      setState((prev) => ({
        ...prev,
        verifiedToken: result.token,
      }));

      // Persistimos la sesion antes de navegar para evitar relogin al llegar al formulario.
      setAuthToken(result.token);

      setInfoMessage("¡Cuenta activada! Ahora, completa tu información médica para protegerte en la carretera.");

      let publicId: string | null = null;
      let shouldGoPublic = false;
      try {
        const dashboard = await fetchDashboardProfile();
        const profile = dashboard?.medicalProfile;
        publicId = profile?.publicId ?? null;

        shouldGoPublic = Boolean(
          profile?.firstName &&
            profile?.lastName &&
            profile?.birthDate &&
            profile?.bloodType &&
            profile?.emergencyContacts?.length,
        );
      } catch {
        publicId = null;
        shouldGoPublic = false;
      }

      localStorage.removeItem(STORAGE_KEY);

      // Para nuevos registros, el destino obligatorio es /perfil-medico.
      // Solo un perfil ya completo puede navegar a su vista publica.
      const redirectTo = shouldGoPublic && publicId ? `/p/${publicId}` : "/perfil-medico";
      window.setTimeout(() => {
        router.push(redirectTo);
      }, 1200);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!state.userId) {
      setErrorMessage("Sesion incompleta. Reinicia el flujo.");
      return;
    }

    setErrorMessage(null);
    setIsResending(true);
    try {
      await sendEmailCode(state.userId, state.basicDataValues);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setIsResending(false);
    }
  };

  const resetFlow = () => {
    setState(initialState);
    setErrorMessage(null);
    setInfoMessage(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  if (!isBootstrapped) {
    return <main className="mx-auto max-w-xl p-6">Cargando...</main>;
  }

  const canRenderProtectedStep = gateStatus === "validated";
  const gateCodeIsValid = Boolean(normalizeActivationCode(gateCodeInput));

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <section className="mx-auto w-full max-w-xl rounded-xl bg-white p-6 shadow-sm">
        <header className="mb-6">
          <div className="mb-3 flex justify-center">
            <img src="/sos-logo-light.png" alt="Logo SOSeguro" className="h-auto w-[260px] md:w-[320px]" />
          </div>
          <h1 className="text-center text-2xl font-semibold text-slate-900">Activar cuenta SOSeguro</h1>
          <p className="mt-1 text-center text-sm text-slate-600">{stepLabel}</p>
        </header>

        {state.verifiedToken ? (
          <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-medium text-emerald-800">Tu cuenta ha sido verificada correctamente.</p>
            <p className="text-xs text-emerald-700">Token de sesion emitido. Ya puedes continuar al login seguro.</p>
            <button
              onClick={resetFlow}
              className="rounded-md border border-emerald-300 px-3 py-2 text-sm text-emerald-800"
            >
              Activar otra cuenta
            </button>
          </div>
        ) : null}

        {infoMessage ? (
          <div className="mb-4 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
            {infoMessage}
          </div>
        ) : null}

        {!state.verifiedToken && state.step === 1 && !canRenderProtectedStep && (
          <div className="space-y-5 rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-6 shadow-inner">
            <h2 className="text-center text-2xl font-extrabold text-slate-900 md:text-3xl">
              Ingresa tu codigo SOSeguro para comenzar
            </h2>

            <div className="mx-auto max-w-md">
              <div className="flex items-center justify-center">
                <input
                  value={gateCodeInput}
                  onChange={(event) => setGateCodeInput(event.target.value.toUpperCase())}
                  inputMode="text"
                  maxLength={32}
                  placeholder="A1B2C3D4E5F60718293A4B5C6D7E8F90"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-5 text-center font-mono text-base tracking-[0.12em] uppercase text-slate-900 outline-none ring-sky-400 transition focus:ring-4"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleValidateCode}
              disabled={gateStatus === "validating" || !gateCodeIsValid}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-lg font-semibold text-white disabled:opacity-50"
            >
              {gateStatus === "validating" ? (
                <>
                  <span
                    className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white"
                    aria-hidden="true"
                  />
                  Validando codigo...
                </>
              ) : (
                "Validar y continuar"
              )}
            </button>

            {errorMessage ? <p className="text-center text-sm text-red-600">{errorMessage}</p> : null}
          </div>
        )}

        {!state.verifiedToken && state.step === 1 && canRenderProtectedStep && (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleCredentialsSubmit(state.activateValues);
            }}
          >
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Codigo validado: <span className="font-mono font-semibold">{state.activateValues.activationCode}</span>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Email</label>
              <input
                type="email"
                value={state.activateValues.email}
                onChange={(event) =>
                  setState((prev) => ({
                    ...prev,
                    activateValues: {
                      ...prev.activateValues,
                      email: event.target.value,
                    },
                  }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Contrasena</label>
              <input
                type="password"
                value={state.activateValues.password}
                onChange={(event) =>
                  setState((prev) => ({
                    ...prev,
                    activateValues: {
                      ...prev.activateValues,
                      password: event.target.value,
                    },
                  }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                minLength={8}
                required
              />
            </div>

            {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

            <button
              type="submit"
              disabled={
                isLoading ||
                !state.activateValues.email ||
                state.activateValues.password.length < 8 ||
                gateStatus !== "validated"
              }
              className="w-full rounded-md bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
            >
              {isLoading ? "Registrando..." : "Continuar"}
            </button>
          </form>
        )}

        {!state.verifiedToken && state.step === 2 && canRenderProtectedStep && (
          <StepBasicDataForm
            defaultValues={state.basicDataValues}
            isLoading={isLoading}
            errorMessage={errorMessage}
            onSubmit={handleBasicDataSubmit}
          />
        )}

        {!state.verifiedToken && state.step === 3 && canRenderProtectedStep && (
          <StepSmsVerificationForm
            targetEmail={state.activateValues.email}
            isLoading={isLoading}
            isResending={isResending}
            errorMessage={errorMessage}
            onSubmit={handleVerifySubmit}
            onResend={handleResend}
          />
        )}
      </section>
    </main>
  );
}
