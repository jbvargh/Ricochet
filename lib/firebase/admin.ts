import * as admin from "firebase-admin";
import type { ServiceAccount } from "firebase-admin/app";
import { readFileSync } from "node:fs";

function initAdminIfNeeded(): void {
  if (admin.apps.length > 0) return;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  if (!raw) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is not set");
  }

  let credential: admin.credential.Credential;
  if (raw.startsWith("{")) {
    credential = admin.credential.cert(JSON.parse(raw) as ServiceAccount);
  } else {
    const json = JSON.parse(readFileSync(raw, "utf8")) as ServiceAccount;
    credential = admin.credential.cert(json);
  }

  admin.initializeApp({ credential });
}

export async function verifyIdToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
  initAdminIfNeeded();
  return admin.auth().verifyIdToken(idToken);
}
