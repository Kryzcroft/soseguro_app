"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

const SOS_LOGO = "/sos-logo-light.png";

export default function EmergenciaPage() {
  const [isNotifying, setIsNotifying] = useState(true);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const handleCancel = () => {
    setIsNotifying(false);
    setShowCancelConfirm(false);
  };

  return (
    <main className="min-h-screen bg-soseguro-light px-4 py-8 text-soseguro-navy md:px-8">
      <section className="mx-auto max-w-5xl space-y-5">
        <header className="so-header flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/80">Operacion SOS</p>
            <h1 className="mt-1 text-3xl font-bold">Pantalla de Emergencia</h1>
          </div>
          <img src={SOS_LOGO} alt="Logo SOSeguro" className="h-12 w-auto rounded-md bg-white p-1" />
        </header>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="rounded-[10px] border border-soseguro-navy/10 bg-white p-5"
        >
          <h2 className="text-2xl font-bold">Estado</h2>
          <p className="mt-2 text-lg font-semibold text-soseguro-emergency">
            {isNotifying ? "Notificando contactos" : "Notificacion cancelada"}
          </p>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.05 }}
          className="rounded-[10px] border border-soseguro-navy/10 bg-white p-5"
        >
          <h2 className="text-2xl font-bold">Mapa</h2>
          <div className="mt-3 h-72 rounded-[10px] border border-soseguro-navy/15 bg-[linear-gradient(120deg,#dbe4ec,#f4f6f8)] p-4">
            <p className="text-sm text-soseguro-navy/70">Mapa activo de ubicacion (modo demo).</p>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.1 }}
          className="rounded-[10px] border border-soseguro-navy/10 bg-white p-5"
        >
          <h2 className="text-2xl font-bold">Informacion Medica Visible</h2>
          <div className="mt-3 grid gap-2 text-base">
            <p><span className="font-bold">Nombre:</span> Usuario SOSeguro</p>
            <p><span className="font-bold">Grupo sanguineo:</span> O+</p>
            <p><span className="font-bold">Alergias:</span> Sin alergias registradas</p>
            <p><span className="font-bold">Contactos:</span> 2 disponibles</p>
          </div>
        </motion.section>

        <section className="rounded-[10px] border border-soseguro-navy/10 bg-white p-5">
          {!showCancelConfirm ? (
            <button
              type="button"
              onClick={() => setShowCancelConfirm(true)}
              className="rounded-[10px] border border-soseguro-emergency px-5 py-3 font-bold text-soseguro-emergency transition-colors duration-150 hover:bg-soseguro-emergency hover:text-white"
            >
              Cancelar emergencia
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-soseguro-navy">Confirmar cancelacion de alerta activa?</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-[10px] bg-soseguro-emergency px-5 py-3 font-bold text-white transition-transform duration-150 active:scale-[0.99]"
                >
                  Si, cancelar
                </button>
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(false)}
                  className="rounded-[10px] border border-soseguro-navy/20 px-5 py-3 font-bold text-soseguro-navy"
                >
                  No, volver
                </button>
              </div>
            </div>
          )}
        </section>

        <Link href="/dashboard" className="inline-block rounded-[10px] border border-soseguro-navy/20 px-4 py-2 font-semibold text-soseguro-navy">
          Volver al dashboard
        </Link>
      </section>
    </main>
  );
}
