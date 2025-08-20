import { execSync } from "child_process";
import path from "path";
import { createPerformanceIndexes } from "../db/migrations";

export default async function globalSetup() {
  const dbUrl = process.env.DATABASE_URL_TEST;
  if (!dbUrl) throw new Error("DATABASE_URL_TEST is required for tests");
  const schemaPath = path.resolve(__dirname, "../../../prisma/schema.prisma");
  // execSync is synchronous; wrap in a Promise to satisfy require-await lint
  await Promise.resolve(
    execSync(
      `DATABASE_URL=${dbUrl} npx prisma db push --skip-generate --schema ${schemaPath}`,
      { stdio: "inherit", env: { ...process.env, DATABASE_URL: dbUrl } }
    )
  );

  // Ensure performance indexes for tests
  await createPerformanceIndexes();
}
