export default function AvisoPrivacidadPage() {
  return (
    <main className="min-h-screen bg-[#F5F7FA] px-4 py-10 text-slate-900 md:px-8">
      <article className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="mt-2 text-3xl font-bold">Aviso de Privacidad Simplificado</h1>
        <p className="mt-3 text-sm text-slate-600">
          SOSeguro es responsable del tratamiento de sus datos personales. Este documento resume el manejo de su información bajo los principios de licitud y lealtad.
        </p>

        <section className="mt-6 space-y-4 text-sm leading-6 text-slate-700">
          <div>
            <h2 className="text-lg font-semibold">1. Finalidad del Tratamiento</h2>
            <p>
              Los datos recolectados tienen como finalidad exclusiva:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>La creación y visualización de una ficha médica de emergencia.</li>
              <li>La generación de identificadores únicos para dispositivos QR/NFC.</li>
              <li>La notificación a contactos de emergencia designados en caso de incidentes.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold">2. Datos Personales Tratados</h2>
            <p>
              Procesamos datos de identificación, contacto, información médica sensible (alergias, padecimientos,
              tipo de sangre), fotografías para reconocimiento y metadatos técnicos necesarios para la estabilidad
              del servicio.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold">3. Gestión de la Visibilidad</h2>
            <p>
              El Titular es el único responsable de activar la visibilidad pública de su perfil. En estado
              "Oculto", cualquier acceso vía QR/NFC mostrará un aviso de indisponibilidad para proteger su
              privacidad.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold">4. Consentimiento Informado</h2>
            <p>
              El uso de la ficha médica requiere la aceptación expresa del Titular para la exposición de datos
              sensibles. SOSeguro mantendrá un registro inmutable del momento y versión de aceptación.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold">5. Seguridad y Derechos ARCO</h2>
            <p>
              Implementamos medidas de seguridad técnica y administrativa para proteger su información. Usted puede
              ejercer sus derechos de Acceso, Rectificación, Cancelación u Oposición (ARCO) en cualquier momento a
              través de las herramientas de gestión en su Dashboard o mediante los canales oficiales de soporte.
            </p>
          </div>

          <div className="rounded-xl bg-amber-50 p-4 text-amber-900">
            <p className="font-semibold">Deslinde de Responsabilidad</p>
            <p className="mt-1">
              La información contenida en el perfil es proporcionada de manera voluntaria y bajo protesta de decir
              verdad por el usuario. SOSeguro actúa únicamente como plataforma de almacenamiento y exhibición; no
              verifica, valida ni garantiza la veracidad de los datos médicos ingresados. El uso de esta información
              por parte de terceros o cuerpos de emergencia es responsabilidad exclusiva del usuario y de quienes
              consulten el perfil.
            </p>
          </div>
        </section>
      </article>
    </main>
  );
}
