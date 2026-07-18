import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/billing/demo-mode";

export async function GET() {
  return NextResponse.json({ enabled: isDemoMode() });
}
