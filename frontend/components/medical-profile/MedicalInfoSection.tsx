"use client";

import { UseFormReturn } from "react-hook-form";
import { MedicalProfileFormValues } from "../../lib/medical-profile-schema";

type MedicalInfoSectionProps = {
  form: UseFormReturn<MedicalProfileFormValues>;
};

type BinaryFieldName =
  | "isOrganDonor"
  | "hasInsurance"
  | "hasChronicDiseases"
  | "hasMedications"
  | "hasImplants";

type BinaryFieldProps = {
  label: string;
  name: BinaryFieldName;
  form: UseFormReturn<MedicalProfileFormValues>;
};

function toBoolean(value: unknown): boolean {
  return value === true || value === "true";
}

function BinaryRadioField({ label, name, form }: BinaryFieldProps) {
  const currentValue = toBoolean(form.watch(name));

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-[#294861]">{label}</label>
      <div className="flex items-center gap-4 rounded-md border border-[#C8D3E1] px-3 py-2">
        <label className="inline-flex items-center gap-2 text-sm text-[#294861]">
          <input
            type="radio"
            name={name}
            checked={currentValue}
            onChange={() =>
              form.setValue(name, true, {
                shouldDirty: true,
                shouldTouch: true,
                shouldValidate: true,
              })
            }
          />
          <span>Si</span>
        </label>

        <label className="inline-flex items-center gap-2 text-sm text-[#294861]">
          <input
            type="radio"
            name={name}
            checked={!currentValue}
            onChange={() =>
              form.setValue(name, false, {
                shouldDirty: true,
                shouldTouch: true,
                shouldValidate: true,
              })
            }
          />
          <span>No</span>
        </label>
      </div>
    </div>
  );
}

export function MedicalInfoSection({ form }: MedicalInfoSectionProps) {
  const { register, watch } = form;

  const hasInsurance = toBoolean(watch("hasInsurance"));
  const hasChronicDiseases = toBoolean(watch("hasChronicDiseases"));
  const hasMedications = toBoolean(watch("hasMedications"));
  const hasImplants = toBoolean(watch("hasImplants"));

  return (
    <section className="rounded-xl border border-[#D8DEE8] bg-white p-5">
      <h2 className="mb-4 text-lg font-semibold text-[#0A2A43]">Informacion Medica</h2>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-[#294861]">Grupo Sanguineo</label>
          <select className="w-full rounded-md border border-[#C8D3E1] px-3 py-2" {...register("bloodType")}>
            <option value="">Seleccionar</option>
            <option value="A_POSITIVE">A+</option>
            <option value="A_NEGATIVE">A-</option>
            <option value="B_POSITIVE">B+</option>
            <option value="B_NEGATIVE">B-</option>
            <option value="AB_POSITIVE">AB+</option>
            <option value="AB_NEGATIVE">AB-</option>
            <option value="O_POSITIVE">O+</option>
            <option value="O_NEGATIVE">O-</option>
          </select>
        </div>

        <div>
          <BinaryRadioField label="Donante de Organos" name="isOrganDonor" form={form} />
        </div>

        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium text-[#294861]">Alergias</label>
          <textarea className="w-full rounded-md border border-[#C8D3E1] px-3 py-2" rows={3} {...register("allergies")} />
        </div>

        <div>
          <BinaryRadioField label="Tiene poliza?" name="hasInsurance" form={form} />
        </div>

        {hasInsurance ? (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium text-[#294861]">Aseguradora</label>
              <input className="w-full rounded-md border border-[#C8D3E1] px-3 py-2" {...register("insuranceName")} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[#294861]">Numero de poliza</label>
              <input className="w-full rounded-md border border-[#C8D3E1] px-3 py-2" {...register("policyNumber")} />
            </div>
          </>
        ) : null}

        <div>
          <BinaryRadioField
            label="Tiene enfermedades cronicas?"
            name="hasChronicDiseases"
            form={form}
          />
        </div>

        {hasChronicDiseases ? (
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-[#294861]">Detalle de enfermedades</label>
            <textarea className="w-full rounded-md border border-[#C8D3E1] px-3 py-2" rows={3} {...register("chronicDiseases")} />
          </div>
        ) : null}

        <div>
          <BinaryRadioField label="Toma medicamentos?" name="hasMedications" form={form} />
        </div>

        {hasMedications ? (
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-[#294861]">Medicamentos</label>
            <textarea className="w-full rounded-md border border-[#C8D3E1] px-3 py-2" rows={3} {...register("medications")} />
          </div>
        ) : null}

        <div>
          <BinaryRadioField label="Tiene implantes?" name="hasImplants" form={form} />
        </div>

        {hasImplants ? (
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-[#294861]">Implantes</label>
            <textarea className="w-full rounded-md border border-[#C8D3E1] px-3 py-2" rows={3} {...register("implants")} />
          </div>
        ) : null}

        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium text-[#294861]">Unidad de Atención Médica</label>
          <textarea
            className="w-full rounded-md border border-[#C8D3E1] px-3 py-2"
            rows={3}
            placeholder="Ej: Clínica 24 IMSS, Hospital ABC Santa Fe, etc."
            {...register("medicalUnit")}
          />
        </div>
      </div>
    </section>
  );
}
