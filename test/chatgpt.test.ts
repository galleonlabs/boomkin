import { expect, test } from "bun:test";
import { chatGptArgs } from "../src/hermes.ts";

test("ChatGPT auth delegates to native fresh OAuth without a copied credential store", () => {
  expect(chatGptArgs("login")).toEqual(["auth", "add", "openai-codex", "--type", "oauth", "--no-browser"]);
  expect(chatGptArgs("status")).toEqual(["auth", "status", "openai-codex"]);
  expect(chatGptArgs("refresh")).toEqual(["auth", "refresh", "openai-codex"]);
  expect(chatGptArgs("model")).toEqual(["model"]);
  expect(() => chatGptArgs("invalid" as never)).toThrow("Choose");
});

test("unknown ChatGPT action and misplaced action fail without authentication", async () => {
  for (const args of [["chatgpt", "--action", "invalid", "--dry-run", "--directory", "/tmp/boomkin-chatgpt-test"], ["doctor", "--action", "login"]]) {
    const child = Bun.spawn([process.execPath, "src/cli.ts", ...args], { stdout: "pipe", stderr: "pipe" });
    expect(await child.exited).toBe(1);
  }
});
