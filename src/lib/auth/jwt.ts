import crypto from "crypto";
import { env } from "@/config/env";

const JWT_SECRET = env.JWT_SECRET ?? "dev-secret-change-me";
const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

export function signAccessToken(payload: Record<string, unknown>) {
  const header = { alg: "HS256", typ: "HS256" };
  const now = Math.floor(Date.now() / 1000);
  const body = {
    ...payload,
    iat: now,
    exp: now + Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(body));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(signingInput).digest("base64url");

  return `${signingInput}.${signature}`;
}

export function verifyAccessToken(token: string) {
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) {
    throw new Error("Invalid token format");
  }

  const signingInput = `${header}.${payload}`;
  const expectedSignature = crypto.createHmac("sha256", JWT_SECRET).update(signingInput).digest("base64url");
  if (expectedSignature !== signature) {
    throw new Error("Invalid token signature");
  }

  const decodedPayload = JSON.parse(base64UrlDecode(payload));
  if (decodedPayload.exp && decodedPayload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Token expired");
  }

  return decodedPayload as { sub?: number; email?: string; role?: string };
}

export function createOpaqueRefreshToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function getRefreshTokenTTL() {
  return REFRESH_TOKEN_TTL_MS;
}
