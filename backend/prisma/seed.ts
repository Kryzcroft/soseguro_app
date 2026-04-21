import "dotenv/config";
import { createHash } from "crypto";
import { randomBytes } from "crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

function generateActivationCode(): string {
  return randomBytes(16).toString("hex").toUpperCase();
}

async function main() {
  // Configurar el pool de conexiones de PostgreSQL
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL no está configurada");
  }

  const pool = new Pool({ connectionString });

  // Instanciar Prisma Client con el adaptador PrismaPg
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    // Crear usuario inicial
    const initialUser = await prisma.user.upsert({
      where: { email: "admin@soseguro.app" },
      update: {},
      create: {
        email: "admin@soseguro.app",
        // Reemplazar por hash seguro (bcrypt/argon2) en entorno real.
        password: "ChangeMe_123!",
      },
    });

    const pepper = process.env.ACTIVATION_CODE_PEPPER || process.env.JWT_SECRET || "change-me";
    const freshActivationCodes = new Set<string>();
    while (freshActivationCodes.size < 5) {
      freshActivationCodes.add(generateActivationCode());
    }

    await prisma.activationCode.deleteMany({});

    for (const activationCodeValue of freshActivationCodes) {
      const activationCodeHash = createHash("sha256")
        .update(`${pepper}:${activationCodeValue}`)
        .digest("hex");

      await prisma.activationCode.create({
        data: {
          code: activationCodeValue,
          codeHash: activationCodeHash,
          isUsed: false,
        },
      });
    }

    console.log(
      `✓ Seed completado: usuario inicial y ${freshActivationCodes.size} codigos de activacion disponibles.`
    );
    console.log(`Codigos disponibles: ${Array.from(freshActivationCodes).join(", ")}`);
  } catch (error) {
    console.error("✗ Error ejecutando seed:", error);
    throw error;
  } finally {
    // Cerrar Prisma Client
    await prisma.$disconnect();

    // Cerrar el pool de conexiones de PostgreSQL
    await pool.end();
  }
}

// Ejecutar el seed
main()
  .catch((error) => {
    console.error("Error fatal:", error);
    process.exit(1);
  })
  .then(() => {
    process.exit(0);
  });
