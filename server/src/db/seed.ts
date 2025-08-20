/* eslint-disable no-console */
import "dotenv/config";
import { prisma } from "../db";

async function main() {
  const adminEmail = "admin@example.com";
  const modEmail = "moderate@example.com";

  // Upsert-like inserts
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: { email: adminEmail, username: "admin", name: "Admin User" },
  });

  await prisma.user.upsert({
    where: { email: modEmail },
    update: {},
    create: { email: modEmail, username: "moderate", name: "Moderate User" },
  });

  // Set service-level ACLs
  await prisma.user.update({
    where: { email: adminEmail },
    data: { serviceAccess: { userService: "Admin" } as unknown as object },
  });
  await prisma.user.update({
    where: { email: modEmail },
    data: { serviceAccess: { userService: "Moderate" } as unknown as object },
  });

  // Seed default models (real, low-cost defaults)
  const validModels = [
    {
      provider: "openai",
      modelKey: "gpt-4o-mini",
      displayName: "GPT-4o mini",
      contextWindowTokens: 200000,
      isActive: true,
    },
    {
      provider: "openai",
      modelKey: "gpt-4.1",
      displayName: "GPT-4.1",
      contextWindowTokens: 200000,
      isActive: true,
    },
    {
      provider: "anthropic",
      modelKey: "claude-3-5-haiku-latest",
      displayName: "Claude 3.5 Haiku",
      contextWindowTokens: 200000,
      isActive: true,
    },
  ];

  // Remove known invalid seeds from earlier iterations
  await prisma.model.deleteMany({
    where: { modelKey: { in: ["gpt-5", "gpt-5-fast", "sonnet-4"] } },
  });

  for (const m of validModels) {
    const existing = await prisma.model.findFirst({
      where: { modelKey: m.modelKey },
    });
    if (!existing) {
      await prisma.model.create({ data: m });
    } else {
      await prisma.model.update({ where: { id: existing.id }, data: m });
    }
  }

  // Seed example agent "Zero" for the admin user
  const admin = await prisma.user.findUnique({
    where: { email: adminEmail },
    select: { id: true },
  });
  const adminId = admin?.id;
  if (adminId) {
    const existingAgent = await prisma.agent.findFirst({
      where: { ownerId: adminId, name: "Zero" },
    });
    if (!existingAgent) {
      await prisma.agent.create({
        data: { ownerId: adminId, name: "Zero", description: "Seed agent" },
      });
    }
  }

  console.log("Seed complete.");
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
