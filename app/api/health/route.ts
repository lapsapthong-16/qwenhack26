import { NextResponse } from "next/server";
import { databaseStatus, hasDatabase } from "../../../lib/database";

export const runtime = "nodejs";

export async function GET() {
  try {
    const database = await databaseStatus();
    return NextResponse.json({
      ok: true,
      service: "locksmith",
      storage: hasDatabase() ? "rds" : "local-json",
      database,
    });
  } catch {
    return NextResponse.json({ ok: false, service: "locksmith", storage: "rds", database: { configured: true, connected: false } }, { status: 503 });
  }
}
