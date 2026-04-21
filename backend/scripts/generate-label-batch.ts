import "dotenv/config";
import { randomBytes } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { PrismaClient, ActivationCodeStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { buildActivationCodeHash } from "../src/auth/activation-code-security";

type BatchRow = {
  code: string;
  url: string;
};

const DEFAULT_BATCH_SIZE = 150;
const MAX_RETRY_ROUNDS = 20;

function parseBatchSize(): number {
  const raw = process.argv[2];
  if (!raw) {
    return DEFAULT_BATCH_SIZE;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("La cantidad debe ser un entero positivo.");
  }

  return parsed;
}

function normalizeBaseUrl(rawBaseUrl: string): string {
  const trimmed = rawBaseUrl.trim().replace(/\/$/, "");
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    throw new Error("LABEL_BASE_URL debe iniciar con http:// o https://");
  }
  return trimmed;
}

function generateHexCode8(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

function toCsv(rows: BatchRow[]): string {
  const header = "code,url";
  const body = rows.map((row) => `${row.code},${row.url}`).join("\n");
  return `${header}\n${body}\n`;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL no está configurada");
  }

  const baseUrl = normalizeBaseUrl(process.env.LABEL_BASE_URL || "https://soseguro.app/a");
  const quantity = parseBatchSize();

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const pepper =
    process.env.ACTIVATION_CODE_PEPPER || process.env.JWT_SECRET || "change-me";

  try {
    const generatedCodes = new Set<string>();
    let retries = 0;

    while (generatedCodes.size < quantity) {
      if (retries >= MAX_RETRY_ROUNDS) {
        throw new Error("No fue posible generar suficientes códigos únicos para el lote.");
      }

      const pending = quantity - generatedCodes.size;
      const candidates = Array.from({ length: pending }, () => generateHexCode8());
      const existing = await prisma.activationCode.findMany({
        where: {
          code: { in: candidates },
        },
        select: { code: true },
      });

      const existingSet = new Set(existing.map((row) => row.code));
      for (const candidate of candidates) {
        if (!existingSet.has(candidate)) {
          generatedCodes.add(candidate);
        }
      }

      retries += 1;
    }

    const codes = Array.from(generatedCodes);
    const now = new Date();

    await prisma.activationCode.createMany({
      data: codes.map((code) => ({
        code,
        codeHash: buildActivationCodeHash(code, pepper),
        status: ActivationCodeStatus.AVAILABLE,
        isUsed: false,
        userId: null,
        activatedAt: null,
        usedAt: null,
        createdAt: now,
      })),
      skipDuplicates: true,
    });

    const rows: BatchRow[] = codes.map((code) => ({
      code,
      url: `${baseUrl}/${code}`,
    }));

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outputDir = join(process.cwd(), "outputs");
    await mkdir(outputDir, { recursive: true });

    const csvPath = join(outputDir, `activation-batch-${quantity}-${timestamp}.csv`);
    const jsonPath = join(outputDir, `activation-batch-${quantity}-${timestamp}.json`);

    await writeFile(csvPath, toCsv(rows), "utf8");
    await writeFile(jsonPath, JSON.stringify(rows, null, 2), "utf8");

    console.log(`✓ Lote generado: ${quantity} códigos`);
    console.log(`CSV: ${csvPath}`);
    console.log(`JSON: ${jsonPath}`);
    console.log(`Base URL: ${baseUrl}`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Error fatal en generación de lote:", error);
  process.exit(1);
});
