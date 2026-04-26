"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { jsPDF } from "jspdf";

type QRCardProps = {
  targetUrl: string;
  logoUrl: string;
  title: string;
};

export function QRCard({ targetUrl, logoUrl, title }: QRCardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string>("");

  useEffect(() => {
    let active = true;
    const loadLogo = async () => {
      try {
        const response = await fetch(logoUrl);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          if (active && typeof reader.result === "string") {
            setLogoDataUrl(reader.result);
          }
        };
        reader.readAsDataURL(blob);
      } catch {
        if (active) {
          setLogoDataUrl("");
        }
      }
    };

    loadLogo();

    return () => {
      active = false;
    };
  }, [logoUrl]);

  const imageSettings = useMemo(
    () =>
      logoDataUrl
        ? {
            src: logoDataUrl,
            width: 56,
            height: 56,
            excavate: true,
          }
        : undefined,
    [logoDataUrl],
  );

  const downloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) return;
      const link = document.createElement("a");
      link.download = "sosguro-qr.png";
      const objectUrl = URL.createObjectURL(blob);
      link.href = objectUrl;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    }, "image/png");
  };

  const downloadPdf = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pdf = new jsPDF({ unit: "px", format: [320, 420] });
    pdf.setFontSize(16);
    pdf.text(title, 20, 24);
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 40, 50, 240, 240);
    pdf.setFontSize(10);
    pdf.text(targetUrl, 20, 320, { maxWidth: 280 });
    pdf.save("sosguro-qr.pdf");
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Etiqueta QR y NFC</h3>
          <p className="text-sm text-slate-500">aquí podras Descargar tu QR en caso que necesites más</p>
        </div>
        <div className="flex gap-2">
          <button onClick={downloadPng} className="rounded-md border px-3 py-2 text-sm font-medium text-slate-700">
            PNG
          </button>
          <button onClick={downloadPdf} className="rounded-md border px-3 py-2 text-sm font-medium text-slate-700">
            PDF
          </button>
        </div>
      </div>

      <div className="mt-4 flex justify-center rounded-xl bg-slate-50 p-4">
        <QRCodeCanvas
          ref={(node) => {
            canvasRef.current = node;
          }}
          value={targetUrl}
          size={220}
          level="H"
          includeMargin
          imageSettings={imageSettings}
        />
      </div>
    </section>
  );
}
