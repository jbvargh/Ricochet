import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE_NAME = "__session";

const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 5; // 5 days

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET must be set and at least 32 characters (use a long random string).",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(
  uid: string,
  email: string,
): Promise<string> {
  return new SignJWT({ uid, email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5d")
    .sign(getSecretKey());
}

export async function verifySessionToken(
  token: string,
): Promise<{ uid: string; email: string } | null> {
  try {
    const secret = process.env.SESSION_SECRET;
    if (!secret || secret.length < 32) return null;
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    const uid = payload.uid;
    const email = payload.email;
    if (typeof uid !== "string" || typeof email !== "string") return null;
    return { uid, email };
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: COOKIE_MAX_AGE_SEC,
};
