#!/usr/bin/env node
// Writes .env by prompting for the key, so it never passes through shell
// quoting or lands in shell history. `echo 'KEY...' > .env` looks simple and
// breaks badly: a stray quote leaves the terminal hanging mid-string, and the
// key sits in ~/.zsh_history afterwards either way.

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const ENV_PATH = path.join(process.cwd(), ".env");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
// Resolve on close too, so an EOF (piped input, ctrl-D) ends the prompt
// instead of hanging on an await that can never settle.
const ask = (q) =>
  new Promise((resolve) => {
    rl.once("close", () => resolve(""));
    rl.question(q, resolve);
  });

if (fs.existsSync(ENV_PATH)) {
  const answer = await ask(".env already exists. Replace it? [y/N] ");
  if (answer.trim().toLowerCase() !== "y") {
    console.log("Left it alone.");
    rl.close();
    process.exit(0);
  }
}

console.log("\nPaste your Anthropic API key from console.anthropic.com → API Keys.");
const key = (await ask("Key: ")).trim();

if (!key) {
  console.error("\nNo key entered. Nothing written.");
  rl.close();
  process.exit(1);
}
if (!key.startsWith("sk-ant-")) {
  console.error(
    `\nThat does not look like an Anthropic API key (they start with "sk-ant-"). Nothing written.`,
  );
  rl.close();
  process.exit(1);
}

console.log(
  "\nWorkspace id — only needed if your key is identity-linked. Find it in the",
  "\nConsole address bar: platform.claude.com/workspaces/<THIS PART>/...",
  "\nPress enter to skip; the run will tell you if it turns out to be required.",
);
const workspace = (await ask("Workspace id (optional): ")).trim();

const lines = [`ANTHROPIC_API_KEY=${key}`];
if (workspace) lines.push(`ANTHROPIC_WORKSPACE_ID=${workspace}`);
fs.writeFileSync(ENV_PATH, lines.join("\n") + "\n", { mode: 0o600 });
rl.close();
console.log("\nWrote .env (readable only by you). It is gitignored.");
console.log("Next:  npm run extract -- <matter-folder>");
