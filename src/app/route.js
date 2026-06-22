import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    name: "Remembly API",
    version: "1.0.0",
    status: "online",
  });
}