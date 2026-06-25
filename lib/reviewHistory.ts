import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ReviewResult } from "./locksmith";

const historyPath = join(process.cwd(), ".locksmith", "reviews.json");

type HistoryFile = { reviews: ReviewResult[] };

export async function readHistory(): Promise<HistoryFile> {
  try {
    return JSON.parse(await readFile(historyPath, "utf8")) as HistoryFile;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return { reviews: [] };
    throw error;
  }
}

export async function saveReview(review: ReviewResult) {
  const history = await readHistory();
  const reviews = [review, ...history.reviews.filter(item => item.reviewId !== review.reviewId)].slice(0, 100);
  await mkdir(dirname(historyPath), { recursive: true });
  await writeFile(historyPath, JSON.stringify({ reviews }, null, 2));
}
