import "dotenv/config";
import { createHash } from "crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

function buildCodeHash(code: string, pepper: string): string {
  return createHash("sha256")
    .update(`${pepper}:${code.trim().toUpperCase()}`)
    .digest("hex");
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL no está configurada");
  }

  const pepper = process.env.ACTIVATION_CODE_PEPPER || process.env.JWT_SECRET;
  if (!pepper) {
    throw new Error("ACTIVATION_CODE_PEPPER (o JWT_SECRET) es requerido para rehash");
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const rows = await prisma.activationCode.findMany({
      where: {
        codeHash: null,
      },
      select: {
        id: true,
        code: true,
      },
    });

    if (rows.length === 0) {
      console.log("No hay codigos pendientes de rehash.");
      return;
    }

    await prisma.$transaction(
      rows.map((row) =>
        prisma.activationCode.update({
          where: { id: row.id },
          data: {
            codeHash: buildCodeHash(row.code, pepper),
          },
        }),
      ),
    );

    console.log(`✓ Rehash completado para ${rows.length} codigo(s).`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Error en rehash de códigos:", error);
  process.exit(1);
});
