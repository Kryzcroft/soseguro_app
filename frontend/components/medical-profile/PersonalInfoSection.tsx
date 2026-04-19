"use client";

import { UseFormReturn } from "react-hook-form";
import { uploadProfilePhoto } from "../../lib/medical-profile-api";
import { MedicalProfileFormValues } from "../../lib/medical-profile-schema";

type PersonalInfoSectionProps = {
  form: UseFormReturn<MedicalProfileFormValues>;
  mapsUrl: string;
  onUploadStateChange: (isUploading: boolean, error: string | null) => void;
};

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024;
const HEIGHT_OPTIONS = Array.from({ length: 61 }, (_, index) => 140 + index);

export function PersonalInfoSection({
  form,
  mapsUrl,
  onUploadStateChange,
}: PersonalInfoSectionProps) {
  const { register, setValue, watch } = form;
  const photoUrl = watch("photoUrl");

  const onPhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!ACCEPTED_TYPES.includes(file.type)) {
      onUploadStateChange(false, "Formato invalido. Usa JPG, PNG o WEBP.");
      return;
    }

    if (file.size > MAX_SIZE) {
      onUploadStateChange(false, "La imagen supera el maximo de 5MB.");
      return;
    }

    onUploadStateChange(true, null);

    try {
      const url = await uploadProfilePhoto(file);
      setValue("photoUrl", url, { shouldDirty: true, shouldTouch: true });
      onUploadStateChange(false, null);
    } catch (error) {
      onUploadStateChange(false, error instanceof Error ? error.message : "Error al subir foto");
    }
  };

  return (
    <section className="rounded-xl border border-[#D8DEE8] bg-white p-5">
      <h2 className="mb-4 text-lg font-semibold text-[#0A2A43]">Informacion Personal</h2>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-[#294861]">Fotografia (max 5MB)</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onPhotoChange}
            className="block w-full text-sm text-[#294861] file:mr-4 file:rounded-md file:border-0 file:bg-[#0A2A43] file:px-4 file:py-2 file:text-white hover:file:bg-[#123657]"
          />
          <p className="mt-1 text-xs text-[#6B7F92]">PNG, JPG o WEBP. La imagen se usa tambien en tu perfil publico.</p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#294861]">Nombre</label>
            <input className="w-full rounded-md border border-[#C8D3E1] px-3 py-2" {...register("firstName")} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[#294861]">Apellidos</label>
            <input className="w-full rounded-md border border-[#C8D3E1] px-3 py-2" {...register("lastName")} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[#294861]">Nacimiento</label>
            <input type="date" className="w-full rounded-md border border-[#C8D3E1] px-3 py-2" {...register("birthDate")} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[#294861]">Estatura</label>
            <select
              className="w-full rounded-md border border-[#C8D3E1] px-3 py-2"
              {...register("heightCm", {
                setValueAs: (value) => (value === "" ? undefined : Number.parseInt(value, 10)),
              })}
            >
              <option value="">Seleccionar estatura</option>
              {HEIGHT_OPTIONS.map((height) => (
                <option key={height} value={height}>
                  {height} cm
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[#294861]">Peso (kg)</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min={1}
              max={500}
              className="w-full rounded-md border border-[#C8D3E1] px-3 py-2"
              {...register("weightKg", {
                setValueAs: (value) => (value === "" ? undefined : Number.parseFloat(value)),
              })}
              placeholder="Ej. 68.5"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-[#294861]">Direccion</label>
            <input className="w-full rounded-md border border-[#C8D3E1] px-3 py-2" {...register("address")} />
            <a href={mapsUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm text-[#0E7396]">
              Abrir en Google Maps
            </a>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-[#294861]">Profesion</label>
            <input className="w-full rounded-md border border-[#C8D3E1] px-3 py-2" {...register("profession")} />
          </div>
        </div>
      </div>
    </section>
  );
}
