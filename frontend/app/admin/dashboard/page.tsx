"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeCanvas } from "qrcode.react";
import { approveUser, assignActivationCode, deleteUserWithRelatedData, fetchAdminDashboard, generateActivationCodes, ProfileStatus } from "../../../lib/admin-api";
import { clearAuthToken, getAuthToken, UnauthorizedError } from "../../../lib/auth-client";

type FilterOption = "ALL" | ProfileStatus;
type AccountStatusFilter = "ALL" | "PENDING" | "APPROVED";
type ActivationStatusFilter = "ALL" | "USED" | "AVAILABLE";
type ActivationSortKey = "code" | "userEmail" | "isUsed" | "createdAt" | "usedAt";

type QrToolsProps = {
  targetUrl: string;
  label: string;
  fileLabel?: string;
};

const SITE_BASE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "";

function buildLabelUrl(code?: string | null): string {
  const normalizedCode = code?.trim().toUpperCase();
  if (!normalizedCode || !SITE_BASE_URL) {
    return "";
  }

  return `${SITE_BASE_URL}/a/${encodeURIComponent(normalizedCode)}`;
}

function QrTools({ targetUrl, label, fileLabel }: QrToolsProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const finalUrl = useMemo(() => targetUrl?.trim() || "", [targetUrl]);

  const disabled = !finalUrl;

  const downloadQr = useCallback(() => {
    if (!canvasRef.current || disabled) {
      return;
    }

    canvasRef.current.toBlob((blob) => {
      if (!blob) {
        return;
      }

      const link = document.createElement("a");
      const normalizedFileLabel = (fileLabel || "etiqueta").replace(/[^A-Z0-9_-]/gi, "");
      link.download = `qr-${normalizedFileLabel || "etiqueta"}.png`;
      const objectUrl = URL.createObjectURL(blob);
      link.href = objectUrl;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    }, "image/png");
  }, [disabled]);

  const copyForNfc = useCallback(async () => {
    if (disabled) {
      return;
    }

    await navigator.clipboard.writeText(finalUrl);
    setCopyMessage("URL copiada para NFC");
    window.setTimeout(() => setCopyMessage(null), 1800);
  }, [disabled, finalUrl]);

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">URL completa QR/NFC</p>
      <p className="break-all rounded-md bg-slate-50 px-2 py-1 text-[11px] font-mono text-slate-700">{label}</p>
      <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
        <QRCodeCanvas
          ref={(node) => {
            canvasRef.current = node;
          }}
          value={finalUrl || "about:blank"}
          size={84}
          level="M"
          includeMargin
        />
      </div>

      <button
        type="button"
        onClick={downloadQr}
        disabled={disabled}
        className="w-full rounded-md border px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50"
      >
        Descargar QR
      </button>

      <button
        type="button"
        onClick={copyForNfc}
        disabled={disabled}
        className="w-full rounded-md bg-slate-900 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
      >
        Copiar Link NFC
      </button>

      {copyMessage ? <p className="text-[11px] text-emerald-700">{copyMessage}</p> : null}
    </div>
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterOption>("ALL");
  const [accountStatusFilter, setAccountStatusFilter] = useState<AccountStatusFilter>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [inventory, setInventory] = useState<Awaited<ReturnType<typeof fetchAdminDashboard>>["inventory"]>([]);
  const [activationCodes, setActivationCodes] = useState<
    Awaited<ReturnType<typeof fetchAdminDashboard>>["activationCodes"]
  >([]);
  const [activationStatusFilter, setActivationStatusFilter] = useState<ActivationStatusFilter>("ALL");
  const [activationSortKey, setActivationSortKey] = useState<ActivationSortKey>("createdAt");
  const [activationSortDirection, setActivationSortDirection] = useState<"asc" | "desc">("desc");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [codeDrafts, setCodeDrafts] = useState<Record<string, string>>({});
  const [assigningForUserId, setAssigningForUserId] = useState<string | null>(null);
  const [approvingForUserId, setApprovingForUserId] = useState<string | null>(null);
  const [deletingForUserId, setDeletingForUserId] = useState<string | null>(null);
  const [isGeneratingCodes, setIsGeneratingCodes] = useState(false);

  const orderedActivationCodes = useMemo(() => {
    const filtered = activationCodes.filter((code) => {
      if (activationStatusFilter === "ALL") return true;
      if (activationStatusFilter === "USED") return code.isUsed;
      return !code.isUsed;
    });

    const sorted = [...filtered].sort((left, right) => {
      const normalize = (value: string | null) => (value || "").toLowerCase();

      let compare = 0;
      switch (activationSortKey) {
        case "code":
          compare = normalize(left.code).localeCompare(normalize(right.code));
          break;
        case "userEmail":
          compare = normalize(left.userEmail).localeCompare(normalize(right.userEmail));
          break;
        case "isUsed":
          compare = Number(left.isUsed) - Number(right.isUsed);
          break;
        case "createdAt":
          compare = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
          break;
        case "usedAt":
          compare = new Date(left.usedAt || 0).getTime() - new Date(right.usedAt || 0).getTime();
          break;
      }

      return activationSortDirection === "asc" ? compare : -compare;
    });

    return sorted;
  }, [activationCodes, activationSortDirection, activationSortKey, activationStatusFilter]);

  const filteredInventory = useMemo(() => {
    return inventory.filter((row) => {
      if (accountStatusFilter === "PENDING") {
        return !row.isVerified;
      }

      if (accountStatusFilter === "APPROVED") {
        return row.isVerified;
      }

      return true;
    });
  }, [accountStatusFilter, inventory]);

  const toggleActivationSort = (key: ActivationSortKey) => {
    if (activationSortKey === key) {
      setActivationSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setActivationSortKey(key);
    setActivationSortDirection("asc");
  };

  const sortIndicatorFor = (key: ActivationSortKey) => {
    if (activationSortKey !== key) {
      return "↕";
    }

    return activationSortDirection === "asc" ? "↑" : "↓";
  };

  const loadDashboard = useCallback(
    async (currentFilter: FilterOption) => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const data = await fetchAdminDashboard(
          currentFilter === "ALL" ? undefined : currentFilter,
          searchTerm,
        );
        setInventory(data.inventory);
        setActivationCodes(data.activationCodes);
      } catch (error) {
        if (error instanceof UnauthorizedError) {
          router.replace("/login");
          return;
        }

        const message = error instanceof Error ? error.message : "No se pudo cargar el dashboard de admin.";
        if (message.includes("Acceso denegado")) {
          router.replace("/dashboard");
          return;
        }
        setErrorMessage(message);
      } finally {
        setIsLoading(false);
      }
    },
    [router, searchTerm],
  );

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    loadDashboard(filter);
  }, [filter, loadDashboard, router, searchTerm]);

  const handleAssignCode = async (userId: string) => {
    const draft = codeDrafts[userId]?.trim().toUpperCase();
    if (!draft) {
      setErrorMessage("Ingresa un codigo antes de asignar.");
      return;
    }

    setAssigningForUserId(userId);
    setErrorMessage(null);

    try {
      await assignActivationCode(userId, draft);
      setCodeDrafts((current) => ({ ...current, [userId]: "" }));
      await loadDashboard(filter);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo asignar el codigo.");
    } finally {
      setAssigningForUserId(null);
    }
  };

  const handleGenerateCodes = async () => {
    const raw = window.prompt("Cuantos codigos nuevos necesitas? (1-500)", "50");
    if (!raw) {
      return;
    }

    const quantity = Number.parseInt(raw, 10);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 500) {
      setSuccessMessage(null);
      setErrorMessage("Ingresa una cantidad valida entre 1 y 500.");
      return;
    }

    setIsGeneratingCodes(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await generateActivationCodes(quantity);
      setSuccessMessage(`Se generaron ${result.generated} codigos nuevos.`);
      await loadDashboard(filter);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudieron generar codigos.");
    } finally {
      setIsGeneratingCodes(false);
    }
  };

  const handleApproveUser = async (userId: string) => {
    setApprovingForUserId(userId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await approveUser(userId);
      setSuccessMessage(result.alreadyApproved ? "La cuenta ya estaba aprobada." : "Cuenta aprobada correctamente.");
      await loadDashboard(filter);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo aprobar la cuenta.");
    } finally {
      setApprovingForUserId(null);
    }
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    const confirmed = window.confirm(
      `Vas a eliminar al usuario ${email}. Esta accion borra su perfil medico y libera su codigo de activacion. Deseas continuar?`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingForUserId(userId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await deleteUserWithRelatedData(userId);
      setSuccessMessage(
        `Usuario eliminado. Codigos liberados: ${result.releasedActivationCodes}.`,
      );
      await loadDashboard(filter);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo eliminar la cuenta.");
    } finally {
      setDeletingForUserId(null);
    }
  };

  const handleLogout = () => {
    clearAuthToken();
    router.replace("/login");
  };

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 md:px-8">
      <section className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl bg-[#10243A] px-6 py-5 text-white shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#C7D8E8]">Panel protegido</p>
              <h1 className="mt-2 text-2xl font-bold">Admin Dashboard: Logistica de Dispositivos</h1>
              <p className="mt-1 text-sm text-[#D8E6F1]">
                Gestion de inventario, codigos de activacion y activos QR/NFC.
              </p>
              <p className="mt-2 text-xs text-[#C7D8E8]">
                Cada fila muestra la URL final que debes grabar en QR y NFC, con opcion de copiar y descargar QR.
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-white transition hover:bg-white/20"
            >
              Cerrar sesion
            </button>
          </div>
        </header>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Inventario de usuarios</h2>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar por email o codigo de activacion"
                className="w-72 rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <label className="text-sm font-medium text-slate-700">Estatus de perfil</label>
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value as FilterOption)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="ALL">Todos</option>
                <option value="COMPLETO">Completo</option>
                <option value="INCOMPLETO">Incompleto</option>
              </select>
              <label className="text-sm font-medium text-slate-700">Estatus de cuenta</label>
              <select
                value={accountStatusFilter}
                onChange={(event) => setAccountStatusFilter(event.target.value as AccountStatusFilter)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="ALL">Todas</option>
                <option value="PENDING">Pendiente</option>
                <option value="APPROVED">Aprobada</option>
              </select>
            </div>
          </div>

          {errorMessage ? (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {errorMessage}
            </div>
          ) : null}

          {isLoading ? (
            <p className="mt-4 text-sm text-slate-600">Cargando inventario...</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-600">
                    <th className="px-3 py-2">Usuario</th>
                    <th className="px-3 py-2">Estatus perfil</th>
                    <th className="px-3 py-2">Estatus cuenta</th>
                    <th className="px-3 py-2">Codigo</th>
                    <th className="px-3 py-2">URL completa QR/NFC</th>
                    <th className="px-3 py-2">Asignacion manual</th>
                    <th className="px-3 py-2">Eliminar</th>
                    <th className="px-3 py-2">QR y NFC</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInventory.map((row) => (
                    <tr key={row.userId} className="border-b align-top">
                      <td className="px-3 py-3">
                        <p className="font-semibold text-slate-900">{row.email}</p>
                        <p className="text-xs text-slate-500">
                          {[row.firstName, row.lastName].filter(Boolean).join(" ") || "Sin nombre"}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${
                            row.profileStatus === "COMPLETO"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {row.profileStatus}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {row.isVerified ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                            Aprobada
                          </span>
                        ) : (
                          <div className="space-y-2">
                            <span className="inline-block rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                              Pendiente
                            </span>
                            <button
                              type="button"
                              onClick={() => handleApproveUser(row.userId)}
                              disabled={approvingForUserId === row.userId}
                              className="block rounded-md bg-emerald-700 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              {approvingForUserId === row.userId ? "Aprobando..." : "Aprobar"}
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-slate-700">
                        {row.activationCode?.code || "Sin codigo"}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-600">
                        {buildLabelUrl(row.activationCode?.code) ? (
                          <div className="space-y-2">
                            <a
                              href={buildLabelUrl(row.activationCode?.code)}
                              target="_blank"
                              rel="noreferrer"
                              className="break-all font-mono text-blue-700 underline"
                            >
                              {buildLabelUrl(row.activationCode?.code)}
                            </a>
                            <button
                              type="button"
                              onClick={async () => {
                                await navigator.clipboard.writeText(buildLabelUrl(row.activationCode?.code));
                                setSuccessMessage("URL de etiqueta copiada.");
                                window.setTimeout(() => setSuccessMessage(null), 1500);
                              }}
                              className="rounded-md border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700"
                            >
                              Copiar URL
                            </button>
                          </div>
                        ) : (
                          "No disponible"
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex gap-2">
                          <input
                            value={codeDrafts[row.userId] || ""}
                            onChange={(event) =>
                              setCodeDrafts((current) => ({ ...current, [row.userId]: event.target.value }))
                            }
                            placeholder="A1B2C3D4E5F60718293A4B5C6D7E8F90"
                            className="w-36 rounded-md border border-slate-300 px-2 py-1 text-xs uppercase"
                          />
                          <button
                            type="button"
                            onClick={() => handleAssignCode(row.userId)}
                            disabled={assigningForUserId === row.userId}
                            className="rounded-md bg-slate-900 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            {assigningForUserId === row.userId ? "Asignando..." : "Asignar"}
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(row.userId, row.email)}
                          disabled={deletingForUserId === row.userId}
                          className="rounded-md bg-rose-700 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          {deletingForUserId === row.userId ? "Eliminando..." : "Eliminar"}
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        {(() => {
                          const labelUrl = buildLabelUrl(row.activationCode?.code);
                          const fallbackUrl = row.publicLink || "";
                          const finalUrl = labelUrl || fallbackUrl;
                          const label = finalUrl || "Sin URL";
                          const fileLabel = row.activationCode?.code || row.userId;

                          return (
                        <QrTools
                          targetUrl={finalUrl}
                          label={label}
                          fileLabel={fileLabel}
                        />
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filteredInventory.length ? (
                <p className="px-3 py-4 text-sm text-slate-500">No hay usuarios con los filtros actuales.</p>
              ) : null}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Codigos de activacion generados</h2>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-sm font-medium text-slate-700">Filtro</label>
              <select
                value={activationStatusFilter}
                onChange={(event) => setActivationStatusFilter(event.target.value as ActivationStatusFilter)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="ALL">Todos</option>
                <option value="USED">Usados</option>
                <option value="AVAILABLE">Disponibles</option>
              </select>

              <button
                type="button"
                onClick={handleGenerateCodes}
                disabled={isGeneratingCodes}
                className="rounded-md bg-[#0A5E7A] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {isGeneratingCodes ? "Generando..." : "Generar codigos"}
              </button>
            </div>
          </div>

          {successMessage ? (
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {successMessage}
            </div>
          ) : null}

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b text-left text-slate-600">
                  <th className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => toggleActivationSort("code")}
                      className={`inline-flex items-center gap-1 font-semibold ${activationSortKey === "code" ? "text-slate-900" : "text-slate-600"}`}
                    >
                      Codigo <span className="text-xs">{sortIndicatorFor("code")}</span>
                    </button>
                  </th>
                  <th className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => toggleActivationSort("userEmail")}
                      className={`inline-flex items-center gap-1 font-semibold ${activationSortKey === "userEmail" ? "text-slate-900" : "text-slate-600"}`}
                    >
                      Asignado a <span className="text-xs">{sortIndicatorFor("userEmail")}</span>
                    </button>
                  </th>
                  <th className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => toggleActivationSort("isUsed")}
                      className={`inline-flex items-center gap-1 font-semibold ${activationSortKey === "isUsed" ? "text-slate-900" : "text-slate-600"}`}
                    >
                      Estatus <span className="text-xs">{sortIndicatorFor("isUsed")}</span>
                    </button>
                  </th>
                  <th className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => toggleActivationSort("createdAt")}
                      className={`inline-flex items-center gap-1 font-semibold ${activationSortKey === "createdAt" ? "text-slate-900" : "text-slate-600"}`}
                    >
                      Creado <span className="text-xs">{sortIndicatorFor("createdAt")}</span>
                    </button>
                  </th>
                  <th className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => toggleActivationSort("usedAt")}
                      className={`inline-flex items-center gap-1 font-semibold ${activationSortKey === "usedAt" ? "text-slate-900" : "text-slate-600"}`}
                    >
                      Usado <span className="text-xs">{sortIndicatorFor("usedAt")}</span>
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {orderedActivationCodes.map((code) => (
                  <tr key={code.id} className="border-b">
                    <td className="px-3 py-2 font-mono text-xs text-slate-700">{code.code}</td>
                    <td className="px-3 py-2 text-xs text-slate-700">{code.userEmail || "Sin asignar"}</td>
                    <td className="px-3 py-2 text-xs text-slate-700">{code.isUsed ? "Usado" : "Disponible"}</td>
                    <td className="px-3 py-2 text-xs text-slate-700">
                      {new Date(code.createdAt).toLocaleString("es-MX")}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-700">
                      {code.usedAt ? new Date(code.usedAt).toLocaleString("es-MX") : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}
