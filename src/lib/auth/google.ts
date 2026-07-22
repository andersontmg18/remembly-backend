import crypto from "crypto";
import { env } from "@/config/env";
import { prisma } from "@/lib/prisma";
import { buildDefaultUserPreferenceCreateData, buildDefaultUserPreferenceData } from "@/lib/userPreference";
import { createOpaqueRefreshToken, getRefreshTokenTTL, signAccessToken } from "@/lib/auth/jwt";
import { AppError } from "@/utils/AppError";
import { NextRequest } from "next/server";

type GoogleTokenResponse = {
  access_token: string;
  id_token?: string;
};

type GoogleProfile = {
  sub: string;
  email: string;
  name?: string;
  given_name?: string;
  family_name?: string;
};

export function getGoogleOAuthUrl() {
  const clientId = env.GOOGLE_CLIENT_ID;
  const redirectUri = env.GOOGLE_REDIRECT_URI ?? "http://localhost:3000/api/auth/google/callback";

  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID is not configured");
  }

  const scope = encodeURIComponent("openid email profile");
  const responseType = "code";

  return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=${responseType}&scope=${scope}&access_type=offline&prompt=consent`;
}

async function exchangeGoogleCodeForToken(code: string) {
  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  const redirectUri = env.GOOGLE_REDIRECT_URI ?? "http://localhost:3000/api/auth/google/callback";

  if (!clientId || !clientSecret) {
    throw new AppError("Google OAuth is not configured", 500);
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) {
    throw new AppError("Failed to exchange Google code", 400);
  }

  const tokenData = (await tokenResponse.json()) as GoogleTokenResponse;
  return tokenData;
}

async function getGoogleProfile(accessToken: string): Promise<GoogleProfile> {
  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!profileResponse.ok) {
    throw new AppError("Failed to fetch Google profile", 400);
  }

  return (await profileResponse.json()) as GoogleProfile;
}

export async function authenticateGoogleUser(code: string, request: NextRequest) {
  const tokenData = await exchangeGoogleCodeForToken(code);
  const profile = await getGoogleProfile(tokenData.access_token);

  if (!profile.email) {
    throw new AppError("Google account email is required", 400);
  }

  const normalizedEmail = profile.email.toLowerCase();
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: { userPreference: true, userProviders: true },
  });

  let user = existingUser;

  if (!user) {
    const firstName = profile.given_name ?? profile.name?.split(" ")[0] ?? "Google";
    const lastName = profile.family_name ?? profile.name?.split(" ").slice(1).join(" ") ?? "User";

    user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash: null,
        firstName,
        lastName,
        isEmailVerified: true,
        userPreference: {
          create: buildDefaultUserPreferenceCreateData(),
        },
        userProviders: {
          create: [
            {
              provider: "GOOGLE",
              providerUserId: profile.sub,
            },
          ],
        },
      },
      include: { userPreference: true, userProviders: true },
    });
  } else {
    const isAlreadyLinked = existingUser.userProviders.some(
      (provider) => provider.provider === "GOOGLE" && provider.providerUserId === profile.sub
    );

    if (!isAlreadyLinked) {
      await prisma.userProvider.create({
        data: {
          userId: existingUser.id,
          provider: "GOOGLE",
          providerUserId: profile.sub,
        },
      });
    }

    if (!existingUser.userPreference) {
      await prisma.userPreference.create({
        data: buildDefaultUserPreferenceData(existingUser.id),
      });
    }
  }

  const finalUser = user ?? (await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: { userPreference: true, userProviders: true },
  }));

  if (!finalUser) {
    throw new AppError("Unable to load the authenticated user", 500);
  }

  const now = new Date();
  const session = await prisma.session.create({
    data: {
      userId: finalUser.id,
      status: "ACTIVE",
      createdAt: now,
      lastUsedAt: now,
      idleExpiresAt: new Date(now.getTime() + 15 * 60 * 1000),
      absoluteExpiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      userAgent: request.headers.get("user-agent") ?? undefined,
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
      deviceName: "Google OAuth",
    },
  });

  const refreshTokenValue = createOpaqueRefreshToken();
  const refreshToken = await prisma.refreshToken.create({
    data: {
      sessionId: session.id,
      tokenHash: crypto.createHash("sha256").update(refreshTokenValue).digest("hex"),
      familyId: crypto.randomUUID(),
      sequence: 1,
      createdAt: now,
      expiresAt: new Date(now.getTime() + getRefreshTokenTTL()),
    },
  });

  const accessToken = signAccessToken({
    sub: finalUser.id,
    email: finalUser.email,
    role: finalUser.role,
  });

  await prisma.user.update({
    where: { id: finalUser.id },
    data: { lastLoginAt: now },
  });

  return {
    accessToken,
    refreshToken: refreshTokenValue,
    sessionId: session.id,
    refreshTokenId: refreshToken.id,
    user: finalUser,
  };
}
