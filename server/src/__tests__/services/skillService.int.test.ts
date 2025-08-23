import { resetDatabase } from "../setup";
import { seedUsers } from "../seed";
import { startTestServer, connectAsUser, emitWithAck } from "../utils/socket";
import { testPrisma } from "../../db/testDb";

describe("SkillService integration", () => {
  let port: number;
  let stop: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    const server = await startTestServer();
    port = server.port;
    stop = server.stop;
  });

  afterAll(async () => {
    if (stop) await stop();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("listMySkills returns only skills for own character", async () => {
    const { regularAId, regularBId } = await seedUsers();
    const clientA = await connectAsUser(port, regularAId);
    const clientB = await connectAsUser(port, regularBId);

    const charA = await emitWithAck<{ name: string }, { id: string }>(
      clientA,
      "characterService:createCharacter",
      { name: "HeroA" }
    );
    const charB = await emitWithAck<{ name: string }, { id: string }>(
      clientB,
      "characterService:createCharacter",
      { name: "HeroB" }
    );

    // Seed skills directly
    await testPrisma.skill.createMany({
      data: [
        {
          characterId: charA.id,
          name: "Pulse Bolt",
          manaCost: 5,
          damage: 10,
          cooldownMs: 500,
          targetPriority: "Closest" as unknown as never,
        },
        {
          characterId: charB.id,
          name: "Shadow Fang",
          manaCost: 7,
          damage: 14,
          cooldownMs: 600,
          targetPriority: "Closest" as unknown as never,
        },
      ],
    });

    const aSkills = await emitWithAck<{ characterId: string }, Array<{ id: string; name: string }>>(
      clientA,
      "skillService:listMySkills",
      { characterId: charA.id }
    );
    expect(Array.isArray(aSkills)).toBe(true);
    expect(aSkills.length).toBe(1);
    expect(aSkills[0].name).toBe("Pulse Bolt");

    // B cannot list A's skills (returns empty array)
    const bOnA = await emitWithAck<{ characterId: string }, Array<{ id: string }>>(
      clientB,
      "skillService:listMySkills",
      { characterId: charA.id }
    );
    expect(bOnA.length).toBe(0);

    clientA.close();
    clientB.close();
  });

  it("owner can update own skill; others cannot", async () => {
    const { regularAId, regularBId } = await seedUsers();
    const clientA = await connectAsUser(port, regularAId);
    const clientB = await connectAsUser(port, regularBId);

    const charA = await emitWithAck<{ name: string }, { id: string }>(
      clientA,
      "characterService:createCharacter",
      { name: "HeroA" }
    );
    const created = await testPrisma.skill.create({
      data: {
        characterId: charA.id,
        name: "Bolt",
        manaCost: 5,
        damage: 10,
        cooldownMs: 500,
        targetPriority: "Closest" as unknown as never,
      },
    });

    const updated = await emitWithAck<
      { id: string; patch: { name?: string } },
      { id: string; name: string } | undefined
    >(clientA, "skillService:updateSkill", { id: created.id, patch: { name: "Bolt+" } });
    expect(updated?.name).toBe("Bolt+");

    const otherTry = await emitWithAck<
      { id: string; patch: { name?: string } },
      { id: string; name: string } | undefined
    >(clientB, "skillService:updateSkill", { id: created.id, patch: { name: "Hacked" } });
    expect(otherTry).toBeUndefined();

    clientA.close();
    clientB.close();
  });
});


