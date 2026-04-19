import "dotenv/config";
import { createHash, randomBytes } from "crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

type GeneratedCode = {
  code: string;
  codeHash: string;
  isUsed: boolean;
  createdAt: Date;
};

const DEFAULT_BATCH_SIZE = 50;
const MAX_RETRY_ROUNDS = 10;

function parseBatchSize(): number {
  const raw = process.argv[2];
  if (!raw) {
    return DEFAULT_BATCH_SIZE;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("El tamaño del lote debe ser un entero positivo.");
  }

  return parsed;
}

function generateBlock(): string {
  return randomBytes(2).toString("hex").toUpperCase();
}

function generateActivationCode(): string {
  return `SOS-${generateBlock()}-${generateBlock()}`;
}

function buildCodeHash(code: string, pepper: string): string {
  return createHash("sha256").update(`${pepper}:${code}`).digest("hex");
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL no está configurada");
  }

  const batchSize = parseBatchSize();
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  const pepper = process.env.ACTIVATION_CODE_PEPPER || process.env.JWT_SECRET || "change-me";

  try {
    const codes = new Set<string>();
    let retries = 0;

    while (codes.size < batchSize) {
      if (retries >= MAX_RETRY_ROUNDS) {
        throw new Error("No fue posible generar suficientes códigos únicos.");
      }

      const pending = batchSize - codes.size;
      const candidates = Array.from({ length: pending }, () => generateActivationCode());
      const existing = await prisma.activationCode.findMany({
        where: { code: { in: candidates } },
        select: { code: true },
      });

      const existingCodes = new Set(existing.map((row) => row.code));
      for (const candidate of candidates) {
        if (!existingCodes.has(candidate)) {
          codes.add(candidate);
        }
      }

      retries += 1;
    }

    const rows: GeneratedCode[] = Array.from(codes).map((code) => ({
      code,
      codeHash: buildCodeHash(code, pepper),
      isUsed: false,
      createdAt: new Date(),
    }));

    await prisma.activationCode.createMany({
      data: rows,
      skipDuplicates: true,
    });

    console.table(
      rows.map((row) => ({
        code: row.code,
        isUsed: row.isUsed,
        createdAt: row.createdAt.toISOString(),
      })),
    );

    console.log(`✓ Se generaron ${rows.length} códigos de activación.`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Error fatal al generar códigos:", error);
  process.exit(1);
});