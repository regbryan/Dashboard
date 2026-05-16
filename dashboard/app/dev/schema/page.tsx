import fs from "node:fs/promises";
import path from "node:path";
import DocViewer from "@/components/DocViewer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Schema · SocialPulse Dev Docs" };

export default async function SchemaPage() {
  const markdown = await fs.readFile(
    path.join(process.cwd(), "docs", "schema", "README.md"),
    "utf-8"
  );
  return <DocViewer markdown={markdown} />;
}
