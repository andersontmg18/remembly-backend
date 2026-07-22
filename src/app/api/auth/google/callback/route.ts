import { NextRequest, NextResponse } from "next/server";
import { apiResponse } from "@/utils/apiResponse";
import { authenticateGoogleUser } from "@/lib/auth/google";
import { AppError } from "@/utils/AppError";

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get("code") ?? "";

    if (!code) {
      return NextResponse.json(apiResponse(false, "Google authorization code is required"), {
        status: 400,
      });
    }

    const authResult = await authenticateGoogleUser(code, request);

    return NextResponse.json(
      apiResponse(true, "Google authentication successful", {
        accessToken: authResult.accessToken,
        refreshToken: authResult.refreshToken,
        sessionId: authResult.sessionId,
        refreshTokenId: authResult.refreshTokenId,
        user: {
          id: authResult.user.id,
          email: authResult.user.email,
          firstName: authResult.user.firstName,
          lastName: authResult.user.lastName,
          isEmailVerified: authResult.user.isEmailVerified,
          role: authResult.user.role,
        },
      }),
      { status: 200 }
    );
  } catch (error) {
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
