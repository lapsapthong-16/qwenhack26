import { NextResponse } from "next/server";
import { readHistory } from "../../../lib/reviewHistory";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await readHistory());
}
