import fs from "fs";
import path from "path";
import os from "os";

// Must run before any module import captures DATA_DIR (db.ts reads
// process.env.DATA_DIR_OVERRIDE at import time). setupFilesAfterEnv runs this
// file body before the test module graph is loaded, so the override is set in
// time; seeding/cleanup stay in hooks.
export const testDataDir: string = fs.mkdtempSync(
  path.join(os.tmpdir(), "fineprint-test-")
);
process.env.DATA_DIR_OVERRIDE = testDataDir;

beforeAll(() => {
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
