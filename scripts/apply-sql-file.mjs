import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";

const file = process.argv[2];
const startAt = Math.max(1, Number(process.argv[3] ?? 1));
if (!file) throw new Error("Usage: node scripts/apply-sql-file.mjs <sql-file> [start-statement]");
const sql = await readFile(file, "utf8");
const statements = sql
  .split(/;\s*(?:\r?\n|$)/)
  .map((statement) => statement.replace(/^\s*--.*$/gm, "").trim())
  .filter(Boolean);
const prisma = new PrismaClient();
try {
  for (const [index, statement] of statements.entries()) {
    if (index + 1 < startAt) continue;
    try {
      await prisma.$executeRawUnsafe(statement);
      process.stdout.write(`Applied ${index + 1}/${statements.length}\n`);
    } catch (error) {
      throw new Error(`SQL statement ${index + 1}/${statements.length} failed: ${statement.slice(0, 120)}`, { cause: error });
    }
  }
} finally {
  await prisma.$disconnect();
}
