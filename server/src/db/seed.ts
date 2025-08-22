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

  // ----- Beat Sage seed data -----
  // Genres
  const genre = await prisma.genre.upsert({
    where: { name: "Electronic" },
    update: {},
    create: { name: "Electronic", description: "Upbeat electronic tracks" },
  });

  // Song + beats (simple 4-beat bar x 4)
  const songSrc = "/songs/demo-electro.mp3";
  let song = await prisma.song.findFirst({ where: { src: songSrc } });
  if (!song) {
    song = await prisma.song.create({
      data: { name: "Demo Electro", genreId: genre.id, src: songSrc },
    });
  } else {
    song = await prisma.song.update({
      where: { id: song.id },
      data: { name: "Demo Electro", genreId: genre.id },
    });
  }
  // Minimal deterministic beat map (16 beats, 500ms apart)
  await prisma.songBeat.deleteMany({ where: { songId: song.id } });
  for (let i = 0; i < 16; i += 1) {
    const directions = ["Up", "Down", "Left", "Right"] as const;
    await prisma.songBeat.create({
      data: {
        songId: song.id,
        index: i,
        timeMs: 1000 + i * 500,
        direction: directions[i % 4] as unknown as never,
        holdMs: 0,
      },
    });
  }

  // Location
  let location = await prisma.location.findFirst({
    where: { name: "Neon Arena" },
  });
  if (!location) {
    location = await prisma.location.create({
      data: {
        name: "Neon Arena",
        difficulty: 1,
        image: "/images/locations/neon-arena.jpg",
      },
    });
  } else {
    location = await prisma.location.update({
      where: { id: location.id },
      data: { difficulty: 1 },
    });
  }

  // Mobs
  await prisma.mob.deleteMany({
    where: { name: { in: ["Spark Wisp", "Bass Hound"] } },
  });
  await prisma.mob.create({
    data: {
      name: "Spark Wisp",
      healthBase: 30,
      healthMultiplier: 1.0,
      damageBase: 3,
      damageMultiplier: 1.0,
      xpBase: 1,
      xpMultiplier: 1.0,
      spawnRate: 0.6,
      spawnRateMultiplier: 1.0,
    },
  });
  await prisma.mob.create({
    data: {
      name: "Bass Hound",
      healthBase: 60,
      healthMultiplier: 1.2,
      damageBase: 5,
      damageMultiplier: 1.1,
      xpBase: 2,
      xpMultiplier: 1.2,
      spawnRate: 0.4,
      spawnRateMultiplier: 1.05,
    },
  });

  // Admin character with mana + skills
  if (adminId) {
    let character = await prisma.character.findFirst({
      where: { name: "ZeroMage", userId: adminId },
    });
    if (!character) {
      character = await prisma.character.create({
        data: { userId: adminId, name: "ZeroMage" },
      });
    }
    await prisma.mana.upsert({
      where: { characterId: character.id },
      update: {},
      create: {
        characterId: character.id,
        maximum: 120,
        current: 0,
        rate: 0,
        maxRate: 5,
      },
    });
    // Two basic skills
    const basicSkills = [
      {
        name: "Pulse Bolt",
        manaCost: 5,
        damage: 5,
        cooldownMs: 800,
        priority: 1,
        target: "Closest",
      },
      {
        name: "Wave Slash",
        manaCost: 12,
        damage: 12,
        cooldownMs: 1800,
        priority: 2,
        target: "LowestHealth",
      },
    ] as const;
    for (const s of basicSkills) {
      await prisma.skill.create({
        data: {
          characterId: character.id,
          name: s.name,
          manaCost: s.manaCost,
          damage: s.damage,
          cooldownMs: s.cooldownMs,
          priority: s.priority,
          targetPriority: s.target as unknown as never,
        },
      });
    }
  }

  console.log("Seed complete.");
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
