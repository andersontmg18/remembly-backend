import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { apiResponse } from "@/utils/apiResponse";
import { AppError } from "@/utils/AppError";
import { createOpaqueRefreshToken, getRefreshTokenTTL, signAccessToken } from "@/lib/auth/jwt";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const refreshTokenValue = body?.refreshToken;

    if (!refreshTokenValue) {
      throw new AppError("Refresh token is required", 400);
    }

    const tokenHash = crypto.createHash("sha256").update(refreshTokenValue).digest("hex");
    const token = await prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        session: true,
      },
    });

    if (!token || !token.session || token.session.status !== "ACTIVE") {
      throw new AppError("Invalid or expired refresh token", 401);
    }

    const now = new Date();
    await prisma.refreshToken.update({
      where: { id: token.id },
      data: {
        usedAt: now,
        revokedAt: now,
        replacedByTokenId: undefined,
      },
    });

    const nextTokenValue = createOpaqueRefreshToken();
    const nextToken = await prisma.refreshToken.create({
      data: {
        sessionId: token.sessionId,
        tokenHash: crypto.createHash("sha256").update(nextTokenValue).digest("hex"),
        familyId: token.familyId,
        sequence: token.sequence + 1,
        createdAt: now,
        expiresAt: new Date(now.getTime() + getRefreshTokenTTL()),
        parentTokenId: token.id,
      },
    });

    const accessToken = signAccessToken({
      sub: token.session.userId,
      email: "",
      role: "USER",
    });

    return NextResponse.json(
      apiResponse(true, "Token refreshed successfully", {
        accessToken,
        refreshToken: nextTokenValue,
        sessionId: token.sessionId,
        refreshTokenId: nextToken.id,
      }),
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(apiResponse(false, error.message), { status: error.statusCode });
    }

    return NextResponse.json(apiResponse(false, "Internal server error"), { status: 500 });
  }
}
