import fs from "node:fs/promises";
import path from "node:path";
import DocViewer from "@/components/DocViewer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Architecture · SocialPulse Dev Docs" };

export default async function ArchitecturePage() {
  const markdown = await fs.readFile(
    path.join(process.cwd(), "docs", "architecture.md"),
    "utf-8"
  );
  return <DocViewer markdown={markdown} />;
}
