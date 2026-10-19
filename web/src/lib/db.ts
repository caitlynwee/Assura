/**
 * db.ts — JSON file database layer.
 *
 * Rules:
 * - The web backend is the ONLY writer. Never write from client components.
 * - All writes are atomic: write to a temp file, then fs.rename().
 * - All paths resolve to the shared /data directory at the repo root.
 */

import fs from "fs";
import path from "path";

const DATA_DIR =
  process.env.DATA_DIR_OVERRIDE ??
  path.resolve(process.cwd(), "../data");

function resolvePath(filename: string): string {
  return path.join(DATA_DIR, filename);
}

function resolveTempPath(filename: string): string {
  return path.join(DATA_DIR, `.${filename}.tmp`);
}

// ─── JSON files ───────────────────────────────────────────────────────────────

export function readJSON<T>(filename: string): T {
  const filePath = resolvePath(filename);
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

export function writeJSON<T>(filename: string, data: T): void {
  const filePath = resolvePath(filename);
  const tempPath = resolveTempPath(filename);
  const json = JSON.stringify(data, null, 2);
  fs.writeFileSync(tempPath, json, "utf-8");
  fs.renameSync(tempPath, filePath); // atomic on POSIX
}

// ─── JSONL files (append-only) ────────────────────────────────────────────────

export function appendJSONL(filename: string, entry: unknown): void {
  const filePath = resolvePath(filename);
  const line = JSON.stringify(entry) + "\n";
  fs.appendFileSync(filePath, line, "utf-8");
}

export function readJSONL<T>(filename: string): T[] {
  const filePath = resolvePath(filename);
  const raw = fs.readFileSync(filePath, "utf-8");
  return raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as T);
}

// ─── Convenience helpers ──────────────────────────────────────────────────────

export function dataFileExists(filename: string): boolean {
  return fs.existsSync(resolvePath(filename));
}
