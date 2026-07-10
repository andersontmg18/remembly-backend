import { NextRequest, NextResponse } from "next/server";
import { apiResponse } from "@/utils/apiResponse";
import { AppError } from "@/utils/AppError";
import { verifyEmailToken } from "@/lib/verification";

async function handleToken(token: string) {
  if (!token) {
    throw new AppError("Verification token is required", 400);
  }

  await verifyEmailToken(token);
}

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token") ?? "";
    await handleToken(token);

    return NextResponse.json(apiResponse(true, "Email verified successfully"));
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = body?.token ?? "";
    await handleToken(token);

    return NextResponse.json(apiResponse(true, "Email verified successfully"));
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
