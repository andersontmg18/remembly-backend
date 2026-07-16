import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { apiResponse } from "@/utils/apiResponse";
import { AppError } from "@/utils/AppError";
import { comparePasswords } from "@/lib/password";
import { loginUserSchema } from "@/validators/user";
import { buildDefaultUserPreferenceData } from "@/lib/userPreference";
import { ZodError } from "zod";

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

    const isPasswordValid = await comparePasswords(validatedData.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError("Invalid email or password", 401);
    }

    if (!user.isEmailVerified) {
      throw new AppError("Please verify your email before logging in", 403);
    }

    if (!user.userPreference) {
      await prisma.userPreference.create({
        data: buildDefaultUserPreferenceData(user.id),
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
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
        lastLoginAt: new Date(),
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
