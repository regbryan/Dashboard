import fs from "node:fs/promises";
import path from "node:path";
import DocViewer from "@/components/DocViewer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Flows · SocialPulse Dev Docs" };

export default async function FlowsPage() {
  const markdown = await fs.readFile(
    path.join(process.cwd(), "docs", "flows", "onboarding-to-publish.md"),
    "utf-8"
  );
  return <DocViewer markdown={markdown} />;
}
