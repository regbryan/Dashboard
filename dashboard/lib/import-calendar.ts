import fs from "node:fs";
import path from "node:path";
import { globSync } from "glob";
import * as XLSX from "xlsx";
import { getDb } from "./db";
import { PROJECT_ROOT } from "./paths";
import { findBrandByTabName, type BrandMapping } from "./brand-mapping";

function findCalendarFile(): string {
  const pattern = path.join(PROJECT_ROOT, "Social_Media_Calendar_*.xlsx");
  const matches = globSync(pattern.replace(/\\/g, "/"));
  if (matches.length === 0) {
    throw new Error(
      `No calendar file found matching Social_Media_Calendar_*.xlsx in ${PROJECT_ROOT}`
    );
  }

  // Pick most recently modified
  let newest = matches[0];
  let newestMtime = fs.statSync(matches[0]).mtimeMs;
  for (let i = 1; i < matches.length; i++) {
    const mtime = fs.statSync(matches[i]).mtimeMs;
    if (mtime > newestMtime) {
      newest = matches[i];
      newestMtime = mtime;
    }
  }
  return newest;
}

function upsertBrand(brand: BrandMapping): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO brands (id, name, handle, platform, folder_path, posts_subfolder,
        color_primary, color_secondary, color_accent, cadence, has_brand_doc,
        logo_path, logo_position, logo_max_width, logo_padding, logo_bg_block,
        created_at, updated_at)
     VALUES (@id, @name, @handle, @platform, @folderPath, @postsSubfolder,
        @colorPrimary, @colorSecondary, @colorAccent, @cadence, @hasBrandDoc,
        @logoPath, @logoPosition, @logoMaxWidth, @logoPadding, @logoBgBlock,
        @now, @now)
     ON CONFLICT(id) DO UPDATE SET
        name=excluded.name, handle=excluded.handle, platform=excluded.platform,
        folder_path=excluded.folder_path, posts_subfolder=excluded.posts_subfolder,
        color_primary=excluded.color_primary, color_secondary=excluded.color_secondary,
        color_accent=excluded.color_accent, cadence=excluded.cadence,
        has_brand_doc=excluded.has_brand_doc, logo_path=excluded.logo_path,
        logo_position=excluded.logo_position, logo_max_width=excluded.logo_max_width,
        logo_padding=excluded.logo_padding, logo_bg_block=excluded.logo_bg_block,
        updated_at=excluded.updated_at`
  ).run({
    id: brand.slug,
    name: brand.name,
    handle: brand.handle,
    platform: brand.platform,
    folderPath: brand.folderPath,
    postsSubfolder: brand.postsSubfolder,
    colorPrimary: brand.colorPrimary,
    colorSecondary: brand.colorSecondary,
    colorAccent: brand.colorAccent,
    cadence: brand.cadence,
    hasBrandDoc: brand.hasBrandDoc ? 1 : 0,
    logoPath: brand.logoPath,
    logoPosition: brand.logoPosition,
    logoMaxWidth: brand.logoMaxWidth,
    logoPadding: brand.logoPadding,
    logoBgBlock: brand.logoBgBlock,
    now,
  });
}

/** Column name mapping from Excel headers to our field names */
const HEADER_MAP: Record<string, string> = {
  "#": "post_number",
  "Date": "date",
  "Day": "day",
  "Platform": "platform",
  "Post Type": "post_type",
  "Content Pillar": "content_pillar",
  "Concept / Hook": "concept",
  "Caption": "caption",
  "Hashtags": "hashtags",
  "CTA": "cta",
  "Visual / Asset Direction": "visual_direction",
  "Status": "status_raw",
};

function findHeaderRow(sheetData: XLSX.WorkSheet): number {
  const rawRows: unknown[][] = XLSX.utils.sheet_to_json(sheetData, { header: 1 });
  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (Array.isArray(row) && row[0] === "#" && row[1] === "Date") {
      return i;
    }
  }
  return -1;
}

function parseSheet(
  sheetData: XLSX.WorkSheet,
  brandSlug: string
): number {
  const db = getDb();

  // Find the header row (sheets have title/description rows before headers)
  const headerIdx = findHeaderRow(sheetData);
  if (headerIdx < 0) return 0;

  // Re-read using the header row as column names by adjusting the range
  const range = XLSX.utils.decode_range(sheetData["!ref"] || "A1");
  range.s.r = headerIdx; // Start from header row
  sheetData["!ref"] = XLSX.utils.encode_range(range);
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheetData);
  const now = new Date().toISOString();

  const upsertPost = db.prepare(
    `INSERT INTO posts (brand_id, post_number, date, day, post_type, content_pillar,
        concept, caption, hashtags, cta, visual_direction, created_at, updated_at)
     VALUES (@brandId, @postNumber, @date, @day, @postType, @contentPillar,
        @concept, @caption, @hashtags, @cta, @visualDirection, @now, @now)
     ON CONFLICT(brand_id, post_number) DO UPDATE SET
        caption=excluded.caption, hashtags=excluded.hashtags, cta=excluded.cta,
        visual_direction=excluded.visual_direction, concept=excluded.concept,
        content_pillar=excluded.content_pillar, updated_at=excluded.updated_at`
  );

  let count = 0;
  for (const row of rows) {
    // Map Excel column names to our field names
    const mapped: Record<string, unknown> = {};
    for (const [excelHeader, fieldName] of Object.entries(HEADER_MAP)) {
      if (row[excelHeader] !== undefined) {
        mapped[fieldName] = row[excelHeader];
      }
    }

    const postNumber = Number(mapped.post_number);
    if (!postNumber || isNaN(postNumber)) continue;

    // Convert Excel date serial number to string if needed
    let dateStr: string | null = null;
    if (mapped.date != null) {
      if (typeof mapped.date === "number") {
        const parsed = XLSX.SSF.parse_date_code(mapped.date);
        dateStr = `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
      } else {
        dateStr = String(mapped.date);
      }
    }

    upsertPost.run({
      brandId: brandSlug,
      postNumber,
      date: dateStr,
      day: mapped.day != null ? String(mapped.day) : null,
      postType: mapped.post_type != null ? String(mapped.post_type) : null,
      contentPillar: mapped.content_pillar != null ? String(mapped.content_pillar) : null,
      concept: mapped.concept != null ? String(mapped.concept) : null,
      caption: mapped.caption != null ? String(mapped.caption) : null,
      hashtags: mapped.hashtags != null ? String(mapped.hashtags) : null,
      cta: mapped.cta != null ? String(mapped.cta) : null,
      visualDirection: mapped.visual_direction != null ? String(mapped.visual_direction) : null,
      now,
    });
    count++;
  }
  return count;
}

/**
 * Scan brand folders for existing post images and link them to DB records.
 * Files follow the pattern vX_NN_slug.png where NN = post_number.
 * For each post, finds the latest version file (highest vX, then latest letter suffix).
 */
function scanExistingFiles(): number {
  const db = getDb();
  const brands = db.prepare("SELECT id, folder_path, posts_subfolder FROM brands").all() as Array<{
    id: string;
    folder_path: string;
    posts_subfolder: string;
  }>;

  let linked = 0;

  for (const brand of brands) {
    const postsDir = path.join(PROJECT_ROOT, brand.folder_path, brand.posts_subfolder);
    if (!fs.existsSync(postsDir)) continue;

    // Find all versioned post files: vX_NN_*.png / .jpg / .jpeg
    const files = globSync(
      path.join(postsDir, "v*_*.*").replace(/\\/g, "/")
    ).map((f) => path.basename(f));

    // Group files by post number
    const byPostNumber = new Map<number, string[]>();
    for (const file of files) {
      // Match pattern: v{batch}_{postNumber}{optional_letter_suffix}_{slug}.{ext}
      const match = file.match(/^v(\d+)_(\d+)[a-z]*_/);
      if (!match) continue;
      const postNum = parseInt(match[2], 10);
      if (!byPostNumber.has(postNum)) byPostNumber.set(postNum, []);
      byPostNumber.get(postNum)!.push(file);
    }

    // For each post number, pick the latest version (highest batch, then latest suffix)
    const updateStmt = db.prepare(
      `UPDATE posts SET file_path = ?, version = ?, updated_at = ?
       WHERE brand_id = ? AND post_number = ? AND (file_path IS NULL OR file_path = '')`
    );

    for (const [postNum, postFiles] of byPostNumber) {
      // Sort: highest batch first, then alphabetically (letter suffixes sort naturally)
      postFiles.sort((a, b) => {
        const aMatch = a.match(/^v(\d+)_(\d+)([a-z]*)_/);
        const bMatch = b.match(/^v(\d+)_(\d+)([a-z]*)_/);
        if (!aMatch || !bMatch) return 0;
        const batchDiff = parseInt(bMatch[1]) - parseInt(aMatch[1]);
        if (batchDiff !== 0) return batchDiff;
        // Same batch — compare letter suffix (f > c > b > empty)
        return bMatch[3].localeCompare(aMatch[3]);
      });

      const latestFile = postFiles[0];
      const versionMatch = latestFile.match(/^(v\d+_\d+[a-z]*)/);
      const version = versionMatch ? versionMatch[1] : null;
      const relativePath = `${brand.posts_subfolder}/${latestFile}`;

      const result = updateStmt.run(
        relativePath,
        version,
        new Date().toISOString(),
        brand.id,
        postNum
      );
      if (result.changes > 0) linked++;
    }
  }

  return linked;
}

export function importCalendar(): { brands: number; posts: number; filesLinked: number } {
  const filePath = findCalendarFile();
  const workbook = XLSX.readFile(filePath);

  let brandCount = 0;
  let postCount = 0;

  for (const sheetName of workbook.SheetNames) {
    const brand = findBrandByTabName(sheetName);
    if (!brand) {
      continue; // Skip unknown tabs
    }

    upsertBrand(brand);
    brandCount++;

    const sheet = workbook.Sheets[sheetName];
    postCount += parseSheet(sheet, brand.slug);
  }

  // Scan disk for existing post images and link to DB records
  const filesLinked = scanExistingFiles();

  return { brands: brandCount, posts: postCount, filesLinked };
}
