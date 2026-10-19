import fs from "fs";
import path from "path";
import os from "os";

export let testDataDir: string;

beforeAll(() => {
  testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "fineprint-test-"));
  process.env.DATA_DIR_OVERRIDE = testDataDir;

  // Copy seed files into temp dir
  const seedDir = path.resolve(__dirname, "../../../seed");
  for (const file of fs.readdirSync(seedDir)) {
    if (file.endsWith(".json")) {
      fs.copyFileSync(path.join(seedDir, file), path.join(testDataDir, file));
    }
  }

  // Create empty log files
  fs.writeFileSync(path.join(testDataDir, "audit.jsonl"), "");
  fs.writeFileSync(path.join(testDataDir, "scraper_runs.jsonl"), "");
});

afterAll(() => {
  fs.rmSync(testDataDir, { recursive: true, force: true });
});
