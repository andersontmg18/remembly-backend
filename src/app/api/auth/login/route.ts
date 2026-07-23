import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { apiResponse } from "@/utils/apiResponse";
import { AppError } from "@/utils/AppError";
import { comparePasswords } from "@/lib/password";
import { loginUserSchema } from "@/validators/user";
import { buildDefaultUserPreferenceData } from "@/lib/userPreference";
import { createOpaqueRefreshToken, getRefreshTokenTTL, signAccessToken } from "@/lib/auth/jwt";
import { ZodError } from "zod";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = loginUserSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { email: validatedData.email },
      include: { userPreference: true },
    });

    if (!user) {
      throw new AppError("Invalid email or password", 401);
    }

    if (!user.passwordHash) {
      throw new AppError("This account uses Google sign-in. Please use Google login.", 401);
    }

    const isPasswordValid = await comparePasswords(validatedData.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError("Invalid email or password", 401);
    }

    if (!user.isEmailVerified) {
      throw new AppError("Please verify your email before logging in", 403);
    }

    // FrontendUpdate -> will be updated by the front end login the frontend feature 
    // need to collect the correct time zone of user and default language to 
    // save during this sign in.
    if (!user.userPreference) {
      await prisma.userPreference.create({
        data: buildDefaultUserPreferenceData(user.id),
      });
    }

    const now = new Date();
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        status: "ACTIVE",
        createdAt: now,
        lastUsedAt: now,
        idleExpiresAt: new Date(now.getTime() + 15 * 60 * 1000),
        absoluteExpiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        userAgent: request.headers.get("user-agent") ?? undefined,
        ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
        deviceName: "Unknown device",
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
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: now },
    });

    logger.info(`User logged in successfully: ${user.id}`);

    return NextResponse.json(
      apiResponse(true, "Authenticated successfully", {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isEmailVerified: user.isEmailVerified,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: now,
        accessToken,
        refreshToken: refreshTokenValue,
        sessionId: session.id,
      }),
      { status: 200 }
    );
  } catch (error) {
    logger.error(error);

    if (error instanceof ZodError) {
      return NextResponse.json(apiResponse(false, "Validation error", error.issues), {
        status: 400,
      });
    }

    if (error instanceof AppError) {
      return NextResponse.json(apiResponse(false, error.message), {
        status: error.statusCode,
      });
    }

    return NextResponse.json(apiResponse(false, "Internal server error"), {
      status: 500,
    });
  }
}
