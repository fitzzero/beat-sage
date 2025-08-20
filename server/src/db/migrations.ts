import { prisma } from "../db";
import { testPrisma } from "./testDb";
import baseLogger from "../utils/logger";
import { execSync } from "child_process";
import path from "path";

const logger = baseLogger.child({ service: "Migrations" });

// Use test database in test environment
const getDb = () => (process.env.NODE_ENV === "test" ? testPrisma : prisma);

// Create tables for testing and development
export async function createTables() {
  // Use Prisma to sync schema to the database (synchronous via execSync)
  const isTest = process.env.NODE_ENV === "test";
  const dbUrl = isTest
    ? process.env.DATABASE_URL_TEST
    : process.env.DATABASE_URL;
  if (!dbUrl)
    throw new Error("DATABASE_URL (or DATABASE_URL_TEST) is required");
  const schemaPath = path.resolve(__dirname, "../../../prisma/schema.prisma");
  try {
    logger.info(
      `Syncing schema via Prisma db push (${isTest ? "test" : "dev"})`
    );
    // Wrap sync operation in a resolved Promise to satisfy require-await
    await Promise.resolve(
      execSync(
        `DATABASE_URL=${dbUrl} npx prisma db push --skip-generate --schema ${schemaPath}`,
        { stdio: "inherit", env: { ...process.env, DATABASE_URL: dbUrl } }
      )
    );
  } catch (error) {
    logger.error("Prisma db push failed:", error);
    throw error;
  }
}

// Drop all tables (for testing cleanup)
export async function dropTables() {
  const database = getDb();
  try {
    // Fast nuke: reinitialize the test DB with migrate reset when under test
    if (database === testPrisma) {
      logger.info("Prisma test reset: dropping all tables via raw SQL");
      await database.$executeRawUnsafe("DROP SCHEMA public CASCADE;");
      await database.$executeRawUnsafe("CREATE SCHEMA public;");
    } else {
      logger.warn("dropTables called outside test; skipping.");
    }
  } catch (error) {
    logger.error("Failed to drop database tables:", error);
    throw error;
  }
}

// Create performance indexes (idempotent) for development/test
export async function createPerformanceIndexes() {
  const database = getDb();
  try {
    await database.$executeRawUnsafe("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
    await database.$executeRawUnsafe(
      "CREATE INDEX IF NOT EXISTS idx_memories_content_trgm ON memories USING gin (content gin_trgm_ops);"
    );
    await database.$executeRawUnsafe(
      "CREATE INDEX IF NOT EXISTS idx_memories_title_trgm ON memories USING gin (title gin_trgm_ops);"
    );
    await database.$executeRawUnsafe(
      "CREATE INDEX IF NOT EXISTS idx_memories_tags_gin ON memories USING gin (tags);"
    );
    logger.info("Performance indexes ensured (memories)");
  } catch (error) {
    logger.warn("Failed to create performance indexes (non-fatal):", error);
  }
}

// Evergreen comment: Simple migration utilities for testing using Prisma. Drizzle is no longer used.
