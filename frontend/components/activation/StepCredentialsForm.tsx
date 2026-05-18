"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Eye, EyeOff } from "lucide-react";
import { getActivationCodeStatus } from "../../lib/activation-api";
import { activateSchema, ActivateValues } from "../../lib/activation-schemas";

type StepCredentialsFormProps = {
  defaultValues: ActivateValues;
  isLoading: boolean;
  errorMessage: string | null;
  onSubmit: (values: ActivateValues) => Promise<void>;
};

export function StepCredentialsForm(props: StepCredentialsFormProps) {
  const [codeStatus, setCodeStatus] = useState<"idle" | "checking" | "valid" | "used" | "invalid" | "error">(
    "idle",
  );
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState, watch } = useForm<ActivateValues>({
    resolver: zodResolver(activateSchema),
    defaultValues: props.defaultValues,
    mode: "onChange",
  });

  const activationCode = watch("activationCode");

  useEffect(() => {
    const normalizedCode = activationCode?.trim().toUpperCase() ?? "";

    if (!normalizedCode) {
      setCodeStatus("idle");
      return;
    }

    if (!/^SOS-[A-F0-9]{4}-[A-F0-9]{4}$/.test(normalizedCode)) {
      setCodeStatus("invalid");
      return;
    }

    let active = true;
    setCodeStatus("checking");

    const timeoutId = window.setTimeout(async () => {
      try {
        const result = await getActivationCodeStatus(normalizedCode);
        if (!active) {
          return;
        }

        if (result.status === "FREE") {
          setCodeStatus("valid");
          return;
        }

        if (result.status === "USED") {
          setCodeStatus("used");
          return;
        }

        setCodeStatus("invalid");
      } catch {
        if (active) {
          setCodeStatus("error");
        }
      }
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [activationCode]);

  const canSubmit = !props.isLoading && formState.isValid && codeStatus === "valid";

  return (
    <form className="space-y-4" onSubmit={handleSubmit(props.onSubmit)}>
      <div>
        <label className="mb-1 block text-sm font-medium">Codigo de activacion</label>
        <input
          type="text"
          maxLength={32}
          placeholder="A1B2C3D4E5F60718293A4B5C6D7E8F90"
          className="w-full rounded-md border border-slate-300 px-3 py-2 uppercase"
          {...register("activationCode")}
        />
        {codeStatus === "checking" && (
          <p className="mt-1 text-xs text-slate-500">Validando codigo...</p>
        )}
        {codeStatus === "valid" && (
          <p className="mt-1 text-xs text-emerald-700">Codigo disponible. Puedes registrarte.</p>
        )}
        {codeStatus === "used" && (
          <p className="mt-1 text-xs text-red-600">Codigo ya utilizado.</p>
        )}
        {codeStatus === "invalid" && (
          <p className="mt-1 text-xs text-red-600">Codigo invalido o no disponible.</p>
        )}
        {codeStatus === "error" && (
          <p className="mt-1 text-xs text-red-600">No se pudo validar el codigo en este momento.</p>
        )}
        {formState.errors.activationCode && (
          <p className="mt-1 text-sm text-red-600">{formState.errors.activationCode.message}</p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Email</label>
        <input
          type="email"
          className="w-full rounded-md border border-slate-300 px-3 py-2"
          {...register("email")}
        />
        {formState.errors.email && (
          <p className="mt-1 text-sm text-red-600">{formState.errors.email.message}</p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Contrasena</label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            className="w-full rounded-md border border-slate-300 px-3 py-2 pr-10"
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 transition-colors hover:text-slate-700"
            aria-label={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
            aria-pressed={showPassword}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {formState.errors.password && (
          <p className="mt-1 text-sm text-red-600">{formState.errors.password.message}</p>
        )}
      </div>

      {props.errorMessage && <p className="text-sm text-red-600">{props.errorMessage}</p>}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-md bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
      >
        {props.isLoading ? "Registrando..." : "Registrarse"}
      </button>
    </form>
  );
}
