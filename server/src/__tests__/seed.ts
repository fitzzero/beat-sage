import { testPrisma } from "../db/testDb";

export type SeededUsers = {
  adminId: string;
  moderateId: string;
  regularAId: string;
  regularBId: string;
};

export async function seedUsers(): Promise<SeededUsers> {
  await testPrisma.user.createMany({
    data: [
      { email: "admin@example.com", username: "admin", name: "Admin User" },
      {
        email: "moderate@example.com",
        username: "moderate",
        name: "Moderate User",
      },
      {
        email: "regularA@example.com",
        username: "regulara",
        name: "Regular A",
      },
      {
        email: "regularB@example.com",
        username: "regularb",
        name: "Regular B",
      },
    ],
    skipDuplicates: true,
  });
  const users = await testPrisma.user.findMany({
    where: {
      email: {
        in: [
          "admin@example.com",
          "moderate@example.com",
          "regularA@example.com",
          "regularB@example.com",
        ],
      },
    },
    select: { id: true, email: true },
  });
  const adminId = users.find((r) => r.email === "admin@example.com")!.id;
  const moderateId = users.find((r) => r.email === "moderate@example.com")!.id;
  const regularAId = users.find((r) => r.email === "regularA@example.com")!.id;
  const regularBId = users.find((r) => r.email === "regularB@example.com")!.id;

  // Apply service-level ACL to admin and moderate
  await testPrisma.user.update({
    where: { id: adminId },
    data: { serviceAccess: { userService: "Admin" } as unknown as object },
  });
  await testPrisma.user.update({
    where: { id: moderateId },
    data: { serviceAccess: { userService: "Moderate" } as unknown as object },
  });

  return { adminId, moderateId, regularAId, regularBId };
}
