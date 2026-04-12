import path from "node:path";

// process.cwd() is the dashboard/ directory when running Next.js dev server
// PROJECT_ROOT is one level up (the Instagram Automation directory)
export const PROJECT_ROOT = path.resolve(process.cwd(), "..");

export function brandFolderPath(folderPath: string): string {
  return path.join(PROJECT_ROOT, folderPath);
}

export function postImagePath(folderPath: string, filePath: string): string {
  return path.join(PROJECT_ROOT, folderPath, filePath);
}
