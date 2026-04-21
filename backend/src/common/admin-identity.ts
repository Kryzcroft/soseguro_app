const ONLY_ADMIN_EMAIL = "cristian@soseguro.app";

function normalizeEmail(email?: string | null): string {
  return (email || "").trim().toLowerCase();
}

export function buildAdminEmailSet(primaryEmail?: string | null): Set<string> {
  return new Set([normalizeEmail(ONLY_ADMIN_EMAIL)]);
}
