import "reflect-metadata";
import { config as loadEnv } from "dotenv";
import { join } from "path";
import { NestFactory } from "@nestjs/core";
import type { INestApplication } from "@nestjs/common";
import { AppModule } from "../src/app.module";
import { buildActivationCodeHash } from "../src/auth/activation-code-security";
import { PrismaService } from "../src/prisma/prisma.service";

loadEnv({ path: join(process.cwd(), "../.env") });
loadEnv({ path: join(process.cwd(), ".env") });

function randomHex(len: number): string {
  const chars = "ABCDEF0123456789";
  let out = "";
  for (let i = 0; i < len; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function makeCode(): string {
  return `SOS-${randomHex(4)}-${randomHex(4)}`;
}

function assertCondition(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function postJson(baseUrl: string, path: string, payload: Record<string, unknown>) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  let body: any = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  return { response, body };
}

async function run() {
  console.log("E2E Code-First: iniciando...");
  let prisma: PrismaService | null = null;
  let app: INestApplication | null = null;
  const createdCodes: string[] = [];
  const createdEmails: string[] = [];

  try {
    prisma = new PrismaService();
    await prisma.$connect();
    console.log("E2E Code-First: prisma conectado");

    const pepper = process.env.ACTIVATION_CODE_PEPPER || process.env.JWT_SECRET || "change-me";
    app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
    await app.listen(0);
    console.log("E2E Code-First: app iniciada");

    const address = app.getHttpServer().address();
    const port = typeof address === "string" ? Number(address.split(":").pop()) : address.port;
    const baseUrl = `http://127.0.0.1:${port}`;

    const validCode = makeCode();
    const duplicateCode = makeCode();

    createdCodes.push(validCode, duplicateCode);

    await prisma.activationCode.createMany({
      data: [
        {
          code: validCode,
          codeHash: buildActivationCodeHash(validCode, pepper),
          isUsed: false,
        },
        {
          code: duplicateCode,
          codeHash: buildActivationCodeHash(duplicateCode, pepper),
          isUsed: false,
        },
      ],
    });

    const emailOk = `e2e-ok-${Date.now()}@test.local`;
    createdEmails.push(emailOk);

    const registerOk = await postJson(baseUrl, "/auth/register-basic", {
      activationCode: validCode,
      email: emailOk,
      password: "SuperPass123!",
    });

    console.log("E2E Code-First: caso 1 ejecutado");

    assertCondition(registerOk.response.ok, "Caso 1 fallido: el registro con codigo valido no fue exitoso");

    const usedAfterSuccess = await prisma.activationCode.findUnique({
      where: { code: validCode },
      select: { isUsed: true, userId: true },
    });

    assertCondition(usedAfterSuccess?.isUsed === true, "Caso 1 fallido: el codigo valido no quedo marcado como usado");
    assertCondition(Boolean(usedAfterSuccess?.userId), "Caso 1 fallido: el codigo usado no quedo vinculado al usuario");

    const registerDupEmail = await postJson(baseUrl, "/auth/register-basic", {
      activationCode: duplicateCode,
      email: emailOk,
      password: "SuperPass123!",
    });

    console.log("E2E Code-First: caso 2 ejecutado");

    assertCondition(registerDupEmail.response.status === 400, "Caso 2 fallido: el email duplicado debio devolver 400");

    const codeStillFree = await prisma.activationCode.findUnique({
      where: { code: duplicateCode },
      select: { isUsed: true, userId: true },
    });

    assertCondition(codeStillFree?.isUsed === false, "Caso 2 fallido: se quemo un codigo cuando el registro fallo");
    assertCondition(!codeStillFree?.userId, "Caso 2 fallido: el codigo fallido no debio vincular usuario");

    const registerUsedCode = await postJson(baseUrl, "/auth/register-basic", {
      activationCode: validCode,
      email: `e2e-used-${Date.now()}@test.local`,
      password: "SuperPass123!",
    });

    console.log("E2E Code-First: caso 3 ejecutado");

    assertCondition(registerUsedCode.response.status === 403, "Caso 3 fallido: el codigo usado debio devolver 403");

    const usedMessage = Array.isArray(registerUsedCode.body?.message)
      ? registerUsedCode.body.message.join(", ")
      : String(registerUsedCode.body?.message || "");

    assertCondition(
      usedMessage.includes("Código de activación inválido o ya utilizado"),
      "Caso 3 fallido: mensaje inesperado para codigo usado",
    );

    console.log("E2E Code-First: OK (3/3 casos)");
  } catch (error) {
    console.error("E2E Code-First: ERROR");
    if (error instanceof Error) {
      console.error(error.stack || error.message);
    } else {
      console.error(error);
    }
    process.exitCode = 1;
  } finally {
    if (prisma && createdEmails.length) {
      await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
    }

    if (prisma && createdCodes.length) {
      await prisma.activationCode.deleteMany({ where: { code: { in: createdCodes } } });
    }

    if (app) {
      await app.close();
    }

    if (prisma) {
      await prisma.$disconnect();
    }
  }
}

void run();
