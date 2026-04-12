import { globSync } from "glob";
import path from "node:path";
import { PROJECT_ROOT } from "./paths";

export function getVersionHistory(
  brandFolderPath: string,
  filePath: string
): string[] {
  if (!filePath) return [];

  const subfolder = path.dirname(filePath);
  const basename = path.basename(filePath);
  const ext = path.extname(basename);

  // Extract the base version pattern from filenames like:
  // v5_06_myth_busted.png, v5_06b_myth_busted.png, v5_06f_myth_busted.png
  // Base pattern is "v5_06" — everything up to (but not including) trailing letter(s) before the first underscore after the version number
  const match = basename.match(/^(v\d+_\d+)/);
  if (!match) return [];

  const baseVersion = match[1];

  // Glob for all versions with the same base pattern
  const globPattern = `${PROJECT_ROOT}/${brandFolderPath}/${subfolder}/${baseVersion}*${ext}`
    .split(path.sep)
    .join("/");

  const matches = globSync(globPattern);

  // Convert to relative paths (relative to brand folder)
  const brandRoot = path.join(PROJECT_ROOT, brandFolderPath);
  const relativePaths = matches
    .map((absPath) => path.relative(brandRoot, absPath).split(path.sep).join("/"))
    .sort();

  return relativePaths;
}
