import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { buildBot } from "../src/bot";
import { _resetPersistStore } from "../src/persist";
import { formatSuiteResult, parseBotSpecs, runSpecs } from "../src/toolkit/harness/run-specs";

const SPECS_DIR = join(process.cwd(), "tests", "specs");

describe("dialog specs (the publish gate replays these)", () => {
  it("every tests/specs/*.json spec passes against the real bot", async () => {
    if (!existsSync(SPECS_DIR)) return;
    const files = readdirSync(SPECS_DIR).filter((f) => f.endsWith(".json"));
    if (files.length === 0) return;
    const specs = files.flatMap((f) =>
      parseBotSpecs(JSON.parse(readFileSync(join(SPECS_DIR, f), "utf8"))),
    );
    const suite = await runSpecs(async () => {
      _resetPersistStore();
      return buildBot("123456:TEST");
    }, specs);
    expect(suite.failed, "\n" + formatSuiteResult(suite)).toBe(0);
  });
});
