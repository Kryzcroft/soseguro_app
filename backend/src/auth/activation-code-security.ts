import { createHash } from "crypto";

export function normalizeActivationCode(input: string): string {
  return input.trim().toUpperCase();
}

export function buildActivationCodeHash(code: string, pepper: string): string {
  return createHash("sha256")
    .update(`${pepper}:${normalizeActivationCode(code)}`)
    .digest("hex");
}
