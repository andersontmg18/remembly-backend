import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { comparePasswords, hashPassword } from "@/lib/password";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { changePasswordSchema } from "@/validators/user";
import { apiResponse } from "@/utils/apiResponse";
import { AppError } from "@/utils/AppError";

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

    const body = await request.json();
    const validatedData = changePasswordSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError("User not found", 404);
    }

    if (!user.passwordHash) {
      throw new AppError("Password is not set for this account. Use the set-password route first.", 409);
    }

    const isCurrentPasswordValid = await comparePasswords(
      validatedData.currentPassword,
      user.passwordHash
    );

    if (!isCurrentPasswordValid) {
      throw new AppError("Current password is incorrect", 401);
    }

    const passwordHash = await hashPassword(validatedData.newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
      },
    });

    return NextResponse.json(apiResponse(true, "Password changed successfully"), {
      status: 200,
    });
  } catch (error) {
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
