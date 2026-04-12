export interface BrandMapping {
  tabName: string;
  slug: string;
  name: string;
  handle: string;
  platform: string;
  folderPath: string;
  postsSubfolder: string;
  colorPrimary: string | null;
  colorSecondary: string | null;
  colorAccent: string | null;
  cadence: string;
  hasBrandDoc: boolean;
  logoPath: string | null;
  logoPosition: string | null;
  logoMaxWidth: number | null;
  logoPadding: number | null;
  logoBgBlock: string | null;
}

export const BRANDS: BrandMapping[] = [
  {
    tabName: "Inland Empire Comfort",
    slug: "iec",
    name: "Inland Empire Comfort",
    handle: "@inlandempirecomfort",
    platform: "instagram",
    folderPath: "Inland Empire Comfort",
    postsSubfolder: "iec-posts",
    colorPrimary: "#104B94",
    colorSecondary: "#87ABCF",
    colorAccent: "#DB222A",
    cadence: "2x/week (Tu/Th)",
    hasBrandDoc: true,
    logoPath: null,
    logoPosition: null,
    logoMaxWidth: null,
    logoPadding: null,
    logoBgBlock: null,
  },
  {
    tabName: "Omega Mortgage",
    slug: "omega",
    name: "Omega Mortgage Group",
    handle: "@omglending",
    platform: "instagram",
    folderPath: "Omega Mortgage Group",
    postsSubfolder: "posts",
    colorPrimary: "#005181",
    colorSecondary: "#FEFEFE",
    colorAccent: "#FDD314",
    cadence: "3x/week (M/W/F)",
    hasBrandDoc: true,
    logoPath: "cutouts/Omega-logofullcolor-transparent-full.png",
    logoPosition: "top-left",
    logoMaxWidth: 0.30,
    logoPadding: 40,
    logoBgBlock: null,
  },
  {
    tabName: "Blitz Organization",
    slug: "blitz",
    name: "Blitz Organization",
    handle: "@blitzyourspace",
    platform: "instagram",
    folderPath: "Blitz Organization",
    postsSubfolder: "posts",
    colorPrimary: "#ECB7B9",
    colorSecondary: "#9CAF9C",
    colorAccent: "#DAD6CF",
    cadence: "2x/week (M/Th)",
    hasBrandDoc: true,
    logoPath: null,
    logoPosition: null,
    logoMaxWidth: null,
    logoPadding: null,
    logoBgBlock: null,
  },
  {
    tabName: "Cyber Safety Cop",
    slug: "csc",
    name: "Cyber Safety Cop",
    handle: "@cybersafetycop",
    platform: "instagram",
    folderPath: "Cyber Safety Cop",
    postsSubfolder: "posts",
    colorPrimary: null,
    colorSecondary: null,
    colorAccent: null,
    cadence: "2x/month",
    hasBrandDoc: true,
    logoPath: "cutouts/CSC-logo-newer.png",
    logoPosition: "top-left",
    logoMaxWidth: 0.25,
    logoPadding: 30,
    logoBgBlock: null,
  },
  {
    tabName: "Stephanie Perez",
    slug: "stephanie",
    name: "Stephanie Perez",
    handle: "@stephanieperezhomeloans",
    platform: "instagram",
    folderPath: "Stephanie Perez",
    postsSubfolder: "posts",
    colorPrimary: "#B69D81",
    colorSecondary: "#3B3526",
    colorAccent: "#545454",
    cadence: "3x/week (M/W/F)",
    hasBrandDoc: true,
    logoPath: null,
    logoPosition: null,
    logoMaxWidth: null,
    logoPadding: null,
    logoBgBlock: null,
  },
  {
    tabName: "SC Boardwalk Crew",
    slug: "scboardwalk",
    name: "SC Boardwalk Crew",
    handle: "@beachboardwalkjobs",
    platform: "instagram",
    folderPath: "SC Boardwalk Crew",
    postsSubfolder: "posts",
    colorPrimary: null,
    colorSecondary: null,
    colorAccent: null,
    cadence: "3x/week (Tu/Th/Sa)",
    hasBrandDoc: false,
    logoPath: null,
    logoPosition: null,
    logoMaxWidth: null,
    logoPadding: null,
    logoBgBlock: null,
  },
  {
    tabName: "Riverside Hat Co",
    slug: "riverside",
    name: "Riverside Hat Co",
    handle: "@riversidehatco",
    platform: "instagram",
    folderPath: "Riverside Hat Co",
    postsSubfolder: "posts",
    colorPrimary: null,
    colorSecondary: null,
    colorAccent: null,
    cadence: "2x/week (W/Sa)",
    hasBrandDoc: false,
    logoPath: null,
    logoPosition: null,
    logoMaxWidth: null,
    logoPadding: null,
    logoBgBlock: null,
  },
  {
    tabName: "Doug Mitchell",
    slug: "doug",
    name: "Doug Mitchell",
    handle: "doug-mitchell-esq",
    platform: "linkedin",
    folderPath: "Doug Mitchell",
    postsSubfolder: "posts",
    colorPrimary: null,
    colorSecondary: null,
    colorAccent: null,
    cadence: "3x/week (M/W/F)",
    hasBrandDoc: false,
    logoPath: null,
    logoPosition: null,
    logoMaxWidth: null,
    logoPadding: null,
    logoBgBlock: null,
  },
];

/**
 * Look up a brand by tab name. Strips parenthetical suffixes before matching.
 * E.g., "Doug Mitchell (LinkedIn)" -> strips " (LinkedIn)" -> matches "Doug Mitchell".
 */
export function findBrandByTabName(tabName: string): BrandMapping | undefined {
  const stripped = tabName.replace(/\s*\(.*\)\s*$/, "").trim();
  return BRANDS.find(
    (b) => b.tabName === stripped || b.tabName === tabName
  );
}
