import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/jwt";
import { cookies } from "next/headers";

export async function getSessionFromCookies(): Promise<{
  uid: string;
  email: string;
} | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) return null;
  return verifySessionToken(raw);
}
