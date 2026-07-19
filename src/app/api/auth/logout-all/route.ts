import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiResponse } from "@/utils/apiResponse";
import { AppError } from "@/utils/AppError";
import { verifyAccessToken } from "@/lib/auth/jwt";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (!token) {
      throw new AppError("Access token is required", 401);
    }

    const payload = verifyAccessToken(token);
    const userId = payload.sub;
    if (!userId) {
      throw new AppError("Invalid access token", 401);
    }

    const now = new Date();
    const sessions = await prisma.session.findMany({
      where: {
        userId,
        status: "ACTIVE",
      },
      select: { id: true },
    });

    if (sessions.length === 0) {
      return NextResponse.json(apiResponse(true, "No active sessions to revoke"), { status: 200 });
    }

    const sessionIds = sessions.map((session) => session.id);

    await prisma.refreshToken.updateMany({
      where: {
        sessionId: { in: sessionIds },
        revokedAt: null,
      },
      data: {
        revokedAt: now,
      },
    });

    await prisma.session.updateMany({
      where: {
        id: { in: sessionIds },
      },
      data: {
        status: "REVOKED",
        revokedAt: now,
        revokeReason: "logout_all",
      },
    });

    return NextResponse.json(apiResponse(true, "Logged out from all devices"), { status: 200 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(apiResponse(false, error.message), {
        status: error.statusCode,
      });
    }

    return NextResponse.json(apiResponse(false, "Internal server error"), { status: 500 });
  }
}
