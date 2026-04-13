import path from "node:path";
import fs from "node:fs";

// Resolve PROJECT_ROOT reliably regardless of where Next.js sets cwd.
// We know the dashboard/ folder contains this file's source, and PROJECT_ROOT
// is the parent of dashboard/. Use __dirname (works in Turbopack server bundles)
// or fall back to walking up from cwd looking for our known marker files.
function findProjectRoot(): string {
  // Strategy 1: This file is at dashboard/lib/paths.ts — go up 2 levels
  // But __dirname may not be reliable in bundled environments.

  // Strategy 2: Walk up from cwd looking for the calendar file or brand folders
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    // Check if this looks like the Instagram Automation root
    if (
      fs.existsSync(path.join(dir, "remotion")) &&
      fs.existsSync(path.join(dir, "overlay_logo.py"))
    ) {
      return dir;
    }
    // Check if dashboard/ is here (meaning we're at the project root)
    if (
      fs.existsSync(path.join(dir, "dashboard")) &&
      fs.existsSync(path.join(dir, "overlay_logo.py"))
    ) {
      return dir;
    }
    // Go up one level
    const parent = path.dirname(dir);
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }

  // Fallback: assume cwd is the project root (works when cwd is Instagram Automation/)
  return process.cwd();
}

export const PROJECT_ROOT = findProjectRoot();

export function brandFolderPath(folderPath: string): string {
  return path.join(PROJECT_ROOT, folderPath);
}

export function postImagePath(folderPath: string, filePath: string): string {
  return path.join(PROJECT_ROOT, folderPath, filePath);
}
