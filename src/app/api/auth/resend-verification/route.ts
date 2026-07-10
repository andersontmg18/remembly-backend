import { NextRequest, NextResponse } from "next/server";
import { apiResponse } from "@/utils/apiResponse";
import { AppError } from "@/utils/AppError";
import { prisma } from "@/lib/prisma";
import { createEmailVerificationToken, sendVerificationEmail } from "@/lib/verification";
import { ZodError, z } from "zod";

const resendSchema = z.object({
  email: z.string().email("Invalid email address").toLowerCase(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = resendSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Keep response generic to avoid email enumeration.
      return NextResponse.json(apiResponse(true, "If your email is registered, a verification email has been sent."));
    }

    if (user.isEmailVerified) {
      return NextResponse.json(apiResponse(true, "Email is already verified."));
    }

    const verificationToken = await createEmailVerificationToken(user.id);
    await sendVerificationEmail(
      {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      verificationToken
    );

    return NextResponse.json(apiResponse(true, "Verification email sent."));
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
