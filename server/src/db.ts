import { PrismaClient } from "@prisma/client";

let datasourceUrl =
  process.env.NODE_ENV === "test"
    ? process.env.DATABASE_URL_TEST || process.env.DATABASE_URL
    : process.env.DATABASE_URL;

if (!datasourceUrl) {
  throw new Error(
    "DATABASE_URL is required (and DATABASE_URL_TEST for tests). Configure in ~/.zshrc."
  );
}

// In development, automatically scope Prisma to a dedicated Postgres schema
// without requiring local env var changes. This prevents collisions when
// multiple projects share the same database during local development.
if (process.env.NODE_ENV === "development") {
  const hasSchemaParam = /[?&]schema=/.test(datasourceUrl);
  if (!hasSchemaParam) {
    const separator = datasourceUrl.includes("?") ? "&" : "?";
    datasourceUrl = `${datasourceUrl}${separator}schema=beat_sage`;
  }
}

// Single Prisma client for the app lifecycle
export const prisma = new PrismaClient({ datasourceUrl });

// Evergreen comment: Prisma is the single source of truth for schema and types.
