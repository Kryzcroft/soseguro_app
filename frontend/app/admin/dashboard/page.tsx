"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeCanvas } from "qrcode.react";
import {
  approveUser,
  createPasswordResetLink,
  deleteUserWithRelatedData,
  fetchAdminDashboard,
  generateActivationCodes,
  assignActivationCode,
  releaseActivationCode,
  ProfileStatus,
} from "../../../lib/admin-api";
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
const PRINT_LABEL_TEMPLATE_URL = "/helmet-label-template.png";
const PRINT_TEMPLATE_BASE_HEIGHT = 1329;
const PRINT_QR_PLACEMENT = {
  xRatio: 0.167,
  yRatio: 0.257,
  sizeRatio: 0.662,
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`No se pudo cargar la imagen: ${url}`));
    image.src = url;
  });
}

function drawFallbackLabelTemplate(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.fillStyle = "#F4F6FA";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "#0C2340";
  ctx.lineWidth = Math.max(6, Math.round(width * 0.01));
  ctx.strokeRect(8, 8, width - 16, height - 16);

  const topBandHeight = Math.round(height * 0.17);
  ctx.fillStyle = "#E11D2E";
  ctx.fillRect(0, 0, width * 0.52, topBandHeight);

  ctx.fillStyle = "#0C2340";
  ctx.font = `${Math.round(width * 0.09)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("SOSeguro", Math.round(width * 0.25), Math.round(topBandHeight * 0.72));

  ctx.fillStyle = "#0C2340";
  ctx.font = `${Math.round(width * 0.07)}px sans-serif`;
  ctx.fillText("PERFIL MEDICO DIGITAL", Math.round(width * 0.5), Math.round(height * 0.54));
}

function buildLabelUrl(code?: string | null): string {
  const normalizedCode = code?.trim().toUpperCase();
  if (!normalizedCode || !SITE_BASE_URL) {
    return "";
  }

  return `${SITE_BASE_URL}/a/${encodeURIComponent(normalizedCode)}`;
}

function escapeCsvValue(value: unknown): string {
  const raw = value == null ? "" : String(value);
  const escaped = raw.replace(/"/g, '""');
  return `"${escaped}"`;
}

function QrTools({ targetUrl, label, fileLabel }: QrToolsProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const printCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const finalUrl = useMemo(() => targetUrl?.trim() || "", [targetUrl]);

  const disabled = !finalUrl;

  const downloadQr = useCallback(() => {
    const sourceCanvas = printCanvasRef.current || canvasRef.current;
    if (!sourceCanvas || disabled) {
      return;
    }

    sourceCanvas.toBlob((blob) => {
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

  const downloadPrintableLabel = useCallback(async () => {
    if (disabled) {
      return;
    }

    const qrCanvas = printCanvasRef.current || canvasRef.current;
    if (!qrCanvas) {
      setCopyMessage("No se pudo generar QR para impresion.");
      return;
    }

    let templateImage: HTMLImageElement | null = null;
    try {
      templateImage = await loadImage(PRINT_LABEL_TEMPLATE_URL);
    } catch {
      templateImage = null;
    }

    const width = templateImage?.naturalWidth || 760;
    const height = templateImage?.naturalHeight || 1600;
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = width;
    exportCanvas.height = height;

    const ctx = exportCanvas.getContext("2d");
    if (!ctx) {
      setCopyMessage("No se pudo preparar la etiqueta para impresion.");
      return;
    }

    if (templateImage) {
      ctx.drawImage(templateImage, 0, 0, width, height);
    } else {
      drawFallbackLabelTemplate(ctx, width, height);
    }

    const qrYOffsetPx = Math.round((height / PRINT_TEMPLATE_BASE_HEIGHT) * 6);
    const qrSize = Math.round(width * PRINT_QR_PLACEMENT.sizeRatio);
    const qrX = Math.round(width * PRINT_QR_PLACEMENT.xRatio);
    const qrY = Math.round(height * PRINT_QR_PLACEMENT.yRatio) + qrYOffsetPx;
    ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

    const activationLabel = (fileLabel || "ETIQUETA").toUpperCase();
    ctx.fillStyle = "#0C2340";
    ctx.font = `${Math.round(width * 0.02)}px monospace`;
    ctx.textAlign = "center";
    const keyX = Math.round(width * 0.5);
    const keyY = Math.round(height * 0.585);
    ctx.fillText(activationLabel, keyX, keyY);

    exportCanvas.toBlob((blob) => {
      if (!blob) {
        setCopyMessage("No se pudo exportar la etiqueta.");
        return;
      }

      const normalizedFileLabel = (fileLabel || "etiqueta").replace(/[^A-Z0-9_-]/gi, "");
      const link = document.createElement("a");
      link.download = `etiqueta-${normalizedFileLabel || "soseguro"}.png`;
      const objectUrl = URL.createObjectURL(blob);
      link.href = objectUrl;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);

      setCopyMessage(templateImage ? "Etiqueta lista para imprimir." : "Etiqueta generada con plantilla base.");
      window.setTimeout(() => setCopyMessage(null), 1800);
    }, "image/png");
  }, [disabled, fileLabel]);

  const copyForNfc = useCallback(async () => {
    if (disabled) {
      return;
    }

    await navigator.clipboard.writeText(finalUrl);
    setCopyMessage("URL copiada para NFC");
    window.setTimeout(() => setCopyMessage(null), 1800);
  }, [disabled, finalUrl]);

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Acceso QR/NFC</p>
      <p className="break-all rounded-md bg-slate-50 px-2 py-1 text-[11px] font-mono text-slate-700">{label}</p>
      <div className="flex items-start gap-2">
        <div className="shrink-0 rounded-md border border-slate-200 bg-slate-50 p-1">
          <QRCodeCanvas
            ref={(node) => {
              canvasRef.current = node;
            }}
            value={finalUrl || "about:blank"}
            size={64}
            level="M"
            includeMargin
          />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <button
            type="button"
            onClick={downloadQr}
            disabled={disabled}
            className="w-full whitespace-nowrap rounded-md border px-2 py-1 text-[11px] font-semibold text-slate-700 disabled:opacity-50"
          >
            Descargar QR
          </button>

          <button
            type="button"
            onClick={downloadPrintableLabel}
            disabled={disabled}
            className="w-full whitespace-nowrap rounded-md border border-slate-900 px-2 py-1 text-[11px] font-semibold text-slate-900 disabled:opacity-50"
          >
            Descargar Etiqueta
          </button>

          <button
            type="button"
            onClick={copyForNfc}
            disabled={disabled}
            className="w-full whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
          >
            Copiar Link NFC
          </button>
        </div>
      </div>

      <div className="hidden">
        <QRCodeCanvas
          ref={(node) => {
            printCanvasRef.current = node;
          }}
          value={finalUrl || "about:blank"}
          size={1024}
          level="H"
          includeMargin
        />
      </div>

      {copyMessage ? <p className="text-[11px] text-emerald-700">{copyMessage}</p> : null}
    </div>
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterOption>("ALL");
  const [accountStatusFilter, setAccountStatusFilter] = useState<AccountStatusFilter>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  // Texto que el usuario escribe; searchTerm se actualiza con debounce
  // para no recargar el inventario con cada tecla.
  const [searchInput, setSearchInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [inventory, setInventory] = useState<Awaited<ReturnType<typeof fetchAdminDashboard>>["inventory"]>([]);
  const [activationCodes, setActivationCodes] = useState<
    Awaited<ReturnType<typeof fetchAdminDashboard>>["activationCodes"]
  >([]);
  const [activationStatusFilter, setActivationStatusFilter] = useState<ActivationStatusFilter>("ALL");
  const [activationSortKey, setActivationSortKey] = useState<ActivationSortKey>("createdAt");
  const [activationSortDirection, setActivationSortDirection] = useState<"asc" | "desc">("desc");
  const [activationSearchTerm, setActivationSearchTerm] = useState("");
  const [activationPage, setActivationPage] = useState(1);
  const ACTIVATION_CODES_PER_PAGE = 20;
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [approvingForUserId, setApprovingForUserId] = useState<string | null>(null);
  const [resettingPasswordForUserId, setResettingPasswordForUserId] = useState<string | null>(null);
  const [deletingForUserId, setDeletingForUserId] = useState<string | null>(null);
  const [isGeneratingCodes, setIsGeneratingCodes] = useState(false);
  const [selectedUserForCode, setSelectedUserForCode] = useState<Record<string, string | null>>({});
  const [assigningForCodeId, setAssigningForCodeId] = useState<string | null>(null);
  const [assignMessageByCodeId, setAssignMessageByCodeId] = useState<Record<string, { kind: "success" | "error"; text: string } | null>>({});
  const [releasingForCodeId, setReleasingForCodeId] = useState<string | null>(null);
  const [releaseMessageByCodeId, setReleaseMessageByCodeId] = useState<Record<string, { kind: "success" | "error"; text: string } | null>>({});

  const orderedActivationCodes = useMemo(() => {
    const normalizedSearch = activationSearchTerm.trim().toLowerCase();

    const filtered = activationCodes.filter((code) => {
      if (activationStatusFilter === "USED" && !code.isUsed) return false;
      if (activationStatusFilter === "AVAILABLE" && code.isUsed) return false;

      if (normalizedSearch) {
        const haystack = [code.code, code.userEmail ?? "", buildLabelUrl(code.code)]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(normalizedSearch)) return false;
      }

      return true;
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
  }, [activationCodes, activationSortDirection, activationSortKey, activationStatusFilter, activationSearchTerm]);

  const activationTotalPages = Math.max(
    1,
    Math.ceil(orderedActivationCodes.length / ACTIVATION_CODES_PER_PAGE),
  );
  const activationCurrentPage = Math.min(activationPage, activationTotalPages);
  const pagedActivationCodes = useMemo(() => {
    const start = (activationCurrentPage - 1) * ACTIVATION_CODES_PER_PAGE;
    return orderedActivationCodes.slice(start, start + ACTIVATION_CODES_PER_PAGE);
  }, [orderedActivationCodes, activationCurrentPage]);

  // Al cambiar el buscador o el filtro, volver a la primera pagina.
  useEffect(() => {
    setActivationPage(1);
  }, [activationSearchTerm, activationStatusFilter]);

  const activationCodesByUserId = useMemo(() => {
    const grouped = new Map<string, typeof activationCodes>();

    for (const code of activationCodes) {
      if (!code.userId) {
        continue;
      }

      const rows = grouped.get(code.userId) ?? [];
      rows.push(code);
      grouped.set(code.userId, rows);
    }

    grouped.forEach((rows) => {
      rows.sort(
        (left, right) =>
          new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
      );
    });

    return grouped;
  }, [activationCodes]);

  const handleAssignCode = async (codeRow: { id: string; code: string }) => {
    try {
      const selected = selectedUserForCode[codeRow.id];
      if (!selected) {
        setAssignMessageByCodeId((prev) => ({
          ...prev,
          [codeRow.id]: { kind: "error", text: "Selecciona un usuario antes de asignar." },
        }));
        window.setTimeout(() => {
          setAssignMessageByCodeId((prev) => ({ ...prev, [codeRow.id]: null }));
        }, 2500);
        return;
      }

      let userId = selected;
      if (selected === "__manual__") {
        const manual = window.prompt("Ingresa userId manualmente (o cancelar):");
        if (!manual) return;
        userId = manual.trim();
      }

      setAssigningForCodeId(codeRow.id);
      setAssignMessageByCodeId((prev) => ({ ...prev, [codeRow.id]: null }));

      await assignActivationCode(userId, codeRow.code);

      // Optimistic local update so UI refleja el cambio inmediatamente.
      setActivationCodes((prev) =>
        prev.map((currentCode) =>
          currentCode.id === codeRow.id
            ? {
                ...currentCode,
                userId,
                userEmail: inventory.find((u) => u.userId === userId)?.email || currentCode.userEmail,
                isUsed: true,
                status: "ACTIVE",
                usedAt: new Date().toISOString(),
              }
            : currentCode,
        ),
      );

      setAssignMessageByCodeId((prev) => ({
        ...prev,
        [codeRow.id]: { kind: "success", text: `Etiqueta ${codeRow.code} asignada.` },
      }));
      window.setTimeout(() => {
        setAssignMessageByCodeId((prev) => ({ ...prev, [codeRow.id]: null }));
      }, 2500);

      // Refresh server state to ensure consistency.
      await loadDashboard(filter);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo asignar etiqueta";
      setAssignMessageByCodeId((prev) => ({
        ...prev,
        [codeRow.id]: { kind: "error", text: message },
      }));
      window.setTimeout(() => {
        setAssignMessageByCodeId((prev) => ({ ...prev, [codeRow.id]: null }));
      }, 4000);
    } finally {
      setAssigningForCodeId(null);
    }
  };

  const handleSelectForCode = (codeId: string, value: string) => {
    setSelectedUserForCode((prev) => ({ ...prev, [codeId]: value }));
  };

  const handleReleaseCode = async (codeRow: { id: string; code: string }) => {
    const confirmed = window.confirm(
      `Vas a liberar la etiqueta ${codeRow.code}. Se desvinculara del usuario, pero el perfil no se borrara. Deseas continuar?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setReleasingForCodeId(codeRow.id);
      setReleaseMessageByCodeId((prev) => ({ ...prev, [codeRow.id]: null }));

      await releaseActivationCode(codeRow.code);

      setActivationCodes((prev) =>
        prev.map((currentCode) =>
          currentCode.id === codeRow.id
            ? {
                ...currentCode,
                userId: null,
                userEmail: null,
                isUsed: false,
                status: "AVAILABLE",
                usedAt: null,
                activatedAt: null,
              }
            : currentCode,
        ),
      );

      setReleaseMessageByCodeId((prev) => ({
        ...prev,
        [codeRow.id]: { kind: "success", text: `Etiqueta ${codeRow.code} liberada.` },
      }));
      window.setTimeout(() => {
        setReleaseMessageByCodeId((prev) => ({ ...prev, [codeRow.id]: null }));
      }, 2500);

      await loadDashboard(filter);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo liberar la etiqueta";
      setReleaseMessageByCodeId((prev) => ({
        ...prev,
        [codeRow.id]: { kind: "error", text: message },
      }));
      window.setTimeout(() => {
        setReleaseMessageByCodeId((prev) => ({ ...prev, [codeRow.id]: null }));
      }, 4000);
    } finally {
      setReleasingForCodeId(null);
    }
  };

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

  // Espera 400 ms sin escribir antes de aplicar la búsqueda de usuarios,
  // para no disparar una recarga completa ("Cargando inventario...") con cada tecla.
  useEffect(() => {
    const timer = window.setTimeout(() => setSearchTerm(searchInput), 400);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

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

  const handleResetPassword = async (userId: string, email: string) => {
    setResettingPasswordForUserId(userId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await createPasswordResetLink(userId);

      try {
        await navigator.clipboard.writeText(result.resetUrl);
        setSuccessMessage(
          `Enlace de restablecimiento copiado para ${email}. Vence en ${result.expiresInMinutes} minutos.`,
        );
      } catch {
        window.prompt("Copia y comparte este enlace con el usuario", result.resetUrl);
        setSuccessMessage(
          `Enlace generado para ${email}. Vence en ${result.expiresInMinutes} minutos.`,
        );
      }

      await loadDashboard(filter);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo generar el enlace de restablecimiento.");
    } finally {
      setResettingPasswordForUserId(null);
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

  const handleCopyLabelUrl = async (url: string) => {
    if (!url) {
      return;
    }

    await navigator.clipboard.writeText(url);
    setSuccessMessage("URL de etiqueta copiada.");
    window.setTimeout(() => setSuccessMessage(null), 1500);
  };

  const handleExportActivationCodesCsv = () => {
    const inventoryByUserId = new Map(inventory.map((row) => [row.userId, row]));

    const headers = [
      "codigo_activacion",
      "status",
      "is_used",
      "created_at_iso",
      "used_at_iso",
      "activated_at_iso",
      "user_id",
      "user_email",
      "full_name",
      "is_verified",
      "profile_status",
      "public_profile_link",
      "label_qr_url",
      "nfc_url",
    ];

    const rows = activationCodes.map((code) => {
      const linkedUser = code.userId ? inventoryByUserId.get(code.userId) : undefined;
      const fullName = linkedUser
        ? [linkedUser.firstName, linkedUser.lastName].filter(Boolean).join(" ")
        : "";
      const labelUrl = buildLabelUrl(code.code);

      return [
        code.code,
        code.status || (code.isUsed ? "USED" : "AVAILABLE"),
        code.isUsed ? "true" : "false",
        code.createdAt,
        code.usedAt || "",
        code.activatedAt || "",
        code.userId || "",
        code.userEmail || "",
        fullName,
        linkedUser ? (linkedUser.isVerified ? "true" : "false") : "",
        linkedUser?.profileStatus || "",
        linkedUser?.publicLink || "",
        labelUrl,
        labelUrl,
      ];
    });

    const csvContent = [headers, ...rows]
      .map((line) => line.map((cell) => escapeCsvValue(cell)).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `soseguro-codigos-activacion-${date}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setSuccessMessage(`CSV exportado con ${rows.length} codigos.`);
    window.setTimeout(() => setSuccessMessage(null), 2200);
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
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Buscar por email o codigo de activacion"
                className="w-80 max-w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
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
            <>
              <p className="mt-4 text-sm text-slate-600">
                Mostrando {filteredInventory.length} de {inventory.length} usuarios.
              </p>
              <div className="mt-2 overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-600">
                    <th className="whitespace-nowrap px-3 py-2">Usuario</th>
                    <th className="whitespace-nowrap px-3 py-2">Estatus perfil</th>
                    <th className="whitespace-nowrap px-3 py-2">Estatus cuenta</th>
                    <th className="whitespace-nowrap px-3 py-2">Codigo</th>
                    <th className="whitespace-nowrap px-3 py-2">Acceso</th>
                    <th className="whitespace-nowrap px-3 py-2">Eliminar</th>
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
                          <div className="space-y-2">
                            <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                              Aprobada
                            </span>
                            <button
                              type="button"
                              onClick={() => handleResetPassword(row.userId, row.email)}
                              disabled={resettingPasswordForUserId === row.userId}
                              className="block whitespace-nowrap rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50"
                            >
                              {resettingPasswordForUserId === row.userId ? "Generando..." : "Reset contraseña"}
                            </button>
                          </div>
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
                            <button
                              type="button"
                              onClick={() => handleResetPassword(row.userId, row.email)}
                              disabled={resettingPasswordForUserId === row.userId}
                              className="block whitespace-nowrap rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50"
                            >
                              {resettingPasswordForUserId === row.userId ? "Generando..." : "Reset contraseña"}
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-slate-700">
                        {(() => {
                          const userCodes = activationCodesByUserId.get(row.userId) ?? [];

                          if (!userCodes.length) {
                            return <span>Sin codigo</span>;
                          }

                          return (
                            <div className="space-y-1">
                              {userCodes.map((codeRow, index) => (
                                <div key={codeRow.id} className="flex items-center gap-2">
                                  <span>{codeRow.code}</span>
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                      index === 0
                                        ? "bg-emerald-100 text-emerald-700"
                                        : "bg-indigo-100 text-indigo-700"
                                    }`}
                                  >
                                    {index === 0 ? "Principal" : "Espejo"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-3">
                        {(() => {
                          const userCodes = activationCodesByUserId.get(row.userId) ?? [];
                          const primaryCode = userCodes[0]?.code || row.activationCode?.code || null;
                          const labelUrl = buildLabelUrl(primaryCode);
                          const fallbackUrl = row.publicLink || "";
                          const finalUrl = labelUrl || fallbackUrl;
                          const label = finalUrl || "Sin URL";
                          const fileLabel = primaryCode || row.userId;

                          return (
                            <QrTools
                              targetUrl={finalUrl}
                              label={label}
                              fileLabel={fileLabel}
                            />
                          );
                        })()}
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
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filteredInventory.length ? (
                <p className="px-3 py-4 text-sm text-slate-500">No hay usuarios con los filtros actuales.</p>
              ) : null}
            </div>
            </>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Codigos de activacion generados</h2>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={activationSearchTerm}
                onChange={(event) => setActivationSearchTerm(event.target.value)}
                placeholder="Buscar por código, usuario o URL"
                className="w-72 rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
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

              <button
                type="button"
                onClick={handleExportActivationCodesCsv}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Exportar CSV
              </button>
            </div>
          </div>

          {successMessage ? (
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {successMessage}
            </div>
          ) : null}

          <p className="mt-4 text-sm text-slate-600">
            Mostrando {pagedActivationCodes.length} de {orderedActivationCodes.length} códigos
            {orderedActivationCodes.length !== activationCodes.length
              ? ` (${activationCodes.length} en total)`
              : ""}
            .
          </p>

          <div className="mt-2 max-h-[32rem] overflow-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[1180px] table-fixed border-separate border-spacing-0 text-sm">
              <colgroup>
                <col className="w-[22%]" />
                <col className="w-[14%]" />
                <col className="w-[9%]" />
                <col className="w-[11%]" />
                <col className="w-[11%]" />
                <col className="w-[12%]" />
                <col className="w-[21%]" />
              </colgroup>
              <thead>
                <tr className="text-left text-slate-600">
                  <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => toggleActivationSort("code")}
                      className={`inline-flex items-center gap-1 font-semibold ${activationSortKey === "code" ? "text-slate-900" : "text-slate-600"}`}
                    >
                      Codigo <span className="text-xs">{sortIndicatorFor("code")}</span>
                    </button>
                  </th>
                  <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => toggleActivationSort("userEmail")}
                      className={`inline-flex items-center gap-1 font-semibold ${activationSortKey === "userEmail" ? "text-slate-900" : "text-slate-600"}`}
                    >
                      Asignado a <span className="text-xs">{sortIndicatorFor("userEmail")}</span>
                    </button>
                  </th>
                  <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => toggleActivationSort("isUsed")}
                      className={`inline-flex items-center gap-1 font-semibold ${activationSortKey === "isUsed" ? "text-slate-900" : "text-slate-600"}`}
                    >
                      Estatus <span className="text-xs">{sortIndicatorFor("isUsed")}</span>
                    </button>
                  </th>
                  <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => toggleActivationSort("createdAt")}
                      className={`inline-flex items-center gap-1 font-semibold ${activationSortKey === "createdAt" ? "text-slate-900" : "text-slate-600"}`}
                    >
                      Creado <span className="text-xs">{sortIndicatorFor("createdAt")}</span>
                    </button>
                  </th>
                  <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => toggleActivationSort("usedAt")}
                      className={`inline-flex items-center gap-1 font-semibold ${activationSortKey === "usedAt" ? "text-slate-900" : "text-slate-600"}`}
                    >
                      Usado <span className="text-xs">{sortIndicatorFor("usedAt")}</span>
                    </button>
                  </th>
                  <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-3 py-2">URL completa QR/NFC</th>
                  <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-3 py-2">Acción</th>
                </tr>
              </thead>
              <tbody>
                {pagedActivationCodes.map((code) => (
                  <tr key={code.id}>
                    <td className="border-b border-slate-200 px-3 py-2 font-mono text-xs text-slate-700">
                      <span className="block truncate" title={code.code}>
                        {code.code}
                      </span>
                    </td>
                    <td className="break-words border-b border-slate-200 px-3 py-2 text-xs text-slate-700">{code.userEmail || "Sin asignar"}</td>
                    <td className="border-b border-slate-200 px-3 py-2">
                      <span
                        className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold ${
                          code.isUsed ? "bg-indigo-100 text-indigo-700" : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {code.isUsed ? "Usado" : "Disponible"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap border-b border-slate-200 px-3 py-2 text-xs text-slate-700">
                      {new Date(code.createdAt).toLocaleString("es-MX")}
                    </td>
                    <td className="whitespace-nowrap border-b border-slate-200 px-3 py-2 text-xs text-slate-700">
                      {code.usedAt ? new Date(code.usedAt).toLocaleString("es-MX") : "-"}
                    </td>
                    <td className="border-b border-slate-200 px-3 py-2 text-xs text-slate-700">
                      {buildLabelUrl(code.code) ? (
                        <div className="space-y-2">
                          <a
                            href={buildLabelUrl(code.code)}
                            target="_blank"
                            rel="noreferrer"
                            title={buildLabelUrl(code.code)}
                            className="block truncate font-mono text-blue-700 underline"
                          >
                            {buildLabelUrl(code.code)}
                          </a>
                          <button
                            type="button"
                            onClick={() => handleCopyLabelUrl(buildLabelUrl(code.code))}
                            className="rounded-md border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700"
                          >
                            Copiar URL
                          </button>
                        </div>
                      ) : (
                        "No disponible"
                      )}
                    </td>
                    <td className="border-b border-slate-200 px-3 py-2 text-xs text-slate-700">
                      <div className="space-y-2">
                        <div className="flex flex-col gap-2">
                        <select
                          value={selectedUserForCode[code.id] ?? ""}
                          onChange={(e) => handleSelectForCode(code.id, e.target.value)}
                          disabled={assigningForCodeId === code.id}
                          className="w-full min-w-0 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
                        >
                          <option value="">Seleccionar usuario</option>
                          {inventory.map((user) => (
                            <option key={user.userId} value={user.userId}>
                              {user.email} {user.firstName || user.lastName ? `— ${user.firstName || ""} ${user.lastName || ""}` : ""}
                            </option>
                          ))}
                          <option value="__manual__">Otro (ingresar userId)</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => handleAssignCode(code)}
                          disabled={assigningForCodeId === code.id}
                          className="w-full rounded-md border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700"
                        >
                          {assigningForCodeId === code.id ? "Asignando..." : "Asignar"}
                        </button>
                        </div>
                        {code.userId ? (
                          <button
                            type="button"
                            onClick={() => handleReleaseCode(code)}
                            disabled={releasingForCodeId === code.id}
                            className="w-full rounded-md border border-rose-300 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 disabled:opacity-50"
                          >
                            {releasingForCodeId === code.id ? "Liberando..." : "Liberar"}
                          </button>
                        ) : null}
                      </div>
                      {assignMessageByCodeId[code.id] ? (
                        <p
                          className={`mt-1 text-[11px] font-medium ${
                            assignMessageByCodeId[code.id]?.kind === "error" ? "text-rose-600" : "text-emerald-700"
                          }`}
                        >
                          {assignMessageByCodeId[code.id]?.text}
                        </p>
                      ) : null}
                      {releaseMessageByCodeId[code.id] ? (
                        <p
                          className={`mt-1 text-[11px] font-medium ${
                            releaseMessageByCodeId[code.id]?.kind === "error" ? "text-rose-600" : "text-emerald-700"
                          }`}
                        >
                          {releaseMessageByCodeId[code.id]?.text}
                        </p>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!pagedActivationCodes.length ? (
              <p className="px-3 py-4 text-sm text-slate-500">No hay códigos con los filtros actuales.</p>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-500">
              Página {activationCurrentPage} de {activationTotalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActivationPage((current) => Math.max(1, current - 1))}
                disabled={activationCurrentPage <= 1}
                className="rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => setActivationPage((current) => Math.min(activationTotalPages, current + 1))}
                disabled={activationCurrentPage >= activationTotalPages}
                className="rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
