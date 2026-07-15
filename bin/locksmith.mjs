#!/usr/bin/env node
import { guardedNpmInstall } from "../lib/npmInstall.ts";

const [, , tool, command, ...args] = process.argv;

if (tool !== "npm" || command !== "install") {
  console.error("Usage: locksmith npm install [package names and npm options]");
  process.exitCode = 1;
} else {
  const outcome = await guardedNpmInstall({ args });
  if (outcome.review) {
    console.log(`\nLocksmith verdict: ${outcome.review.result.verdict}`);
    console.log(`Dependency state: ${outcome.review.result.dependencyStateId}`);
    console.log(`Workspace status: ${outcome.review.reused ? "exact local decision reused" : "new review required"}`);
    console.log(`Baseline meaning: comparison context only; it never authorizes a changed dependency state.`);
    console.log(`Report: ${outcome.review.reportPath}`);
  }
  console.log(outcome.message);
  process.exitCode = outcome.code;
}
