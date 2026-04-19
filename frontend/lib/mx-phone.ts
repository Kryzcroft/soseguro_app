import { parsePhoneNumberFromString } from "libphonenumber-js";

export const MX_COUNTRY_CODE = "+52";

export function toMxNationalDigits(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("52")) {
    return digits.slice(2, 12);
  }

  return digits.slice(0, 10);
}

export function normalizeToMxE164(value: string | null | undefined): string {
  const nationalDigits = toMxNationalDigits(value);
  if (!nationalDigits) {
    return "";
  }

  return `${MX_COUNTRY_CODE}${nationalDigits}`;
}

export function isCompleteMxNumber(value: string | null | undefined): boolean {
  return toMxNationalDigits(value).length === 10;
}

export function isValidMxE164(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalized = normalizeToMxE164(value);
  const parsed = parsePhoneNumberFromString(normalized, "MX");
  return Boolean(parsed && parsed.isValid() && parsed.country === "MX");
}

export function toMxE164FromBackend(
  countryCode: string | null | undefined,
  phoneNumber: string | null | undefined,
): string {
  if (!phoneNumber) {
    return "";
  }

  if (phoneNumber.startsWith("+")) {
    return normalizeToMxE164(phoneNumber);
  }

  const raw = `${countryCode || MX_COUNTRY_CODE}${phoneNumber}`;
  return normalizeToMxE164(raw);
}
