const ONLY_ADMIN_EMAIL = "cristian@soseguro.app";

function normalizeEmail(email?: string | null): string {
  return (email || "").trim().toLowerCase();
}

export function isAdminEmail(email?: string | null): boolean {
  return normalizeEmail(email) === ONLY_ADMIN_EMAIL;
}