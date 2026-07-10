import { PrismaClient, Role } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) throw new Error("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD before seeding.");
  await prisma.user.upsert({
    where: { email },
    update: { role: Role.ADMIN },
    create: { email, name: "ผู้ดูแลระบบ NTOP", passwordHash: await hash(password, 12), role: Role.ADMIN },
  });
}

main().finally(() => prisma.$disconnect());
