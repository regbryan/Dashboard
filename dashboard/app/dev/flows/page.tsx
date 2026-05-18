import fs from "node:fs/promises";
import path from "node:path";
import DocViewer from "@/components/DocViewer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Flows · SocialPulse Dev Docs" };

/**
 * Renders every `.md` file in `docs/flows/` as a single concatenated
 * doc. New flow files (e.g. brand-page-experience.md) land in the
 * page automatically — no need to register each one.
 */
export default async function FlowsPage() {
  const flowsDir = path.join(process.cwd(), "docs", "flows");
  const files = await fs.readdir(flowsDir);
  const markdownFiles = files.filter((f) => f.endsWith(".md")).sort();

  const sections = await Promise.all(
    markdownFiles.map((file) =>
      fs.readFile(path.join(flowsDir, file), "utf-8")
    )
  );

  const combined = sections.join("\n\n---\n\n");
  return <DocViewer markdown={combined} />;
}
