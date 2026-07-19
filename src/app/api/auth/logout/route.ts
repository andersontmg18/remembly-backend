import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { apiResponse } from "@/utils/apiResponse";
import { AppError } from "@/utils/AppError";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const refreshTokenValue = body?.refreshToken;

    if (!refreshTokenValue) {
      throw new AppError("Refresh token is required", 400);
    }

    const tokenHash = crypto.createHash("sha256").update(refreshTokenValue).digest("hex");
    const token = await prisma.refreshToken.findFirst({
      where: { tokenHash },
      include: { session: true },
    });

    if (!token || !token.session) {
      throw new AppError("Invalid refresh token", 401);
    }

    const now = new Date();
    await prisma.refreshToken.updateMany({
      where: { sessionId: token.sessionId },
      data: { revokedAt: now },
    });
    await prisma.session.update({
      where: { id: token.sessionId },
      data: {
        status: "REVOKED",
        revokedAt: now,
        revokeReason: "logout",
      },
    });

    return NextResponse.json(apiResponse(true, "Logged out successfully"), { status: 200 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(apiResponse(false, error.message), { status: error.statusCode });
    }

    return NextResponse.json(apiResponse(false, "Internal server error"), { status: 500 });
  }
}
