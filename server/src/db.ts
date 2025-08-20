import { PrismaClient } from "@prisma/client";

const datasourceUrl =
  process.env.NODE_ENV === "test"
    ? process.env.DATABASE_URL_TEST || process.env.DATABASE_URL
    : process.env.DATABASE_URL;

if (!datasourceUrl) {
  throw new Error(
    "DATABASE_URL is required (and DATABASE_URL_TEST for tests). Configure in ~/.zshrc."
  );
}

// Single Prisma client for the app lifecycle
export const prisma = new PrismaClient({ datasourceUrl });

// Evergreen comment: Prisma is the single source of truth for schema and types.
