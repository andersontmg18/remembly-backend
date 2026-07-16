import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { apiResponse } from "@/utils/apiResponse";
import { AppError } from "@/utils/AppError";
import { registerUserSchema } from "@/validators/user";
import { hashPassword } from "@/lib/password";
import { createEmailVerificationToken, sendVerificationEmail } from "@/lib/verification";
import { buildDefaultUserPreferenceCreateData } from "@/lib/userPreference";
import { ZodError } from "zod";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validatedData = registerUserSchema.parse(body);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      throw new AppError("Email already registered", 409);
    }

    // Hash password
    const hashedPassword = await hashPassword(validatedData.password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: validatedData.email,
        passwordHash: hashedPassword,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        userPreference: {
          create: buildDefaultUserPreferenceCreateData(),
        },
      },
    });

    const verificationToken = await createEmailVerificationToken(user.id);
    await sendVerificationEmail(
      {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      verificationToken
    );

    logger.info(`User registered successfully: ${user.id}`);

    return NextResponse.json(
      apiResponse(true, "User registered successfully. Please check your email to verify your account.", {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isEmailVerified: user.isEmailVerified,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }),
      { status: 201 }
    );
  } catch (error) {
    logger.error(error);

    if (error instanceof ZodError) {
      return NextResponse.json(
        apiResponse(false, "Validation error", error.issues),
        { status: 400 }
      );
    }

    if (error instanceof AppError) {
      return NextResponse.json(apiResponse(false, error.message), {
        status: error.statusCode,
      });
    }

    return NextResponse.json(
      apiResponse(false, "Internal server error"),
      { status: 500 }
    );
  }
}
