import { PrismaClient } from "@prisma/client";

// Use DATABASE_URL_TEST environment variable for test database
const testDatabaseUrl = process.env.DATABASE_URL_TEST;

if (!testDatabaseUrl) {
  throw new Error(
    "DATABASE_URL_TEST environment variable is required for testing.\n" +
      "Please add to your ~/.zshrc:\n" +
      'export DATABASE_URL_TEST="postgresql://beatsage:password@host:port/beatsage_test"\n' +
      "Then run: source ~/.zshrc"
  );
}

// Validate it's actually a test database
if (!testDatabaseUrl.includes("test")) {
  throw new Error(
    "DATABASE_URL_TEST must contain 'test' in the database name for safety. " +
      `Current: ${testDatabaseUrl}`
  );
}

export const testPrisma = new PrismaClient({ datasourceUrl: testDatabaseUrl });

export const testPool = {
  end: async () => {
    /* Prisma handles its pool lifecycle */
  },
} as const;

// Evergreen comment: Test-specific Prisma client; safety checks ensure we talk to the test DB only.
