"use client";

import { Controller, useFieldArray, UseFormReturn } from "react-hook-form";
import { MX_COUNTRY_CODE } from "../../lib/mx-phone";
import { MedicalProfileFormValues } from "../../lib/medical-profile-schema";
import { MxPhoneInput } from "./MxPhoneInput";

type EmergencyContactsSectionProps = {
  form: UseFormReturn<MedicalProfileFormValues>;
};

export function EmergencyContactsSection({ form }: EmergencyContactsSectionProps) {
  const { control, register, formState } = form;
  const { fields, append, remove } = useFieldArray({
    control,
    name: "emergencyContacts",
  });

  return (
    <section className="rounded-xl border border-[#D8DEE8] bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#0A2A43]">Contactos de Emergencia</h2>
        <button
          type="button"
          onClick={() =>
            append({
              name: "",
              relationship: "",
              countryCode: MX_COUNTRY_CODE,
              phoneNumber: "",
            })
          }
          disabled={fields.length >= 3}
          className="rounded-md border border-[#92A7BE] px-3 py-1 text-sm text-[#294861] disabled:opacity-50"
        >
          Agregar contacto
        </button>
      </div>

      {fields.length === 0 ? (
        <p className="text-sm text-[#9D2D2F]">Debes agregar al menos 1 contacto para finalizar.</p>
      ) : null}

      <div className="space-y-4">
        {fields.map((field, index) => (
          <article key={field.id} className="rounded-lg border border-[#DCE4EE] p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#294861]">Contacto {index + 1}</h3>
              <button
                type="button"
                onClick={() => remove(index)}
                className="text-sm text-[#9D2D2F]"
              >
                Eliminar
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-[#294861]">Nombre</label>
                <input
                  className="w-full rounded-md border border-[#C8D3E1] px-3 py-2"
                  {...register(`emergencyContacts.${index}.name` as const)}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-[#294861]">Parentesco</label>
                <input
                  className="w-full rounded-md border border-[#C8D3E1] px-3 py-2"
                  {...register(`emergencyContacts.${index}.relationship` as const)}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-[#294861]">Telefono</label>
                <Controller
                  control={control}
                  name={`emergencyContacts.${index}.phoneNumber` as const}
                  render={({ field: phoneField }) => (
                    <MxPhoneInput
                      id={`emergencyContacts.${index}.phoneNumber`}
                      name={phoneField.name}
                      value={phoneField.value}
                      onBlur={phoneField.onBlur}
                      onChange={(value) => {
                        phoneField.onChange(value);
                        form.setValue(`emergencyContacts.${index}.countryCode`, MX_COUNTRY_CODE, {
                          shouldDirty: true,
                          shouldTouch: true,
                        });
                      }}
                    />
                  )}
                />
                {formState.errors.emergencyContacts?.[index]?.phoneNumber ? (
                  <p className="mt-1 text-sm text-[#9D2D2F]">
                    {formState.errors.emergencyContacts[index]?.phoneNumber?.message}
                  </p>
                ) : null}
              </div>
            </div>

            <input
              type="hidden"
              value={MX_COUNTRY_CODE}
              {...register(`emergencyContacts.${index}.countryCode` as const)}
            />
          </article>
        ))}
      </div>
    </section>
  );
}
