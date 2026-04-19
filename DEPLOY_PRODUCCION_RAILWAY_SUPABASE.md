# Deploy Produccion (Railway + Supabase)

## Paso 1. Preparar variables y runtime (hecho en codigo)

### Cambios ya aplicados

- Backend ahora usa `PORT` dinamico (Railway) en `backend/src/main.ts`.
- CORS ahora puede cerrarse por lista con `CORS_ORIGINS`.
- Plantillas de entorno listas:
  - `backend/.env.example`
  - `frontend/.env.example`

### Que debes configurar en Railway (Backend)

Usa los valores de `backend/.env.example` y define al menos:

- `DATABASE_URL` (Supabase connection string)
- `JWT_SECRET`
- `ACTIVATION_CODE_PEPPER`
- `PUBLIC_PROFILE_BASE_URL` (URL del frontend en Railway)
- `PROFILE_UPLOAD_PUBLIC_BASE_URL` (URL del backend + `/uploads`)
- `ADMIN_EMAIL`
- `REQUIRE_EMAIL_VERIFICATION` (`false` para flujo pendiente/aprobado)
- `CORS_ORIGINS` (URL exacta del frontend)

### Que debes configurar en Railway (Frontend)

Usa los valores de `frontend/.env.example`:

- `NEXT_PUBLIC_API_BASE_URL` (URL del backend en Railway)
- `NEXT_PUBLIC_SITE_URL` (URL del frontend en Railway)
- `NEXT_PUBLIC_LEGAL_TERMS_VERSION`

## Paso 2. Crear base en Supabase

1. Crear proyecto Supabase.
2. Copiar cadena de conexion Postgres (transaction pooler o direct connection).
3. Colocar `DATABASE_URL` en Railway backend.

## Paso 3. Deploy Backend en Railway

1. Crear servicio Railway apuntando a carpeta `backend`.
2. Build command: `npm install && npm run build`.
3. Start command: `npm run start`.
4. Definir variables de entorno backend.
5. Ejecutar migraciones en Railway shell:
   - `npm run prisma:deploy`
6. (Opcional) Seed inicial:
   - `npm run prisma:seed`

## Paso 4. Deploy Frontend en Railway

1. Crear servicio Railway apuntando a carpeta `frontend`.
2. Build command: `npm install && npm run build`.
3. Start command: `npm run start`.
4. Definir variables frontend.

## Paso 5. Validacion post-deploy

1. `/auth/login` responde 200 con cuenta admin.
2. `/admin/dashboard` carga inventario.
3. Activacion nueva queda en pendiente.
4. Admin aprueba usuario.
5. Login usuario aprobado redirige a `/perfil-medico` si incompleto.
6. Perfil publico `/p/{publicId}` carga correctamente.

## Paso 6. Endurecimiento final

- Rotar secretos (`JWT_SECRET`, `ACTIVATION_CODE_PEPPER`).
- Restringir `CORS_ORIGINS` a dominio final.
- Configurar dominio custom en Railway.
- (Recomendado) mover uploads a almacenamiento persistente (S3/Supabase Storage), porque filesystem de contenedor es efimero.
