import { createHmac } from "node:crypto";

export interface UserSession {
  userId: string;
  tenantId: string;
  roles: string[];
  issuedAt: number;
  expiresAt: number;
}

const JWT_SECRET = process.env.JWT_SECRET || "complex-secret-key-32-chars-minimum";

export function signSessionToken(session: Omit<UserSession, "issuedAt" | "expiresAt">, ttlSeconds = 3600): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: UserSession = {
    ...session,
    issuedAt: now,
    expiresAt: now + ttlSeconds,
  };
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

export function verifySessionToken(token: string): UserSession {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed JWT token structure");
  }
  const [header, body, signature] = parts;
  const expectedSignature = createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  if (signature !== expectedSignature) {
    throw new Error("Invalid token signature");
  }
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as UserSession;
  const now = Math.floor(Date.now() / 1000);
  if (payload.expiresAt < now) {
    throw new Error("Token expired");
  }
  return payload;
}
