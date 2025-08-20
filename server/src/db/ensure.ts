/* eslint-disable no-console */
// Prisma manages schema via migrations/db push. This ensure script is a no-op retained for compatibility.
async function main() {
  // No asynchronous work required; return immediately to satisfy require-await
  console.log("Using Prisma; run yarn db:push for schema synchronization.");
  return Promise.resolve();
}

main().catch((e) => {
  console.error("Ensure failed:", e);
  process.exit(1);
});
