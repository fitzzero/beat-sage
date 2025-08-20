import UserService from "../../services/user";
import { resetDatabase } from "../../__tests__/setup";

describe("UserService", () => {
  let userService: UserService;

  beforeAll(() => {
    userService = new UserService();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  describe("CRUD Operations", () => {
    it("should create a user successfully", async () => {
      const userData = {
        email: "test@example.com",
        username: "testuser",
        name: "Test User",
      };

      const user = (await (
        userService as unknown as {
          create: (
            d: Record<string, unknown>
          ) => Promise<Record<string, unknown>>;
        }
      ).create(userData)) as {
        id: string;
        email: string;
        username: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
      };

      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.email).toBe(userData.email);
      expect(user.username).toBe(userData.username);
      expect(user.name).toBe(userData.name);
      expect(user.createdAt).toBeDefined();
      expect(user.updatedAt).toBeDefined();
    });

    it("should update a user successfully", async () => {
      // Create a user first
      const userData = {
        email: "test@example.com",
        username: "testuser",
        name: "Test User",
      };

      const user = (await (
        userService as unknown as {
          create: (
            d: Record<string, unknown>
          ) => Promise<Record<string, unknown>>;
        }
      ).create(userData)) as {
        id: string;
        email: string;
        username: string;
        name: string;
        updatedAt: Date;
      };
      const originalUpdatedAt = user.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Update the user
      const updateData = {
        name: "Updated Name",
        username: "updateduser",
        updatedAt: new Date(),
      };

      const updatedUser = (await userService["update"](user.id, updateData)) as
        | {
            id: string;
            email: string;
            username: string;
            name: string;
            updatedAt: Date;
          }
        | undefined;

      expect(updatedUser).toBeDefined();
      expect(updatedUser!.id).toBe(user.id);
      expect(updatedUser!.name).toBe(updateData.name);
      expect(updatedUser!.username).toBe(updateData.username);
      expect(updatedUser!.email).toBe(userData.email); // Should remain unchanged
      expect(updatedUser!.updatedAt).not.toEqual(originalUpdatedAt);
    });

    it("should return undefined when updating non-existent user", async () => {
      const fakeId = "550e8400-e29b-41d4-a716-446655440000";
      const updateData = { name: "Updated Name" };

      const result = await (
        userService as unknown as {
          update: (
            id: string,
            d: Record<string, unknown>
          ) => Promise<Record<string, unknown> | undefined>;
        }
      ).update(fakeId, updateData);

      expect(result).toBeUndefined();
    });

    it("should delete a user successfully", async () => {
      // Create a user first
      const userData = {
        email: "test@example.com",
        username: "testuser",
        name: "Test User",
      };

      const user = (await (
        userService as unknown as {
          create: (
            d: Record<string, unknown>
          ) => Promise<Record<string, unknown>>;
        }
      ).create(userData)) as { id: string };

      // Delete the user
      await (
        userService as unknown as {
          delete: (id: string) => Promise<void>;
        }
      ).delete(user.id);

      // Try to update the deleted user (should return undefined)
      const result = await (
        userService as unknown as {
          update: (id: string, d: Record<string, unknown>) => Promise<unknown>;
        }
      ).update(user.id, {
        name: "Should not work",
      });
      expect(result).toBeUndefined();
    });

    it("should handle unique constraint violations", async () => {
      const userData = {
        email: "test@example.com",
        username: "testuser",
        name: "Test User",
      };

      // Create first user
      await userService["create"](userData);

      // Try to create another user with same email
      await expect(userService["create"](userData)).rejects.toThrow();
    });

    it("should handle ACL field correctly", async () => {
      const userData = {
        email: "test@example.com",
        username: "testuser",
        name: "Test User",
        acl: [
          { userId: "user-1", level: "Read" as const },
          { userId: "user-2", level: "Admin" as const },
        ],
      };

      const user = (await userService["create"](userData)) as unknown as {
        acl: Array<{ userId: string; level: string }>;
      };

      expect(user.acl).toBeDefined();
      const acl = user.acl;
      expect(acl).toHaveLength(2);
      expect(acl[0].userId).toBe("user-1");
      expect(acl[0].level).toBe("Read");
      expect(acl[1].userId).toBe("user-2");
      expect(acl[1].level).toBe("Admin");
    });
  });

  describe("Access Control", () => {
    it("should allow users to access themselves", () => {
      const userId = "user-123";
      const entryId = "user-123";

      const hasAccess = userService["checkAccess"](userId, entryId, "Moderate");

      expect(hasAccess).toBe(true);
    });

    it("should deny access when user IDs don't match and no service ACL", () => {
      const userId = "user-123";
      const entryId = "user-456";

      const hasAccess = userService["checkAccess"](userId, entryId, "Moderate");

      expect(hasAccess).toBe(false);
    });

    it("should correctly evaluate access levels", () => {
      const service = userService as unknown as {
        isAccessLevelSufficient: (a: string, b: string) => boolean;
      };
      const isReadSufficient = service.isAccessLevelSufficient("Read", "Read");
      const isModerateSufficient = service.isAccessLevelSufficient(
        "Moderate",
        "Read"
      );
      const isAdminSufficient = service.isAccessLevelSufficient(
        "Admin",
        "Moderate"
      );
      const isReadNotSufficient = service.isAccessLevelSufficient(
        "Read",
        "Admin"
      );

      expect(isReadSufficient).toBe(true);
      expect(isModerateSufficient).toBe(true);
      expect(isAdminSufficient).toBe(true);
      expect(isReadNotSufficient).toBe(false);
    });
  });
});

// Evergreen comment: Tests for UserService CRUD operations and ACL logic; validates DB integration.
