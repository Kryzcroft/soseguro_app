"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { verifySmsSchema, VerifySmsValues } from "../../lib/activation-schemas";

type StepSmsVerificationFormProps = {
  targetEmail: string;
  isLoading: boolean;
  isResending: boolean;
  errorMessage: string | null;
  onSubmit: (values: VerifySmsValues) => Promise<void>;
  onResend: () => Promise<void>;
};

export function StepSmsVerificationForm(props: StepSmsVerificationFormProps) {
  const { register, handleSubmit, formState } = useForm<VerifySmsValues>({
    resolver: zodResolver(verifySmsSchema),
    defaultValues: { code: "" },
    mode: "onTouched",
  });

  return (
    <form className="space-y-4" onSubmit={handleSubmit(props.onSubmit)}>
      <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
          Hemos enviado un codigo de verificacion a {props.targetEmail}.
      </p>

      <div>
        <label className="mb-1 block text-sm font-medium">Codigo de verificacion (6 digitos)</label>
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          className="w-full rounded-md border border-slate-300 px-3 py-2 tracking-[0.5em]"
          {...register("code")}
        />
        {formState.errors.code && (
          <p className="mt-1 text-sm text-red-600">{formState.errors.code.message}</p>
        )}
      </div>

      {props.errorMessage && <p className="text-sm text-red-600">{props.errorMessage}</p>}

      <button
        type="submit"
        disabled={props.isLoading}
        className="w-full rounded-md bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
      >
        {props.isLoading ? "Verificando..." : "Verificar"}
      </button>

      <button
        type="button"
        onClick={props.onResend}
        disabled={props.isResending}
        className="w-full rounded-md border border-slate-300 px-4 py-2 text-slate-700 disabled:opacity-50"
      >
        {props.isResending ? "Reenviando..." : "Reenviar codigo por correo"}
      </button>
    </form>
  );
}
