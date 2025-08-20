import jwt from "jsonwebtoken";
import crypto from "crypto";
import { CustomSocket } from "../core/baseService";
import { testPrisma } from "../db/testDb";
import { prisma } from "../db";
import baseLogger from "../utils/logger";

const logger = baseLogger.child({ service: "Auth" });

// JWT secret should match NextAuth's NEXTAUTH_SECRET
const JWT_SECRET = process.env.NEXTAUTH_SECRET || "your-secret-here";

type NextAuthJWT = {
  id: string;
  email: string;
  name?: string;
  iat: number;
  exp: number;
  jti: string;
};

export async function authenticateSocket(
  socket: CustomSocket,
  next: (err?: Error) => void
) {
  try {
    // Prefer NextAuth JWT from cookies (httpOnly)
    const cookieHeader = socket.handshake.headers?.cookie || "";
    const cookiePairs = cookieHeader.split(";").map((c) => c.trim());
    const cookieMap: Record<string, string> = {};
    for (const pair of cookiePairs) {
      const idx = pair.indexOf("=");
      if (idx > -1) {
        const k = decodeURIComponent(pair.slice(0, idx));
        const v = decodeURIComponent(pair.slice(idx + 1));
        cookieMap[k] = v;
      }
    }

    // Prefer explicit short-lived socket token from client auth payload
    const { socketToken } = socket.handshake.auth || {};
    if (typeof socketToken === "string") {
      try {
        const [payloadB64, signature] = socketToken.split(".");
        const expectedSig = crypto
          .createHmac("sha256", JWT_SECRET)
          .update(payloadB64)
          .digest("base64")
          .replace(/=/g, "")
          .replace(/\+/g, "-")
          .replace(/\//g, "_");
        if (signature !== expectedSig) throw new Error("Invalid signature");
        const json = Buffer.from(
          payloadB64.replace(/-/g, "+").replace(/_/g, "/"),
          "base64"
        ).toString();
        const data = JSON.parse(json) as {
          userId: string;
          iat: number;
          exp: number;
        };
        const now = Math.floor(Date.now() / 1000);
        if (data.exp < now) throw new Error("Token expired");
        socket.userId = data.userId;
        logger.info("Socket authenticated via socketToken", {
          socketId: socket.id,
          userId: socket.userId,
        });
        // Load serviceAccess for this user and cache on socket
        await hydrateServiceAccess(socket);
        return next();
      } catch (e) {
        logger.warn("Invalid socketToken", {
          socketId: socket.id,
          error: e instanceof Error ? e.message : "Unknown error",
        });
      }
    }

    // Fallback to NextAuth cookie JWT if present
    const sessionToken =
      cookieMap["__Secure-next-auth.session-token"] ||
      cookieMap["next-auth.session-token"] ||
      undefined;

    if (sessionToken) {
      try {
        const decoded = jwt.verify(sessionToken, JWT_SECRET) as NextAuthJWT;
        socket.userId = decoded.id;
        logger.info("Socket authenticated via cookie token", {
          socketId: socket.id,
          userId: socket.userId,
          email: decoded.email,
        });
        await hydrateServiceAccess(socket);
        return next();
      } catch (jwtError) {
        logger.warn("Invalid cookie session token", {
          socketId: socket.id,
          error: jwtError instanceof Error ? jwtError.message : "Unknown error",
        });
      }
    }

    // Fallback: allow explicit userId from auth for development/testing only
    if (process.env.ENABLE_DEV_CREDENTIALS === "true") {
      const { userId } = socket.handshake.auth || {};
      if (userId) {
        socket.userId = String(userId);
        logger.info("Socket authenticated via userId (dev)", {
          socketId: socket.id,
          userId: socket.userId,
        });
        await hydrateServiceAccess(socket);
        return next();
      }
    }

    // No valid authentication
    logger.warn("Socket connection failed authentication", {
      socketId: socket.id,
    });
    socket.userId = `guest-${socket.id}`;
    next();
  } catch (error) {
    logger.error("Authentication middleware error:", error);
    socket.userId = `guest-${socket.id}`;
    next();
  }
}

async function hydrateServiceAccess(socket: CustomSocket) {
  // Lightweight cache to avoid repeated DB lookups per connection in tests
  const isTestEnv = process.env.NODE_ENV === "test";
  const cache: Map<string, Record<string, "Read" | "Moderate" | "Admin">> = (
    global as unknown as {
      __serviceAccessCache__?: Map<
        string,
        Record<string, "Read" | "Moderate" | "Admin">
      >;
    }
  ).__serviceAccessCache__ ||
  new Map<string, Record<string, "Read" | "Moderate" | "Admin">>();
  if (isTestEnv) {
    (
      global as unknown as {
        __serviceAccessCache__?: Map<
          string,
          Record<string, "Read" | "Moderate" | "Admin">
        >;
      }
    ).__serviceAccessCache__ = cache;
  }

  try {
    const userId = socket.userId!;
    if (isTestEnv && cache.has(userId)) {
      socket.serviceAccess = cache.get(userId)!;
      return;
    }

    const database = process.env.NODE_ENV === "test" ? testPrisma : prisma;
    const user = await database.user.findUnique({
      where: { id: userId },
      select: { serviceAccess: true },
    });
    const access = ((user?.serviceAccess as unknown) || {}) as Record<
      string,
      "Read" | "Moderate" | "Admin"
    >;
    socket.serviceAccess = access;
    if (isTestEnv) {
      cache.set(userId, access);
    }
  } catch (e) {
    // Leave serviceAccess undefined if lookup fails; services will handle checks conservatively
    socket.serviceAccess = {};
  }
}
