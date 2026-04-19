"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { basicDataSchema, BasicDataValues } from "../../lib/activation-schemas";
import { MxPhoneInput } from "../medical-profile/MxPhoneInput";

type StepBasicDataFormProps = {
  defaultValues: BasicDataValues;
  isLoading: boolean;
  errorMessage: string | null;
  onSubmit: (values: BasicDataValues) => Promise<void>;
};

export function StepBasicDataForm(props: StepBasicDataFormProps) {
  const { register, control, handleSubmit, formState } = useForm<BasicDataValues>({
    resolver: zodResolver(basicDataSchema),
    defaultValues: props.defaultValues,
    mode: "onTouched",
  });

  return (
    <form className="space-y-4" onSubmit={handleSubmit(props.onSubmit)}>
      <div>
        <label className="mb-1 block text-sm font-medium">Nombre</label>
        <input
          type="text"
          className="w-full rounded-md border border-slate-300 px-3 py-2"
          {...register("firstName")}
        />
        {formState.errors.firstName && (
          <p className="mt-1 text-sm text-red-600">{formState.errors.firstName.message}</p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Apellidos</label>
        <input
          type="text"
          className="w-full rounded-md border border-slate-300 px-3 py-2"
          {...register("lastName")}
        />
        {formState.errors.lastName && (
          <p className="mt-1 text-sm text-red-600">{formState.errors.lastName.message}</p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Telefono</label>
        <Controller
          control={control}
          name="phoneNumber"
          render={({ field }) => (
            <MxPhoneInput
              id="phoneNumber"
              name={field.name}
              value={field.value}
              onBlur={field.onBlur}
              onChange={field.onChange}
            />
          )}
        />
        {formState.errors.phoneNumber && (
          <p className="mt-1 text-sm text-red-600">{formState.errors.phoneNumber.message}</p>
        )}
      </div>

      {props.errorMessage && <p className="text-sm text-red-600">{props.errorMessage}</p>}

      <button
        type="submit"
        disabled={props.isLoading}
        className="w-full rounded-md bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
      >
        {props.isLoading ? "Enviando correo..." : "Enviar codigo por correo"}
      </button>
    </form>
  );
}
