import { testPool } from "../db/testDb";
import { testPrisma } from "../db/testDb";
//

// Global test setup
jest.setTimeout(20000);
beforeAll(async () => {
  // Enable dev userId handshake for tests
  process.env.ENABLE_DEV_CREDENTIALS = "true";
  // Database URL validation is handled in testDb.ts

  // Schema is synced once in globalSetup
  // Prisma handles uuid via db-generated default; no extension init needed
  await Promise.resolve();
  // Clean any per-run global caches from prior Jest workers
  (
    global as unknown as { __serviceAccessCache__?: unknown }
  ).__serviceAccessCache__ = undefined;
});

// Clean up after all tests
afterAll(async () => {
  // Close database connections
  await testPool.end();
  // Disconnect Prisma client
  await testPrisma.$disconnect();
});

// Reset database state between tests
export async function resetDatabase() {
  // Fast and robust: truncate all domain tables in a single statement to minimize locks
  await testPrisma.$executeRawUnsafe(
    `TRUNCATE TABLE 
	      verification_tokens,
	      memories,
	      messages,
	      chats,
	      agents,
	      models,
	      sessions,
	      accounts,
	      users
	     RESTART IDENTITY CASCADE`
  );
}

// Evergreen comment: Test setup handles DB connection verification and cleanup utilities.
