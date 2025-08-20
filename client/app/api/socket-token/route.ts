import { NextResponse } from "next/server";
import crypto from "crypto";
import { getServerAuthSession } from "../../lib/auth";

type SocketTokenPayload = {
  userId: string;
  iat: number; // seconds
  exp: number; // seconds
};

function base64url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signHmacSHA256(message: string, secret: string) {
  return base64url(
    crypto.createHmac("sha256", secret).update(message).digest()
  );
}

export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const payload: SocketTokenPayload = {
    userId: session.user.id,
    iat: nowSec,
    exp: nowSec + 60, // 1 minute validity
  };

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 }
    );
  }

  const payloadB64 = base64url(JSON.stringify(payload));
  const signature = signHmacSHA256(payloadB64, secret);
  const token = `${payloadB64}.${signature}`;

  return NextResponse.json({ token });
}
