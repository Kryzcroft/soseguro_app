"use client";

import { MX_COUNTRY_CODE, normalizeToMxE164, toMxNationalDigits } from "../../lib/mx-phone";

type MxPhoneInputProps = {
  value?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  name?: string;
  id?: string;
  placeholder?: string;
};

export function MxPhoneInput({
  value,
  onChange,
  onBlur,
  name,
  id,
  placeholder,
}: MxPhoneInputProps) {
  const displayDigits = toMxNationalDigits(value);

  return (
    <div className="flex w-full overflow-hidden rounded-md border border-[#C8D3E1] focus-within:ring-2 focus-within:ring-[#0E7396]/25">
      <span className="inline-flex items-center border-r border-[#C8D3E1] bg-[#F3F7FB] px-3 text-sm font-medium text-[#294861]">
        {MX_COUNTRY_CODE}
      </span>
      <input
        id={id}
        name={name}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder={placeholder || "5512345678"}
        value={displayDigits}
        onBlur={onBlur}
        onChange={(event) => {
          const digitsOnly = event.target.value.replace(/\D/g, "").slice(0, 10);
          onChange(normalizeToMxE164(digitsOnly));
        }}
        className="w-full px-3 py-2 text-[#294861] outline-none"
      />
    </div>
  );
}
