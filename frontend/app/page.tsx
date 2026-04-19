import Link from "next/link";
import { AlertTriangle, CheckCircle2, MapPin } from "lucide-react";

const SOS_LOGO = "/sos-logo-light.png";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-soseguro-light px-4 py-8 text-soseguro-navy md:px-8">
      <section className="mx-auto max-w-5xl space-y-6">
        <header className="so-header flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/80">Live Testing</p>
            <h1 className="mt-1 text-3xl font-bold">SOSeguro</h1>
            <p className="mt-1 text-sm text-white/85">Respuesta de emergencia medica con QR/NFC y contactos inmediatos.</p>
          </div>
          <img src={SOS_LOGO} alt="Logo SOSeguro" className="h-12 w-auto rounded-md bg-white p-1" />
        </header>

        <section className="so-card rounded-[10px] border border-soseguro-navy/10 p-6">
          <h2 className="text-2xl font-bold">Activacion de Emergencia</h2>
          <p className="mt-2 text-base text-soseguro-navy/80">Un solo toque para iniciar protocolo SOS y notificar a contactos.</p>

          <div className="mt-6">
            <Link href="/emergencia" className="inline-flex w-full items-center justify-center gap-2 rounded-[10px] bg-soseguro-emergency px-6 py-5 text-2xl font-bold text-white transition-transform duration-150 active:scale-[0.99] md:w-auto">
              <AlertTriangle size={24} />
              ACTIVAR SOS
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <article className="so-card rounded-[10px] border border-soseguro-navy/10 p-5">
            <p className="text-sm font-semibold uppercase text-soseguro-navy/70">Estado de Ubicacion</p>
            <div className="mt-3 flex items-center gap-2 text-lg font-semibold text-soseguro-navy">
              <MapPin className="text-soseguro-emergency" size={20} />
              Ubicacion activa
            </div>
          </article>

          <article className="so-card rounded-[10px] border border-soseguro-navy/10 p-5">
            <p className="text-sm font-semibold uppercase text-soseguro-navy/70">Estado de Perfil</p>
            <div className="mt-3 flex items-center gap-2 text-lg font-semibold text-soseguro-navy">
              <CheckCircle2 className="text-soseguro-emergency" size={20} />
              Perfil medico listo
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}
