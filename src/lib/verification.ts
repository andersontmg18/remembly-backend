import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/utils/AppError";
import { env } from "@/config/env";
import { sendEmail } from "@/lib/email";

export const VERIFICATION_TOKEN_TYPE = "EMAIL_VERIFICATION";
const VERIFICATION_TOKEN_EXPIRATION_MS = 24 * 60 * 60 * 1000;

function createRandomToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createEmailVerificationToken(userId: number) {
  const rawToken = createRandomToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_EXPIRATION_MS);

  await prisma.verificationToken.deleteMany({
    where: {
      userid: userId,
      type: VERIFICATION_TOKEN_TYPE,
    },
  });

  await prisma.verificationToken.create({
    data: {
      userid: userId,
      token: tokenHash,
      type: VERIFICATION_TOKEN_TYPE,
      expireat: expiresAt,
    },
  });

  return rawToken;
}

export async function getVerificationTokenRecord(token: string) {
  const tokenHash = hashToken(token);

  const record = await prisma.verificationToken.findUnique({
    where: { token: tokenHash },
  });

  if (!record) {
    throw new AppError("Invalid verification token", 400);
  }

  if (record.type !== VERIFICATION_TOKEN_TYPE) {
    throw new AppError("Unsupported verification token type", 400);
  }

  if (record.expireat < new Date()) {
    throw new AppError("Verification token has expired", 400);
  }

  return record;
}

export async function verifyEmailToken(token: string) {
  const record = await getVerificationTokenRecord(token);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userid },
      data: { isEmailVerified: true },
    }),
    prisma.verificationToken.delete({
      where: { id: record.id },
    }),
  ]);
}

export async function sendVerificationEmail(
  user: { email: string; firstName?: string | null; lastName?: string | null },
  token: string
) {
  const baseUrl = env.VERIFICATION_URL || env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const verificationUrl = `${baseUrl.replace(/\/$/, "")}/api/auth/email-verification?token=${token}`;
  const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_EXPIRATION_MS);
  const formattedExpiry = expiresAt.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  const greetingName = displayName || user.email.split("@")[0];
  const subject = "Verify your Remembly account";
  const text = `Hi ${greetingName},\n\nPlease verify your email by visiting this link:\n${verificationUrl}\n\nThis link will expire on ${formattedExpiry}.`;
  const html = `
    <p>Hi ${greetingName},</p>
    <p>Welcome to <strong>Remembly</strong>! We’re excited to have you join our community.</p>
    <p>To activate your account and start using Remembly, please verify your email address by clicking the button below.</p>
    <p><a href="${verificationUrl}" style="padding: 12px 20px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px;">Verify Email</a></p>
    <p>This verification link will expire on ${formattedExpiry}.</p>
    <p>If the button doesn’t work, copy and paste the following link into your browser:</p>
    <p><a href="${verificationUrl}">${verificationUrl}</a></p>
    <p>If you need assistance, feel free to contact our support team.</p>
    <p>Thank you for choosing Remembly.</p>
    <p><strong>The Remembly Team</strong></p>

  `;

  await sendEmail({
    to: user.email,
    subject,
    text,
    html,
  });
}
