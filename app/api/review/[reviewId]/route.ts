import { NextResponse } from "next/server";
import { getReviewJob } from "../../../../lib/reviewJobs";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ reviewId: string }> }) {
  const { reviewId } = await params;
  const job = getReviewJob(reviewId);
  if (!job) return NextResponse.json({ error: "Review job expired. Start a new scan." }, { status: 404 });
  return NextResponse.json(job);
}
