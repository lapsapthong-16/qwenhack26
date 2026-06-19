#!/usr/bin/env node
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { reviewDependencies } from "../lib/locksmith.ts";

const color = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code, text) => color ? `\x1b[${code}m${text}\x1b[0m` : text;
const verdictStyle = {
  Allow: ["32;1", "✓"],
  Review: ["33;1", "!"],
  Block: ["31;1", "×"],
};
const logo = () => {
  const lock = ["   ╭────╮", "  ╱      ╲", " ║  ╭──╮  ║", " ║  ╰╮╭╯  ║", " ╰───╯╰───╯"];
  const word = [
    "█   █▀▀ █▀▀ █ █ █▀▀ █▄█ █ ▀█▀ █ █",
    "█   █ █ █   █▀▄ ▀▀█ █ █ █  █  █▀█",
    "▀▀▀ ▀▀▀ ▀▀▀ ▀ ▀ ▀▀▀ ▀ ▀ ▀  ▀  ▀ ▀",
  ];
  console.log();
  console.log(`${paint("36;1", lock[0])}   ${paint("36;1", word[0])}`);
  console.log(`${paint("36;1", lock[1])}   ${paint("36;1", word[1])}`);
  console.log(`${paint("34;1", lock[2])}   ${paint("34;1", word[2])}`);
  console.log(paint("34;1", lock[3]));
  console.log(`${paint("34;1", lock[4])}   ${paint("2", "DEPENDENCY CHANGES, PUT ON TRIAL.")}`);
};

const [, , command, target = "."] = process.argv;
if (command !== "scan") {
  console.error("Usage: node bin/locksmith.mjs scan [project-directory]");
  process.exitCode = 1;
} else {
  const root = resolve(target);
  const names = ["package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "requirements.txt", "pyproject.toml"];
  const files = {};

  if (!(await stat(root)).isDirectory()) throw new Error(`${root} is not a directory`);
  await Promise.all(names.map(async (name) => {
    try { files[name] = await readFile(resolve(root, name), "utf8"); } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }));
  if (!Object.keys(files).length) throw new Error("No supported dependency files found");

  logo();
  console.log(`\n${paint("2", "╭─ SCAN CONTEXT " + "─".repeat(43))}`);
  console.log(`${paint("2", "│")} ${paint("1", "Target")}  ${root}`);
  console.log(`${paint("2", "│")} ${paint("1", "Files ")}  ${Object.keys(files).join(", ")}`);
  console.log(paint("2", "╰" + "─".repeat(58)));
  console.log(`\n${paint("36;1", "● PANEL")}  Six specialist agents reviewing this state\n`);

  const result = await reviewDependencies({ files });
  for (const finding of result.findings) {
    const [code, icon] = verdictStyle[finding.verdict];
    console.log(`${paint(code, icon)}  ${paint("1", finding.role.padEnd(9))} ${paint(code, finding.verdict.toUpperCase().padEnd(6))} ${paint("2", "│")} ${finding.summary}`);
  }

  const [code, icon] = verdictStyle[result.verdict];
  console.log(`\n${paint(code, "╭" + "─".repeat(58))}`);
  console.log(`${paint(code, "│")} ${paint(code, `${icon} VERDICT: ${result.verdict.toUpperCase()}`)}`);
  console.log(`${paint(code, "│")} ${result.remediation}`);
  console.log(`${paint(code, "╰" + "─".repeat(58))}`);
  console.log(`${paint("2", "State ")} ${result.dependencyStateId}`);
  console.log(`${paint("2", "Engine")} ${result.model} ${paint("33", `[${result.mode.toUpperCase()}]`)}\n`);
}
