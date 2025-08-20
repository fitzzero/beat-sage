/* eslint-disable no-console */
import "dotenv/config";
import { prisma } from "../db";
import { createTables } from "./migrations";

async function main() {
  // Safety guard: Only run against a development DB
  const url = process.env.DATABASE_URL || "";
  if (!url || !/development|dev|localhost|127\.0\.0\.1/.test(url)) {
    throw new Error(
      "Refusing to reset non-development database. Set DATABASE_URL to a local dev DB."
    );
  }

  console.log(
    "Resetting dev schema (dropping chat/agent/message/model tables)..."
  );

  // Drop app tables if they exist to ensure clean shapes
  await prisma.$executeRawUnsafe("DROP TABLE IF EXISTS messages CASCADE");
  await prisma.$executeRawUnsafe("DROP TABLE IF EXISTS chats CASCADE");
  await prisma.$executeRawUnsafe("DROP TABLE IF EXISTS agents CASCADE");
  await prisma.$executeRawUnsafe("DROP TABLE IF EXISTS models CASCADE");

  // Recreate tables using our migration helpers (idempotent CREATE IF NOT EXISTS)
  await createTables();

  console.log("Dev schema reset complete.");
}

main().catch((e) => {
  console.error("Dev schema reset failed:", e);
  process.exit(1);
});
